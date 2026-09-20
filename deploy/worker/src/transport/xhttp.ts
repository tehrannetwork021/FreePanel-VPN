import { concatBytes } from '../core/bytes';
import type { FirstPacketParser, ParsedFirstPacket } from './websocket';
import type { ParseResult } from '../core/types';
import type { ConnectTcp } from '../network/tcp';
import type { TunnelPrincipal } from '../security/tunnelAuth';
import type { UsageMeter } from './usageMeter';

type XhttpInput = {
  body: ReadableStream<Uint8Array>;
  parseFirstPacket: FirstPacketParser;
  connectTcp: ConnectTcp;
  selfHost: string;
  maxHandshakeBytes?: number;
  createUsageMeter?: (principal: TunnelPrincipal) => UsageMeter | null;
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
  let parsed: ParseResult<ParsedFirstPacket>;

  while (true) {
    const next = await bodyReader.read();
    if (next.done) return response(400, 'Incomplete XHTTP handshake');
    handshake = concatBytes(handshake, next.value);
    if (handshake.byteLength > maxHandshakeBytes) return response(413, 'XHTTP handshake too large');
    parsed = await input.parseFirstPacket(handshake);
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
  const usageMeter =
    parsed.value.principal && input.createUsageMeter
      ? input.createUsageMeter(parsed.value.principal)
      : null;
  if (parsed.value.payload.byteLength) {
    await writer.write(parsed.value.payload);
    usageMeter?.addUpload(parsed.value.payload.byteLength);
    if (usageMeter) {
      await usageMeter.flush();
      if (usageMeter.exhausted()) {
        await usageMeter.close();
        bodyReader.releaseLock();
        writer.releaseLock();
        socket.close();
        return response(403, 'Access unavailable');
      }
    }
  }

  const pumpUpload = async () => {
    try {
      while (true) {
        const next = await bodyReader.read();
        if (next.done) break;
        if (next.value.byteLength) {
          await writer.write(next.value);
          usageMeter?.addUpload(next.value.byteLength);
          if (usageMeter) {
            await usageMeter.flush();
            if (usageMeter.exhausted()) {
              socket.close();
              break;
            }
          }
        }
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
          if (next.value.byteLength) {
            controller.enqueue(next.value);
            usageMeter?.addDownload(next.value.byteLength);
            if (usageMeter) {
              await usageMeter.flush();
              if (usageMeter.exhausted()) {
                socket.close();
                break;
              }
            }
          }
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      } finally {
        reader.releaseLock();
        await usageMeter?.close();
        try {
          socket.close();
        } catch {
          /* best effort */
        }
      }
    },
    cancel() {
      void usageMeter?.close();
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
      // Production semantics (P0 field fix): the Xray stream-one client sends
      // Content-Type: application/grpc, and Cloudflare's edge treats SSE-typed
      // responses to gRPC requests specially (buffering/mangling risk). Real
      // Xray servers answer SSE, which the official XHTTP discussion flags as
      // problematic through CDNs; field-proven Workers deployments answer with
      // application/octet-stream and disable edge buffering explicitly. The
      // Xray client never inspects this content-type, so this is safe.
      'content-type': 'application/octet-stream',
      'x-accel-buffering': 'no',
      'x-content-type-options': 'nosniff',
    },
  });
}
