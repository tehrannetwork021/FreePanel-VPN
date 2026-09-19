import { describe, expect, it, vi } from 'vitest';
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
