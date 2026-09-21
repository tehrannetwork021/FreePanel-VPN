import { afterEach, describe, expect, it, vi } from 'vitest';
import type { InstallResult } from '@tehrannetwork/shared';
import { CloudflareApiError } from './cloudflare';
import type { InstallerEnv } from './env';
import { ProvisionError } from './provision';
import { handleInstallerRequest, type RouterDeps } from './router';

const env = {
  ASSETS: { fetch: vi.fn().mockResolvedValue(new Response('asset')) },
} as unknown as InstallerEnv;

function deps(overrides: Partial<RouterDeps> = {}): RouterDeps {
  return {
    verifyApiToken: vi.fn().mockResolvedValue(undefined),
    listAccounts: vi.fn().mockResolvedValue([
      { id: 'a1', name: 'One' },
      { id: 'a2', name: 'Two' },
    ]),
    provisionPanel: vi.fn().mockResolvedValue({
      ok: true,
      workerUrl: 'https://pvnetwork-client.sub.workers.dev',
      workerName: 'pvnetwork-client',
      version: '0.1.0',
      schemaVersion: 1,
      adminUrl: 'https://pvnetwork-client.sub.workers.dev/admin',
    } satisfies InstallResult),
    ...overrides,
  } as RouterDeps;
}
function post(path: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request(`https://installer.example${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

afterEach(() => vi.restoreAllMocks());

describe('stateless token installer router', () => {
  it('exposes the exact edge artifact version without requiring a token', async () => {
    const response = await handleInstallerRequest(
      new Request('https://installer.example/api/health'),
      env,
      deps(),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({ ok: true, edgeVersion: '0.3.1' });
  });

  it('verifies a token and returns every accessible account', async () => {
    const d = deps();
    const response = await handleInstallerRequest(
      post('/api/token/verify', { token: 'TOKEN_VALUE' }),
      env,
      d,
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      accounts: [
        { id: 'a1', name: 'One' },
        { id: 'a2', name: 'Two' },
      ],
    });
    expect(d.verifyApiToken).toHaveBeenCalledWith('TOKEN_VALUE');
    expect(d.listAccounts).toHaveBeenCalledWith('TOKEN_VALUE');
  });
  it('rejects invalid requests and oversized bodies before Cloudflare calls', async () => {
    const d = deps();
    const wrongType = await handleInstallerRequest(
      new Request('https://installer.example/api/token/verify', { method: 'POST', body: 'x' }),
      env,
      d,
    );
    expect(wrongType.status).toBe(415);

    const malformed = await handleInstallerRequest(post('/api/token/verify', '{bad-json'), env, d);
    expect(malformed.status).toBe(400);

    const oversized = await handleInstallerRequest(
      post(
        '/api/token/verify',
        { token: 'TOKEN_VALUE' },
        { 'content-length': String(16 * 1024 + 1) },
      ),
      env,
      d,
    );
    expect(oversized.status).toBe(413);
    await expect(oversized.json()).resolves.toEqual({
      ok: false,
      stage: 'token',
      code: 'invalid-request',
    });
    expect(d.verifyApiToken).not.toHaveBeenCalled();
    expect(d.listAccounts).not.toHaveBeenCalled();
  });
  it('maps invalid tokens and insufficient permissions to safe errors', async () => {
    const invalid = await handleInstallerRequest(
      post('/api/token/verify', { token: 'BAD_VALUE' }),
      env,
      deps({
        verifyApiToken: vi
          .fn()
          .mockRejectedValue(new CloudflareApiError(401, undefined, 'token-invalid')),
      }),
    );
    expect(invalid.status).toBe(401);
    await expect(invalid.json()).resolves.toEqual({
      ok: false,
      stage: 'token',
      code: 'token-invalid',
    });

    const insufficient = await handleInstallerRequest(
      post('/api/token/verify', { token: 'LIMITED_VALUE' }),
      env,
      deps({
        listAccounts: vi.fn().mockRejectedValue(new CloudflareApiError(403, 9109)),
      }),
    );
    expect(insufficient.status).toBe(403);
    await expect(insufficient.json()).resolves.toEqual({
      ok: false,
      stage: 'account',
      code: 'insufficient-scope',
    });
  });
  it('installs from only the token and chooses all hidden settings server-side', async () => {
    const d = deps();
    const response = await handleInstallerRequest(
      post('/api/install', { token: 'TOKEN_VALUE' }),
      env,
      d,
    );
    expect(response.status).toBe(200);
    expect(d.listAccounts).toHaveBeenCalledWith('TOKEN_VALUE');
    expect(d.provisionPanel).toHaveBeenCalledTimes(1);
    const [, installRequest] = vi.mocked(d.provisionPanel).mock.calls[0];
    expect(installRequest).toEqual({
      accountId: 'a1',
      workerName: 'tehran-network-edge',
      adminPassword: expect.stringMatching(/^[A-Za-z0-9]{18}$/),
    });
    await expect(response.json()).resolves.toEqual({
      ok: true,
      workerUrl: 'https://pvnetwork-client.sub.workers.dev',
      workerName: 'pvnetwork-client',
      version: '0.1.0',
      schemaVersion: 1,
      adminUrl: 'https://pvnetwork-client.sub.workers.dev/admin',
      adminPassword: installRequest.adminPassword,
    });

    const retryable = await handleInstallerRequest(
      post('/api/install', { token: 'TOKEN_VALUE' }),
      env,
      deps({
        provisionPanel: vi
          .fn()
          .mockRejectedValue(new ProvisionError('worker', 'worker-upload-failed')),
      }),
    );
    expect(retryable.status).toBe(502);
    await expect(retryable.json()).resolves.toEqual({
      ok: false,
      stage: 'worker',
      code: 'worker-upload-failed',
    });
  });
  it('never leaks the submitted token through logs or failed responses', async () => {
    const token = 'SENTINEL_VALUE_A';
    const spies = [
      vi.spyOn(console, 'log').mockImplementation(() => undefined),
      vi.spyOn(console, 'error').mockImplementation(() => undefined),
      vi.spyOn(console, 'warn').mockImplementation(() => undefined),
    ];
    const response = await handleInstallerRequest(
      post('/api/install', { token }),
      env,
      deps({
        provisionPanel: vi.fn().mockRejectedValue(new ProvisionError('secret', 'secret-failed')),
      }),
    );
    const text = await response.text();
    expect(text).not.toContain(token);
    for (const spy of spies) expect(JSON.stringify(spy.mock.calls)).not.toContain('SENTINEL');
  });

  it('removes all OAuth/session endpoints after migration', async () => {
    for (const path of ['/api/oauth/start', '/api/oauth/callback', '/api/session', '/api/logout']) {
      const response = await handleInstallerRequest(
        new Request(`https://installer.example${path}`),
        env,
        deps(),
      );
      expect(response.status).toBe(404);
    }
  });
});
