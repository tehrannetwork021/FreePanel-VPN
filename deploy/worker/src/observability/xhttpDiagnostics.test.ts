import { describe, expect, it, vi } from 'vitest';
import { createXhttpDiagnostics, type KvLike } from './xhttpDiagnostics';

const KV_KEY = 'diag:xhttp:v1';

function fakeKv(): KvLike & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    store,
    async get(key: string) {
      return store.get(key) ?? null;
    },
    async put(key: string, value: string) {
      store.set(key, value);
    },
  };
}

describe('redacted XHTTP diagnostics', () => {
  it('counts POST attempts and successes without storing credentials or identity', async () => {
    const kv = fakeKv();
    const now = 1_000;
    const diagnostics = createXhttpDiagnostics(kv, { now: () => now });

    diagnostics.record(403);
    diagnostics.record(403);
    diagnostics.record(200);

    const snapshot = await diagnostics.snapshot();
    expect(snapshot.attempts).toBe(3);
    expect(snapshot.success).toBe(1);
    expect(snapshot.lastStatus).toBe(200);
    expect(typeof snapshot.day).toBe('string');
    expect(typeof snapshot.lastAt).toBe('string');

    const serialized = JSON.stringify(snapshot).toLowerCase();
    for (const forbidden of ['uuid', 'password', 'token', '"ip"', 'address']) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it('flushes to KV at most once per interval and only when attempts changed', async () => {
    const kv = fakeKv();
    let now = 1_000;
    const diagnostics = createXhttpDiagnostics(kv, { now: () => now });

    diagnostics.record(200);
    await diagnostics.flushIfNeeded();
    const firstWrite = kv.store.get(KV_KEY);
    expect(firstWrite).toBeTruthy();

    await diagnostics.flushIfNeeded();
    expect(kv.store.get(KV_KEY)).toBe(firstWrite);

    now += 6 * 60 * 1_000;
    diagnostics.record(502);
    await diagnostics.flushIfNeeded();
    const flushed = JSON.parse(kv.store.get(KV_KEY) ?? '{}') as {
      attempts: number;
      lastStatus: number | null;
    };
    expect(flushed.attempts).toBe(2);
    expect(flushed.lastStatus).toBe(502);
  });

  it('merges persisted and in-memory state picking the fresher record', async () => {
    const kv = fakeKv();
    let now = 1_000;
    const diagnostics = createXhttpDiagnostics(kv, { now: () => now });

    diagnostics.record(200);
    await diagnostics.flushIfNeeded();
    now += 1_000;
    diagnostics.record(200);
    diagnostics.record(400);

    const snapshot = await diagnostics.snapshot();
    expect(snapshot.attempts).toBe(3);
    expect(snapshot.success).toBe(2);
    expect(snapshot.lastStatus).toBe(400);
  });

  it('keeps the persisted record when it is newer than local memory', async () => {
    const kv = fakeKv();
    let now = 10_000;
    const other = createXhttpDiagnostics(kv, { now: () => now });
    other.record(200);
    other.record(200);
    await other.flushIfNeeded();
    const persisted = await other.snapshot();

    now += 60_000;
    const mine = createXhttpDiagnostics(kv, { now: () => now });
    mine.record(200);

    const snapshot = await mine.snapshot();
    expect(snapshot.attempts).toBe(persisted.attempts);
    expect(snapshot.lastAt).toBe(persisted.lastAt);
  });

  it('rotates the daily bucket when the UTC day changes', async () => {
    const kv = fakeKv();
    let now = Date.UTC(2026, 8, 20, 23, 59, 0);
    const diagnostics = createXhttpDiagnostics(kv, { now: () => now });

    diagnostics.record(200);
    await diagnostics.flushIfNeeded();
    const dayA = (await diagnostics.snapshot()).day;

    now += 2 * 60 * 1_000;
    diagnostics.record(200);
    const snapshot = await diagnostics.snapshot();
    expect(snapshot.day).not.toBe(dayA);
    expect(snapshot.attempts).toBe(1);
  });

  it('never throws when KV is unavailable', async () => {
    const diagnostics = createXhttpDiagnostics(
      {
        get: vi.fn(async () => {
          throw new Error('kv down');
        }),
        put: vi.fn(async () => {
          throw new Error('kv down');
        }),
      },
      { now: () => 1_000 },
    );
    diagnostics.record(200);
    await expect(diagnostics.flushIfNeeded()).resolves.toBeUndefined();
    const snapshot = await diagnostics.snapshot();
    expect(snapshot.attempts).toBe(1);
  });
});
