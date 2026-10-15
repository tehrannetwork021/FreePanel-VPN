import { concatBytes, toBytes } from '../core/bytes';
import type { Destination, ParseResult } from '../core/types';
import type { ConnectTcp, TcpSocketLike } from '../network/tcp';
import type { TunnelPrincipal } from '../security/tunnelAuth';
import type { UsageMeter } from './usageMeter';
import { forwardSlices } from './usageMeter';

export type TunnelWebSocket = {
  send(data: ArrayBuffer | ArrayBufferView): void;
  close(code?: number, reason?: string): void;
  addEventListener(type: string, listener: (event: unknown) => void): void;
};

export type ParsedFirstPacket = {
  destination: Destination;
  payload: Uint8Array;
  responseHeader?: Uint8Array;
  principal?: TunnelPrincipal;
};

export type FirstPacketParser = (
  input: Uint8Array,
) => ParseResult<ParsedFirstPacket> | Promise<ParseResult<ParsedFirstPacket>>;

type TunnelOptions = {
  webSocket: TunnelWebSocket;
  parseFirstPacket: FirstPacketParser;
  connectTcp: ConnectTcp;
  selfHost: string;
  maxFirstPacketBytes?: number;
  createUsageMeter?: (principal: TunnelPrincipal) => UsageMeter | null;
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
  let usageMeter: UsageMeter | null = null;
  let stopped = false;
  let queue = Promise.resolve();
  let queuedBytes = 0;
  const maxQueuedBytes = 1024 * 1024;

  const stop = (code = 1000, reason = 'closed') => {
    if (stopped) return;
    stopped = true;
    void usageMeter?.close().catch(() => undefined);
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
        if (done || stopped) break;
        if (value?.byteLength) {
          for (const slice of forwardSlices(value)) {
            if (stopped) break;
            webSocket.send(slice);
            usageMeter?.addDownload(slice.byteLength);
            if (usageMeter) {
              await usageMeter.flush();
              if (usageMeter.exhausted()) {
                stop(1008, 'quota');
                break;
              }
            }
          }
        }
      }
      if (!stopped) {
        await usageMeter?.close();
        stop(1000, 'remote-eof');
      }
    } catch {
      stop(1011, 'remote-error');
    } finally {
      reader.releaseLock();
    }
  };

  const writeUpload = async (bytes: Uint8Array) => {
    for (const slice of forwardSlices(bytes)) {
      if (stopped || !writer) return;
      await writer.write(slice);
      usageMeter?.addUpload(slice.byteLength);
      if (usageMeter) {
        await usageMeter.flush();
        if (usageMeter.exhausted()) {
          stop(1008, 'quota');
          return;
        }
      }
    }
  };

  const handleMessage = async (data: unknown) => {
    if (stopped) return;
    const bytes = await eventBytes(data);
    if (stopped) return;
    if (!bytes) {
      stop(1003, 'binary-required');
      return;
    }
    if (writer) {
      await writeUpload(bytes);
      return;
    }

    firstPacket = concatBytes(firstPacket, bytes);
    if (firstPacket.byteLength > maxFirstPacketBytes) {
      stop(1009, 'first-packet-too-large');
      return;
    }
    const parsed = await parseFirstPacket(firstPacket);
    if (stopped) return;
    if (parsed.kind === 'need-more') return;
    if (parsed.kind === 'error') {
      stop(1008, 'invalid-handshake');
      return;
    }

    try {
      socket = await connectTcp(parsed.value.destination, selfHost);
      if (stopped) {
        socket.close();
        return;
      }
      writer = socket.writable.getWriter();
      usageMeter =
        parsed.value.principal && options.createUsageMeter
          ? options.createUsageMeter(parsed.value.principal)
          : null;
      if (parsed.value.responseHeader?.byteLength) webSocket.send(parsed.value.responseHeader);
      if (parsed.value.payload.byteLength) {
        await writeUpload(parsed.value.payload);
        if (stopped) return;
      }
      firstPacket = new Uint8Array();
      void pumpDownstream(socket);
    } catch {
      stop(1011, 'connect-failed');
    }
  };

  webSocket.addEventListener('message', (event) => {
    if (stopped) return;
    const data =
      typeof event === 'object' && event !== null && 'data' in event
        ? (event as { data: unknown }).data
        : undefined;
    const size =
      data instanceof Blob
        ? data.size
        : data instanceof ArrayBuffer || ArrayBuffer.isView(data)
          ? data.byteLength
          : 0;
    if (queuedBytes + size > maxQueuedBytes) {
      stop(1009, 'queue-too-large');
      return;
    }
    queuedBytes += size;
    queue = queue
      .then(() => handleMessage(data))
      .catch(() => stop(1011, 'tunnel-error'))
      .finally(() => {
        queuedBytes -= size;
      });
  });
  webSocket.addEventListener('close', () => {
    if (!stopped) {
      stopped = true;
      void usageMeter?.close().catch(() => undefined);
      try {
        socket?.close();
      } catch {
        /* best effort */
      }
    }
  });
  webSocket.addEventListener('error', () => stop(1011, 'websocket-error'));
}
