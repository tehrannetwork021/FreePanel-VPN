import { concatBytes } from '../core/bytes';
import type { FirstPacketParser } from './websocket';
import type { ConnectTcp } from '../network/tcp';

type XhttpInput = {
  body: ReadableStream<Uint8Array>;
  parseFirstPacket: FirstPacketParser;
  connectTcp: ConnectTcp;
  selfHost: string;
  maxHandshakeBytes?: number;
};

const response = (status: number, message: string) =>
  new Response(message, {
    status,
    headers: { 'cache-control': 'no-store', 'content-type': 'text/plain; charset=utf-8' },
  });

export async function createXhttpStream(input: XhttpInput): Promise<Response> {
  const maxHandshakeBytes = input.maxHandshakeBytes ?? 64 * 1024;
  const bodyReader = input.body.getReader();
  let handshake: Uint8Array = new Uint8Array();
  let parsed: ReturnType<FirstPacketParser>;

  while (true) {
    const next = await bodyReader.read();
    if (next.done) return response(400, 'Incomplete XHTTP handshake');
    handshake = concatBytes(handshake, next.value);
    if (handshake.byteLength > maxHandshakeBytes) return response(413, 'XHTTP handshake too large');
    parsed = input.parseFirstPacket(handshake);
    if (parsed.kind === 'need-more') continue;
    if (parsed.kind === 'error')
      return response(parsed.code === 'auth' ? 403 : 400, 'Invalid XHTTP handshake');
    break;
  }

  let socket;
  try {
    socket = await input.connectTcp(parsed.value.destination, input.selfHost);
  } catch {
    return response(502, 'TCP destination unavailable');
  }
  const writer = socket.writable.getWriter();
  if (parsed.value.payload.byteLength) await writer.write(parsed.value.payload);

  const pumpUpload = async () => {
    try {
      while (true) {
        const next = await bodyReader.read();
        if (next.done) break;
        if (next.value.byteLength) await writer.write(next.value);
      }
    } catch {
      try {
        socket.close();
      } catch {
        /* best effort */
      }
    } finally {
      bodyReader.releaseLock();
      try {
        writer.releaseLock();
      } catch {
        /* closed writer */
      }
    }
  };
  void pumpUpload();

  const responseHeader = parsed.value.responseHeader ?? new Uint8Array();
  const downstream = new ReadableStream<Uint8Array>({
    async start(controller) {
      if (responseHeader.byteLength) controller.enqueue(responseHeader);
      const reader = socket.readable.getReader();
      try {
        while (true) {
          const next = await reader.read();
          if (next.done) break;
          if (next.value.byteLength) controller.enqueue(next.value);
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      } finally {
        reader.releaseLock();
        try {
          socket.close();
        } catch {
          /* best effort */
        }
      }
    },
    cancel() {
      try {
        socket.close();
      } catch {
        /* best effort */
      }
    },
  });

  return new Response(downstream, {
    status: 200,
    headers: {
      'cache-control': 'no-store',
      'content-type': 'text/event-stream',
      'x-accel-buffering': 'no',
      'x-content-type-options': 'nosniff',
    },
  });
}
