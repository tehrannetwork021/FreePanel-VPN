import { describe, expect, it } from 'vitest';
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
    expect(response.headers.get('content-type')).toBe('text/event-stream');
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
