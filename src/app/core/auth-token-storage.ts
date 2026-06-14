const ACCESS_TOKEN_KEY = 'token';
const LEGACY_USER_KEY = 'user';

export function getAccessToken(): string | null {
    clearLegacyAuthStorage();
    return sessionStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setAccessToken(token: string): void {
    clearLegacyAuthStorage();
    sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function clearAuthStorage(): void {
    sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    clearLegacyAuthStorage();
}

export function clearLegacyAuthStorage(): void {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(LEGACY_USER_KEY);
}
