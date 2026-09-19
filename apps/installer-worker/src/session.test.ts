import { describe, expect, it } from 'vitest';
import {
  INSTALL_SESSION_COOKIE,
  OAUTH_STATE_COOKIE,
  clearInstallerCookies,
  makeInstallSessionCookie,
  openCookie,
  sealCookie,
} from './session';

const KEY = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';

describe('encrypted installer session', () => {
  it('round-trips an encrypted session and rejects tampering/expiry', async () => {
    const now = 1_800_000_000_000;
    const sealed = await sealCookie(
      { accessToken: 'secret-token', issuedAt: now, expiresAt: now + 600_000 },
      KEY,
    );

    await expect(openCookie(sealed, KEY, now + 1)).resolves.toMatchObject({
      accessToken: 'secret-token',
    });
    await expect(openCookie(`${sealed.slice(0, -1)}x`, KEY, now + 1)).rejects.toThrow(
      'invalid-session',
    );
    await expect(openCookie(sealed, KEY, now + 600_001)).rejects.toThrow('expired-session');
  });

  it('serializes hardened cookies without plaintext authorization', async () => {
    const now = Date.now();
    const cookie = await makeInstallSessionCookie(
      { accessToken: 'do-not-leak', issuedAt: now, expiresAt: now + 600_000 },
      KEY,
    );

    expect(cookie).toContain(`${INSTALL_SESSION_COOKIE}=`);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Path=/');
    expect(cookie).toContain('Max-Age=600');
    expect(cookie).not.toContain('do-not-leak');
  });

  it('clears both state and installer cookies explicitly', () => {
    const cleared = clearInstallerCookies();
    expect(cleared).toHaveLength(2);
    expect(cleared.join('\n')).toContain(`${OAUTH_STATE_COOKIE}=;`);
    expect(cleared.join('\n')).toContain(`${INSTALL_SESSION_COOKIE}=;`);
    expect(cleared.every((cookie) => cookie.includes('Max-Age=0'))).toBe(true);
  });
});
