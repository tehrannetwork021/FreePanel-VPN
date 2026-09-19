import { afterEach, describe, expect, it, vi } from 'vitest';
import type { InstallerEnv } from './env';
import { finishOAuth, startOAuth } from './oauth';
import { makeOAuthStateCookie } from './session';

const KEY = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
const env = {
  CF_OAUTH_CLIENT_ID: 'client-id',
  CF_OAUTH_CLIENT_SECRET: 'client-secret',
  CF_OAUTH_SCOPES: 'account.read workers-platform.write',
  COOKIE_KEY_B64: KEY,
  INSTALLER_ORIGIN: 'https://install.example.com',
} as InstallerEnv;

function requestWithCookie(url: string, setCookie: string) {
  return new Request(url, { headers: { cookie: setCookie.split(';', 1)[0] } });
}

afterEach(() => vi.unstubAllGlobals());

describe('Cloudflare OAuth', () => {
  it('redirects to Cloudflare with exact configured authorization parameters', async () => {
    const response = await startOAuth(new Request(`${env.INSTALLER_ORIGIN}/api/oauth/start`), env);
    const location = new URL(response.headers.get('location')!);
    expect(location.origin + location.pathname).toBe('https://dash.cloudflare.com/oauth2/auth');
    expect(location.searchParams.get('response_type')).toBe('code');
    expect(location.searchParams.get('client_id')).toBe('client-id');
    expect(location.searchParams.get('redirect_uri')).toBe(`${env.INSTALLER_ORIGIN}/api/oauth/callback`);
    expect(location.searchParams.get('scope')).toBe(env.CF_OAUTH_SCOPES);
    expect(location.searchParams.get('state')).toBeTruthy();
    expect(response.headers.get('set-cookie')).toContain('__Host-tn_oauth_state=');
  });

  it('rejects mismatched state before exchanging the code', async () => {
    const now = Date.now();
    const setCookie = await makeOAuthStateCookie(
      { state: 'expected-state', issuedAt: now, expiresAt: now + 600_000 },
      KEY,
    );
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await finishOAuth(
      requestWithCookie(
        `${env.INSTALLER_ORIGIN}/api/oauth/callback?code=abc&state=wrong-state`,
        setCookie,
      ),
      env,
      now,
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(response.headers.get('location')).toContain('error=authorization-expired');
    expect(response.headers.get('set-cookie')).toContain('__Host-tn_oauth_state=;');
  });

  it('exchanges a valid code and stores only a bounded encrypted session', async () => {
    const now = Date.now();
    const setCookie = await makeOAuthStateCookie(
      { state: 'good-state', issuedAt: now, expiresAt: now + 600_000 },
      KEY,
    );
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ access_token: 'oauth-secret-token', expires_in: 3600 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await finishOAuth(
      requestWithCookie(
        `${env.INSTALLER_ORIGIN}/api/oauth/callback?code=abc&state=good-state`,
        setCookie,
      ),
      env,
      now,
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://dash.cloudflare.com/oauth2/token');
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(new Headers(init.headers).get('authorization')).toMatch(/^Basic /);
    expect(String(init.body)).toContain('grant_type=authorization_code');
    expect(response.headers.get('location')).toBe(`${env.INSTALLER_ORIGIN}/?connected=1`);
    const cookies = response.headers.get('set-cookie') ?? '';
    expect(cookies).toContain('__Host-tn_install_session=');
    expect(cookies).not.toContain('oauth-secret-token');
  });

  it('maps denied and insufficient authorization to safe local errors', async () => {
    const denied = await finishOAuth(
      new Request(`${env.INSTALLER_ORIGIN}/api/oauth/callback?error=access_denied`),
      env,
    );
    expect(denied.headers.get('location')).toContain('error=authorization-denied');

    const now = Date.now();
    const setCookie = await makeOAuthStateCookie(
      { state: 'state', issuedAt: now, expiresAt: now + 600_000 },
      KEY,
    );
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: 'invalid_scope', detail: 'SECRET DETAIL' }), {
          status: 403,
        }),
      ),
    );

    const insufficient = await finishOAuth(
      requestWithCookie(
        `${env.INSTALLER_ORIGIN}/api/oauth/callback?code=abc&state=state`,
        setCookie,
      ),
      env,
      now,
    );
    expect(insufficient.headers.get('location')).toContain('error=insufficient-scope');
    expect(insufficient.headers.get('location')).not.toContain('SECRET');
  });
});
