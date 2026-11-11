export type NotificationScope = 'public' | 'private' | 'all';
export type NotificationEvent = { type: 'ready' | 'change'; scope: NotificationScope }
  | { type: 'end'; reason: 'auth' | 'retry' | 'disabled' };

/** Bounded UTF-8 SSE framing. Payloads are invalidation hints, never messages or counters. */
export class NotificationEventDecoder {
  private readonly decoder = new TextDecoder();
  private carry = '';
  private event = '';
  private data: string[] = [];
  private size = 0;
  constructor(private readonly receive: (event: NotificationEvent) => void) {}
  push(bytes: Uint8Array): void {
    if (bytes.byteLength > 65536) throw new Error('Notification chunk too large');
    this.carry += this.decoder.decode(bytes, { stream: true });
    let end: number;
    while ((end = this.carry.indexOf('\n')) !== -1) {
      const line = this.carry.slice(0, end).replace(/\r$/, ''); this.carry = this.carry.slice(end + 1);
      if (line.length > 16384) throw new Error('Notification line too large');
      if (!line) { this.dispatch(); continue; }
      if (line.startsWith(':')) continue;
      const split = line.indexOf(':'), field = split < 0 ? line : line.slice(0, split);
      const value = split < 0 ? '' : line.slice(split + 1).replace(/^ /, '');
      if (field === 'event') this.event = value;
      if (field === 'data') { this.size += value.length; if (this.size > 4096) throw new Error('Notification event too large'); this.data.push(value); }
    }
    if (this.carry.length > 16384) throw new Error('Notification line too large');
  }
  private dispatch(): void {
    const type = this.event, data = this.data.join('\n'); this.event = ''; this.data = []; this.size = 0;
    if (!data || !['ready', 'change', 'end'].includes(type)) return;
    const value: unknown = JSON.parse(data);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid notification event');
    const object = value as Record<string, unknown>;
    if (object['v'] !== 1 || Object.keys(object).length !== 2) throw new Error('Unsupported notification event');
    if ((type === 'ready' || type === 'change') && ['public', 'private', 'all'].includes(object['scope'] as string))
      this.receive({ type, scope: object['scope'] as NotificationScope });
    else if (type === 'end' && ['auth', 'retry', 'disabled'].includes(object['reason'] as string))
      this.receive({ type, reason: object['reason'] as 'auth' | 'retry' | 'disabled' });
    else throw new Error('Invalid notification event');
  }
}
