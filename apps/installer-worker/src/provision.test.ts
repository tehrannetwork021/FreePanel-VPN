import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  defaultProvisionDeps,
  ProvisionError,
  provisionPanel,
  type ProvisionDeps,
} from './provision';

afterEach(() => vi.unstubAllGlobals());

describe('packaged edge artifact', () => {
  it('decodes data lazily once and preserves the exact deployable UTF-8 bytes', async () => {
    const decode = vi.fn(atob);
    vi.stubGlobal('atob', decode);
    const source = defaultProvisionDeps.artifact.source;
    expect(decode).toHaveBeenCalledTimes(1);
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(source));
    const actualSha = Array.from(new Uint8Array(hash), (byte) =>
      byte.toString(16).padStart(2, '0'),
    ).join('');
    expect(actualSha).toBe(defaultProvisionDeps.artifact.sha256);
    expect(defaultProvisionDeps.artifact.source).toBe(source);
    expect(decode).toHaveBeenCalledTimes(1);
  });
});

describe('real login success contract', () => {
  it.each([
    new Response('<html>Login</html>', { status: 200, headers: { 'content-type': 'text/html' } }),
    Response.json({ ok: false }),
    Response.json({ ok: true, expiresAt: Date.now() + 60000 }),
    Response.json(
      { ok: true, expiresAt: Date.now() + 60000 },
      { headers: { 'set-cookie': 'tn_session=value; Secure; HttpOnly; SameSite=Strict' } },
    ),
  ])('does not accept an HTTP 200 without a real authenticated session', async (response) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
    await expect(
      defaultProvisionDeps.verifyAdminLogin('https://panel.example', 'test-password'),
    ).resolves.toBe(false);
  });
  it('accepts the Worker login JSON only with both secure session cookies', async () => {
    const headers = new Headers();
    headers.append(
      'set-cookie',
      'tn_session=session-value; Path=/; Secure; HttpOnly; SameSite=Strict',
    );
    headers.append('set-cookie', 'tn_csrf=csrf-value; Path=/; Secure; SameSite=Strict');
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(Response.json({ ok: true, expiresAt: Date.now() + 60000 }, { headers })),
    );
    await expect(
      defaultProvisionDeps.verifyAdminLogin('https://panel.example', 'test-password'),
    ).resolves.toBe(true);
  });
});

const accessToken = 'test-token';
const request = {
  accountId: 'acct-1',
  workerName: 'pvnetwork-client',
  adminPassword: 'correct-horse-1234',
};

function makeDeps(events: string[], overrides: Partial<ProvisionDeps> = {}): ProvisionDeps {
  const source = 'export default {}';
  return {
    artifact: {
      source,
      sha256: '9aeb8d59b4d483ca6298e9a450fbf37dfd2b4c63990135ab1d040d76314087ec',
      version: '0.1.0',
    },
    listAccounts: async () => {
      events.push('account');
      return [{ id: 'acct-1', name: 'Account' }];
    },
    findOrCreateKvNamespace: async () => {
      events.push('kv');
      return { id: 'kv-1', title: 'pvnetwork-client-config' };
    },
    findOrCreateD1Database: async () => {
      events.push('d1');
      return { uuid: 'db-1', name: 'pvnetwork-client-control' };
    },
    uploadWorkerModule: async (
      _token,
      _account,
      _worker,
      _kv,
      _db,
      _source,
      password,
      generation,
    ) => {
      events.push(`worker:${password}:${generation}`);
    },
    ensureAccountSubdomain: async () => {
      events.push('subdomain');
      return 'my-subdomain';
    },
    enableScriptSubdomain: async () => {
      events.push('enable');
    },
    fetchHealth: async () => {
      events.push('health');
      return { ok: true, version: '0.1.0', schemaVersion: 1, d1: true };
    },
    verifyAdminLogin: async (_url, password) => {
      events.push(`login:${password}`);
      return true;
    },
    generateInstallGeneration: () => 'gen-test',
    now: () => Date.now(),
    sleep: async () => undefined,
    ...overrides,
  };
}

describe('panel provisioning', () => {
  it('validates then provisions in order and returns the final workers.dev URL', async () => {
    const events: string[] = [];
    const result = await provisionPanel(accessToken, request, makeDeps(events));
    expect(events).toEqual([
      'account',
      'kv',
      'd1',
      'worker:correct-horse-1234:gen-test',
      'subdomain',
      'enable',
      'health',
      'login:correct-horse-1234',
    ]);
    expect(result).toEqual({
      ok: true,
      workerUrl: 'https://pvnetwork-client.my-subdomain.workers.dev',
      workerName: 'pvnetwork-client',
      version: '0.1.0',
      schemaVersion: 1,
      adminUrl: 'https://pvnetwork-client.my-subdomain.workers.dev/admin',
    });
  });

  it('rejects invalid input before any Cloudflare API call', async () => {
    const events: string[] = [];
    await expect(
      provisionPanel(accessToken, { ...request, workerName: '../bad' }, makeDeps(events)),
    ).rejects.toMatchObject({ code: 'invalid-worker-name' });
    expect(events).toEqual([]);
  });

  it('re-enters deterministic KV resolution on retry after a partial Worker failure', async () => {
    const events: string[] = [];
    let uploadAttempts = 0;
    const deps = makeDeps(events, {
      uploadWorkerModule: async () => {
        uploadAttempts += 1;
        events.push(`worker-${uploadAttempts}`);
        if (uploadAttempts === 1) throw new Error('network');
      },
    });

    await expect(provisionPanel(accessToken, request, deps)).rejects.toMatchObject({
      stage: 'worker',
      code: 'worker-upload-failed',
    });
    events.length = 0;
    await expect(provisionPanel(accessToken, request, deps)).resolves.toMatchObject({ ok: true });
    expect(events.filter((event) => event === 'kv')).toHaveLength(1);
    expect(events.filter((event) => event === 'd1')).toHaveLength(1);
    expect(uploadAttempts).toBe(2);
  });

  it('does not report success when the deployed Worker rejects the displayed admin password', async () => {
    const events: string[] = [];
    let now = 10_000;
    const verifyAdminLogin = vi.fn().mockResolvedValue(false);
    const deps = makeDeps(events, {
      verifyAdminLogin,
      now: () => now,
      sleep: async (ms) => {
        now += ms;
      },
    });

    await expect(provisionPanel(accessToken, request, deps)).rejects.toEqual(
      new ProvisionError('health', 'health-failed'),
    );
    expect(verifyAdminLogin).toHaveBeenCalledWith(
      'https://pvnetwork-client.my-subdomain.workers.dev',
      request.adminPassword,
    );
  });

  it('bounds health polling to 30 seconds and returns a health-stage failure', async () => {
    const events: string[] = [];
    let now = 10_000;
    const fetchHealth = vi.fn().mockResolvedValue({ ok: false, version: '0.1.0' });
    const deps = makeDeps(events, {
      fetchHealth,
      now: () => now,
      sleep: async (ms) => {
        now += ms;
      },
    });

    await expect(provisionPanel(accessToken, request, deps)).rejects.toEqual(
      new ProvisionError('health', 'health-failed'),
    );
    expect(fetchHealth.mock.calls.length).toBeGreaterThan(1);
    expect(fetchHealth.mock.calls.length).toBeLessThanOrEqual(30);
    expect(now).toBeLessThanOrEqual(40_000);
  });
});
