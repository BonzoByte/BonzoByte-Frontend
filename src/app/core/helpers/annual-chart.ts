import { ChartData } from 'chart.js';
import { ChartPoint } from '../models/analytics.model';

export interface AnnualChartCopy {
  text(key: string, params?: Record<string, unknown>): string;
  date(value: string): string;
}

export function annualChart(items: ChartPoint[], label: string, archiveEnd: string | null,
  currentYear = new Date().getUTCFullYear(), partialLabel = 'Partial'): ChartData<'line'> {
  const end = /^(\d{4})-(\d{2})-(\d{2})$/.exec(archiveEnd ?? '');
  const partial = items.map(item => /^\d{4}$/.test(item.label) &&
    (Number(item.label) >= currentYear || (!!end && item.label === end[1] && archiveEnd!.slice(5) !== '12-31')));
  return {
    labels: items.map((item, i) => partial[i] ? `${item.label} · ${partialLabel}` : item.label),
    datasets: [{
      label, data: items.map(item => item.value), tension: 0.25, fill: false,
      segment: { borderDash: ctx => partial[ctx.p0DataIndex] || partial[ctx.p1DataIndex] ? [5, 4] : undefined },
      pointStyle: items.map((_, i) => partial[i] ? 'triangle' : 'circle'),
      pointRadius: items.map((_, i) => partial[i] ? 5 : 3)
    }]
  };
}

export function annualChartNote(items: ChartPoint[], archiveEnd: string | null,
  currentYear = new Date().getUTCFullYear(), copy?: AnnualChartCopy): string {
  if (!items.length) return copy ? copy.text('annualEmpty') : 'No annual data available.';
  const data = annualChart(items, '', archiveEnd, currentYear);
  const years = items.filter((_, i) => String(data.labels![i]).endsWith(' · Partial')).map(x => x.label);
  if (years.length) {
    const date = /^(\d{4})-(\d{2})-(\d{2})$/.exec(archiveEnd ?? '');
    if (copy) return copy.text('annualPartial', {
      years: years.join(', '), range: date ? copy.text('annualRange', { date: copy.date(archiveEnd!) }) : ''
    });
    const range = date ? ` Latest match date in the overall archive: ${date[3]}.${date[2]}.${date[1]}.` : '';
    return `${years.join(', ')} · Partial: actual values, not full-year totals. Dashed segments mark partial years.${range} Daily coverage may vary. No annual projection.`;
  }
  const latest = Math.max(...items.map(x => Number(x.label)).filter(Number.isFinite));
  if (copy) return copy.text(latest < currentYear ? 'annualStale' : 'annualActual', { latest, year: currentYear });
  return latest < currentYear
    ? `This series ends in ${latest}; ${currentYear} is not yet included in these aggregates. Actual counts, no annual projection.`
    : 'Actual recorded counts; no annual projection.';
}
