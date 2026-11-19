import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, map, of, shareReplay } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ArchiveCoverage { fromDate: string; through: string; }
export function recentArchiveCoverage(value: unknown): ArchiveCoverage | null {
    if (!value || typeof value !== 'object') return null;
    const scope = (value as { archiveCoverage?: unknown }).archiveCoverage;
    if (!scope || typeof scope !== 'object') return null;
    const data = scope as Record<string, unknown>;
    const iso = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
        && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;
    return data['kind'] === 'recent-window' && iso(data['fromDate']) && iso(data['through'])
        && data['fromDate'] <= data['through']
        ? { fromDate: data['fromDate'], through: data['through'] } : null;
}

@Injectable({ providedIn: 'root' })
export class ArchiveCoverageService {
    readonly coverage$ = inject(HttpClient).get<unknown>(environment.apiBase + '/players/manifest').pipe(
        map(recentArchiveCoverage), catchError(() => of(null)),
        shareReplay({ bufferSize: 1, refCount: false })
    );
}
