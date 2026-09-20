import type { Env } from '../config/model';
import { changeAdminPassword, ensureAdminCredential, verifyAdminCredential } from '../db/auth';
import {
  checkLoginThrottle,
  clearLoginThrottle,
  recordFailedLogin,
  recordLoginEvent,
} from '../db/audit';
import { ensureControlPlaneSchema, ensureInstallationState } from '../db/migrations';
import {
  authenticateAdminRequest,
  createSession,
  deleteSession,
  requireCsrf,
} from '../security/session';

const json = (body: unknown, status = 200, initHeaders: HeadersInit = {}) => {
  const headers = new Headers(initHeaders);
  if (!headers.has('content-type')) headers.set('content-type', 'application/json; charset=utf-8');
  if (!headers.has('cache-control')) headers.set('cache-control', 'no-store');
  if (!headers.has('x-content-type-options')) headers.set('x-content-type-options', 'nosniff');
  if (!headers.has('referrer-policy')) headers.set('referrer-policy', 'no-referrer');
  return new Response(JSON.stringify(body), { status, headers });
};

function sessionCookie(value: string, maxAgeSeconds: number, httpOnly: boolean): string {
  const parts = [
    `${httpOnly ? 'tn_session' : 'tn_csrf'}=${value}`,
    'Path=/',
    'Secure',
    'SameSite=Strict',
  ];
  if (httpOnly) parts.push('HttpOnly');
  parts.push(`Max-Age=${maxAgeSeconds}`);
  return parts.join('; ');
}
async function readJsonObject(request: Request): Promise<Record<string, unknown> | null> {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))
    return null;
  const length = Number(request.headers.get('content-length') ?? 0);
  if (Number.isFinite(length) && length > 4096) return null;
  try {
    const parsed = (await request.json()) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function clearCookies(headers: Headers) {
  headers.append('set-cookie', sessionCookie('', 0, true));
  headers.append('set-cookie', sessionCookie('', 0, false));
}

function unauthorized() {
  return json({ ok: false, error: 'unauthorized' }, 401);
}

function forbidden() {
  return json({ ok: false, error: 'forbidden' }, 403);
}

export async function handleAuthRoute(
  request: Request,
  env: Env,
  now = Date.now(),
): Promise<Response | null> {
  const path = new URL(request.url).pathname;
  if (!path.startsWith('/api/auth/')) return null;
  await ensureControlPlaneSchema(env.DB);
  if (path === '/api/auth/login') {
    if (request.method !== 'POST') return json({ ok: false, error: 'method-not-allowed' }, 405);
    const body = await readJsonObject(request);
    const password = typeof body?.password === 'string' ? body.password : '';
    if (!password || password.length > 1024)
      return json({ ok: false, error: 'invalid-credentials' }, 401);

    const install = await ensureInstallationState(env.DB);
    const throttle = await checkLoginThrottle(env.DB, install.secretSeed, request, now);
    if (!throttle.allowed) {
      return json({ ok: false, error: 'too-many-attempts' }, 429, {
        'retry-after': String(throttle.retryAfterSeconds),
      });
    }

    await ensureAdminCredential(env.DB, env.ADMIN_PASSWORD, env.INSTALL_GENERATION, now);
    const credential = await verifyAdminCredential(env.DB, password);
    if (!credential) {
      await recordFailedLogin(env.DB, install.secretSeed, request, now);
      await recordLoginEvent(env.DB, request, false, now);
      return json({ ok: false, error: 'invalid-credentials' }, 401);
    }
    await clearLoginThrottle(env.DB, install.secretSeed, request);
    await recordLoginEvent(env.DB, request, true, now);
    const session = await createSession(env.DB, credential.passwordVersion, now);
    const headers = new Headers();
    const maxAge = Math.floor((session.expiresAt - now) / 1000);
    headers.append('set-cookie', sessionCookie(session.sessionToken, maxAge, true));
    headers.append('set-cookie', sessionCookie(session.csrfToken, maxAge, false));
    return json({ ok: true, expiresAt: session.expiresAt }, 200, headers);
  }

  if (path === '/api/auth/session') {
    if (request.method !== 'GET') return json({ ok: false, error: 'method-not-allowed' }, 405);
    const session = await authenticateAdminRequest(request, env.DB, now);
    return session
      ? json({ authenticated: true, expiresAt: session.expiresAt })
      : json({ authenticated: false });
  }

  if (path === '/api/auth/logout') {
    if (request.method !== 'POST') return json({ ok: false, error: 'method-not-allowed' }, 405);
    const session = await authenticateAdminRequest(request, env.DB, now);
    if (!session) return unauthorized();
    if (!(await requireCsrf(request, session))) return forbidden();
    await deleteSession(env.DB, session);
    const headers = new Headers();
    clearCookies(headers);
    return json({ ok: true }, 200, headers);
  }
  if (path === '/api/auth/password') {
    if (request.method !== 'POST') return json({ ok: false, error: 'method-not-allowed' }, 405);
    const session = await authenticateAdminRequest(request, env.DB, now);
    if (!session) return unauthorized();
    if (!(await requireCsrf(request, session))) return forbidden();
    const body = await readJsonObject(request);
    const currentPassword = typeof body?.currentPassword === 'string' ? body.currentPassword : '';
    const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : '';
    if (!currentPassword || !newPassword || newPassword.length > 1024) {
      return json({ ok: false, error: 'invalid-request' }, 400);
    }
    const changed = await changeAdminPassword(env.DB, currentPassword, newPassword, now);
    if (!changed) return json({ ok: false, error: 'invalid-credentials' }, 401);
    const headers = new Headers();
    clearCookies(headers);
    return json({ ok: true }, 200, headers);
  }

  return json({ ok: false, error: 'not-found' }, 404);
}
