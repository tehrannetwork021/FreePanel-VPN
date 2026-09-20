import type {
  InstallRequest,
  TokenInstallRequest,
  TokenVerifyRequest,
} from '@tehrannetwork/shared';
import { CloudflareApiError, listAccounts, verifyApiToken } from './cloudflare';
import type { InstallerEnv } from './env';
import { defaultProvisionDeps, ProvisionError, provisionPanel } from './provision';

export type RouterDeps = {
  verifyApiToken: typeof verifyApiToken;
  listAccounts: typeof listAccounts;
  provisionPanel: typeof provisionPanel;
};

const defaultDeps: RouterDeps = {
  verifyApiToken,
  listAccounts,
  provisionPanel,
};

const MAX_BODY_BYTES = 16 * 1024;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  });
}
async function readJson<T>(request: Request): Promise<T | Response> {
  if (!(request.headers.get('content-type') ?? '').toLowerCase().startsWith('application/json')) {
    return json({ ok: false, stage: 'token', code: 'invalid-request' }, 415);
  }
  const contentLength = Number(request.headers.get('content-length') ?? '0');
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return json({ ok: false, stage: 'token', code: 'invalid-request' }, 413);
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) {
    return json({ ok: false, stage: 'token', code: 'invalid-request' }, 413);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    return json({ ok: false, stage: 'token', code: 'invalid-request' }, 400);
  }
}

function tokenError(error: unknown): Response {
  if (error instanceof CloudflareApiError && error.message === 'token-invalid') {
    return json({ ok: false, stage: 'token', code: 'token-invalid' }, 401);
  }
  if (error instanceof CloudflareApiError && error.message === 'insufficient-scope') {
    return json({ ok: false, stage: 'account', code: 'insufficient-scope' }, 403);
  }
  return json({ ok: false, stage: 'token', code: 'token-invalid' }, 401);
}
async function handleVerify(request: Request, deps: RouterDeps): Promise<Response> {
  const body = await readJson<TokenVerifyRequest>(request);
  if (body instanceof Response) return body;
  const token = typeof body.token === 'string' ? body.token.trim() : '';
  if (!token) return json({ ok: false, stage: 'token', code: 'token-invalid' }, 401);
  try {
    await deps.verifyApiToken(token);
    const accounts = await deps.listAccounts(token);
    return json({ ok: true, accounts });
  } catch (error) {
    return tokenError(error);
  }
}

function installError(error: unknown): Response {
  if (error instanceof CloudflareApiError) return tokenError(error);
  if (!(error instanceof ProvisionError)) {
    return json({ ok: false, stage: 'worker', code: 'worker-upload-failed' }, 502);
  }
  const inputError =
    error.code === 'invalid-account' ||
    error.code === 'invalid-worker-name' ||
    error.code === 'invalid-admin-password';
  return json(
    { ok: false, stage: error.stage, code: error.code },
    error.code === 'insufficient-scope' ? 403 : inputError ? 400 : 502,
  );
}
async function handleInstall(request: Request, deps: RouterDeps): Promise<Response> {
  const body = await readJson<TokenInstallRequest>(request);
  if (body instanceof Response) return body;
  const token = typeof body.token === 'string' ? body.token.trim() : '';
  if (!token) return json({ ok: false, stage: 'token', code: 'token-invalid' }, 401);
  try {
    await deps.verifyApiToken(token);
    const installRequest: InstallRequest = {
      accountId: body.accountId,
      workerName: body.workerName,
      adminPassword: body.adminPassword,
    };
    const result = await deps.provisionPanel(token, installRequest, defaultProvisionDeps);
    return json(result);
  } catch (error) {
    return installError(error);
  }
}

export async function handleInstallerRequest(
  request: Request,
  env: InstallerEnv,
  deps: RouterDeps = defaultDeps,
): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname === '/api/token/verify' && request.method === 'POST') {
    return handleVerify(request, deps);
  }
  if (url.pathname === '/api/install' && request.method === 'POST') {
    return handleInstall(request, deps);
  }
  if (url.pathname.startsWith('/api/')) {
    return json({ ok: false, code: 'not-found' }, 404);
  }
  if (request.method === 'GET' || request.method === 'HEAD') {
    return env.ASSETS.fetch(request);
  }
  return json({ ok: false, code: 'method-not-allowed' }, 405);
}
