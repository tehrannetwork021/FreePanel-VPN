import { afterEach, describe, expect, it, vi } from 'vitest';
import type { InstallResult } from '@tehrannetwork/shared';
import type { InstallerEnv } from './env';
import { ProvisionError } from './provision';
import { handleInstallerRequest, type RouterDeps } from './router';
import { makeInstallSessionCookie } from './session';

const KEY = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
const now = Date.now();
const env = {
  COOKIE_KEY_B64: KEY,
  INSTALLER_ORIGIN: 'https://install.example.com',
  ASSETS: { fetch: vi.fn().mockResolvedValue(new Response('asset')) },
} as unknown as InstallerEnv;

async function cookieFor(token = 'oauth-token', expiresAt = now + 600_000) {
  const setCookie = await makeInstallSessionCookie(
    { accessToken: token, issuedAt: now, expiresAt },
    KEY,
  );
  return setCookie.split(';', 1)[0];
}

function deps(overrides: Partial<RouterDeps> = {}): RouterDeps {
  return {
    startOAuth: vi.fn().mockResolvedValue(new Response(null, { status: 302 })),
    finishOAuth: vi.fn().mockResolvedValue(new Response(null, { status: 302 })),
    listAccounts: vi.fn().mockResolvedValue([{ id: 'acct', name: 'Account' }]),
    provisionPanel: vi.fn().mockResolvedValue({
      ok: true,
      workerUrl: 'https://pvnetwork-client.sub.workers.dev',
      workerName: 'pvnetwork-client',
      version: '0.1.0',
    } satisfies InstallResult),
    revokeOAuth: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

afterEach(() => vi.restoreAllMocks());

describe('installer Worker router', () => {
  it('returns disconnected without a session and lists accounts with a valid session', async () => {
    const d = deps();
    const disconnected = await handleInstallerRequest(
      new Request('https://install.example.com/api/session'),
      env,
      d,
    );
    await expect(disconnected.json()).resolves.toEqual({ connected: false });

    const connected = await handleInstallerRequest(
      new Request('https://install.example.com/api/session', {
        headers: { cookie: await cookieFor() },
      }),
      env,
      d,
    );
    await expect(connected.json()).resolves.toMatchObject({
      connected: true,
      accounts: [{ id: 'acct', name: 'Account' }],
    });
  });

  it('fails closed and clears an expired session', async () => {
    const response = await handleInstallerRequest(
      new Request('https://install.example.com/api/session', {
        headers: { cookie: await cookieFor('expired-token', now - 1) },
      }),
      env,
      deps(),
    );
    expect(response.status).toBe(401);
    expect(response.headers.get('set-cookie')).toContain('__Host-tn_install_session=;');
    await expect(response.json()).resolves.toMatchObject({
      connected: false,
      error: 'authorization-expired',
    });
  });

  it('revokes authorization and clears cookies after a successful install without leaking secrets', async () => {
    const sentinelToken = 'SENTINEL-OAUTH-TOKEN';
    const sentinelPassword = 'SENTINEL-ADMIN-PASSWORD';
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const d = deps();
    const response = await handleInstallerRequest(
      new Request('https://install.example.com/api/install', {
        method: 'POST',
        headers: {
          cookie: await cookieFor(sentinelToken),
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          accountId: 'acct',
          workerName: 'pvnetwork-client',
          adminPassword: sentinelPassword,
        }),
      }),
      env,
      d,
    );

    expect(response.status).toBe(200);
    expect(d.revokeOAuth).toHaveBeenCalledWith(sentinelToken, env);
    expect(response.headers.get('set-cookie')).toContain('__Host-tn_install_session=;');
    const body = JSON.stringify(await response.json());
    expect(body).not.toContain(sentinelToken);
    expect(body).not.toContain(sentinelPassword);
    for (const spy of [log, error, warn]) {
      expect(JSON.stringify(spy.mock.calls)).not.toContain('SENTINEL');
    }
  });

  it('clears terminal permission errors but preserves retryable provisioning sessions', async () => {
    const cookie = await cookieFor();
    const permission = await handleInstallerRequest(
      new Request('https://install.example.com/api/install', {
        method: 'POST',
        headers: { cookie, 'content-type': 'application/json' },
        body: JSON.stringify({
          accountId: 'acct',
          workerName: 'pvnetwork-client',
          adminPassword: 'correct-horse-1234',
        }),
      }),
      env,
      deps({
        provisionPanel: vi
          .fn()
          .mockRejectedValue(new ProvisionError('account', 'insufficient-scope')),
      }),
    );
    expect(permission.status).toBe(403);
    expect(permission.headers.get('set-cookie')).toContain('__Host-tn_install_session=;');
    await expect(permission.json()).resolves.toEqual({
      ok: false,
      stage: 'account',
      code: 'insufficient-scope',
    });

    const retryable = await handleInstallerRequest(
      new Request('https://install.example.com/api/install', {
        method: 'POST',
        headers: { cookie, 'content-type': 'application/json' },
        body: JSON.stringify({
          accountId: 'acct',
          workerName: 'pvnetwork-client',
          adminPassword: 'correct-horse-1234',
        }),
      }),
      env,
      deps({
        provisionPanel: vi
          .fn()
          .mockRejectedValue(new ProvisionError('worker', 'worker-upload-failed')),
      }),
    );
    expect(retryable.status).toBe(502);
    expect(retryable.headers.get('set-cookie')).toBeNull();
  });
});
