/* eslint-disable @typescript-eslint/consistent-type-definitions */
import { CommonModule } from '@angular/common';
import {
    Component,
    EventEmitter,
    Input,
    OnChanges,
    OnDestroy,
    OnInit,
    Output,
    SimpleChanges,
    ViewEncapsulation
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BbModalShellComponent } from '../../../shared/ui/bb-modal-shell.component/bb-modal-shell.component';

export type MatchStatus = 'all' | 'finished' | 'unfinished';
export type OddsFilter = 'all' | 'with' | 'without';
export type ValueFilter = 'all' | 'valueOnly';
export type FilterPayload = {
    startDate: string | null;
    endDate: string | null;
    option: string;
    surfaceIds: number[];
    tournamentTypeIds: number[];
    strengthStars: number[];
    status: MatchStatus;
    odds: 'all' | 'with' | 'without';
    valueFilter: 'all' | 'valueOnly';
};

@Component({
    selector: 'app-match-filter-modal',
    standalone: true,
    templateUrl: './match-filter-modal.component.html',
    imports: [CommonModule, FormsModule, BbModalShellComponent],
    encapsulation: ViewEncapsulation.None
})
export class MatchFilterModalComponent implements OnChanges, OnInit, OnDestroy {
    @Output() closed = new EventEmitter<void>();
    @Output() filterApplied = new EventEmitter<FilterPayload>();
    @Output() resetFilter = new EventEmitter<void>();

    // (legacy outputs – ostavljamo ako ih parent negdje sluša)
    @Output() surfaceFilterChanged = new EventEmitter<number | null>();
    @Output() tournamentTypeFilterChanged = new EventEmitter<number | null>();
    @Output() tournamentLevelFilterChanged = new EventEmitter<number | null>(); // legacy

    @Input() activeDateFilter = 'all';
    @Input() activeFromDate: string | null = null;
    @Input() activeToDate: string | null = null;

    @Input() activeSurfaceIds: number[] = [];
    @Input() activeTournamentTypeIds: number[] = [];

    // legacy input (više ga ne koristimo u UI-u, ali ostavljamo da parent ne pukne)
    @Input() activeTournamentLevelIds: number[] = [];

    /** ✅ NEW: parent može (kasnije) slati aktivne zvjezdice; ako ne šalje, držimo default */
    @Input() activeStrengthStars: number[] = [];

    @Input() minDate!: Date;
    @Input() maxDate!: Date;

    @Input() activeStatus: MatchStatus = 'all';
    @Input() activeOdds: 'all' | 'with' | 'without' = 'all';
    @Input() selectedOdds: 'all' | 'with' | 'without' = 'all';
    @Input() activeValueFilter: ValueFilter = 'all';

    selectedStatus: MatchStatus = 'all';
    private readonly DEFAULT_STATUS: MatchStatus = 'all';
    private readonly DEFAULT_ODDS: 'all' | 'with' | 'without' = 'all';
    private readonly DEFAULT_VALUE: ValueFilter = 'all';

    selectedValueFilter: ValueFilter = 'all';

    dateOptions = [
        { label: 'All matches', value: 'all' },
        { label: 'Last year', value: 'year' },
        { label: 'Last month', value: 'month' },
        { label: 'Last week', value: 'week' },
        { label: 'Custom date range', value: 'custom' }
    ];

    surfaces = [
        { _id: 1, surface: 'Indoors' },
        { _id: 2, surface: 'Clay' },
        { _id: 3, surface: 'Grass' },
        { _id: 4, surface: 'Hard' }
    ];

    tournamentTypes = [
        { _id: 2, type: 'ATP' },
        { _id: 4, type: 'WTA' }
    ];

    strengthOptions: number[] = [0, 1, 2, 3, 4, 5];
    selectedDateOption = 'all';
    selectedSurfaceIds: number[] = [];
    selectedTournamentTypeIds: number[] = [];
    selectedStrengthStars: number[] = [];

    customFromDate: string | null = null;
    customToDate: string | null = null;

    errorMessage = '';

    private readonly DEFAULT_SURFACES = [1, 2, 3, 4];
    private readonly DEFAULT_TYPES = [2, 4];
    private readonly DEFAULT_STRENGTH = [0, 1, 2, 3, 4, 5];

    ngOnInit(): void {
        document.body.classList.add('modal-open');
    }

    ngOnDestroy(): void {
        document.body.classList.remove('modal-open');
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['activeDateFilter']) {
            this.selectedDateOption = this.activeDateFilter || 'all';
        }

        // custom dates only when option=custom
        if (this.selectedDateOption === 'custom') {
            this.customFromDate = this.activeFromDate || null;
            this.customToDate = this.activeToDate || null;
        } else {
            this.customFromDate = null;
            this.customToDate = null;
        }

        if (changes['activeSurfaceIds']) { this.selectedSurfaceIds = Array.isArray(this.activeSurfaceIds) ? [...this.activeSurfaceIds] : []; }
        if (!this.selectedSurfaceIds.length) this.selectedSurfaceIds = [...this.DEFAULT_SURFACES];
        if (changes['activeTournamentTypeIds']) { this.selectedTournamentTypeIds = Array.isArray(this.activeTournamentTypeIds) ? [...this.activeTournamentTypeIds] : []; }
        if (!this.selectedTournamentTypeIds.length) this.selectedTournamentTypeIds = [...this.DEFAULT_TYPES];
        if (changes['activeStrengthStars']) { this.selectedStrengthStars = Array.isArray(this.activeStrengthStars) ? [...this.activeStrengthStars] : []; }
        if (!this.selectedStrengthStars.length) { this.selectedStrengthStars = [...this.DEFAULT_STRENGTH]; }
        if (!this.selectedStrengthStars.length) this.selectedStrengthStars = [...this.DEFAULT_STRENGTH];
        if (changes['activeStatus']) { this.selectedStatus = this.activeStatus || this.DEFAULT_STATUS; }
        if (changes['activeOdds']) { this.selectedOdds = this.activeOdds || this.DEFAULT_ODDS; }
        if (changes['activeValueFilter']) {this.selectedValueFilter = this.activeValueFilter || this.DEFAULT_VALUE;}

        this.errorMessage = '';
    }

    close(): void {
        document.body.classList.remove('modal-open');
        this.closed.emit();
    }

    onDateOptionChange(): void {
        this.errorMessage = '';
        if (this.selectedDateOption !== 'custom') {
            this.customFromDate = null;
            this.customToDate = null;
        }
    }

    apply(): void {
        this.errorMessage = '';

        const { startDate, endDate } = this.resolveDates();
        if (this.errorMessage) return;

        const payload: FilterPayload = {
            option: this.selectedDateOption,
            startDate,
            endDate,
            surfaceIds: (this.selectedSurfaceIds || []).map(Number),
            tournamentTypeIds: (this.selectedTournamentTypeIds || []).map(Number),
            strengthStars: (this.selectedStrengthStars || []).map(Number),
            status: this.selectedStatus,
            odds: this.selectedOdds,
            valueFilter: this.selectedValueFilter,
        };

        console.groupCollapsed('%c[Filter] Emitting', 'color:#0b5; font-weight:600;');
        console.log(payload);
        console.groupEnd();

        this.filterApplied.emit(payload);
    }

    reset(): void {
        this.errorMessage = '';
        this.selectedDateOption = 'all';
        this.customFromDate = null;
        this.customToDate = null;
        this.selectedSurfaceIds = [...this.DEFAULT_SURFACES];
        this.selectedTournamentTypeIds = [...this.DEFAULT_TYPES];
        this.selectedStrengthStars = [...this.DEFAULT_STRENGTH];
        this.selectedStatus = this.DEFAULT_STATUS;
        this.selectedOdds = this.DEFAULT_ODDS;
        this.selectedValueFilter = this.DEFAULT_VALUE;
        this.resetFilter.emit();
    }

    isLastSelected(arr: number[], id: number): boolean {
        return Array.isArray(arr) && arr.length === 1 && arr[0] === id;
    }

    // ---- toggles ----

    toggleSurface(id: number): void {
        this.selectedSurfaceIds = this.toggleIdWithMinOne(this.selectedSurfaceIds, id);
    }

    toggleTournamentType(id: number): void {
        this.selectedTournamentTypeIds = this.toggleIdWithMinOne(this.selectedTournamentTypeIds, id);
    }

    toggleStrengthStar(star: number): void {
        this.selectedStrengthStars = this.toggleIdWithMinOne(this.selectedStrengthStars, star);
    }

    private toggleIdWithMinOne(selected: number[], id: number): number[] {
        const has = selected.includes(id);

        // ako pokušava ugasiti zadnju preostalu -> ne dopuštamo
        if (has && selected.length === 1) return selected;

        if (has) return selected.filter(x => x !== id);
        return [...selected, id];
    }

    // ---- date logic ----

    private resolveDates(): { startDate: string | null; endDate: string | null } {
        // all → no restriction
        if (this.selectedDateOption === 'all') return { startDate: null, endDate: null };

        // custom → must be valid
        if (this.selectedDateOption === 'custom') {
            const from = this.customFromDate || null;
            const to = this.customToDate || null;

            if (!from || !to) {
                this.errorMessage = 'Please select both From and To dates.';
                return { startDate: null, endDate: null };
            }

            // swap if needed
            let a = from;
            let b = to;
            if (a > b) [a, b] = [b, a];

            // clamp to min/max (defensive)
            const min = this.minDate ? this.fmt(this.minDate) : null;
            const max = this.maxDate ? this.fmt(this.maxDate) : null;

            if (min && a < min) a = min;
            if (max && b > max) b = max;

            return { startDate: a, endDate: b };
        }

        // relative → compute from maxDate (zadnji dostupni meč), not "today"
        if (!this.maxDate) {
            const today = new Date();
            return { startDate: this.calcRelativeFrom(today, this.selectedDateOption), endDate: this.fmt(today) };
        }

        const end = new Date(this.maxDate);
        const startIso = this.calcRelativeFrom(end, this.selectedDateOption);
        const endIso = this.fmt(end);

        // clamp start to minDate (defensive)
        const minIso = this.minDate ? this.fmt(this.minDate) : null;
        let start = startIso;
        if (minIso && start && start < minIso) start = minIso;

        return { startDate: start, endDate: endIso };
    }

    private calcRelativeFrom(end: Date, option: string): string | null {
        const start = new Date(end);
        switch (option) {
            case 'year':
                start.setFullYear(start.getFullYear() - 1);
                break;
            case 'month':
                start.setMonth(start.getMonth() - 1);
                break;
            case 'week':
                start.setDate(start.getDate() - 7);
                break;
            default:
                return null;
        }
        return this.fmt(start);
    }

    private fmt(d: Date): string {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    }
}