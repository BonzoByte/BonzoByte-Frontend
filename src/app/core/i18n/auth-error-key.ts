type AuthErrorContext = 'login' | 'registration' | 'reset' | 'verify' | 'resend' | 'recovery' | 'profile';

const FALLBACK: Record<AuthErrorContext, string> = {
  login: 'auth.loginFailed', registration: 'auth.registrationFailed', reset: 'auth.resetFailed',
  verify: 'auth.verifyFailed', resend: 'auth.verificationSendFailed', recovery: 'auth.resetSendFailed',
  profile: 'profile.updateFailed'
};

// Temporary compatibility for endpoints that still return a message without a stable code.
// Exact, contextual allowlists only; arbitrary server text is never a translation key or HTML.
const LEGACY: Partial<Record<AuthErrorContext, Record<string, string>>> = {
  reset: {
    'Invalid or expired reset token.': 'auth.resetExpired',
    'Token and new password are required.': 'auth.resetRequired',
    'Password must be at least 8 characters long.': 'auth.passwordLength'
  },
  verify: {
    'Token nije ispravan ili je istekao.': 'auth.verifyExpired',
    'Korisnik nije pronađen.': 'auth.userMissing'
  },
  resend: {
    'Email is required.': 'auth.emailRequired',
    'Korisnik ne postoji.': 'auth.userMissing',
    'Račun je već verificiran.': 'auth.alreadyVerified'
  },
  profile: { 'Invalid avatar image.': 'profile.invalidAvatar', 'Korisnik nije pronađen.': 'auth.userMissing' }
};

export function authErrorKey(error: unknown, context: AuthErrorContext): string {
  const e = error as { status?: number; error?: { code?: unknown; message?: unknown } | string } | null;
  if (e?.status === 0) return 'auth.networkError';
  if (e?.status === 429) return 'auth.tooManyRequests';
  const body = e?.error;
  const code = typeof body === 'object' && body ? body.code : undefined;
  if (context === 'verify' && code === 'VERIFICATION_EXPIRED') return 'auth.verifyExpired';
  if (context === 'registration') {
    if (code === 'ACCOUNT_ERASURE_PENDING') return 'auth.accountErasurePending';
    if (code === 'EMAIL_ALREADY_EXISTS') return 'auth.emailExists';
    if (code === 'NICKNAME_ALREADY_EXISTS') return 'auth.nicknameExists';
    if (code === 'VALIDATION_ERROR') return 'auth.registrationInvalid';
  }
  const message = typeof body === 'string' ? body : body?.message;
  const known = LEGACY[context];
  return typeof message === 'string' && known && Object.prototype.hasOwnProperty.call(known, message)
    ? known[message] : FALLBACK[context];
}
