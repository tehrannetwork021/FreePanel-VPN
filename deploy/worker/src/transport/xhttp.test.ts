import { describe, expect, it, vi } from 'vitest';
import { concatBytes } from '../core/bytes';
import { uuidToBytes } from '../core/uuid';
import type { TcpSocketLike } from '../network/tcp';
import { parseVlessRequest } from '../protocols/vless';
import { createXhttpStream } from './xhttp';

const UUID = '27848739-7e62-4138-9fd3-098a63964b6b';

function vless(payload = new Uint8Array()) {
  const host = new TextEncoder().encode('example.com');
  return concatBytes(
    new Uint8Array([0]),
    uuidToBytes(UUID),
    new Uint8Array([0, 1, 0, 80, 2, host.length]),
    host,
    payload,
  );
}

function body(chunks: Uint8Array[]) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    },
  });
}

function socket(remote: string) {
  const writes: Uint8Array[] = [];
  const value: TcpSocketLike = {
    readable: new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(remote));
        controller.close();
      },
    }),
    writable: new WritableStream({
      write(chunk) {
        writes.push(chunk.slice());
      },
    }),
    close() {},
  };
  return { value, writes };
}

describe('XHTTP stream-one transport', () => {
  it('reads a fragmented VLESS header, forwards upload and streams response', async () => {
    const packet = vless(new TextEncoder().encode('GET / HTTP/1.0\r\n\r\n'));
    const remote = socket('HTTP/1.1 200 OK\r\n');
    const response = await createXhttpStream({
      body: body([packet.slice(0, 10), packet.slice(10, 30), packet.slice(30)]),
      parseFirstPacket: (input) => parseVlessRequest(input, UUID),
      connectTcp: async (destination) => {
        expect(destination).toEqual({ host: 'example.com', port: 80, addressType: 'domain' });
        return remote.value;
      },
      selfHost: 'edge.example.dev',
    });
    expect(response.status).toBe(200);
    // Production semantics: Cloudflare edge mishandles SSE-typed responses to
    // gRPC-typed stream-one requests; field-proven deployments answer with
    // application/octet-stream and disable edge buffering explicitly.
    expect(response.headers.get('content-type')).toBe('application/octet-stream');
    expect(response.headers.get('x-accel-buffering')).toBe('no');
    expect(response.headers.get('cache-control')).toBe('no-store');
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect([...bytes.slice(0, 2)]).toEqual([0, 0]);
    expect(new TextDecoder().decode(bytes.slice(2))).toContain('HTTP/1.1 200 OK');
    expect(new TextDecoder().decode(concatBytes(...remote.writes))).toContain('GET / HTTP/1.0');
  });

  it('does not connect when VLESS authentication fails', async () => {
    const packet = vless();
    packet[1] ^= 0xff;
    let connects = 0;
    const response = await createXhttpStream({
      body: body([packet]),
      parseFirstPacket: (input) => parseVlessRequest(input, UUID),
      connectTcp: async () => {
        connects += 1;
        return socket('').value;
      },
      selfHost: 'edge.example.dev',
    });
    expect(response.status).toBe(403);
    expect(connects).toBe(0);
  });

  it('caps a handshake that never becomes parseable', async () => {
    const response = await createXhttpStream({
      body: body([new Uint8Array(40), new Uint8Array(40)]),
      parseFirstPacket: () => ({ kind: 'need-more' }),
      connectTcp: async () => socket('').value,
      selfHost: 'edge.example.dev',
      maxHandshakeBytes: 64,
    });
    expect(response.status).toBe(413);
  });
});

describe('async XHTTP authorization gate', () => {
  it('awaits authorization and never connects when it resolves to auth failure', async () => {
    let resolveParser!: (value: any) => void;
    const pending = new Promise<any>((resolve) => {
      resolveParser = resolve;
    });
    let connects = 0;
    const responsePromise = createXhttpStream({
      body: body([vless()]),
      parseFirstPacket: async () => pending,
      connectTcp: async () => {
        connects += 1;
        return socket('').value;
      },
      selfHost: 'edge.example.dev',
    });
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(connects).toBe(0);
    resolveParser({ kind: 'error', code: 'auth' });
    const response = await responsePromise;
    expect(response.status).toBe(403);
    expect(connects).toBe(0);
  });
});

describe('XHTTP usage checkpoints', () => {
  it('counts parsed upload and remote download but not the VLESS handshake', async () => {
    const packet = vless(new Uint8Array([5, 6]));
    const remote = socket('abc');
    const meter = {
      addUpload: vi.fn(),
      addDownload: vi.fn(),
      flush: vi.fn(async () => ({ allowed: true, totalUsedBytes: 0, todayUsedBytes: 0 })),
      close: vi.fn(async () => null),
      exhausted: vi.fn(() => false),
    };
    const response = await createXhttpStream({
      body: body([packet]),
      parseFirstPacket: (input) => {
        const parsed = parseVlessRequest(input, UUID);
        return parsed.kind === 'ok'
          ? {
              ...parsed,
              value: {
                ...parsed.value,
                principal: {
                  kind: 'user' as const,
                  userId: 'u-1',
                  channel: 'vless-xhttp' as const,
                },
              },
            }
          : parsed;
      },
      connectTcp: async () => remote.value,
      selfHost: 'edge.example.dev',
      createUsageMeter: () => meter,
    });
    await response.arrayBuffer();
    expect(meter.addUpload).toHaveBeenCalledWith(2);
    expect(meter.addDownload).toHaveBeenCalledWith(3);
    expect(meter.close).toHaveBeenCalled();
  });
});
