import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map, timeout } from 'rxjs';
import { environment } from '@env/environment';
import { MatchSummary } from '../models/match-summary';
import { parseMatchLinkId } from '../helpers/match-link';

@Injectable({ providedIn: 'root' })
export class MatchLinksService {
    constructor(private http: HttpClient) {}
    byCanonicalId(id: number): Observable<MatchSummary> { return this.read(id, 'canonical'); }
    byLegacyTPId(id: number): Observable<MatchSummary> { return this.read(id, 'legacy'); }
    private read(id: number, kind: 'canonical' | 'legacy'): Observable<MatchSummary> {
        if (parseMatchLinkId(id) === null) throw new Error('MATCH_LINK_INVALID_ID');
        return this.http.get<{ match: MatchSummary }>(`${environment.apiUrl}/match-links/${kind === 'legacy' ? 'legacy/' : ''}${id}`).pipe(
            timeout(25000), map(({ match }) => {
                if (!match || parseMatchLinkId(match.matchId) === null || parseMatchLinkId(match.matchTPId) === null ||
                    (kind === 'canonical' ? match.matchId : match.matchTPId) !== id)
                    throw new Error('MATCH_LINK_INVALID_IDENTITY');
                return match;
            }),
        );
    }
}
