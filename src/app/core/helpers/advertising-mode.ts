export type AdvertisingMode = 'off' | 'demo' | 'adsense';
export interface AdvertisingEnvironment {
    production: boolean;
    advertising: { enabled: boolean; mode: AdvertisingMode; publicDemoCards?: boolean };
}

/** No network provider is implemented yet. Unknown or future modes fail closed.
 * Enabling AdSense later requires a reviewed provider/CMP integration, not just
 * changing a flag. Local preview choices are never advertising consent.
 */
export function resolveAdvertisingMode(env: AdvertisingEnvironment, hostname: string): 'off' | 'demo' {
    if (env?.advertising?.enabled !== true || env.production !== false) return 'off';
    const local = ['localhost', '127.0.0.1', '[::1]', '::1'].includes((hostname || '').toLowerCase());
    return local && env.advertising.mode === 'demo' ? 'demo' : 'off';
}

/** First-party placeholders on the public site. Independent of real ads and consent. */
export function allowsPublicDemoCards(env: AdvertisingEnvironment, location: Pick<Location, 'protocol' | 'hostname'>): boolean {
    return env.production === true && env.advertising.publicDemoCards === true
        && env.advertising.enabled === false && env.advertising.mode === 'off'
        && location.protocol === 'https:' && ['bonzobyte.com', 'www.bonzobyte.com'].includes(location.hostname);
}
