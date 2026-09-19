import { concatBytes, toBytes } from '../core/bytes';
import type { Destination, ParseResult } from '../core/types';
import type { ConnectTcp, TcpSocketLike } from '../network/tcp';

export type TunnelWebSocket = {
  send(data: ArrayBuffer | ArrayBufferView): void;
  close(code?: number, reason?: string): void;
  addEventListener(type: string, listener: (event: unknown) => void): void;
};

export type ParsedFirstPacket = {
  destination: Destination;
  payload: Uint8Array;
  responseHeader?: Uint8Array;
};

export type FirstPacketParser = (input: Uint8Array) => ParseResult<ParsedFirstPacket>;

type TunnelOptions = {
  webSocket: TunnelWebSocket;
  parseFirstPacket: FirstPacketParser;
  connectTcp: ConnectTcp;
  selfHost: string;
  maxFirstPacketBytes?: number;
};

async function eventBytes(data: unknown): Promise<Uint8Array | null> {
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (ArrayBuffer.isView(data))
    return toBytes(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
  if (data instanceof Blob) return new Uint8Array(await data.arrayBuffer());
  return null;
}

export function runWebSocketTunnel(options: TunnelOptions): void {
  const { webSocket, parseFirstPacket, connectTcp, selfHost } = options;
  const maxFirstPacketBytes = options.maxFirstPacketBytes ?? 64 * 1024;
  let firstPacket: Uint8Array = new Uint8Array();
  let socket: TcpSocketLike | null = null;
  let writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  let stopped = false;
  let queue = Promise.resolve();

  const stop = (code = 1000, reason = 'closed') => {
    if (stopped) return;
    stopped = true;
    try {
      socket?.close();
    } catch {
      /* best-effort close */
    }
    try {
      webSocket.close(code, reason);
    } catch {
      /* already closed */
    }
  };

  const pumpDownstream = async (remote: TcpSocketLike) => {
    const reader = remote.readable.getReader();
    try {
      while (!stopped) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value?.byteLength) webSocket.send(value);
      }
      if (!stopped) {
        try {
          webSocket.close(1000, 'remote-eof');
        } catch {
          /* already closed */
        }
      }
    } catch {
      stop(1011, 'remote-error');
    } finally {
      reader.releaseLock();
    }
  };

  const handleMessage = async (data: unknown) => {
    if (stopped) return;
    const bytes = await eventBytes(data);
    if (!bytes) {
      stop(1003, 'binary-required');
      return;
    }
    if (writer) {
      await writer.write(bytes);
      return;
    }

    firstPacket = concatBytes(firstPacket, bytes);
    if (firstPacket.byteLength > maxFirstPacketBytes) {
      stop(1009, 'first-packet-too-large');
      return;
    }
    const parsed = parseFirstPacket(firstPacket);
    if (parsed.kind === 'need-more') return;
    if (parsed.kind === 'error') {
      stop(1008, 'invalid-handshake');
      return;
    }

    try {
      socket = await connectTcp(parsed.value.destination, selfHost);
      writer = socket.writable.getWriter();
      if (parsed.value.responseHeader?.byteLength) webSocket.send(parsed.value.responseHeader);
      if (parsed.value.payload.byteLength) await writer.write(parsed.value.payload);
      firstPacket = new Uint8Array();
      void pumpDownstream(socket);
    } catch {
      stop(1011, 'connect-failed');
    }
  };

  webSocket.addEventListener('message', (event) => {
    const data =
      typeof event === 'object' && event !== null && 'data' in event
        ? (event as { data: unknown }).data
        : undefined;
    queue = queue.then(() => handleMessage(data)).catch(() => stop(1011, 'tunnel-error'));
  });
  webSocket.addEventListener('close', () => {
    if (!stopped) {
      stopped = true;
      try {
        socket?.close();
      } catch {
        /* best effort */
      }
    }
  });
  webSocket.addEventListener('error', () => stop(1011, 'websocket-error'));
}
