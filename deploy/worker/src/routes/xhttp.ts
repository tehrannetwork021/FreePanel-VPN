import type { ProtocolConfig } from '../config/model';
import { ensureControlPlaneSchema } from '../db/migrations';
import { recordUsageDelta } from '../db/usage';
import type { ParseResult } from '../core/types';
import type { ConnectTcp } from '../network/tcp';
import { openTcp } from '../network/tcp';
import { parseVlessCandidate, parseVlessRequest } from '../protocols/vless';
import { resolveTunnelPrincipal, type TunnelPrincipal } from '../security/tunnelAuth';
import { createUsageMeter as makeUsageMeter, type UsageMeter } from '../transport/usageMeter';
import { createXhttpStream } from '../transport/xhttp';
import type { ParsedFirstPacket } from '../transport/websocket';

type StreamInput = Parameters<typeof createXhttpStream>[0];
type RouteDeps = {
  db?: D1Database;
  now?: () => number;
  connectTcp?: ConnectTcp;
  createStreamResponse?: (input: StreamInput) => Promise<Response>;
  onAttempt?: (status: number) => void;
};

const text = (status: number, message: string) =>
  new Response(message, { status, headers: { 'cache-control': 'no-store' } });

function normalizedBase(path: string): string {
  if (path.length > 1 && path.endsWith('/')) return path.slice(0, -1);
  return path;
}

function isXhttpPath(pathname: string, configured: string): boolean {
  const base = normalizedBase(configured);
  return pathname === base || pathname === `${base}/`;
}

async function authorizeXhttp(
  input: Uint8Array,
  config: ProtocolConfig,
  db: D1Database | undefined,
  now: number,
): Promise<ParseResult<ParsedFirstPacket>> {
  const candidate = parseVlessCandidate(input);
  if (candidate.kind !== 'ok') return candidate;
  if (db) {
    const auth = await resolveTunnelPrincipal(
      db,
      'vless-xhttp',
      candidate.value.presentedCredential,
      now,
    );
    if (auth.kind === 'denied-user') return { kind: 'error', code: 'auth' };
    if (auth.kind === 'authorized') {
      return { kind: 'ok', value: { ...candidate.value, principal: auth.principal } };
    }
  }
  const legacy = parseVlessRequest(input, config.vless.uuid);
  if (legacy.kind !== 'ok') return legacy;
  return {
    kind: 'ok',
    value: { ...legacy.value, principal: { kind: 'legacy', channel: 'vless-xhttp' } },
  };
}

export async function handleXhttpRoute(
  request: Request,
  config: ProtocolConfig | null,
  deps: RouteDeps = {},
): Promise<Response | null> {
  const url = new URL(request.url);
  if (!config) {
    if (isXhttpPath(url.pathname, '/xhttp')) return text(503, 'Owner setup required');
    return null;
  }
  if (!isXhttpPath(url.pathname, config.xhttp.path)) return null;
  if (!config.xhttp.enabled) {
    if (request.method === 'POST') deps.onAttempt?.(404);
    return text(404, 'Not found');
  }
  if (request.method !== 'POST') return text(405, 'Method not allowed');
  if (!request.body) {
    deps.onAttempt?.(400);
    return text(400, 'Request body required');
  }
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
  const response = await (deps.createStreamResponse ?? createXhttpStream)({
    body: request.body,
    parseFirstPacket: (bytes) => authorizeXhttp(bytes, config, deps.db, deps.now?.() ?? Date.now()),
    connectTcp: deps.connectTcp ?? openTcp,
    selfHost: url.hostname,
    createUsageMeter: usageFactory,
  });
  deps.onAttempt?.(response.status);
  return response;
}
