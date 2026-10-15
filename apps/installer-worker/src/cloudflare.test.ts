import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CloudflareApiError,
  enableScriptSubdomain,
  ensureAccountSubdomain,
  findOrCreateD1Database,
  findOrCreateKvNamespace,
  listAccounts,
  uploadWorkerModule,
  verifyApiToken,
} from './cloudflare';

function ok(result: unknown, resultInfo?: unknown) {
  return new Response(JSON.stringify({ success: true, result, result_info: resultInfo }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function fail(status: number, code = 1000) {
  return new Response(
    JSON.stringify({
      success: false,
      result: null,
      errors: [{ code, message: 'SECRET RAW DETAIL' }],
    }),
    { status, headers: { 'content-type': 'application/json' } },
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('Cloudflare provisioning API', () => {
  it.each([
    { name: 'verification', operation: verifyApiToken },
    { name: 'account discovery', operation: listAccounts },
  ])('bounds stalled API requests and response bodies for $name', async ({ operation }) => {
    vi.useFakeTimers();
    for (const phase of ['headers', 'body']) {
      vi.stubGlobal(
        'fetch',
        vi.fn((_url: string, init?: RequestInit) => {
          if (phase === 'headers') {
            return new Promise<Response>((_resolve, reject) => {
              init?.signal?.addEventListener('abort', () => reject(new Error('SECRET RAW DETAIL')));
            });
          }
          return Promise.resolve(
            new Response(
              new ReadableStream({
                start(controller) {
                  init?.signal?.addEventListener('abort', () =>
                    controller.error(new Error('SECRET RAW DETAIL')),
                  );
                },
              }),
            ),
          );
        }),
      );
      let outcome: unknown;
      void operation('SECRET_TOKEN_SENTINEL').then(
        () => {
          outcome = 'unexpected-success';
        },
        (error: unknown) => {
          outcome = error;
        },
      );
      await vi.advanceTimersByTimeAsync(30_000);
      expect(outcome, phase).toBeInstanceOf(CloudflareApiError);
      expect((outcome as Error).message).toBe('cloudflare-api-failed');
      expect(String(outcome)).not.toContain('SECRET');
      expect(vi.getTimerCount()).toBe(0);
    }
  });

  it('distinguishes API outages from invalid credentials and releases the timer on success', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('SECRET RAW DETAIL')));
    await expect(verifyApiToken('SECRET_TOKEN_SENTINEL')).rejects.toThrow('cloudflare-api-failed');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fail(503)));
    await expect(verifyApiToken('SECRET_TOKEN_SENTINEL')).rejects.toThrow('cloudflare-api-failed');
    const activeFetch = vi.fn().mockResolvedValue(ok({ status: 'active' }));
    vi.stubGlobal('fetch', activeFetch);
    await verifyApiToken('SECRET_TOKEN_SENTINEL');
    expect(activeFetch.mock.calls[0]?.[1]).toMatchObject({ redirect: 'manual' });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('rejects API redirects without parsing an active-looking body or forwarding the token', async () => {
    const fetchMock = vi.fn().mockImplementation(
      () =>
        new Response(JSON.stringify({ success: true, result: { status: 'active' } }), {
          status: 302,
          headers: { location: 'https://unexpected.example/credential-sink' },
        }),
    );
    vi.stubGlobal('fetch', fetchMock);
    await expect(verifyApiToken('SECRET_TOKEN_SENTINEL')).rejects.toThrow('cloudflare-api-failed');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ redirect: 'manual' });
  });

  it('accepts only active API tokens and sanitizes invalid token failures', async () => {
    const activeFetch = vi.fn().mockResolvedValue(ok({ id: 't1', status: 'active' }));
    vi.stubGlobal('fetch', activeFetch);
    await expect(verifyApiToken('SECRET_TOKEN_SENTINEL')).resolves.toBeUndefined();
    expect(activeFetch.mock.calls[0]?.[0]).toContain('/user/tokens/verify');

    for (const response of [
      ok({ id: 't1', status: 'disabled' }),
      ok({ id: 't1', status: 'expired' }),
      fail(401, 10000),
    ]) {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
      try {
        await verifyApiToken('SECRET_TOKEN_SENTINEL');
        throw new Error('expected-failure');
      } catch (error) {
        expect(error).toBeInstanceOf(CloudflareApiError);
        expect((error as Error).message).toBe('token-invalid');
        expect(String(error)).not.toContain('SECRET_TOKEN_SENTINEL');
        expect(String(error)).not.toContain('SECRET RAW DETAIL');
      }
    }
  });

  it('paginates accounts with the expected API path', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(ok([{ id: 'a1', name: 'One' }], { page: 1, total_pages: 2 }))
      .mockResolvedValueOnce(ok([{ id: 'a2', name: 'Two' }], { page: 2, total_pages: 2 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(listAccounts('token')).resolves.toEqual([
      { id: 'a1', name: 'One' },
      { id: 'a2', name: 'Two' },
    ]);
    expect(fetchMock.mock.calls[0]?.[0]).toContain('/accounts?per_page=50&page=1');
    expect(fetchMock.mock.calls[1]?.[0]).toContain('/accounts?per_page=50&page=2');
  });

  it('reuses the deterministic KV namespace and creates only when absent', async () => {
    const reuseFetch = vi
      .fn()
      .mockResolvedValue(
        ok([{ id: 'kv-existing', title: 'pvnetwork-client-config' }], { page: 1, total_pages: 1 }),
      );
    vi.stubGlobal('fetch', reuseFetch);
    await expect(findOrCreateKvNamespace('token', 'acct', 'pvnetwork-client')).resolves.toEqual({
      id: 'kv-existing',
      title: 'pvnetwork-client-config',
    });
    expect(reuseFetch).toHaveBeenCalledTimes(1);

    const createFetch = vi
      .fn()
      .mockResolvedValueOnce(ok([], { page: 1, total_pages: 1 }))
      .mockResolvedValueOnce(ok({ id: 'kv-new', title: 'pvnetwork-client-config' }));
    vi.stubGlobal('fetch', createFetch);
    await expect(
      findOrCreateKvNamespace('token', 'acct', 'pvnetwork-client'),
    ).resolves.toMatchObject({
      id: 'kv-new',
    });
    expect(createFetch.mock.calls[1]?.[0]).toContain('/accounts/acct/storage/kv/namespaces');
    expect((createFetch.mock.calls[1]?.[1] as RequestInit).method).toBe('POST');
    expect((createFetch.mock.calls[1]?.[1] as RequestInit).body).toBe(
      JSON.stringify({ title: 'pvnetwork-client-config' }),
    );
  });

  it('reuses a deterministic D1 database and creates it only when absent', async () => {
    const reuseFetch = vi
      .fn()
      .mockResolvedValue(ok([{ uuid: 'db-existing', name: 'pvnetwork-client-control' }]));
    vi.stubGlobal('fetch', reuseFetch);
    await expect(findOrCreateD1Database('token', 'acct', 'pvnetwork-client')).resolves.toEqual({
      uuid: 'db-existing',
      name: 'pvnetwork-client-control',
    });
    expect(reuseFetch).toHaveBeenCalledTimes(1);

    const createFetch = vi
      .fn()
      .mockResolvedValueOnce(ok([]))
      .mockResolvedValueOnce(ok({ uuid: 'db-new', name: 'pvnetwork-client-control' }));
    vi.stubGlobal('fetch', createFetch);
    await expect(
      findOrCreateD1Database('token', 'acct', 'pvnetwork-client'),
    ).resolves.toMatchObject({
      uuid: 'db-new',
    });
    expect((createFetch.mock.calls[1]?.[1] as RequestInit).method).toBe('POST');
  });

  it('uploads KV and ADMIN_PASSWORD atomically in the deployed Worker version', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({}));
    vi.stubGlobal('fetch', fetchMock);
    await uploadWorkerModule(
      'token',
      'acct',
      'pvnetwork-client',
      'kv-id',
      'db-id',
      'export default {};',
      'short-pass',
      'gen-1',
    );

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('/accounts/acct/workers/scripts/pvnetwork-client');
    expect(init.method).toBe('PUT');
    const form = init.body as FormData;
    const metadata = JSON.parse(await (form.get('metadata') as Blob).text());
    expect(metadata).toEqual({
      main_module: 'worker.mjs',
      compatibility_date: '2026-09-19',
      bindings: [
        { type: 'kv_namespace', name: 'C', namespace_id: 'kv-id' },
        { type: 'd1', name: 'DB', database_id: 'db-id' },
        { type: 'secret_text', name: 'ADMIN_PASSWORD', text: 'short-pass' },
        { type: 'plain_text', name: 'INSTALL_GENERATION', text: 'gen-1' },
      ],
    });
    expect(await (form.get('worker.mjs') as Blob).text()).toBe('export default {};');
    expect(await (form.get('worker.mjs') as Blob).text()).not.toContain('short-pass');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('enables workers.dev after upload', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(ok({ subdomain: 'existing-subdomain' }))
      .mockResolvedValueOnce(ok({ enabled: true, previews_enabled: false }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(ensureAccountSubdomain('token', 'acct', 'pvnetwork-client')).resolves.toBe(
      'existing-subdomain',
    );
    await enableScriptSubdomain('token', 'acct', 'pvnetwork-client');

    expect(fetchMock.mock.calls[1]?.[0]).toContain('/workers/scripts/pvnetwork-client/subdomain');
    expect((fetchMock.mock.calls[1]?.[1] as RequestInit).body).toBe(
      JSON.stringify({ enabled: true, previews_enabled: false }),
    );
  });

  it('creates a missing account workers.dev subdomain with bounded collision retries', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(ok({ subdomain: '' }))
      .mockResolvedValueOnce(fail(409, 10090))
      .mockResolvedValueOnce(ok({ subdomain: 'tn-created' }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(ensureAccountSubdomain('token', 'acct', 'pvnetwork-client')).resolves.toBe(
      'tn-created',
    );
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect((fetchMock.mock.calls[1]?.[1] as RequestInit).method).toBe('PUT');
    expect((fetchMock.mock.calls[2]?.[1] as RequestInit).method).toBe('PUT');
  });

  it('maps permission failures to a sanitized local error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fail(403, 9109)));
    try {
      await listAccounts('token');
      throw new Error('expected-failure');
    } catch (error) {
      expect(error).toBeInstanceOf(CloudflareApiError);
      expect((error as Error).message).toBe('insufficient-scope');
      expect(String(error)).not.toContain('SECRET RAW DETAIL');
    }
  });
});
