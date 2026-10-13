import { concatBytes } from '../core/bytes';
import type { FirstPacketParser, ParsedFirstPacket } from './websocket';
import type { ParseResult } from '../core/types';
import type { ConnectTcp } from '../network/tcp';
import type { TunnelPrincipal } from '../security/tunnelAuth';
import type { UsageMeter } from './usageMeter';
import { forwardSlices, MAX_FORWARD_SLICE_BYTES } from './usageMeter';

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
  const reject = async (status: number, message: string) => {
    await bodyReader.cancel().catch(() => undefined);
    bodyReader.releaseLock();
    return response(status, message);
  };

  while (true) {
    const next = await bodyReader.read();
    if (next.done) return reject(400, 'Incomplete XHTTP handshake');
    if (handshake.byteLength + next.value.byteLength > maxHandshakeBytes)
      return reject(413, 'XHTTP handshake too large');
    handshake = concatBytes(handshake, next.value);
    parsed = await input.parseFirstPacket(handshake);
    if (parsed.kind === 'need-more') continue;
    if (parsed.kind === 'error')
      return reject(parsed.code === 'auth' ? 403 : 400, 'Invalid XHTTP handshake');
    break;
  }

  let socket;
  try {
    socket = await input.connectTcp(parsed.value.destination, input.selfHost);
  } catch {
    return reject(502, 'TCP destination unavailable');
  }
  const writer = socket.writable.getWriter();
  const usageMeter =
    parsed.value.principal && input.createUsageMeter
      ? input.createUsageMeter(parsed.value.principal)
      : null;
  const remoteReader = socket.readable.getReader();
  let stopped = false;
  const cleanup = async () => {
    if (stopped) return;
    stopped = true;
    try {
      socket.close();
    } catch {
      /* already closed */
    }
    await Promise.allSettled([bodyReader.cancel(), remoteReader.cancel(), usageMeter?.close()]);
  };
  const writeUpload = async (bytes: Uint8Array) => {
    for (const slice of forwardSlices(bytes)) {
      if (stopped) return;
      await writer.write(slice);
      usageMeter?.addUpload(slice.byteLength);
      if (usageMeter) {
        await usageMeter.flush();
        if (usageMeter.exhausted()) {
          await cleanup();
          return;
        }
      }
    }
  };
  try {
    await writeUpload(parsed.value.payload);
  } catch {
    await cleanup();
    bodyReader.releaseLock();
    writer.releaseLock();
    return response(502, 'TCP destination unavailable');
  }
  if (stopped) {
    bodyReader.releaseLock();
    writer.releaseLock();
    return response(403, 'Access unavailable');
  }

  const pumpUpload = async () => {
    try {
      while (!stopped) {
        const next = await bodyReader.read();
        if (next.done) break;
        if (next.value.byteLength) {
          await writeUpload(next.value);
        }
      }
    } catch {
      await cleanup();
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
  let pending: Uint8Array = new Uint8Array();
  let pendingOffset = 0;
  const downstream = new ReadableStream<Uint8Array>({
    start(controller) {
      if (responseHeader.byteLength) controller.enqueue(responseHeader);
    },
    async pull(controller) {
      if (stopped) {
        controller.close();
        return;
      }
      try {
        while (pendingOffset >= pending.byteLength) {
          const next = await remoteReader.read();
          if (stopped) return;
          if (next.done) {
            await cleanup();
            controller.close();
            return;
          }
          pending = next.value;
          pendingOffset = 0;
        }
        const slice = pending.subarray(pendingOffset, pendingOffset + MAX_FORWARD_SLICE_BYTES);
        pendingOffset += slice.byteLength;
        controller.enqueue(slice);
        usageMeter?.addDownload(slice.byteLength);
        if (usageMeter) {
          await usageMeter.flush();
          if (usageMeter.exhausted()) {
            await cleanup();
            controller.close();
          }
        }
      } catch {
        await cleanup();
        controller.error(new Error('transport-failed'));
      }
    },
    cancel() {
      return cleanup();
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
