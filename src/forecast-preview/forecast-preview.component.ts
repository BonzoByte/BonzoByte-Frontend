import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { playerGridFlagCode, playerGridLabel } from '../app/core/helpers/player-grid-label';
import { ForecastPreview, localPreviewAllowed, PreviewMatch, verifyPreviewBytes } from './forecast-preview-contract';

@Component({
  selector: 'app-forecast-preview', standalone: true, imports: [CommonModule],
  templateUrl: './forecast-preview.component.html', styleUrl: './forecast-preview.component.scss',
})
export class ForecastPreviewComponent implements OnInit, OnDestroy {
  packet: ForecastPreview | null = null;
  filter: 'All' | 'ATP' | 'WTA' = 'All';
  readonly filters = ['All', 'ATP', 'WTA'] as const;
  loading = true;
  error = false;
  readonly flagCode = playerGridFlagCode;
  readonly label = playerGridLabel;
  private request?: AbortController;
  get rows(): PreviewMatch[] { return this.packet?.rows.filter(row => this.filter === 'All' || row.tour === this.filter) || []; }
  winner(row: PreviewMatch): number { return row.players[0].probability >= row.players[1].probability ? 0 : 1; }
  percent(value: number): string { return (value * 100).toFixed(2); }
  date(day: string): string { return day.split('-').reverse().join('/'); }
  utc(value: string): string { return new Date(value).toISOString().slice(0, 19).replace('T', ' ') + ' UTC'; }
  track(_: number, row: PreviewMatch): number { return row.canonicalMatchId; }
  ngOnInit(): void { void this.load(); }
  ngOnDestroy(): void { this.request?.abort(); }
  async load(): Promise<void> {
    this.request?.abort();
    const request = new AbortController(); this.request = request;
    this.loading = true; this.error = false; this.packet = null;
    try {
      if (!localPreviewAllowed(location.hostname)) throw new Error('Loopback-only preview');
      const options: RequestInit = { signal: request.signal, cache: 'no-store', credentials: 'omit' };
      const manifestResponse = await fetch('/__forecast-preview/manifest', options);
      if (!manifestResponse.ok) throw new Error('Preview manifest unavailable');
      const manifest = await manifestResponse.json();
      if (manifest.schema !== 'bonzobyte.frozen-forecast-archive.v1' || manifest.previewOnly !== true || manifest.productionEligible !== false) throw new Error('Invalid preview manifest');
      const archive = await fetch('/__forecast-preview/archive', options);
      if (!archive.ok) throw new Error('Preview archive unavailable');
      const packet = await verifyPreviewBytes(await archive.arrayBuffer(), manifest.jsonSha256);
      if (packet.rows.length !== manifest.rows) throw new Error('Preview count mismatch');
      if (this.request === request) this.packet = packet;
    } catch {
      if (this.request === request) this.error = true;
    } finally {
      if (this.request === request) this.loading = false;
    }
  }
}
