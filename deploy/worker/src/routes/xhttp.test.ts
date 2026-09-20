import { describe, expect, it, vi } from 'vitest';
import type { ProtocolConfig } from '../config/model';
import { handleXhttpRoute } from './xhttp';

const config: ProtocolConfig = {
  schemaVersion: 1,
  createdAt: '2026-09-19T00:00:00.000Z',
  vless: { enabled: true, uuid: '27848739-7e62-4138-9fd3-098a63964b6b', path: '/vless' },
  trojan: { enabled: true, password: 'secret', passwordHash: 'a'.repeat(56), path: '/trojan' },
  xhttp: { enabled: true, path: '/xhttp', mode: 'stream-one' },
  subscription: { token: 'sub', path: '/sub' },
};

const req = (path: string, method = 'POST') =>
  new Request(`https://edge.example.dev${path}`, {
    method,
    body: method === 'POST' ? new Uint8Array([1]) : undefined,
    ...(method === 'POST' ? ({ duplex: 'half' } as any) : {}),
  });

describe('XHTTP route', () => {
  it('accepts the configured path and the canonical trailing slash', async () => {
    const handle = vi.fn(async () => new Response('ok'));
    expect(
      (await handleXhttpRoute(req('/xhttp'), config, { createStreamResponse: handle }))?.status,
    ).toBe(200);
    expect(
      (await handleXhttpRoute(req('/xhttp/'), config, { createStreamResponse: handle }))?.status,
    ).toBe(200);
    expect(handle).toHaveBeenCalledTimes(2);
  });

  it('does not accept stream-one session-style extra path segments', async () => {
    expect(
      await handleXhttpRoute(req('/xhttp/session-id'), config, { createStreamResponse: vi.fn() }),
    ).toBeNull();
  });

  it('requires setup, enabled protocol and POST', async () => {
    expect((await handleXhttpRoute(req('/xhttp'), null))?.status).toBe(503);
    const disabled = structuredClone(config);
    disabled.xhttp.enabled = false;
    expect((await handleXhttpRoute(req('/xhttp'), disabled))?.status).toBe(404);
    expect((await handleXhttpRoute(req('/xhttp', 'GET'), config))?.status).toBe(405);
  });

  it('reports POST attempts for diagnostics but never non-POST or foreign paths', async () => {
    const statuses: number[] = [];
    const deps = {
      createStreamResponse: vi.fn(async () => new Response('ok')),
      onAttempt: (status: number) => statuses.push(status),
    };
    await handleXhttpRoute(req('/xhttp'), config, deps);
    expect(statuses).toEqual([200]);

    statuses.length = 0;
    const invalidAuth = {
      ...deps,
      createStreamResponse: vi.fn(
        async () => new Response('Invalid XHTTP handshake', { status: 403 }),
      ),
    };
    await handleXhttpRoute(req('/xhttp'), config, invalidAuth);
    expect(statuses).toEqual([403]);

    statuses.length = 0;
    const disabled = structuredClone(config);
    disabled.xhttp.enabled = false;
    await handleXhttpRoute(req('/xhttp'), disabled, deps);
    expect(statuses).toEqual([404]);

    statuses.length = 0;
    await handleXhttpRoute(req('/xhttp/session-id'), config, deps);
    await handleXhttpRoute(req('/xhttp', 'GET'), config, deps);
    expect(statuses).toEqual([]);
  });
});
