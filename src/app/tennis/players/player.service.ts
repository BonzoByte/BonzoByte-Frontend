import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PlayerApiResponse } from '../../core/models/tennis.model';

@Injectable({ providedIn: 'root' })
export class PlayerService {
  private apiUrl = `${environment.apiUrl}/players`;

  constructor(private http: HttpClient) {}

  getPaginatedPlayers(
    page: number,
    pageSize: number,
    sortField: string,
    sortDirection: string,
    tournamentTypeIds: number[] = []
  ): Observable<PlayerApiResponse> {
    const params: Record<string, string> = {
      page: page.toString(),
      pageSize: pageSize.toString(),
      sortField,
      sortDirection
    };

    if (tournamentTypeIds.length > 0 && tournamentTypeIds.length < 2) {
      params['tournamentTypeIds'] = tournamentTypeIds.join(',');
    }

    return this.http.get<PlayerApiResponse>(`${this.apiUrl}/paginated`, { params });
  }
}