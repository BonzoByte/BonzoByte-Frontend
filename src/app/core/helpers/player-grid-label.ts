const surnamePrefixes = new Set([
    'al', 'bar', 'ben', 'bin', 'da', 'das', 'de', 'del', 'di', 'dos', 'du', 'ibn', 'la', 'le', 'van', 'von'
]);

/** Names passed here are already decoded plain text, never markup. */
export function playerGridLabel(name: string, iso3?: string | null, seed?: string | null, rank?: string | null): string {
    const n = (name ?? '').trim();
    const isoRaw = (iso3 ?? '').toString().trim().toUpperCase();
    const iso = isoRaw && isoRaw !== '0' ? isoRaw : '';
    const nonZero = (value?: string | null) => {
        const text = (value ?? '').toString().trim();
        return text && text !== '0' && text !== '0.0' ? text : '';
    };
    const s = nonZero(seed), r = nonZero(rank);
    return `${n}${iso ? ` (${iso})` : ''}${s ? ` (${s})` : ''}${r ? ` [${r}]` : ''}`.trim();
}

export function compactPlayerGridLabel(name?: string | null): string {
    const decoded = (name ?? '').trim();
    const parts = decoded.split(/\s+/).filter(Boolean);
    if (parts.length < 2) return decoded;
    const first = parts[0].toLocaleLowerCase();
    if (first === 'de' && parts[1]?.toLocaleLowerCase() === 'la' && parts[2]) return parts.slice(0, 3).join(' ');
    return surnamePrefixes.has(first) && parts[1] ? `${parts[0]} ${parts[1]}` : parts[0];
}

export function playerGridFlagCode(iso2?: string | null): string {
    const code = (iso2 || '').toUpperCase().trim();
    if (!code || ['WD', 'WLD', 'XX', 'XW', '-'].includes(code)) return 'UN';
    return code === 'UK' ? 'GB' : code;
}
