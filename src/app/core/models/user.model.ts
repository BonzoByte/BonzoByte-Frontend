export interface Entitlements {
    plan: 'free' | 'premium';
    isPremium: boolean;
    hasTrial: boolean;
    trialEndsAt: string | null;
    trialResumesAt?: string | null;
    trialRemainingMs?: number;
    sandboxMembership?: boolean;
    liveMembership?: boolean;
    showAds: boolean;
    tier?: 'standard' | 'trial' | 'premium' | 'vip' | 'admin';
    isVip?: boolean;
    isLifetime?: boolean;
    trialStartedAt?: string | null;
    subscriptionEndsAt?: string | null;
    membershipEndsAt?: string | null;
    adFreeReason?: 'admin' | 'vip' | 'premium' | 'trial' | 'manual' | null;
    evaluatedAt?: string;
    nextChangeAt?: string | null;
}

export interface User {
    _id?: string;
    competitionPrivacy?: { shareSettledPicks: boolean };
    presencePrivacy?: { showOnlineStatus: boolean };

  // Core identity fields.
    name: string;
    nickname?: string;
    email: string;
    avatar?: string;

    // Autentikacija
    password?: string;
    country?: number;
    googleId?: string;
    facebookId?: string;
    createdVia?: 'manual' | 'google' | 'facebook';
    provider?: string[];

    // Uloge i statusi
    isAdmin?: boolean;
    isUser?: boolean;
    isOnline?: boolean;
    isVerified?: boolean;

  // Optional profile metadata.
    avatarUrl?: string;
    countryTPId?: number;
    gender?: 'male' | 'female' | 'other';
    dateOfBirth?: Date;
    lastLogin?: Date;

    // Player povezivanje
    player1TPId?: number;
    player2TPId?: number;

  // Password-reset state.
    resetPasswordToken?: string;
    resetPasswordExpires?: Date;

  // Mongo-managed fields.
    createdAt?: Date;
    updatedAt?: Date;
    
    entitlements?: Entitlements;
}
