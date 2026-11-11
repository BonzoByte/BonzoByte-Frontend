import { User } from '../models/user.model';

/** Expire known temporary rights while waiting for /auth/me; never grant new rights locally. */
export function expireMembership(user: User | null, nowMs: number): User | null {
    if (!user?.entitlements) return user;
    const e = user.entitlements;
    const passed = (value?: string | null) => !!value && Number.isFinite(Date.parse(value)) && Date.parse(value) <= nowMs;
    // A scheduled resumption is an explicit server-issued right, not a fresh client grant.
    const resumes = passed(e.trialResumesAt) && !!e.trialEndsAt && !passed(e.trialEndsAt);
    const hasTrial = (e.hasTrial || resumes) && !passed(e.trialEndsAt);
    const isVip = !!e.isVip || !!e.isLifetime;
    const isPremium = e.isPremium && (isVip || !passed(e.subscriptionEndsAt ?? e.membershipEndsAt));
    const manual = e.adFreeReason === 'manual' || (!e.adFreeReason && !e.hasTrial && !e.isPremium && !e.showAds);
    const tier = user.isAdmin ? 'admin' : isVip ? 'vip' : isPremium ? 'premium' : hasTrial ? 'trial' : 'standard';
    return { ...user, entitlements: {
        ...e, hasTrial, isPremium, isVip, tier,
        plan: isPremium ? 'premium' : 'free',
        showAds: !(user.isAdmin || isVip || isPremium || hasTrial || manual),
        membershipEndsAt: tier === 'trial' ? e.trialEndsAt : tier === 'premium' ? e.subscriptionEndsAt ?? e.membershipEndsAt : null,
    } };
}

export function membershipTier(user: User | null): string {
    if (user?.isAdmin) return 'admin';
    const e = user?.entitlements;
    if (e?.isVip || e?.isLifetime) return 'vip';
    if (e?.isPremium) return 'premium';
    if (e?.hasTrial) return 'trial';
    return 'standard';
}

export interface TrialCountdown {
    endsAt: string;
    days: number;
    hours: number;
    minutes: number;
}

/** A paused balance, not a running countdown. Only display explicit server-issued saved time. */
export function savedTrialBalance(user: User | null, nowMs: number): Omit<TrialCountdown, 'endsAt'> | null {
    if (membershipTier(user) !== 'premium' || !Number.isFinite(nowMs)) return null;
    const e = user!.entitlements!;
    const remainingMs = e.trialRemainingMs;
    const resumesAt = Date.parse(e.trialResumesAt ?? '');
    if (e.hasTrial || typeof remainingMs !== 'number' || !Number.isFinite(remainingMs) || remainingMs <= 0
        || !Number.isFinite(resumesAt) || resumesAt <= nowMs) return null;
    // Match the existing display precision; even a saved fraction of a minute remains visible.
    const totalMinutes = Math.ceil(remainingMs / 60_000);
    return { days: Math.floor(totalMinutes / 1440), hours: Math.floor(totalMinutes % 1440 / 60), minutes: totalMinutes % 60 };
}

/** Display only: the server remains authoritative for trial/ad-free access. */
export function trialCountdown(user: User | null, nowMs: number): TrialCountdown | null {
    if (membershipTier(user) !== 'trial') return null;
    const endsAt = user?.entitlements?.trialEndsAt;
    const remainingMs = Date.parse(endsAt ?? '') - nowMs;
    if (!endsAt || !Number.isFinite(remainingMs) || remainingMs <= 0) return null;
    // Round up so an active trial never misleadingly reads "0 minutes left".
    const totalMinutes = Math.ceil(remainingMs / 60_000);
    return {
        endsAt,
        days: Math.floor(totalMinutes / 1440),
        hours: Math.floor((totalMinutes % 1440) / 60),
        minutes: totalMinutes % 60,
    };
}

/** Uses the same clock/rounding for trial and purchased access. */
export function membershipCountdown(user: User | null, nowMs: number): TrialCountdown | null {
    if (membershipTier(user) === 'trial') return trialCountdown(user, nowMs);
    if (membershipTier(user) !== 'premium') return null;
    const endsAt = user?.entitlements?.subscriptionEndsAt ?? user?.entitlements?.membershipEndsAt;
    const remainingMs = Date.parse(endsAt ?? '') - nowMs;
    if (!endsAt || !Number.isFinite(remainingMs) || remainingMs <= 0) return null;
    const totalMinutes = Math.ceil(remainingMs / 60000);
    return { endsAt, days: Math.floor(totalMinutes / 1440), hours: Math.floor(totalMinutes % 1440 / 60), minutes: totalMinutes % 60 };
}
