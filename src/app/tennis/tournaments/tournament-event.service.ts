import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { TournamentEvent, TournamentEventApiResponse, TournamentEventDayApiResponse } from '../../core/models/tennis.model';

@Injectable({ providedIn: 'root' })
export class TournamentEventService {
  private apiUrl = `${environment.apiUrl}/tournamentevents`;

  constructor(private http: HttpClient) { }

  // ✅ Dohvat turnira za točno određeni dan (YYYYMMDD)
  getTournamentsByDate(dateStr: string): Observable<TournamentEventApiResponse> {
    console.log('📡 Calling' + `${this.apiUrl}/summaries/by-date/${dateStr}` + ' with:', dateStr);
    return this.http.get<TournamentEventApiResponse>(`${this.apiUrl}/summaries/by-date/${dateStr}`);
  }

  // ✅ NOVO: Dohvat turnira unutar vremenskog okvira (YYYY-MM-DD)
  getTournamentsByDateRange(from: string, to: string): Observable<TournamentEvent[]> {
    const url = `${this.apiUrl}/filter-by-date-range?from=${from}&to=${to}`;
    console.log('📡 Calling getTournamentsByDateRange with:', url);
    return this.http.get<TournamentEvent[]>(url);
  }

  // ✅ Dohvat prvog i zadnjeg datuma u kolekciji
  getDateRange(): Observable<{ minDate: string; maxDate: string }> {
    return this.http.get<{ minDate: string; maxDate: string }>(`${this.apiUrl}/daterange`);
  }

  // ✅ Dohvat svih dostupnih datuma (koristi se kod paginacije po danima)
  getAvailableDates(): Observable<string[]> {
    return this.http.get<string[]>(`${this.apiUrl}/available-dates`);
  }

  // ✅ Poseban endpoint za dane (odvojen model u backendu)
  getTournamentEventsByDay(date: string): Observable<TournamentEvent[]> {
    const eventDayUrl = `${environment.apiUrl}/tournamenteventdays/by-date/${date}`;
    return this.http.get<TournamentEventDayApiResponse>(eventDayUrl).pipe(
      map(res => res.tournaments)
    );
  }
}