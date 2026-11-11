import { DOCUMENT } from '@angular/common';
import { Inject, Injectable, InjectionToken, NgZone, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { environment } from '../../../environments/environment';
import { getAccessToken } from '../auth-token-storage';
import { NotificationEvent, NotificationEventDecoder, NotificationScope } from '../helpers/notification-events';
import { AuthService } from './auth.service';
import { DiscussionsService } from './discussions.service';
import { PrivateMessagesService } from './private-messages.service';

export const NOTIFICATION_FETCH = new InjectionToken<typeof fetch>('notification fetch', { providedIn: 'root', factory: () => (input, init) => globalThis.fetch(input, init) });
export const NOTIFICATION_TOKEN = new InjectionToken<() => string | null>('notification token', { providedIn: 'root', factory: () => getAccessToken });
export const NOTIFICATION_TIMING = new InjectionToken<{ idleMS: number; retryMS: number; retryMaxMS: number; refreshMS: number; coalesceMS: number }>('notification timing',
  { providedIn: 'root', factory: () => ({ idleMS: 45000, retryMS: 1000, retryMaxMS: 30000, refreshMS: 2000, coalesceMS: 120 }) });
interface Session { id: string; token: string; disabled: boolean; }
interface Connection { session: Session; controller: AbortController; reader?: ReadableStreamDefaultReader<Uint8Array>; idle?: number; }

/** App-level opt-in provider. One authenticated connection; only summary GETs run on hints. */
@Injectable()
export class NotificationStreamService implements OnDestroy {
  private readonly view: Window | null;
  private started = false;
  private subscriptions?: Subscription;
  private session?: Session;
  private connection?: Connection;
  private retryTimer?: number;
  private refreshTimer?: number;
  private failures = 0;
  private dirty = new Set<'public' | 'private'>();
  private lastRefresh = -Infinity;
  constructor(private readonly auth: AuthService, private readonly discussions: DiscussionsService,
    private readonly privateMessages: PrivateMessagesService, private readonly zone: NgZone,
    @Inject(DOCUMENT) private readonly document: Document, @Inject(NOTIFICATION_FETCH) private readonly fetcher: typeof fetch,
    @Inject(NOTIFICATION_TOKEN) private readonly token: () => string | null, @Inject(NOTIFICATION_TIMING) private readonly timing: { idleMS: number; retryMS: number; retryMaxMS: number; refreshMS: number; coalesceMS: number }) {
    this.view = document.defaultView;
  }
  start(): void {
    if (this.started || !this.view || environment.billingLab) return;
    this.started = true; this.subscriptions = new Subscription();
    this.subscriptions.add(this.auth.user$.subscribe(() => this.synchronize()));
    if (this.auth.authChanged$) this.subscriptions.add(this.auth.authChanged$.subscribe(() => this.synchronize()));
    this.zone.runOutsideAngular(() => {
      this.view!.addEventListener('online', this.online);
      this.document.addEventListener('visibilitychange', this.visibility);
    });
  }
  stop(): void {
    this.started = false; this.subscriptions?.unsubscribe(); this.subscriptions = undefined;
    this.view?.removeEventListener('online', this.online); this.document.removeEventListener('visibilitychange', this.visibility);
    this.session = undefined; this.cancel();
  }
  ngOnDestroy(): void { this.stop(); }
  private readonly online = () => { if (this.session && !this.connection && !this.session.disabled) this.connectSoon(this.session, 0); };
  private readonly visibility = () => {
    const session = this.session;
    if (!this.started || !session || this.document.visibilityState === 'hidden' || session.disabled) return;
    // Catch a response cancelled while entering the background. This never fetches comments or acknowledges reading.
    this.scheduleRefresh(session, 'all');
    if (!this.connection) this.connectSoon(session, 0);
  };
  private synchronize(): void {
    const user = this.auth.getUser(), token = this.token();
    if (!user?._id || user.isVerified !== true || !token) { this.session = undefined; this.cancel(); return; }
    if (this.session?.id === user._id && this.session.token === token) return;
    this.cancel(); this.failures = 0; this.lastRefresh = -Infinity;
    const session: Session = { id: user._id, token, disabled: false }; this.session = session;
    this.zone.runOutsideAngular(() => { void this.connect(session); });
  }
  private current(connection: Connection): boolean { return this.started && this.session === connection.session && this.connection === connection; }
  private cancel(): void {
    this.view?.clearTimeout(this.retryTimer); this.view?.clearTimeout(this.refreshTimer); this.retryTimer = this.refreshTimer = undefined; this.dirty.clear();
    const connection = this.connection; this.connection = undefined;
    if (connection) { this.view?.clearTimeout(connection.idle); connection.controller.abort(); void connection.reader?.cancel().catch(() => {}); }
  }
  private armIdle(connection: Connection): void {
    this.view!.clearTimeout(connection.idle);
    connection.idle = this.view!.setTimeout(() => { if (this.current(connection)) { connection.controller.abort(); void connection.reader?.cancel().catch(() => {}); } }, this.timing.idleMS);
  }
  private async connect(session: Session): Promise<void> {
    if (!this.started || this.session !== session || session.disabled || this.connection) return;
    const connection: Connection = { session, controller: new AbortController() }; this.connection = connection; this.armIdle(connection);
    let retryAfter = 0;
    try {
      const response = await this.fetcher(environment.apiUrl.replace(/\/$/, '') + '/notifications/stream', {
        method: 'GET', headers: { Authorization: `Bearer ${session.token}`, Accept: 'text/event-stream' },
        cache: 'no-store', credentials: 'include', signal: connection.controller.signal
      });
      if (!this.current(connection)) { void response.body?.cancel().catch(() => {}); return; }
      if ([401, 403, 404, 405, 501].includes(response.status)) {
        // Unsupported/unauthorized streaming must not break the ordinary polling/auth flow.
        session.disabled = true; void response.body?.cancel().catch(() => {}); return;
      }
      retryAfter = Math.min(this.timing.retryMaxMS, Math.max(0, Number(response.headers.get('retry-after')) * 1000 || 0));
      if (response.status !== 200 || !response.headers.get('content-type')?.toLowerCase().startsWith('text/event-stream') || !response.body) {
        void response.body?.cancel().catch(() => {}); throw new Error('Notification stream unavailable');
      }
      const decoder = new NotificationEventDecoder(event => this.event(connection, event));
      connection.reader = response.body.getReader();
      while (this.current(connection) && !session.disabled) {
        const part = await connection.reader.read();
        if (!this.current(connection) || part.done) break;
        this.armIdle(connection); decoder.push(part.value);
      }
    } catch { /* Existing read APIs/polling remain available; no user action is replayed. */ }
    finally {
      this.view!.clearTimeout(connection.idle); void connection.reader?.cancel().catch(() => {});
      if (this.current(connection)) {
        this.connection = undefined;
        if (!session.disabled) {
          const delay = Math.max(retryAfter, Math.min(this.timing.retryMaxMS, this.timing.retryMS * 2 ** Math.min(this.failures++, 5)));
          this.connectSoon(session, delay);
        }
      }
    }
  }
  private event(connection: Connection, event: NotificationEvent): void {
    if (!this.current(connection)) return;
    if (event.type === 'end') {
      if (event.reason !== 'retry') connection.session.disabled = true;
      if (event.reason === 'auth' && this.token() === connection.session.token && this.auth.getUser()?._id === connection.session.id)
        this.zone.run(() => this.auth.forceClearSession());
      connection.controller.abort(); void connection.reader?.cancel().catch(() => {}); return;
    }
    this.failures = 0; this.scheduleRefresh(connection.session, event.scope);
  }
  private connectSoon(session: Session, delay: number): void {
    this.view!.clearTimeout(this.retryTimer);
    this.retryTimer = this.view!.setTimeout(() => { this.retryTimer = undefined; void this.connect(session); }, delay);
  }
  private scheduleRefresh(session: Session, scope: NotificationScope): void {
    if (scope !== 'private') this.dirty.add('public'); if (scope !== 'public') this.dirty.add('private');
    if (this.refreshTimer !== undefined) return;
    const wait = Math.max(this.timing.coalesceMS, Math.min(this.timing.refreshMS, this.timing.refreshMS - (performance.now() - this.lastRefresh)));
    this.refreshTimer = this.view!.setTimeout(() => {
      this.refreshTimer = undefined;
      if (!this.started || this.session !== session) return;
      const pending = new Set(this.dirty); this.dirty.clear(); this.lastRefresh = performance.now();
      this.zone.run(() => {
        if (pending.has('public')) this.discussions.refreshNotificationSummary();
        if (pending.has('private')) this.privateMessages.refreshSummary(true);
      });
    }, wait);
  }
}
