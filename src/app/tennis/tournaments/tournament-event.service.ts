import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { TournamentEvent, TournamentEventApiResponse, TournamentEventDayApiResponse } from '../../core/models/tennis.model';

@Injectable({ providedIn: 'root' })
export class TournamentEventService {
  private apiUrl = `${environment.apiUrl}/tournamentevents`;

  constructor(private http: HttpClient) { }

  // Fetch tournaments for one exact YYYYMMDD archive date.
  getTournamentsByDate(dateStr: string): Observable<TournamentEventApiResponse> {
    console.log('📡 Calling' + `${this.apiUrl}/summaries/by-date/${dateStr}` + ' with:', dateStr);
    return this.http.get<TournamentEventApiResponse>(`${this.apiUrl}/summaries/by-date/${dateStr}`);
  }

  // Fetch tournaments within an inclusive YYYY-MM-DD range.
  getTournamentsByDateRange(from: string, to: string): Observable<TournamentEvent[]> {
    const url = `${this.apiUrl}/filter-by-date-range?from=${from}&to=${to}`;
    console.log('📡 Calling getTournamentsByDateRange with:', url);
    return this.http.get<TournamentEvent[]>(url);
  }

  // Fetch the first and last archive dates in the collection.
  getDateRange(): Observable<{ minDate: string; maxDate: string }> {
    return this.http.get<{ minDate: string; maxDate: string }>(`${this.apiUrl}/daterange`);
  }

  // Fetch all available dates used by day-based pagination.
  getAvailableDates(): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiUrl}/available-dates`);
  }

  // Dedicated day endpoint backed by a separate backend model.
  getTournamentEventsByDay(date: string): Observable<TournamentEvent[]> {
    const eventDayUrl = `${environment.apiUrl}/tournamenteventdays/by-date/${date}`;
    return this.http.get<TournamentEventDayApiResponse>(eventDayUrl).pipe(
      map(res => res.tournaments)
    );
  }
}
