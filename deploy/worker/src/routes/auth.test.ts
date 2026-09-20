import { describe, expect, it } from 'vitest';
import type { Env } from '../config/model';
import { createFakeD1 } from '../test/fakeD1';
import { handleAuthRoute } from './auth';

function env(db = createFakeD1()): Env {
  return {
    C: { get: async () => null, put: async () => undefined },
    DB: db,
    ADMIN_PASSWORD: 'installer-pass',
    INSTALL_GENERATION: 'gen-1',
  };
}

function schemaGuardDb(): D1Database {
  const inner = createFakeD1();
  let schemaStarted = false;
  return new Proxy(inner, {
    get(target, prop, receiver) {
      if (prop === 'exec')
        return async (...args: [string]) => {
          schemaStarted = true;
          return target.exec(...args);
        };
      if (prop === 'prepare')
        return (sql: string) => {
          if (!schemaStarted) throw new Error('missing-control-plane-schema');
          return target.prepare(sql);
        };
      return Reflect.get(target, prop, receiver);
    },
  }) as D1Database;
}

function login(password: string, ip = '203.0.113.7') {
  return new Request('https://worker.example/api/auth/login', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'cf-connecting-ip': ip,
      'cf-ipcountry': 'DE',
      'user-agent': 'Task3 Test Agent',
    },
    body: JSON.stringify({ password }),
  });
}
describe('auth routes', () => {
  it('initializes the control-plane schema when login is the first D1 request', async () => {
    const db = schemaGuardDb();
    const response = await handleAuthRoute(login('installer-pass'), env(db as never), 9_000);
    expect(response?.status).toBe(200);
  });

  it('logs in through D1 credentials and sets secure session/CSRF cookies', async () => {
    const db = createFakeD1();
    const response = await handleAuthRoute(login('installer-pass'), env(db), 10_000);
    expect(response?.status).toBe(200);
    expect(response!.headers.get('cache-control')).toBe('no-store');
    expect(response!.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response!.headers.get('referrer-policy')).toBe('no-referrer');
    const cookie = response!.headers.get('set-cookie') ?? '';
    expect(cookie).toContain('tn_session=');
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('Secure');
    expect(cookie).toContain('SameSite=Strict');
    expect(cookie).toContain('tn_csrf=');
    const text = await response!.text();
    expect(text).not.toContain('installer-pass');
    expect(JSON.stringify(db.rows())).not.toContain('203.0.113.7');
  });

  it('uses one generic invalid-credentials response for a bad password', async () => {
    const response = await handleAuthRoute(login('wrong'), env(), 10_000);
    expect(response?.status).toBe(401);
    await expect(response!.json()).resolves.toEqual({ ok: false, error: 'invalid-credentials' });
  });
  it('throttles the ninth failed login in fifteen minutes without storing the raw IP', async () => {
    const db = createFakeD1();
    const e = env(db);
    for (let i = 0; i < 8; i += 1) {
      const response = await handleAuthRoute(login('wrong'), e, 10_000 + i);
      expect(response?.status).toBe(401);
    }
    const blocked = await handleAuthRoute(login('wrong'), e, 20_000);
    expect(blocked?.status).toBe(429);
    expect(Number(blocked!.headers.get('retry-after'))).toBeGreaterThan(0);
    expect(JSON.stringify(db.rows())).not.toContain('203.0.113.7');
  });

  it('exposes session state and rejects logout on a CSRF mismatch without detail leaks', async () => {
    const db = createFakeD1();
    const e = env(db);
    const loggedIn = await handleAuthRoute(login('installer-pass'), e, 10_000);
    const setCookie = loggedIn!.headers.get('set-cookie') ?? '';
    const sessionToken = /tn_session=([^;,]+)/u.exec(setCookie)?.[1] ?? '';
    const csrfToken = /tn_csrf=([^;,]+)/u.exec(setCookie)?.[1] ?? '';
    const cookie = `tn_session=${sessionToken}; tn_csrf=${csrfToken}`;

    const session = await handleAuthRoute(
      new Request('https://worker.example/api/auth/session', {
        headers: { cookie },
      }),
      e,
      11_000,
    );
    await expect(session!.json()).resolves.toMatchObject({ authenticated: true });

    const badLogout = await handleAuthRoute(
      new Request('https://worker.example/api/auth/logout', {
        method: 'POST',
        headers: { cookie, 'x-csrf-token': 'wrong' },
      }),
      e,
      12_000,
    );
    expect(badLogout?.status).toBe(403);
    expect(await badLogout!.text()).not.toMatch(/hash|salt|password_version|secret_seed/iu);
  });

  it('changes the password, invalidates the old session, and clears auth cookies', async () => {
    const db = createFakeD1();
    const e = env(db);
    const loggedIn = await handleAuthRoute(login('installer-pass'), e, 10_000);
    const setCookie = loggedIn!.headers.get('set-cookie') ?? '';
    const sessionToken = /tn_session=([^;,]+)/u.exec(setCookie)?.[1] ?? '';
    const csrfToken = /tn_csrf=([^;,]+)/u.exec(setCookie)?.[1] ?? '';
    const cookie = `tn_session=${sessionToken}; tn_csrf=${csrfToken}`;
    const changed = await handleAuthRoute(
      new Request('https://worker.example/api/auth/password', {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie, 'x-csrf-token': csrfToken },
        body: JSON.stringify({ currentPassword: 'installer-pass', newPassword: 'panel-new-pass' }),
      }),
      e,
      12_000,
    );
    expect(changed?.status).toBe(200);
    expect(changed!.headers.get('set-cookie')).toContain('Max-Age=0');

    const oldSession = await handleAuthRoute(
      new Request('https://worker.example/api/auth/session', {
        headers: { cookie },
      }),
      e,
      13_000,
    );
    await expect(oldSession!.json()).resolves.toEqual({ authenticated: false });
  });

  it('returns null for non-auth paths', async () => {
    const response = await handleAuthRoute(
      new Request('https://worker.example/api/users'),
      env(),
      10_000,
    );
    expect(response).toBeNull();
  });
});
