import { describe, expect, it, vi } from 'vitest';
import type { Destination, ParseResult } from '../core/types';
import type { TcpSocketLike } from '../network/tcp';
import { runWebSocketTunnel, type TunnelWebSocket } from './websocket';

class FakeWebSocket implements TunnelWebSocket {
  sent: Uint8Array[] = [];
  closes: Array<{ code?: number; reason?: string }> = [];
  private listeners = new Map<string, Array<(event: any) => void>>();
  send(data: ArrayBuffer | ArrayBufferView) {
    const bytes =
      data instanceof ArrayBuffer
        ? new Uint8Array(data)
        : new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    this.sent.push(bytes.slice());
  }
  close(code?: number, reason?: string) {
    this.closes.push({ code, reason });
  }
  addEventListener(type: string, listener: (event: any) => void) {
    const list = this.listeners.get(type) ?? [];
    list.push(listener);
    this.listeners.set(type, list);
  }
  emit(type: string, event: any = {}) {
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}

const destination: Destination = { host: 'example.com', port: 80, addressType: 'domain' };
const okParser = (
  input: Uint8Array,
): ParseResult<{ destination: Destination; payload: Uint8Array; responseHeader: Uint8Array }> => {
  if (input.length < 3) return { kind: 'need-more' };
  return {
    kind: 'ok',
    value: { destination, payload: input.slice(2), responseHeader: new Uint8Array([0, 0]) },
  };
};
const tick = () => new Promise((resolve) => setTimeout(resolve, 10));

function fakeSocket(remoteChunks: Uint8Array[] = []) {
  const writes: Uint8Array[] = [];
  let closed = false;
  const socket: TcpSocketLike = {
    readable: new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of remoteChunks) controller.enqueue(chunk);
        controller.close();
      },
    }),
    writable: new WritableStream<Uint8Array>({
      write(chunk) {
        writes.push(chunk.slice());
      },
    }),
    close() {
      closed = true;
    },
  };
  return { socket, writes, wasClosed: () => closed };
}

describe('WebSocket TCP tunnel', () => {
  it('buffers a fragmented authenticated header, connects once and bridges both directions', async () => {
    const ws = new FakeWebSocket();
    const remote = fakeSocket([new TextEncoder().encode('HTTP/1.1 200 OK\r\n')]);
    let connects = 0;
    runWebSocketTunnel({
      webSocket: ws,
      parseFirstPacket: okParser,
      connectTcp: async (received) => {
        connects += 1;
        expect(received).toEqual(destination);
        return remote.socket;
      },
      selfHost: 'worker.example.dev',
    });
    ws.emit('message', { data: new Uint8Array([1]).buffer });
    ws.emit('message', { data: new Uint8Array([2, 3, 4]).buffer });
    await tick();
    expect(connects).toBe(1);
    expect(remote.writes.flatMap((chunk) => [...chunk])).toEqual([3, 4]);
    expect(ws.sent[0]).toEqual(new Uint8Array([0, 0]));
    expect(new TextDecoder().decode(ws.sent[1])).toContain('HTTP/1.1 200 OK');
  });

  it('never connects when authentication/parser fails', async () => {
    const ws = new FakeWebSocket();
    let connects = 0;
    runWebSocketTunnel({
      webSocket: ws,
      parseFirstPacket: () => ({ kind: 'error', code: 'auth' }),
      connectTcp: async () => {
        connects += 1;
        return fakeSocket().socket;
      },
      selfHost: 'worker.example.dev',
    });
    ws.emit('message', { data: new Uint8Array([1, 2, 3]).buffer });
    await tick();
    expect(connects).toBe(0);
    expect(ws.closes.at(-1)?.code).toBe(1008);
  });

  it('forwards later frames and closes the TCP side when the client closes', async () => {
    const ws = new FakeWebSocket();
    const remote = fakeSocket();
    runWebSocketTunnel({
      webSocket: ws,
      parseFirstPacket: okParser,
      connectTcp: async () => remote.socket,
      selfHost: 'worker.example.dev',
    });
    ws.emit('message', { data: new Uint8Array([1, 2, 7]).buffer });
    await tick();
    ws.emit('message', { data: new Uint8Array([8, 9]).buffer });
    await tick();
    ws.emit('close');
    await tick();
    expect(remote.writes.flatMap((chunk) => [...chunk])).toEqual([7, 8, 9]);
    expect(remote.wasClosed()).toBe(true);
  });

  it('rejects an oversized unauthenticated first packet buffer', async () => {
    const ws = new FakeWebSocket();
    runWebSocketTunnel({
      webSocket: ws,
      parseFirstPacket: () => ({ kind: 'need-more' }),
      connectTcp: async () => fakeSocket().socket,
      selfHost: 'worker.example.dev',
      maxFirstPacketBytes: 32,
    });
    ws.emit('message', { data: new Uint8Array(33).buffer });
    await tick();
    expect(ws.closes.at(-1)?.code).toBe(1009);
  });
});

describe('async WebSocket authorization gate', () => {
  it('does not connect TCP until async authorization resolves successfully', async () => {
    const ws = new FakeWebSocket();
    let resolveParser!: (value: ParseResult<any>) => void;
    const pending = new Promise<ParseResult<any>>((resolve) => {
      resolveParser = resolve;
    });
    let connects = 0;
    runWebSocketTunnel({
      webSocket: ws,
      parseFirstPacket: async () => pending,
      connectTcp: async () => {
        connects += 1;
        return fakeSocket().socket;
      },
      selfHost: 'worker.example.dev',
    });
    ws.emit('message', { data: new Uint8Array([1, 2, 3]).buffer });
    await tick();
    expect(connects).toBe(0);
    resolveParser({ kind: 'error', code: 'auth' });
    await tick();
    expect(connects).toBe(0);
    expect(ws.closes.at(-1)?.code).toBe(1008);
  });
});

describe('WebSocket usage checkpoints', () => {
  it('counts only proxied payload bytes for a user principal', async () => {
    const ws = new FakeWebSocket();
    const remote = fakeSocket([new Uint8Array([7, 8, 9])]);
    const meter = {
      addUpload: vi.fn(),
      addDownload: vi.fn(),
      flush: vi.fn(async () => ({ allowed: true, totalUsedBytes: 0, todayUsedBytes: 0 })),
      close: vi.fn(async () => null),
      exhausted: vi.fn(() => false),
    };
    runWebSocketTunnel({
      webSocket: ws,
      parseFirstPacket: () => ({
        kind: 'ok',
        value: {
          destination,
          payload: new Uint8Array([5, 6]),
          responseHeader: new Uint8Array([0, 0]),
          principal: { kind: 'user', userId: 'u-1', channel: 'vless-ws' },
        },
      }),
      connectTcp: async () => remote.socket,
      selfHost: 'worker.example.dev',
      createUsageMeter: () => meter,
    });
    ws.emit('message', { data: new Uint8Array([1]).buffer });
    await tick();
    expect(meter.addUpload).toHaveBeenCalledWith(2);
    expect(meter.addDownload).toHaveBeenCalledWith(3);
    expect(meter.addUpload).not.toHaveBeenCalledWith(1);
  });
});
