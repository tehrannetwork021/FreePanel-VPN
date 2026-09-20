import type { ProtocolConfig } from '../config/model';
import type { ConnectTcp } from '../network/tcp';
import { openTcp } from '../network/tcp';
import { parseVlessRequest } from '../protocols/vless';
import { createXhttpStream } from '../transport/xhttp';

type StreamInput = Parameters<typeof createXhttpStream>[0];
type RouteDeps = {
  connectTcp?: ConnectTcp;
  createStreamResponse?: (input: StreamInput) => Promise<Response>;
  /** Called with the final status for every POST that matched the configured path. */
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

  const response = await (deps.createStreamResponse ?? createXhttpStream)({
    body: request.body,
    parseFirstPacket: (bytes) => parseVlessRequest(bytes, config.vless.uuid),
    connectTcp: deps.connectTcp ?? openTcp,
    selfHost: url.hostname,
  });
  deps.onAttempt?.(response.status);
  return response;
}
