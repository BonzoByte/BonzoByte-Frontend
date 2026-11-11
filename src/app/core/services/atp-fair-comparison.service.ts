import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable, shareReplay, throwError } from 'rxjs';
import { AtpFairComparison, validateAtpFairComparison } from '../models/atp-fair-comparison.model';
import { LOCAL_SQL_STUDY_ENABLED } from './sql-selection-study.service';

@Injectable({ providedIn: 'root' })
export class AtpFairComparisonService {
  private readonly http = inject(HttpClient);
  private readonly enabled = inject(LOCAL_SQL_STUDY_ENABLED);
  private report$?: Observable<AtpFairComparison>;

  getComparison(): Observable<AtpFairComparison> {
    if (!this.enabled) return throwError(() => new Error('ATP fair comparison is local development only.'));
    return this.report$ ??= this.http.get<unknown>('/research/atp-fair-comparison.json').pipe(
      map(validateAtpFairComparison),
      shareReplay({ bufferSize: 1, refCount: true })
    );
  }
}
