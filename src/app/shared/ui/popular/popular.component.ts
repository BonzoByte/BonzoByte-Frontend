import { CommonModule, DOCUMENT } from '@angular/common';
import { Component, Inject, Injector, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Subscription, timeout, finalize } from 'rxjs';
import { PopularityService, PopularityRanking, PopularMatch, PopularPlayer } from '../../../core/services/popularity.service';
import { PrivacyConsentService } from '../../../core/services/privacy-consent.service';
import { RegionalSettingsService } from '../../../core/services/regional-settings.service';
import { MatchDetailsModalComponent } from '../../../tennis/matches/match-details-modal/match-details-modal.component';
import { PlayerModalComponent } from '../../../tennis/players/player-modal/player-modal.component';
import { playerGridFlagCode, playerGridLabel } from '../../../core/helpers/player-grid-label';
import { finalMatchResult, finalMatchSets } from '../../../core/helpers/final-match-result';
import { environment } from '@env/environment';
import { createPopularPreview, popularPreviewAllowed, popularPreviewMatchDetails, popularPreviewPlayerIndex } from './popular-preview';
import { StaticArchivesService } from '../../../core/services/static-archives.service';
import { PlayerIndex } from '../../../core/models/tennis.model';
import { MatchDetailsRaw } from '../../../core/models/match-details.model';
import { MatchSummary } from '../../../core/models/match-summary';
import { MatchPlayersCellComponent, MatchTournamentCellComponent, MatchResultCellComponent } from '../match-grid-cells/match-grid-cells.component';
import { MatchEntityDetailsComponent, MatchEntityRequest } from '../match-entity-details/match-entity-details.component';
import { DiscussionsService } from '../../../core/services/discussions.service';
import { Match } from '../../../core/models/tennis.model';

@Component({ selector: 'app-popular', standalone: true,
    imports: [CommonModule, TranslateModule, MatchDetailsModalComponent, PlayerModalComponent, MatchPlayersCellComponent, MatchTournamentCellComponent, MatchResultCellComponent, MatchEntityDetailsComponent],
    templateUrl: './popular.component.html', styleUrls: ['./popular.component.scss'] })
export class PopularComponent implements OnInit, OnDestroy {
    tab: 'match' | 'player' = 'match';
    ranking: PopularityRanking | null = null;
    loading = false;
    failed = false;
    preview = false;
    readonly previewAllowed: boolean;
    private readonly previewRanking = createPopularPreview();
    get displayedRanking(): PopularityRanking | null { return this.preview ? this.previewRanking : this.ranking; }
    selectedMatch: PopularMatch | null = null;
    selectedPlayer: PopularPlayer | null = null;
    selectedPlayerIndex: PlayerIndex | null = null;
    selectedMatchPreview: MatchDetailsRaw | null = null;
    selectedTournament: MatchEntityRequest | null = null;
    private gridCache = new WeakMap<PopularMatch, MatchSummary>();
    private matchMetadata: ReadonlyMap<number, MatchSummary> = new Map();
    private matchMetadataKey = '';
    private matchMetadataRequest?: Subscription;
    gridMatch(item: PopularMatch): MatchSummary {
        let match = this.gridCache.get(item);
        if (!match) {
            const summary = this.preview ? undefined : this.matchMetadata.get(item.id);
            // Rankings may be older than the public daily card. Join only the same player pair.
            const pair = summary && summary.matchTPId === item.id && ((!item.match.player1TPId && !item.match.player2TPId) ||
                summary.player1TPId === item.match.player1TPId && summary.player2TPId === item.match.player2TPId ||
                summary.player1TPId === item.match.player2TPId && summary.player2TPId === item.match.player1TPId);
            match = { ...item.match, player1Name: item.player1, player2Name: item.player2, tournamentEventName: item.tournament, ...(pair ? summary : {}) };
            this.gridCache.set(item, match);
        }
        return match;
    }
    openTournament(item: PopularMatch): void { this.selectedTournament = { kind: 'tournament', match: this.gridMatch(item), preview: this.preview }; }
    playerIndexLoading = false;
    private playerIndexRequest?: Subscription;
    private playerIndexKey = '';
    private playerIndices = new Map<number, PlayerIndex>();
    private request?: Subscription;
    private routeSubscription?: Subscription;
    constructor(private popularity: PopularityService, readonly privacy: PrivacyConsentService,
        readonly regional: RegionalSettingsService, @Inject(DOCUMENT) doc: Document, private archives: StaticArchivesService, private injector: Injector,
        private route: ActivatedRoute, private router: Router) {
        this.previewAllowed = popularPreviewAllowed(environment, doc.location?.hostname ?? '');
    }
    ngOnInit(): void {
        this.routeSubscription = this.route.queryParamMap.subscribe(params => {
            this.tab = params.get('tab') === 'players' ? 'player' : 'match';
            this.enrichPlayers(); this.enrichMatches();
        });
        this.load();
    }
    load(): void {
        this.request?.unsubscribe(); this.loading = true; this.failed = false;
        this.request = this.popularity.rankings().subscribe({
            next: ranking => { this.ranking = ranking; this.failed = ranking.available === false; this.loading = false;
                this.playerIndexKey = ''; this.matchMetadataKey = ''; this.enrichPlayers(); this.enrichMatches(); },
            error: () => { this.failed = true; this.loading = false; },
        });
    }
    chooseTab(tab: 'match' | 'player'): void {
        this.tab = tab; this.enrichPlayers(); this.enrichMatches();
        if (/^\/popular(?:[/?#]|$)/.test(this.router.url)) void this.router.navigate([], {
            relativeTo: this.route, queryParams: { tab: tab === 'player' ? 'players' : null }, queryParamsHandling: 'merge'
        });
    }
    togglePreview(): void {
        if (!this.previewAllowed) return;
        this.preview = !this.preview;
        this.selectedMatch = this.selectedPlayer = null;
        this.selectedMatchPreview = null; this.selectedPlayerIndex = null;
        this.enrichPlayers(); this.enrichMatches();
    }
    openMatch(item: PopularMatch): void {
        this.selectedMatchPreview = null;
        if (this.preview) {
            if (!this.previewAllowed || !this.previewRanking.matches.includes(item)) return;
            this.selectedMatchPreview = popularPreviewMatchDetails(item);
            if (!this.selectedMatchPreview) return;
        } else if (!Number.isSafeInteger(item.id) || item.id <= 0) return;
        const match = this.gridMatch(item);
        this.selectedMatch = !this.preview && this.matchMetadata.has(item.id) ? { ...item, match: match as Match } : item;
    }
    openPlayer(item: PopularPlayer): void {
        const index = this.preview ? popularPreviewPlayerIndex(item.id) : this.playerIndex(item);
        if (this.preview ? (!this.previewAllowed || !index) : (!Number.isSafeInteger(item.id) || item.id <= 0)) return;
        this.selectedPlayerIndex = index;
        this.selectedPlayer = item;
    }
    openMatchPlayer(item: PopularMatch, side: 1 | 2): void {
        const match = this.gridMatch(item), id = (side === 1 ? match.player1TPId : match.player2TPId)!;
        const name = (side === 1 ? match.player1Name : match.player2Name) || '';
        const country = side === 1 ? match.player1CountryFull : match.player2CountryFull;
        this.openPlayer({ id, name, country, gender: match.tournamentTypeName === 'WTA' ? 'W' : 'M',
            index: this.playerIndices.get(id) ?? { playerTPId: id, playerName: name, countryFull: country,
                countryISO2: side === 1 ? match.player1CountryISO2 : match.player2CountryISO2,
                countryISO3: side === 1 ? match.player1CountryISO3 : match.player2CountryISO3 } });
    }
    playerIndex(item: PopularPlayer): PlayerIndex {
        return this.playerIndices.get(item.id) ?? (item.index?.playerTPId === item.id ? item.index : undefined) ??
            { playerTPId: item.id, playerName: item.name, countryFull: item.country };
    }
    private enrichMatches(): void {
        if (this.preview || this.tab !== 'match' || !this.ranking || this.failed) return;
        const ids = [...new Set(this.ranking.matches.map(item => item.id).filter(id => Number.isSafeInteger(id) && id > 0))];
        const key = ids.join(','); if (!key || key === this.matchMetadataKey) return;
        this.matchMetadataKey = key; this.matchMetadataRequest?.unsubscribe(); this.matchMetadata = new Map(); this.gridCache = new WeakMap();
        this.matchMetadataRequest = this.injector.get(DiscussionsService).cardSummaries(ids).subscribe({ next: summaries => {
            this.matchMetadata = summaries; this.gridCache = new WeakMap();
        }, error: () => { /* Public ranking remains usable when display enrichment is unavailable. */ } });
    }
    private enrichPlayers(): void {
        if (this.preview || this.tab !== 'player' || !this.ranking || this.failed) return;
        const ids = this.ranking.players.filter(item => item.id > 0 && (item.index?.playerTPId !== item.id ||
            !['numberOfMatches','totalMatches','finishedMatches'].some(key=>typeof (item.index as any)?.[key] === 'number'))).map(item => item.id);
        const key = ids.join(',');
        if (!key || key === this.playerIndexKey) return;
        this.playerIndexKey = key; this.playerIndexRequest?.unsubscribe(); this.playerIndexLoading = true;
        const wanted = new Set(ids);
        this.playerIndexRequest = this.archives.getPlayersIndex().pipe(timeout(15000), finalize(() => this.playerIndexLoading = false))
            .subscribe({ next: rows => { this.playerIndices.clear(); for (const row of rows) if (wanted.has(row.playerTPId)) this.playerIndices.set(row.playerTPId, row); },
                error: () => { /* Missing index fields remain unavailable, never fabricated. */ } });
    }
    readonly stars = [1, 2, 3, 4, 5];
    readonly tsColumns = [{ field: 'averageTSMean', label: 'catalog.avgTs' }, { field: 'peakTsMean', label: 'catalog.peakTs' }, { field: 'currentTsMean', label: 'catalog.latestTs' }] as const;
    tsStars(value: number): number { return Math.round(Math.min(1, Math.max(0, (value - 18) / 14)) * 10) / 2; }
    starClass(star: number, value: number): string { const rating = this.tsStars(value); return rating >= star ? 'full' : rating >= star - .5 ? 'half' : 'empty'; }
    winPercent(value: number | null | undefined): string { return typeof value === 'number' && Number.isFinite(value) ? this.regional.number(value * 100, 2) + ' %' : '—'; }
    readonly flagCode = playerGridFlagCode;
    readonly playerLabel = playerGridLabel;
    readonly finalResult = finalMatchResult;
    readonly finalSets = finalMatchSets;
    trackMatch(_index: number, item: PopularMatch): number { return item.id; }
    matchDate(item: PopularMatch): string {
        const match = this.gridMatch(item), precision = match.sourceTimePrecision;
        // An unverified start time must not turn into an invented midnight.
        if (precision !== 'minute' && precision !== 'second') return this.regional.date(match.dateTime || item.date);
        return this.regional.matchDateTime(match.dateTime, precision).replace(/ (\d{2}:\d{2})$/, '\n$1');
    }
    tabKey(event: KeyboardEvent): void {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        this.chooseTab(event.key === 'Home' ? 'match' : event.key === 'End' ? 'player' : this.tab === 'match' ? 'player' : 'match');
        document.getElementById(`popular-tab-${this.tab}`)?.focus();
    }
    openPrivacy(): void { this.privacy.open(); }
    authAction(action: 'openLogin' | 'openRegister' | 'openBilling'): void {
        this.selectedMatch = this.selectedPlayer = null; this.selectedTournament = null;
        setTimeout(() => window.dispatchEvent(new Event(action)), 0);
    }
    ngOnDestroy(): void { this.routeSubscription?.unsubscribe(); this.request?.unsubscribe(); this.playerIndexRequest?.unsubscribe(); this.matchMetadataRequest?.unsubscribe(); }
}
