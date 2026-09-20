import type { ProtocolConfig } from '../config/model';
import { ensureControlPlaneSchema } from '../db/migrations';
import { recordUsageDelta } from '../db/usage';
import type { ConnectTcp } from '../network/tcp';
import { openTcp } from '../network/tcp';
import { parseTrojanCandidate, parseTrojanRequest } from '../protocols/trojan';
import { parseVlessCandidate, parseVlessRequest } from '../protocols/vless';
import {
  resolveTunnelPrincipal,
  type TunnelChannel,
  type TunnelPrincipal,
} from '../security/tunnelAuth';
import { createUsageMeter as makeUsageMeter, type UsageMeter } from '../transport/usageMeter';
import {
  runWebSocketTunnel,
  type FirstPacketParser,
  type ParsedFirstPacket,
  type TunnelWebSocket,
} from '../transport/websocket';
import type { ParseResult } from '../core/types';

type ProtocolKind = 'vless' | 'trojan';

type UpgradeInput = {
  kind: ProtocolKind;
  parseFirstPacket: FirstPacketParser;
  connectTcp: ConnectTcp;
  selfHost: string;
  createUsageMeter?: (principal: TunnelPrincipal) => UsageMeter | null;
};

type RouteDeps = {
  db?: D1Database;
  now?: () => number;
  connectTcp?: ConnectTcp;
  createUpgradeResponse?: (input: UpgradeInput) => Response;
};

function text(status: number, message: string): Response {
  return new Response(message, { status, headers: { 'cache-control': 'no-store' } });
}

function authError(): ParseResult<ParsedFirstPacket> {
  return { kind: 'error', code: 'auth' };
}

async function authorizeVless(
  input: Uint8Array,
  config: ProtocolConfig,
  db: D1Database | undefined,
  channel: Extract<TunnelChannel, 'vless-ws'>,
  now: number,
): Promise<ParseResult<ParsedFirstPacket>> {
  const candidate = parseVlessCandidate(input);
  if (candidate.kind !== 'ok') return candidate;
  if (db) {
    const auth = await resolveTunnelPrincipal(
      db,
      channel,
      candidate.value.presentedCredential,
      now,
    );
    if (auth.kind === 'denied-user') return authError();
    if (auth.kind === 'authorized') {
      return { kind: 'ok', value: { ...candidate.value, principal: auth.principal } };
    }
  }
  const legacy = parseVlessRequest(input, config.vless.uuid);
  if (legacy.kind !== 'ok') return legacy;
  return { kind: 'ok', value: { ...legacy.value, principal: { kind: 'legacy', channel } } };
}

async function authorizeTrojan(
  input: Uint8Array,
  config: ProtocolConfig,
  db: D1Database | undefined,
  channel: Extract<TunnelChannel, 'trojan-ws'>,
  now: number,
): Promise<ParseResult<ParsedFirstPacket>> {
  const candidate = parseTrojanCandidate(input);
  if (candidate.kind !== 'ok') return candidate;
  if (db) {
    const auth = await resolveTunnelPrincipal(
      db,
      channel,
      candidate.value.presentedCredential,
      now,
    );
    if (auth.kind === 'denied-user') return authError();
    if (auth.kind === 'authorized') {
      return { kind: 'ok', value: { ...candidate.value, principal: auth.principal } };
    }
  }
  const legacy = parseTrojanRequest(input, config.trojan.passwordHash);
  if (legacy.kind !== 'ok') return legacy;
  return { kind: 'ok', value: { ...legacy.value, principal: { kind: 'legacy', channel } } };
}

function cloudflareUpgrade(input: UpgradeInput): Response {
  const pair = new WebSocketPair();
  const client = pair[0];
  const server = pair[1];
  server.accept();
  const tunnelSocket: TunnelWebSocket = {
    send: (data) => server.send(data),
    close: (code, reason) => server.close(code, reason),
    addEventListener: (type, listener) => {
      if (type === 'message') server.addEventListener('message', (event) => listener(event));
      else if (type === 'close') server.addEventListener('close', (event) => listener(event));
      else if (type === 'error') server.addEventListener('error', (event) => listener(event));
    },
  };
  runWebSocketTunnel({
    webSocket: tunnelSocket,
    parseFirstPacket: input.parseFirstPacket,
    connectTcp: input.connectTcp,
    selfHost: input.selfHost,
    createUsageMeter: input.createUsageMeter,
  });
  return new Response(null, { status: 101, webSocket: client });
}

export async function handleWebSocketRoute(
  request: Request,
  config: ProtocolConfig | null,
  deps: RouteDeps = {},
): Promise<Response | null> {
  const url = new URL(request.url);
  if (!config) {
    if (url.pathname === '/vless' || url.pathname === '/trojan')
      return text(503, 'Owner setup required');
    return null;
  }

  let kind: ProtocolKind;
  let parseFirstPacket: FirstPacketParser;
  let enabled: boolean;
  if (url.pathname === config.vless.path) {
    kind = 'vless';
    enabled = config.vless.enabled;
    parseFirstPacket = (input) =>
      authorizeVless(input, config, deps.db, 'vless-ws', deps.now?.() ?? Date.now());
  } else if (url.pathname === config.trojan.path) {
    kind = 'trojan';
    enabled = config.trojan.enabled;
    parseFirstPacket = (input) =>
      authorizeTrojan(input, config, deps.db, 'trojan-ws', deps.now?.() ?? Date.now());
  } else {
    return null;
  }

  if (!enabled) return text(404, 'Not found');
  if (request.method !== 'GET') return text(405, 'Method not allowed');
  if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket')
    return text(426, 'WebSocket upgrade required');
  if (deps.db) await ensureControlPlaneSchema(deps.db);

  const usageFactory = deps.db
    ? (principal: TunnelPrincipal): UsageMeter | null =>
        principal.kind === 'user'
          ? makeUsageMeter({
              now: deps.now,
              write: (delta) =>
                recordUsageDelta(deps.db!, principal.userId, delta, deps.now?.() ?? Date.now()),
            })
          : null
    : undefined;
  const input: UpgradeInput = {
    kind,
    parseFirstPacket,
    connectTcp: deps.connectTcp ?? openTcp,
    selfHost: url.hostname,
    createUsageMeter: usageFactory,
  };
  return (deps.createUpgradeResponse ?? cloudflareUpgrade)(input);
}
