export interface Entitlements {
    plan: 'free' | 'premium';
    isPremium: boolean;
    hasTrial: boolean;
    trialEndsAt: string | null;
    showAds: boolean;
}

export interface User {
    _id?: string;

    // Osnovni podaci
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

    // Dodatni korisnički info
    avatarUrl?: string;
    countryTPId?: number;
    gender?: 'male' | 'female' | 'other';
    dateOfBirth?: Date;
    lastLogin?: Date;

    // Player povezivanje
    player1TPId?: number;
    player2TPId?: number;

    // Reset lozinke
    resetPasswordToken?: string;
    resetPasswordExpires?: Date;

    // Automatska Mongo polja
    createdAt?: Date;
    updatedAt?: Date;
    
    entitlements?: Entitlements;
}
