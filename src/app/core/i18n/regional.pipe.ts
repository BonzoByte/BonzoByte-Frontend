import { Pipe, PipeTransform } from '@angular/core';
import { RegionalSettingsService } from '../services/regional-settings.service';

/** Impure by design: a language switch must refresh an unchanged numeric/date value. */
@Pipe({ name: 'regional', standalone: true, pure: false })
export class RegionalPipe implements PipeTransform {
  constructor(private regional: RegionalSettingsService) {}
  transform(value: number | string | null | undefined, kind: 'number' | 'date' | 'dateTime' | 'matchDate' | 'usd' | 'integer' = 'number', digits = 2): string {
    if (kind === 'date') return typeof value === 'string' ? this.regional.date(value) : '';
    if (kind === 'dateTime') return typeof value === 'string' ? this.regional.dateTime(value) : '';
    if (kind === 'matchDate') return typeof value === 'string' ? this.regional.matchDateTime(value, undefined, true) : '';
    if (typeof value !== 'number') return '';
    if (kind === 'usd') return this.regional.usd(value);
    return this.regional.number(value, kind === 'integer' ? 0 : digits, kind === 'integer');
  }
}
