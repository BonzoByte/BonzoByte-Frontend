import { CommonModule } from '@angular/common';
import { Component, effect, OnDestroy } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { SiteInsightsService, SiteInsightsSummary, RegistrationNotice } from '../core/services/site-insights.service';
import { forkJoin, Subscription } from 'rxjs';

const en = { title: 'Site audience', private: 'PRIVATE OWNER VIEW', intro: 'External audience, separate from tennis data and hosting request counts.',
    denied: 'Sign in with an approved, verified owner account to view this report.', disabled: 'Visit measurement is not activated on this server. No production visit data is being collected by this feature.',
    today: 'Today', seven: '7 days', thirty: '30 days', refresh: 'Refresh', loading: 'Loading…', failed: 'The private report is temporarily unavailable. No sample figures are substituted.',
    views: 'Page views', browsers: 'Estimated browsers', active: 'Active signed-in accounts', confirmed: 'New confirmed external accounts',
    external: 'Current external accounts', total: 'All current accounts', internal: 'Internal accounts excluded', confirmedCurrent: 'Confirmed external accounts',
    caveat: 'Visits include only consenting, non-excluded browsers. A browser is not a person; devices and cleared storage can count separately. Account totals come from the server, not visit tracking.',
    since: 'Observation started', day: 'Day', daily: 'Daily activity', sections: 'Most viewed sections', notices: 'New account notifications',
    empty: 'No measured data in this period.', noNotices: 'No confirmed external account notifications yet.', read: 'Mark as read', readState: 'Read', unread: 'New',
    noticeText: 'New confirmed external account', observe: 'Verification is observed periodically; the time is when the server first recorded it, not necessarily the exact verification time.',
    excluded: 'This browser is excluded', include: 'Include this browser', exclude: 'Exclude this browser', email: 'Owner email notices enabled',
    emailOff: 'Owner email notices are off', timezone: 'Daily boundaries: Europe/Zagreb', accountSplit: 'Current account inventory',
    preview: 'LOCAL DEMO — all figures shown here are synthetic test data, not real visitors or accounts.' };
const hr: typeof en = { title: 'Posjećenost stranice', private: 'PRIVATNI PREGLED VLASNIKA', intro: 'Vanjska publika, odvojeno od teniskih podataka i mrežnih zahtjeva hostinga.',
    denied: 'Za pregled se prijavi odobrenim i potvrđenim računom vlasnika.', disabled: 'Mjerenje posjeta na ovom poslužitelju nije aktivirano. Ova funkcija ne prikuplja produkcijske posjete.',
    today: 'Danas', seven: '7 dana', thirty: '30 dana', refresh: 'Osvježi', loading: 'Učitavam…', failed: 'Privatni izvještaj trenutačno nije dostupan. Ne prikazujemo zamjenske brojke.',
    views: 'Pregledi stranica', browsers: 'Procijenjeni preglednici', active: 'Aktivni prijavljeni računi', confirmed: 'Novi potvrđeni vanjski računi',
    external: 'Trenutačni vanjski računi', total: 'Svi trenutačni računi', internal: 'Isključeni interni računi', confirmedCurrent: 'Potvrđeni vanjski računi',
    caveat: 'Posjeti uključuju samo preglednike s privolom koji nisu isključeni. Preglednik nije osoba; uređaji i obrisana pohrana mogu se brojiti zasebno. Broj računa dolazi s poslužitelja, ne iz praćenja posjeta.',
    since: 'Početak bilježenja', day: 'Dan', daily: 'Dnevna aktivnost', sections: 'Najposjećenije rubrike', notices: 'Obavijesti o novim računima',
    empty: 'Nema izmjerenih podataka u ovom razdoblju.', noNotices: 'Još nema obavijesti o potvrđenim vanjskim računima.', read: 'Označi pročitano', readState: 'Pročitano', unread: 'Novo',
    noticeText: 'Novi potvrđeni vanjski račun', observe: 'Potvrde se provjeravaju periodički; vrijeme označava prvo bilježenje na poslužitelju, ne nužno točan trenutak potvrde.',
    excluded: 'Ovaj preglednik je isključen', include: 'Uključi ovaj preglednik', exclude: 'Isključi ovaj preglednik', email: 'Obavijesti vlasniku e-poštom uključene',
    emailOff: 'Obavijesti vlasniku e-poštom isključene', timezone: 'Dnevni presjek: Europe/Zagreb', accountSplit: 'Trenutačni broj računa',
    preview: 'LOKALNI TESTNI PREGLED — prikazane brojke su izmišljeni testni podaci, a ne stvarni posjetitelji ili računi.' };

@Component({ selector: 'app-site-insights', standalone: true, imports: [CommonModule], template: `
 <div class="insights-page">
  <header class="insights-hero"><small>{{copy.private}}</small><h1>{{copy.title}}</h1><p>{{copy.intro}}</p></header>
  <p *ngIf="localPreview" class="insights-panel" role="status">{{copy.preview}}</p>
  <p *ngIf="!insights.access().allowed" class="insights-panel" role="status">{{copy.denied}}</p>
  <ng-container *ngIf="insights.access().allowed">
   <div class="insights-panel insights-controls">
    <button *ngFor="let option of ranges" type="button" [class.selected]="days===option" [attr.aria-pressed]="days===option" (click)="select(option)">{{option===1?copy.today:option===7?copy.seven:copy.thirty}}</button>
    <button type="button" (click)="load()" [disabled]="loading">{{copy.refresh}}</button>
    <span class="insights-spacer"></span><span>{{insights.excluded()?copy.excluded:''}}</span>
    <button type="button" (click)="insights.setExcluded(!insights.excluded())">{{insights.excluded()?copy.include:copy.exclude}}</button>
   </div>
   <p *ngIf="!insights.access().enabled" class="insights-panel" role="status">{{copy.disabled}}</p>
   <p *ngIf="loading" role="status">{{copy.loading}}</p><p *ngIf="error" class="insights-panel" role="alert">{{copy.failed}}</p>
   <ng-container *ngIf="data as report">
    <section class="insights-cards">
     <article class="insights-panel"><span>{{copy.views}}</span><strong>{{number(report.views)}}</strong></article>
     <article class="insights-panel"><span>{{copy.browsers}}</span><strong>{{number(report.browsers)}}</strong></article>
     <article class="insights-panel"><span>{{copy.active}}</span><strong>{{number(report.activeMembers)}}</strong></article>
     <article class="insights-panel"><span>{{copy.confirmed}}</span><strong>{{number(report.confirmed)}}</strong></article>
    </section>
    <p class="insights-panel insights-explainer">{{copy.caveat}}<br>{{copy.since}}: {{date(report.startedAt)}} · {{copy.timezone}}</p>
    <div class="insights-columns">
     <section class="insights-panel"><h2>{{copy.daily}}</h2><p *ngIf="!report.daily.length">{{copy.empty}}</p>
      <div class="insights-table-scroll" *ngIf="report.daily.length"><table><thead><tr><th>{{copy.day}}</th><th>{{copy.views}}</th><th>{{copy.browsers}}</th><th>{{copy.confirmed}}</th></tr></thead>
       <tbody><tr *ngFor="let row of report.daily"><th>{{row.day}}</th><td class="insights-meter"><span class="meter" [style.width.%]="100*row.views/maxViews"></span><span>{{number(row.views)}}</span></td><td>{{number(row.browsers)}}</td><td>{{number(row.confirmed)}}</td></tr></tbody></table></div>
     </section>
     <section class="insights-panel"><h2>{{copy.sections}}</h2><p *ngIf="!report.sections.length">{{copy.empty}}</p>
      <div *ngFor="let row of report.sections" class="insights-section"><span>{{row.section}}</span><strong>{{number(row.views)}}</strong></div>
      <h2>{{copy.accountSplit}}</h2><div class="insights-section"><span>{{copy.total}}</span><strong>{{number(report.accounts.all)}}</strong></div>
      <div class="insights-section"><span>{{copy.internal}}</span><strong>{{number(report.accounts.internal)}}</strong></div>
      <div class="insights-section"><span>{{copy.external}}</span><strong>{{number(report.accounts.external)}}</strong></div>
      <div class="insights-section"><span>{{copy.confirmedCurrent}}</span><strong>{{number(report.accounts.confirmedExternal)}}</strong></div>
     </section>
    </div>
    <section class="insights-panel"><h2>{{copy.notices}}</h2><p>{{insights.access().emailEnabled?copy.email:copy.emailOff}}</p><p>{{copy.observe}}</p>
     <p *ngIf="!notices.length">{{copy.noNotices}}</p>
     <article *ngFor="let item of notices" class="insights-notice" [class.unread]="!item.read">
      <div><strong>{{copy.noticeText}}</strong><p>{{date(item.at)}} · {{item.provider==='google'?'Google':'Email'}} · {{item.read?copy.readState:copy.unread}}</p></div>
      <button *ngIf="!item.read" type="button" (click)="read(item)">{{copy.read}}</button>
     </article>
    </section>
   </ng-container>
  </ng-container>
 </div>`, styles: [`
 :host{display:block;min-width:0}.insights-page{max-width:1280px;margin:18px auto;padding:0 16px 28px;color:var(--bb-text,#e8edf2)}
 .insights-panel,.insights-hero{background:var(--bb-surface,#152028e8);border:1px solid var(--bb-border,#40505b);border-radius:18px;padding:18px;margin-bottom:14px;backdrop-filter:blur(8px)}
 .insights-hero{background:linear-gradient(120deg,#123c40e8,#171e2de8);padding:26px;color:#edf5f6}.insights-hero small{letter-spacing:.13em;color:#75dcc7;font-weight:700}
 h1{font-size:clamp(26px,4vw,40px);margin:8px 0}h2{font-size:17px;margin:0 0 14px}p{font-size:12px;line-height:1.65;margin:6px 0}
 .insights-controls{display:flex;align-items:center;flex-wrap:wrap;gap:8px}.insights-controls span{font-size:12px}.insights-spacer{flex:1}
 button{border:1px solid var(--bb-border,#536773);border-radius:8px;background:var(--bb-surface,#1d2a34);color:inherit;padding:8px 12px;font-size:12px;cursor:pointer}button.selected{border-color:#6cdbcb;background:#16615d;color:white}button:focus-visible{outline:2px solid #85d6ff;outline-offset:2px}button:disabled{opacity:.5;cursor:wait}
 .insights-cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.insights-cards article{display:flex;flex-direction:column;gap:12px}.insights-cards span{font-size:12px}.insights-cards strong{font-size:30px;color:var(--bb-text,#e8edf2);font-variant-numeric:tabular-nums}
 .insights-explainer{font-size:12px;line-height:1.8}.insights-columns{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:14px}.insights-columns>section{min-width:0}
 .insights-table-scroll{overflow:auto}table{border-collapse:collapse;width:100%;font-size:12px}td,th{padding:10px 8px;border-bottom:1px solid var(--bb-border,#40505b);text-align:right;white-space:nowrap}th:first-child{text-align:left}
 .insights-meter{position:relative;min-width:100px}.insights-meter .meter{position:absolute;inset:20% auto 20% 0;background:#27b69d24;border-radius:4px}.insights-meter>span:last-child{position:relative}
 .insights-section{display:flex;justify-content:space-between;gap:12px;font-size:13px;padding:10px 0;border-bottom:1px solid var(--bb-border,#40505b)}.insights-section+h2{margin-top:24px}
 .insights-notice{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 0;border-top:1px solid var(--bb-border,#40505b);font-size:13px}.insights-notice.unread strong{color:#64cfb8}
 @media(max-width:800px){.insights-cards{grid-template-columns:repeat(2,minmax(0,1fr))}.insights-columns{grid-template-columns:1fr}.insights-page{padding:0 10px 20px}.insights-panel{padding:14px}.insights-notice{align-items:flex-start;flex-wrap:wrap}}
 `] })
export class SiteInsightsComponent implements OnDestroy {
    readonly ranges = [1, 7, 30]; days = 7; data: SiteInsightsSummary | null = null; notices: RegistrationNotice[] = [];
    loading = false; error = false; private request?: Subscription; private revision = 0;
    readonly localPreview = typeof location !== 'undefined' && ['localhost', '127.0.0.1'].includes(location.hostname);
    private refreshTimer: ReturnType<typeof setInterval>;
    constructor(readonly insights: SiteInsightsService, private translate: TranslateService) {
        insights.start(); effect(() => { const access = insights.access();
            if (access.allowed && access.enabled) this.load(); else { this.request?.unsubscribe(); this.revision++; this.data = null; this.notices = []; this.loading = false; }
        });
        this.refreshTimer = setInterval(() => { if (document.visibilityState === 'visible' && !this.loading) this.load(); }, 60000);
    }
    get copy(): typeof en { return this.translate.currentLang === 'hr' ? hr : en; }
    get maxViews(): number { return Math.max(1, ...(this.data?.daily.map(r => r.views) || [])); }
    number(value: number): string { return new Intl.NumberFormat(this.translate.currentLang || 'en').format(value); }
    date(value: string): string { return new Intl.DateTimeFormat(this.translate.currentLang || 'en', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Europe/Zagreb' }).format(new Date(value)); }
    select(days: number): void { this.days = days; this.load(); }
    load(): void {
        if (!this.insights.access().allowed || !this.insights.access().enabled) return;
        this.request?.unsubscribe(); const revision = ++this.revision; this.loading = true; this.error = false;
        this.request = forkJoin({ report: this.insights.summary(this.days), notices: this.insights.notifications() }).subscribe({
            next: result => { if (revision === this.revision && this.insights.access().allowed) { this.data = result.report; this.notices = result.notices.items; this.loading = false; } },
            error: () => { if (revision === this.revision) { this.data = null; this.notices = []; this.loading = false; this.error = true; } }
        });
    }
    read(item: RegistrationNotice): void { this.insights.markRead([item.id]).subscribe({ next: () => this.load(), error: () => { this.error = true; } }); }
    ngOnDestroy(): void { this.revision++; this.request?.unsubscribe(); clearInterval(this.refreshTimer); }
}
