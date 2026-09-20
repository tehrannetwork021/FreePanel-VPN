import { describe, expect, it, vi } from 'vitest';
import { ProvisionError, provisionPanel, type ProvisionDeps } from './provision';

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
    uploadWorkerModule: async (_token, _account, _worker, _kv, _source, password) => {
      events.push(`worker:${password}`);
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
      return { ok: true, version: '0.1.0' };
    },
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
      'worker:correct-horse-1234',
      'subdomain',
      'enable',
      'health',
    ]);
    expect(result).toEqual({
      ok: true,
      workerUrl: 'https://pvnetwork-client.my-subdomain.workers.dev',
      workerName: 'pvnetwork-client',
      version: '0.1.0',
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
    expect(uploadAttempts).toBe(2);
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
