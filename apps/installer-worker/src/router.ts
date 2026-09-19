import type { InstallRequest } from '@tehrannetwork/shared';
import { CloudflareApiError, listAccounts } from './cloudflare';
import type { InstallerEnv } from './env';
import { finishOAuth, revokeOAuth, startOAuth } from './oauth';
import { defaultProvisionDeps, ProvisionError, provisionPanel } from './provision';
import {
  INSTALL_SESSION_COOKIE,
  clearInstallerCookies,
  readInstallSessionCookie,
} from './session';

export type RouterDeps = {
  startOAuth: typeof startOAuth;
  finishOAuth: typeof finishOAuth;
  listAccounts: typeof listAccounts;
  provisionPanel: typeof provisionPanel;
  revokeOAuth: typeof revokeOAuth;
};

const defaultDeps: RouterDeps = {
  startOAuth,
  finishOAuth,
  listAccounts,
  provisionPanel,
  revokeOAuth,
};

function json(data: unknown, status = 200, cookies: string[] = []): Response {
  const headers = new Headers({
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  for (const cookie of cookies) headers.append('set-cookie', cookie);
  return new Response(JSON.stringify(data), { status, headers });
}

function hasInstallCookie(request: Request): boolean {
  return (request.headers.get('cookie') ?? '')
    .split(';')
    .some((part) => part.trim().startsWith(`${INSTALL_SESSION_COOKIE}=`));
}

async function readSessionOrResponse(
  request: Request,
  env: InstallerEnv,
): Promise<Awaited<ReturnType<typeof readInstallSessionCookie>> | Response> {
  if (!hasInstallCookie(request)) {
    return json({ connected: false });
  }
  try {
    return await readInstallSessionCookie(request, env.COOKIE_KEY_B64);
  } catch {
    return json(
      { connected: false, error: 'authorization-expired' },
      401,
      clearInstallerCookies(),
    );
  }
}

async function handleSession(request: Request, env: InstallerEnv, deps: RouterDeps) {
  const session = await readSessionOrResponse(request, env);
  if (session instanceof Response) return session;
  try {
    const accounts = await deps.listAccounts(session.accessToken);
    return json({ connected: true, expiresAt: session.expiresAt, accounts });
  } catch (error) {
    const code =
      error instanceof CloudflareApiError && error.message === 'insufficient-scope'
        ? 'insufficient-scope'
        : 'invalid-account';
    const terminal = code === 'insufficient-scope';
    return json(
      { ok: false, stage: 'account', code },
      terminal ? 403 : 502,
      terminal ? clearInstallerCookies() : [],
    );
  }
}

async function handleInstall(request: Request, env: InstallerEnv, deps: RouterDeps) {
  const session = await readSessionOrResponse(request, env);
  if (session instanceof Response) {
    if (session.status === 200) {
      return json({ ok: false, stage: 'oauth', code: 'authorization-expired' }, 401);
    }
    return session;
  }
  if (!(request.headers.get('content-type') ?? '').toLowerCase().startsWith('application/json')) {
    return json({ ok: false, stage: 'oauth', code: 'invalid-request' }, 415);
  }

  let installRequest: InstallRequest;
  try {
    installRequest = (await request.json()) as InstallRequest;
  } catch {
    return json({ ok: false, stage: 'oauth', code: 'invalid-request' }, 400);
  }

  try {
    const result = await deps.provisionPanel(session, installRequest, defaultProvisionDeps);
    await deps.revokeOAuth(session.accessToken, env);
    return json(result, 200, clearInstallerCookies());
  } catch (error) {
    if (!(error instanceof ProvisionError)) {
      return json({ ok: false, stage: 'worker', code: 'worker-upload-failed' }, 502);
    }
    const terminal = error.code === 'insufficient-scope';
    const inputError =
      error.code === 'invalid-account' ||
      error.code === 'invalid-worker-name' ||
      error.code === 'invalid-admin-password';
    return json(
      { ok: false, stage: error.stage, code: error.code },
      terminal ? 403 : inputError ? 400 : 502,
      terminal ? clearInstallerCookies() : [],
    );
  }
}

async function handleLogout(request: Request, env: InstallerEnv, deps: RouterDeps) {
  if (hasInstallCookie(request)) {
    try {
      const session = await readInstallSessionCookie(request, env.COOKIE_KEY_B64);
      await deps.revokeOAuth(session.accessToken, env);
    } catch {
      // Cookie is still cleared below even if already expired or invalid.
    }
  }
  const headers = new Headers();
  for (const cookie of clearInstallerCookies()) headers.append('set-cookie', cookie);
  return new Response(null, { status: 204, headers });
}

export async function handleInstallerRequest(
  request: Request,
  env: InstallerEnv,
  deps: RouterDeps = defaultDeps,
): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname === '/api/oauth/start' && request.method === 'GET') {
    return deps.startOAuth(request, env);
  }
  if (url.pathname === '/api/oauth/callback' && request.method === 'GET') {
    return deps.finishOAuth(request, env);
  }
  if (url.pathname === '/api/session' && request.method === 'GET') {
    return handleSession(request, env, deps);
  }
  if (url.pathname === '/api/install' && request.method === 'POST') {
    return handleInstall(request, env, deps);
  }
  if (url.pathname === '/api/logout' && request.method === 'POST') {
    return handleLogout(request, env, deps);
  }
  if (url.pathname.startsWith('/api/')) {
    return json({ ok: false, code: 'not-found' }, 404);
  }
  if (request.method === 'GET' || request.method === 'HEAD') {
    return env.ASSETS.fetch(request);
  }
  return json({ ok: false, code: 'method-not-allowed' }, 405);
}
