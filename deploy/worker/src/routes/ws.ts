import type { ProtocolConfig } from '../config/model';
import type { ConnectTcp } from '../network/tcp';
import { openTcp } from '../network/tcp';
import { parseTrojanRequest } from '../protocols/trojan';
import { parseVlessRequest } from '../protocols/vless';
import {
  runWebSocketTunnel,
  type FirstPacketParser,
  type TunnelWebSocket,
} from '../transport/websocket';

type ProtocolKind = 'vless' | 'trojan';

type UpgradeInput = {
  kind: ProtocolKind;
  parseFirstPacket: FirstPacketParser;
  connectTcp: ConnectTcp;
  selfHost: string;
};

type RouteDeps = {
  connectTcp?: ConnectTcp;
  createUpgradeResponse?: (input: UpgradeInput) => Response;
};

function text(status: number, message: string): Response {
  return new Response(message, { status, headers: { 'cache-control': 'no-store' } });
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
    parseFirstPacket = (input) => parseVlessRequest(input, config.vless.uuid);
  } else if (url.pathname === config.trojan.path) {
    kind = 'trojan';
    enabled = config.trojan.enabled;
    parseFirstPacket = (input) => parseTrojanRequest(input, config.trojan.passwordHash);
  } else {
    return null;
  }

  if (!enabled) return text(404, 'Not found');
  if (request.method !== 'GET') return text(405, 'Method not allowed');
  if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket')
    return text(426, 'WebSocket upgrade required');

  const input: UpgradeInput = {
    kind,
    parseFirstPacket,
    connectTcp: deps.connectTcp ?? openTcp,
    selfHost: url.hostname,
  };
  return (deps.createUpgradeResponse ?? cloudflareUpgrade)(input);
}
