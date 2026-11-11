export type AdvertisingMode = 'off' | 'demo' | 'adsense';
export interface AdvertisingEnvironment {
    production: boolean;
    advertising: { enabled: boolean; mode: AdvertisingMode };
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
