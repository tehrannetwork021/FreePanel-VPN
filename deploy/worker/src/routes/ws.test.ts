import { describe, expect, it, vi } from 'vitest';
import { concatBytes } from '../core/bytes';
import { sha224Hex } from '../core/sha224';
import { uuidToBytes } from '../core/uuid';
import { createUser, updateUser } from '../db/users';
import { deriveTrojanPassword, deriveVlessUuid } from '../security/derivedSecrets';
import { createFakeD1 } from '../test/fakeD1';
import type { ProtocolConfig } from '../config/model';
import type { FirstPacketParser } from '../transport/websocket';
import { handleWebSocketRoute } from './ws';

const config: ProtocolConfig = {
  schemaVersion: 1,
  createdAt: '2026-09-19T00:00:00.000Z',
  vless: { enabled: true, uuid: '27848739-7e62-4138-9fd3-098a63964b6b', path: '/vless' },
  trojan: { enabled: true, password: 'secret', passwordHash: 'a'.repeat(56), path: '/trojan' },
  xhttp: { enabled: true, path: '/xhttp', mode: 'stream-one' },
  subscription: { token: 'sub-token', path: '/sub' },
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

function trojanPacket(hash: string) {
  const host = new TextEncoder().encode('example.com');
  return concatBytes(
    new TextEncoder().encode(hash),
    new Uint8Array([13, 10, 1, 3, host.length]),
    host,
    new Uint8Array([0, 80, 13, 10]),
  );
}

function request(path: string, options: { method?: string; upgrade?: boolean } = {}) {
  return new Request(`https://edge.example.dev${path}`, {
    method: options.method ?? 'GET',
    headers: options.upgrade === false ? {} : { Upgrade: 'websocket' },
  });
}

describe('WebSocket protocol routes', () => {
  it.each([
    ['/vless', 'vless'],
    ['/trojan', 'trojan'],
  ] as const)(
    'selects %s and constructs the matching authenticated parser',
    async (path, expectedKind) => {
      const seen: Array<{ kind: string; parser: FirstPacketParser }> = [];
      const response = await handleWebSocketRoute(request(path), config, {
        connectTcp: vi.fn() as any,
        createUpgradeResponse: ({ kind, parseFirstPacket }) => {
          seen.push({ kind, parser: parseFirstPacket });
          return new Response('upgrade-test', { status: 200 });
        },
      });
      expect(response?.status).toBe(200);
      expect(seen).toHaveLength(1);
      expect(seen[0]?.kind).toBe(expectedKind);
      expect(typeof seen[0]?.parser).toBe('function');
    },
  );

  it('returns service unavailable for default tunnel paths before owner setup', async () => {
    expect((await handleWebSocketRoute(request('/vless'), null))?.status).toBe(503);
    expect((await handleWebSocketRoute(request('/trojan'), null))?.status).toBe(503);
  });

  it('hides disabled protocols and ignores unrelated paths', async () => {
    const disabled = structuredClone(config);
    disabled.vless.enabled = false;
    expect((await handleWebSocketRoute(request('/vless'), disabled))?.status).toBe(404);
    expect(await handleWebSocketRoute(request('/other'), config)).toBeNull();
  });

  it('requires GET and a WebSocket Upgrade header', async () => {
    expect(
      (await handleWebSocketRoute(request('/vless', { method: 'POST' }), config))?.status,
    ).toBe(405);
    expect(
      (await handleWebSocketRoute(request('/vless', { upgrade: false }), config))?.status,
    ).toBe(426);
  });

  it('uses configured custom paths instead of exposing defaults', async () => {
    const custom = structuredClone(config);
    custom.vless.path = '/secret-v';
    expect(await handleWebSocketRoute(request('/vless'), custom)).toBeNull();
    const response = await handleWebSocketRoute(request('/secret-v'), custom, {
      connectTcp: vi.fn() as any,
      createUpgradeResponse: () => new Response('ok'),
    });
    expect(response?.status).toBe(200);
  });
});

describe('per-user WebSocket tunnel parsers', () => {
  it('authorizes independent VLESS users, denies a paused indexed user, and keeps legacy fallback', async () => {
    const db = createFakeD1();
    const seed = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    const user1 = await createUser(db, { name: 'U1' }, 1_000, seed);
    const user2 = await createUser(db, { name: 'U2' }, 1_001, seed);
    const uuid1 = await deriveVlessUuid(seed, user1.id, 1);
    const uuid2 = await deriveVlessUuid(seed, user2.id, 1);
    let parser!: FirstPacketParser;
    await handleWebSocketRoute(request('/vless'), config, {
      db,
      now: () => 2_000,
      connectTcp: vi.fn() as any,
      createUpgradeResponse: ({ parseFirstPacket }) => {
        parser = parseFirstPacket;
        return new Response('ok');
      },
    });
    await expect(parser(vlessPacket(uuid1))).resolves.toMatchObject({
      kind: 'ok',
      value: { principal: { kind: 'user', userId: user1.id } },
    });
    await expect(parser(vlessPacket(uuid2))).resolves.toMatchObject({
      kind: 'ok',
      value: { principal: { kind: 'user', userId: user2.id } },
    });
    const paused = await updateUser(db, user2.id, { enabled: false }, user2.version, 1_500);
    expect(paused.enabled).toBe(false);
    await expect(parser(vlessPacket(uuid2))).resolves.toEqual({ kind: 'error', code: 'auth' });
    await expect(parser(vlessPacket(config.vless.uuid))).resolves.toMatchObject({
      kind: 'ok',
      value: { principal: { kind: 'legacy', channel: 'vless-ws' } },
    });
  });
  it('authorizes a per-user Trojan hash and preserves the owner hash fallback', async () => {
    const db = createFakeD1();
    const seed = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    const user = await createUser(db, { name: 'Trojan U' }, 1_000, seed);
    const password = await deriveTrojanPassword(seed, user.id, 1);
    let parser!: FirstPacketParser;
    await handleWebSocketRoute(request('/trojan'), config, {
      db,
      now: () => 2_000,
      connectTcp: vi.fn() as any,
      createUpgradeResponse: ({ parseFirstPacket }) => {
        parser = parseFirstPacket;
        return new Response('ok');
      },
    });
    await expect(parser(trojanPacket(sha224Hex(password)))).resolves.toMatchObject({
      kind: 'ok',
      value: { principal: { kind: 'user', userId: user.id, channel: 'trojan-ws' } },
    });
    await expect(parser(trojanPacket(config.trojan.passwordHash))).resolves.toMatchObject({
      kind: 'ok',
      value: { principal: { kind: 'legacy', channel: 'trojan-ws' } },
    });
  });
});

describe('WebSocket route usage factory', () => {
  it('records a user tunnel through the route-provided coarse meter', async () => {
    const db = createFakeD1();
    const now = Date.parse('2026-09-20T12:00:00Z');
    const user = await createUser(db, { name: 'Meter route' }, now);
    let meter: any;
    const response = await handleWebSocketRoute(request('/vless'), config, {
      db,
      now: () => now,
      connectTcp: vi.fn() as any,
      createUpgradeResponse: ({ createUsageMeter }) => {
        meter = createUsageMeter?.({ kind: 'user', userId: user.id, channel: 'vless-ws' });
        return new Response('ok');
      },
    });
    expect(response?.status).toBe(200);
    meter.addUpload(25);
    await meter.close();
    expect(db.state().users.get(user.id)?.total_used_bytes).toBe(25);
    const row = db.state().usageDaily.get(`${user.id}:2026-09-20`);
    expect(row).toMatchObject({ upload_bytes: 25, connections: 1 });
  });
});
