import type { InstallerEnv } from './env';
import {
  clearOAuthStateCookie,
  makeInstallSessionCookie,
  makeOAuthStateCookie,
  readOAuthStateCookie,
} from './session';

const AUTH_URL = 'https://dash.cloudflare.com/oauth2/auth';
const TOKEN_URL = 'https://dash.cloudflare.com/oauth2/token';
const REVOKE_URL = 'https://dash.cloudflare.com/oauth2/revoke';
const SESSION_TTL_MS = 600_000;

function randomState(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function callbackUrl(env: InstallerEnv): string {
  return `${env.INSTALLER_ORIGIN.replace(/\/$/, '')}/api/oauth/callback`;
}

function safeRedirect(env: InstallerEnv, query: string, cookies: string[] = []): Response {
  const headers = new Headers({ location: `${env.INSTALLER_ORIGIN.replace(/\/$/, '')}/${query}` });
  for (const cookie of cookies) headers.append('set-cookie', cookie);
  return new Response(null, { status: 302, headers });
}

export async function startOAuth(_request: Request, env: InstallerEnv): Promise<Response> {
  const now = Date.now();
  const state = randomState();
  const stateCookie = await makeOAuthStateCookie(
    { state, issuedAt: now, expiresAt: now + SESSION_TTL_MS },
    env.COOKIE_KEY_B64,
  );
  const url = new URL(AUTH_URL);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', env.CF_OAUTH_CLIENT_ID);
  url.searchParams.set('redirect_uri', callbackUrl(env));
  url.searchParams.set('scope', env.CF_OAUTH_SCOPES);
  url.searchParams.set('state', state);

  return new Response(null, {
    status: 302,
    headers: { location: url.toString(), 'set-cookie': stateCookie },
  });
}

function basicAuth(env: InstallerEnv): string {
  return `Basic ${btoa(`${env.CF_OAUTH_CLIENT_ID}:${env.CF_OAUTH_CLIENT_SECRET}`)}`;
}

function errorRedirect(env: InstallerEnv, code: string): Response {
  return safeRedirect(env, `?error=${encodeURIComponent(code)}`, [clearOAuthStateCookie()]);
}

export async function finishOAuth(
  request: Request,
  env: InstallerEnv,
  now = Date.now(),
): Promise<Response> {
  const url = new URL(request.url);
  if (url.searchParams.get('error') === 'access_denied') {
    return errorRedirect(env, 'authorization-denied');
  }

  let stateCookie;
  try {
    stateCookie = await readOAuthStateCookie(request, env.COOKIE_KEY_B64, now);
  } catch {
    return errorRedirect(env, 'authorization-expired');
  }

  const state = url.searchParams.get('state');
  const code = url.searchParams.get('code');
  if (!state || state !== stateCookie.state) return errorRedirect(env, 'authorization-expired');
  if (!code) return errorRedirect(env, 'authorization-denied');

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: callbackUrl(env),
  });
  const tokenResponse = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      authorization: basicAuth(env),
      'content-type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  let tokenBody: { access_token?: string; expires_in?: number; error?: string } = {};
  try {
    tokenBody = (await tokenResponse.json()) as typeof tokenBody;
  } catch {
    tokenBody = {};
  }

  if (!tokenResponse.ok || !tokenBody.access_token) {
    const insufficient = tokenResponse.status === 403 || tokenBody.error?.includes('scope');
    return errorRedirect(env, insufficient ? 'insufficient-scope' : 'authorization-denied');
  }

  const expiresInMs = Math.max(1, Number(tokenBody.expires_in ?? 600)) * 1000;
  const expiresAt = Math.min(now + SESSION_TTL_MS, now + expiresInMs);
  const sessionCookie = await makeInstallSessionCookie(
    { accessToken: tokenBody.access_token, issuedAt: now, expiresAt },
    env.COOKIE_KEY_B64,
  );
  return safeRedirect(env, '?connected=1', [clearOAuthStateCookie(), sessionCookie]);
}

export async function revokeOAuth(accessToken: string, env: InstallerEnv): Promise<void> {
  try {
    await fetch(REVOKE_URL, {
      method: 'POST',
      headers: {
        authorization: basicAuth(env),
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ token: accessToken }),
    });
  } catch {
    // Best-effort cleanup; the encrypted installer session still expires within 10 minutes.
  }
}
