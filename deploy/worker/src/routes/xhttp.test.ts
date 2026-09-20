import { describe, expect, it, vi } from 'vitest';
import { concatBytes } from '../core/bytes';
import { uuidToBytes } from '../core/uuid';
import { createUser } from '../db/users';
import { deriveVlessUuid } from '../security/derivedSecrets';
import { createFakeD1 } from '../test/fakeD1';
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

function vlessPacket(uuid: string) {
  const host = new TextEncoder().encode('example.com');
  return concatBytes(
    new Uint8Array([0]),
    uuidToBytes(uuid),
    new Uint8Array([0, 1, 0, 80, 2, host.length]),
    host,
  );
}

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

describe('per-user XHTTP tunnel parser', () => {
  it('uses the separate vless-xhttp permission and returns the user principal', async () => {
    const db = createFakeD1();
    const seed = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    const user = await createUser(db, { name: 'XHTTP U' }, 1_000, seed);
    const uuid = await deriveVlessUuid(seed, user.id, 1);
    let parsed: any;
    const response = await handleXhttpRoute(req('/xhttp'), config, {
      db,
      now: () => 2_000,
      createStreamResponse: async ({ parseFirstPacket }) => {
        parsed = await parseFirstPacket(vlessPacket(uuid));
        return new Response('ok');
      },
    });
    expect(response?.status).toBe(200);
    expect(parsed).toMatchObject({
      kind: 'ok',
      value: { principal: { kind: 'user', userId: user.id, channel: 'vless-xhttp' } },
    });
  });
});

describe('XHTTP route usage factory', () => {
  it('records per-user usage through the stream meter factory', async () => {
    const db = createFakeD1();
    const now = Date.parse('2026-09-20T12:00:00Z');
    const user = await createUser(db, { name: 'XHTTP meter' }, now);
    const response = await handleXhttpRoute(req('/xhttp'), config, {
      db,
      now: () => now,
      createStreamResponse: async ({ createUsageMeter }) => {
        const meter = createUsageMeter?.({ kind: 'user', userId: user.id, channel: 'vless-xhttp' });
        meter?.addDownload(40);
        await meter?.close();
        return new Response('ok');
      },
    });
    expect(response?.status).toBe(200);
    expect(db.state().users.get(user.id)?.total_used_bytes).toBe(40);
    expect(db.state().usageDaily.get(`${user.id}:2026-09-20`)).toMatchObject({
      download_bytes: 40,
      connections: 1,
    });
  });
});
