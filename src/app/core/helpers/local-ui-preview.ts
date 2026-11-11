/** One loopback-only gate for display fixtures; never enabled in deployed builds or billing lab. */
export function localUiPreviewAllowed(config: { production: boolean; billingLab: boolean }, hostname: string): boolean {
    return !config.production && !config.billingLab && ['localhost', '127.0.0.1', '[::1]', '::1'].includes(hostname);
}
