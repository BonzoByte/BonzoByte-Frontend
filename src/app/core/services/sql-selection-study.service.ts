import { HttpClient } from '@angular/common/http';
import { inject, Injectable, InjectionToken } from '@angular/core';
import { map, Observable, shareReplay, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { isLocalSqlStudyEnabled, SqlSelectionStudy, validateSqlSelectionStudy } from '../models/sql-selection-study.model';

export const LOCAL_SQL_STUDY_ENABLED = new InjectionToken<boolean>('Local SQL selection study', {
  providedIn: 'root',
  factory: () => isLocalSqlStudyEnabled(environment.production, typeof location === 'undefined' ? '' : location.hostname),
});

@Injectable({ providedIn: 'root' })
export class SqlSelectionStudyService {
  private readonly http = inject(HttpClient);
  private readonly enabled = inject(LOCAL_SQL_STUDY_ENABLED);
  private study$?: Observable<SqlSelectionStudy>;

  getStudy(): Observable<SqlSelectionStudy> {
    if (!this.enabled) return throwError(() => new Error('SQL selection study is local development only.'));
    return this.study$ ??= this.http.get<unknown>('/research/simulation-min10-study.json').pipe(
      map(validateSqlSelectionStudy),
      shareReplay({ bufferSize: 1, refCount: true })
    );
  }
}
