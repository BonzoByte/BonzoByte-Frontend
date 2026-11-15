import { accountAvatarUrl } from './account-avatar-url';

describe('Closed-beta account avatar routing', () => {
    const path = '/uploads/avatars/6ac29637c7af15125135517e/avatar-1794726180101.webp';
    const backend = 'https://bonzobyte-backend.onrender.com';
    it('loads uploaded avatars through the same-origin invitation gate', () => {
        expect(accountAvatarUrl(backend + path, true)).toBe(path);
        expect(accountAvatarUrl(backend + path + '?v=2#photo', true)).toBe(path + '?v=2#photo');
    });
    it('does not redirect localhost or ordinary non-beta deployments', () => {
        expect(accountAvatarUrl(backend + path, false)).toBe(backend + path);
        expect(accountAvatarUrl('http://localhost:5000' + path, true)).toBe('http://localhost:5000' + path);
    });
    it('preserves Google photos, R2 images and selected-file previews', () => {
        for (const source of ['https://lh3.googleusercontent.com/photo', 'https://cdn.example.com' + path,
            'data:image/png;base64,aGVsbG8=', 'blob:https://bonzobyte.com/preview', path,
            'assets/images/defaultUser.png']) expect(accountAvatarUrl(source, true)).toBe(source);
    });
    it('never proxies other backend resources or a similarly named host', () => {
        for (const source of [backend + '/api/users/me', backend + '/uploads/other/image.png',
            'https://bonzobyte-backend.onrender.com.evil.example' + path,
            'https://someone@bonzobyte-backend.onrender.com' + path,
            backend + '/uploads/avatars/not-an-account/avatar-1.webp']) {
            expect(accountAvatarUrl(source, true)).toBe(source);
        }
    });
});
