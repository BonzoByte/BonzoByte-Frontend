/* eslint-disable @typescript-eslint/no-explicit-any */
import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Match, MatchApiResponse, MergedTrueSkillEntry, TrueSkillHistoryResponse } from '../../core/models/tennis.model';
import { map } from 'rxjs/operators';

@Injectable({
    providedIn: 'root'
})
export class MatchService {
    private apiUrl = environment.apiUrl;

    constructor(private http: HttpClient) { }

    getArchiveDateRange() {
        return this.http.get<{ minDate: string; maxDate: string }>(`${this.apiUrl}/archives/daterange`);
    }
    getArchiveAvailableDates() {
        return this.http.get<string[]>(`${this.apiUrl}/archives/available-dates`);
    }

    getMatchesByDate(dateStr: string): Observable<MatchApiResponse> {
        return this.http.get<MatchApiResponse>(`${this.apiUrl}/matches/summaries/by-date/${dateStr}`);
    }

    getMatchesByDateRange(from: string, to: string): Observable<Match[]> {
        return this.http.get<Match[]>(`${this.apiUrl}/matches/filter-by-date-range?from=${from}&to=${to}`);
    }

    getDateRange(): Observable<{ minDate: string; maxDate: string }> {
        return this.http.get<{ minDate: string; maxDate: string }>(`${this.apiUrl}/matches/daterange`);
    }

    getAvailableDates(): Observable<string[]> {
        return this.http.get<string[]>(`${this.apiUrl}/matches/available-dates`);
    }

    getMatchDetails(id: number) {
        return this.http.get<any>(`/api/archives/match-details/${id}`);
    }

    getTrueSkillHistory(player1TPId: number, player2TPId: number) {
        console.log(`${this.apiUrl}/trueskill/history?player1TPId=${player1TPId}&player2TPId=${player2TPId}`);
        return this.http.get<TrueSkillHistoryResponse>(`${this.apiUrl}/trueskill/history?player1TPId=${player1TPId}&player2TPId=${player2TPId}`);
    }

    getMergedTrueSkillHistory(player1TPId: number, player2TPId: number): Observable<MergedTrueSkillEntry[]> {
        console.log(`${this.apiUrl}/trueskill/history/merged?player1TPId=${player1TPId}&player2TPId=${player2TPId}`);
        return this.http.get<MergedTrueSkillEntry[]>(`${this.apiUrl}/trueskill/history/merged?player1TPId=${player1TPId}&player2TPId=${player2TPId}`);
    }

    getDailyMatchesByDate(dateStr: string): Observable<{ date: string; count: number; matches: Match[] }> {
        return this.http.get<{ date: string; count: number; matches: Match[] }>(
            `${this.apiUrl}/archives/daily/${dateStr}`
        );
    }
    getDailyMatches(dateStr: string) {
        return this.http
            .get<{ date: string; count: number; matches: Match[] }>(`${this.apiUrl}/archives/daily/${dateStr}`)
            .pipe(map(r => r.matches));
    }

    getLatestDailyDate(): Observable<{ date: string; iso: string; filename: string; dir: string; fullPath: string }> {
        return this.http.get<{ date: string; iso: string; filename: string; dir: string; fullPath: string }>(
            `${this.apiUrl}/archives/latest-daily`
        );
    }

    getDailyArchive(dateStr: string): Observable<{ date: string; count: number; matches: Match[] }> {
        return this.http.get<{ date: string; count: number; matches: Match[] }>(
            `${this.apiUrl}/archives/daily/${dateStr}`
        );
    }
}