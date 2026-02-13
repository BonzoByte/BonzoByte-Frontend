/* eslint-disable @typescript-eslint/no-explicit-any */
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map, shareReplay, catchError, of, switchMap, throwError } from 'rxjs';
import { Match, TournamentIndex } from '../models/tennis.model';
import brotliDecompress from 'brotli/decompress';
import { MatchDetailsRaw } from '../models/match-details.model';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

export interface DailyArchiveIndex {
  minDate: string;
  maxDate?: string;
}

export interface DailyManifest extends DailyArchiveIndex {
  generatedAtUtc?: string;
  players?: {
    version: string;
    url: string;
    contentType?: string;
  };
}

export interface DailyManifestTournaments extends DailyArchiveIndex {
  generatedAtUtc?: string;
  tournaments?: {
    version: string;
    url: string;
    contentType?: string;
  };
  tournamentStrength?: {
    min: number | null;
    median: number | null;
    max: number | null;
  };
}

export interface DetailsLockedError {
  code: 'DETAILS_LOCKED';
  unlocksAt: string; // ISO
  lockHours: number;
}

@Injectable({ providedIn: 'root' })
export class StaticArchivesService {
  private mode = environment.archivesMode;
  private apiBase = environment.apiBase;
  private staticBase = environment.dailyStaticBase;

  private dailyStaticBase = `${this.staticBase}/daily`;
  private detailsStaticBase = `${this.staticBase}/matches`;
  private tsStaticBase = `${this.staticBase}/players/ts`;

  private readonly dailyIndex$: Observable<DailyArchiveIndex>;
  private readonly discoveredMaxDate$: Observable<string>;
  private readonly dailyManifest$: Observable<DailyManifest>;
  private readonly dailyManifestTournaments$: Observable<DailyManifestTournaments>;

  constructor(private http: HttpClient, private auth: AuthService) {
    if (this.mode === 'api') {
      // u api modu sve ide preko backend-a
      this.dailyIndex$ = this.getDateRange().pipe(
        map(r => ({ minDate: r.minDate, maxDate: r.maxDate } as DailyArchiveIndex)),
        shareReplay(1)
      );

      this.discoveredMaxDate$ = this.getDateRange().pipe(
        map(r => r.maxDate),
        shareReplay(1)
      );

      // manifesti u api modu nisu dostupni (dok ih ne dodamo na backend)
      this.dailyManifest$ = of({ minDate: '', maxDate: '' } as DailyManifest).pipe(shareReplay(1));
      this.dailyManifestTournaments$ = of({ minDate: '', maxDate: '' } as DailyManifestTournaments).pipe(shareReplay(1));
      return;
    }

    // static mode (CDN)
    this.dailyIndex$ = this.http
      .get<DailyArchiveIndex>(`${this.dailyStaticBase}/index.json`)
      .pipe(shareReplay(1));

    const cb = `cb=${Date.now()}`;

    this.dailyManifest$ = this.http
      .get<DailyManifest>(`${this.dailyStaticBase}/manifest.json?${cb}`)
      .pipe(shareReplay(1));

    this.dailyManifestTournaments$ = this.http
      .get<DailyManifestTournaments>(`${this.dailyStaticBase}/manifest.tournaments.json?${cb}`)
      .pipe(shareReplay(1));

    this.discoveredMaxDate$ = this.dailyIndex$.pipe(
      switchMap(idx => this.findLatestExistingDate(idx.minDate, this.todayISO())),
      shareReplay(1)
    );
  }

  /** Vrati najbliži dostupni datum (snap), ili null ako nema ništa */
  normalizeToAvailableDate(targetISO: string): Observable<string> {
    return this.getDailyIndex().pipe(
      switchMap(idx =>
        this.discoveredMaxDate$.pipe(
          map(max => {
            const t = this.toDayNumber(targetISO);
            const min = this.toDayNumber(idx.minDate)!;
            const mx = this.toDayNumber(max)!;

            if (t == null) return max;
            if (t < min) return idx.minDate;
            if (t > mx) return max;
            return targetISO;
          })
        )
      )
    );
  }

  getPrevAvailableDate(currentISO: string): Observable<string | null> {
    return this.getDailyIndex().pipe(
      map(idx => {
        const min = idx.minDate;
        if (this.toDayNumber(currentISO)! <= this.toDayNumber(min)!) return null;
        return this.addDaysISO(currentISO, -1);
      })
    );
  }

  getNextAvailableDate(currentISO: string): Observable<string | null> {
    return this.discoveredMaxDate$.pipe(
      map(max => {
        if (this.toDayNumber(currentISO)! >= this.toDayNumber(max)!) return null;
        return this.addDaysISO(currentISO, +1);
      })
    );
  }

  // --- postojeće metode getDaily/getDetails/decoder/mapLiteRowToMatch ostaju iste ---

  private toDayNumber(iso: string): number | null {
    // očekujemo "YYYY-MM-DD"
    if (!iso || iso.length < 10) return null;
    const y = Number(iso.slice(0, 4));
    const m = Number(iso.slice(5, 7));
    const d = Number(iso.slice(8, 10));
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;

    // UTC day number (stabilno, bez timezone pizdarija)
    const ms = Date.UTC(y, m - 1, d);
    return Math.floor(ms / 86400000);
  }

  getDailyIndex(): Observable<DailyArchiveIndex> {
    return this.dailyIndex$;
  }

  getDaily(yyyymmdd: string): Observable<Match[]> {
    if (this.mode === 'api') {
      return this.http
        .get<any>(`${this.apiBase}/daily/${yyyymmdd}`)
        .pipe(
          // backend može vratiti {matches: [...] } ili direktno [...]
          map(r => (Array.isArray(r) ? r : (r?.matches ?? []))),
          map(arr => (arr || []).map((m: any) => this.normalizeApiMatch(m)))
        );
    }

    // static mode (CDN .br)
    return this.http
      .get(`${this.dailyStaticBase}/${yyyymmdd}.br`, { responseType: 'arraybuffer' })
      .pipe(
        map(buf => this.decodeBrotliJson<any[]>(buf)),
        map(rows => (rows || []).map(r => this.mapLiteRowToMatch(r))),
        catchError((err: any) => {
          if (err instanceof HttpErrorResponse && err.status === 404) return of([]);
          const msg = String(err?.message ?? '');
          if (msg.includes('Got HTML instead of data')) return of([]);
          return throwError(() => err);
        })
      );
  }

  private normalizeApiMatch(m: any): Match {
    if (!m) return {} as Match;

    // ✅ daily archive (lite/minified) payload: l01, l02, ...
    if (m.l01 != null || m.l02 != null || m.l04 != null) {
      return this.mapLiteRowToMatch(m);
    }

    const dt = m?.dateTime ?? m?.DateTime ?? null;
    const dateTime =
      (typeof dt === 'string' && dt.trim().length > 0) ? dt : null;

    return {
      ...m,
      dateTime,
    } as Match;
  }

  getLatestDaily(): Observable<{ date: string; iso: string }> {
    return this.http.get<{ date: string; iso: string }>(`${this.apiBase}/latest-daily`);
  }

  getDateRange(): Observable<{ minDate: string; maxDate: string }> {
    return this.http.get<{ minDate: string; maxDate: string }>(`${this.apiBase}/daterange`);
  }

  getAvailableDates(): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiBase}/available-dates`);
  }

  getDetails(matchTPId: number | string): Observable<MatchDetailsRaw> {
    if (this.mode === 'api') {
      return this.http.get<MatchDetailsRaw>(`${this.apiBase}/match-details/${matchTPId}`);
    }

    return this.http
      .get(`${this.detailsStaticBase}/${matchTPId}.br`, { responseType: 'arraybuffer' as const })
      .pipe(map(buf => this.decodeBrotliJson<MatchDetailsRaw>(buf)));
  }

  getDetailsGuarded(match: Match, lockHours = 2): Observable<MatchDetailsRaw> {
    // finished -> always allowed
    if (match?.isFinished) {
      return this.getDetails(match.matchTPId);
    }

    const user = this.auth.getUser();
    const ent: any = (user as any)?.entitlements;
    const privileged = !!(user?.isAdmin || ent?.isPremium || ent?.hasTrial);

    if (privileged) {
      return this.getDetails(match.matchTPId);
    }

    // Free user: enforce lock window (2h before expected start)
    const unlocksAt = this.calcUnlocksAtIso(match, lockHours); // implement below

    // If now < unlocksAt -> locked
    if (unlocksAt && Date.now() < Date.parse(unlocksAt)) {
      return throwError(() => ({
        code: 'DETAILS_LOCKED',
        unlocksAt,
        lockHours,
      } as DetailsLockedError));
    }

    // unlocked -> allowed
    return this.getDetails(match.matchTPId);
  }

  private calcUnlocksAtIso(match: Match, lockHours: number): string | null {
    const dt = match?.dateTime ? new Date(match.dateTime) : null;
    if (!dt || isNaN(dt.getTime())) return null;

    const unlockMs = dt.getTime() - lockHours * 60 * 60 * 1000;
    return new Date(unlockMs).toISOString();
  }

  getPlayersIndex(): Observable<any[]> {
    if (this.mode === 'api') {
      return this.http.get<DailyManifest>(`${this.apiBase}/players/manifest`).pipe(
        switchMap(m => {
          const url = m.players?.url;
          if (!url) return throwError(() => new Error('players manifest missing players.url'));
          // url je npr: "players.index.v2026-02-06T12-30Z.br"
          return this.http.get(`${this.apiBase}/players/index/${url}`, { responseType: 'arraybuffer' });
        }),
        map(buf => this.decodeBrotliJson<any[]>(buf)),
        shareReplay(1)
      );
    }

    // static mode (CDN)
    return this.dailyManifest$.pipe(
      switchMap(m => {
        const url = m.players?.url;
        if (!url) return throwError(() => new Error('manifest.json missing players.url'));
        return this.http.get(`${this.dailyStaticBase}/${url}`, { responseType: 'arraybuffer' });
      }),
      map(buf => this.decodeBrotliJson<any[]>(buf)),
      shareReplay(1)
    );
  }

  private readonly utf8 = new TextDecoder('utf-8');

  private decodeBrotliJson<T>(buf: ArrayBuffer): T {
    const u8 = new Uint8Array(buf);

    const head = this.utf8.decode(u8.slice(0, 32)).trim().toLowerCase();

    if (head.includes('<!doctype') || head.includes('<html')) {
      throw new Error(`Got HTML instead of data. First bytes: ${head}`);
    }

    // već JSON?
    if (head.startsWith('{') || head.startsWith('[')) {
      return JSON.parse(this.utf8.decode(u8)) as T;
    }

    // brotli
    const dec = brotliDecompress(u8);
    return JSON.parse(this.utf8.decode(dec)) as T;
  }


  private mapLiteRowToMatch(r: any): Match {
    const isFinished =
      r?.l03 === true || r?.l03 === 1 || r?.l03 === '1' || r?.l03 === 'true';
    const p1 = this.asNum(r?.l31);
    const p2 = p1 != null ? Math.max(0, 100 - p1) : null;

    const probabilityText =
      (p1 != null && p2 != null) ? `${p1.toFixed(2)} - ${p2.toFixed(2)}` : null;

    const o1 = this.asNum(r?.l29);
    const o2 = this.asNum(r?.l30);
    const oddsText =
      (o1 != null && o2 != null) ? `${o1.toFixed(2)} - ${o2.toFixed(2)}` : null;

    return {
      matchTPId: this.asNum(r?.l01) as any,
      isFinished: isFinished as any,

      tournamentEventName: (r?.l04 ?? '').toString(),
      tournamentEventCountryISO2: (r?.l05 ?? '').toString(),
      tournamentEventCountryISO3: (r?.l06 ?? '').toString(),
      tournamentEventCountryFull: (r?.l07 ?? '').toString(),
      surface: (r?.l08 ?? '').toString(),
      tournamentLevelName: this.decodeLevel(r?.l09),
      tournamentTypeName: (r?.l10 ?? '').toString().trim(),
      tournamentStrengthMeanTS: this.asNum(r?.l11) as any,
      roundName: (r?.l12 ?? '').toString(),

      tournamentEventTPId: this.asNum(r?.l32) as any, // ✅ novo

      dateTime: r?.l02 ?? null,

      player1TPId: this.asNum(r?.l13) as any,
      player1Name: (r?.l14 ?? '').toString(),
      player1CountryISO2: (r?.l15 ?? '').toString(),
      player1CountryISO3: (r?.l16 ?? '').toString(),
      player1CountryFull: (r?.l17 ?? '').toString(),
      player1Rank: this.asNum(r?.l18) as any,
      player1Seed: this.asNum(r?.l19) as any,

      player2TPId: this.asNum(r?.l20) as any,
      player2Name: (r?.l21 ?? '').toString(),
      player2CountryISO2: (r?.l22 ?? '').toString(),
      player2CountryISO3: (r?.l23 ?? '').toString(),
      player2CountryFull: (r?.l24 ?? '').toString(),
      player2Rank: this.asNum(r?.l25) as any,
      player2Seed: this.asNum(r?.l26) as any,

      result: r?.l27 ?? null,
      resultDetails: r?.l28 ?? null,

      oddsText: oddsText as any,
      probabilityText: probabilityText as any,
    } as any as Match;
  }

  private asNum(v: any): number | null {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  private decodeLevel(v: any): string {
    const s = (v ?? '').toString().trim();
    return s.replace(/\u003E/g, '>').replace(/\u003C/g, '<');
  }

  private todayISO(): string {
    const now = new Date();
    const y = now.getUTCFullYear();
    const m = String(now.getUTCMonth() + 1).padStart(2, '0');
    const d = String(now.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private addDaysISO(iso: string, deltaDays: number): string {
    const t = this.toDayNumber(iso);
    if (t == null) return iso;
    const ms = (t + deltaDays) * 86400000;
    const dt = new Date(ms);
    const y = dt.getUTCFullYear();
    const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
    const d = String(dt.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  /** Provjera postoji li daily archive za dan (prefer HEAD; fallback može biti GET) */
  private dailyExists(iso: string): Observable<boolean> {
    const key = this.isoToCompact(iso);        // YYYYMMDD
    const url = `${this.dailyStaticBase}/${key}.br`;
    return this.http.head(url, { observe: 'response' }).pipe(
      map(() => true),
      catchError((err: HttpErrorResponse) => {
        if (err.status === 404) return of(false);
        return throwError(() => err);
      })
    );
  }

  private isoToCompact(iso: string): string {
    return iso.replace(/-/g, '');
  }

  /** Nađe najnoviji postojeći datum u [minDate..upperISO] */
  private findLatestExistingDate(minISO: string, upperISO: string): Observable<string> {
    const lo0 = this.toDayNumber(minISO);
    const hi0 = this.toDayNumber(upperISO);
    if (lo0 == null || hi0 == null) return of(upperISO);
    if (hi0 < lo0) return of(minISO);

    // binary search: zadnji true u rasponu
    const search = (lo: number, hi: number, best: number | null): Observable<string> => {
      if (lo > hi) {
        const finalDay = best ?? lo0; // ako ništa nije nađeno, vrati min
        const ms = finalDay * 86400000;
        const dt = new Date(ms);
        const y = dt.getUTCFullYear();
        const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
        const d = String(dt.getUTCDate()).padStart(2, '0');
        return of(`${y}-${m}-${d}`);
      }

      const mid = (lo + hi) >> 1;
      const ms = mid * 86400000;
      const dt = new Date(ms);
      const iso = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;

      return this.dailyExists(iso).pipe(
        switchMap(exists => {
          if (exists) return search(mid + 1, hi, mid);
          return search(lo, mid - 1, best);
        })
      );
    };

    return search(lo0, hi0, null);
  }

  getTournamentsIndex(): Observable<{
    items: TournamentIndex[];
    strength: { min: number | null; median: number | null; max: number | null } | null;
  }> {
    if (this.mode === 'api') {
      return this.http.get<DailyManifestTournaments>(`${this.apiBase}/tournaments/manifest`).pipe(
        switchMap(m => {
          const url = m.tournaments?.url;
          if (!url) return throwError(() => new Error('tournaments manifest missing tournaments.url'));

          return this.http.get(`${this.apiBase}/tournaments/index/${url}`, { responseType: 'arraybuffer' }).pipe(
            map(buf => {
              const items = this.decodeBrotliJson<TournamentIndex[]>(buf) ?? [];
              const strength = m.tournamentStrength ?? null;
              return { items, strength };
            })
          );
        }),
        shareReplay(1)
      );
    }

    // static mode (CDN)
    return this.dailyManifestTournaments$.pipe(
      switchMap(m => {
        const url = m.tournaments?.url;
        if (!url) return throwError(() => new Error('manifest.tournaments.json missing tournaments.url'));

        return this.http.get(`${this.dailyStaticBase}/${url}`, { responseType: 'arraybuffer' }).pipe(
          map(buf => {
            const items = this.decodeBrotliJson<TournamentIndex[]>(buf) ?? [];
            const strength = m.tournamentStrength ?? null;
            return { items, strength };
          })
        );
      }),
      shareReplay(1)
    );
  }

  getTsHistory(playerTPId: number | string): Observable<any> {
    if (this.mode === 'api') {
      return this.http.get<any>(`${this.apiBase}/ts/${playerTPId}`);
    }

    return this.http
      .get(`${this.tsStaticBase}/${playerTPId}.br`, { responseType: 'arraybuffer' as const })
      .pipe(map(buf => this.decodeBrotliJson<any>(buf)));
  }

  getPlayerPhotoUrl(playerTPId: number): string {
    return `${environment.apiUrl}/api/archives/players/photo/${playerTPId}`;
  }

  getDefaultPlayerPhotoUrl(gender: 'M' | 'W'): string {
    return `${environment.apiBase}/players/photo/photo${gender}.jpg`;
  }
}