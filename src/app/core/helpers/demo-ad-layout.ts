import { User } from '../models/user.model';

// Presentation only: never add these slots to Match[], counts, exports or P/L.
export const DEMO_AD_LAYOUT = Object.freeze({ matchesPerSlot: 20, groupsPerSlot: 2, maxSlots: 3 });
const PUBLIC_DEMO_LAYOUT = Object.freeze({ matchesPerSlot: 32, groupsPerSlot: 4, maxSlots: 3 });

export function demoAdSlotAfter(index: number, total: number, mode: 'matches' | 'groups', publicDemo = false): number | null {
    if (!Number.isInteger(index) || !Number.isInteger(total) || index < 0 || index >= total - 1) return null;
    const layout = publicDemo ? PUBLIC_DEMO_LAYOUT : DEMO_AD_LAYOUT;
    const interval = mode === 'matches' ? layout.matchesPerSlot : layout.groupsPerSlot;
    const position = index + 1;
    if (position % interval !== 0) return null;
    const slot = position / interval;
    return slot <= layout.maxSlots ? slot : null;
}

export function accountAllowsDemoAds(user: User | null): boolean {
    if (!user) return true;
    return !user.isAdmin && !user.entitlements?.isPremium && !user.entitlements?.hasTrial
        && !user.entitlements?.isVip && !user.entitlements?.isLifetime
        && user.entitlements?.showAds !== false;
}
