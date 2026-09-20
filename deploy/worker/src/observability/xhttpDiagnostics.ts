import type { KvBinding } from '../config/model';

export type XhttpDiagnosticsSnapshot = {
  day: string;
  attempts: number;
  success: number;
  lastStatus: number | null;
  lastAt: string | null;
};

type XhttpDiagnosticsRecord = XhttpDiagnosticsSnapshot;

type KvStore = Pick<KvBinding, 'get' | 'put'>;

type DiagnosticsOptions = {
  now?: () => number;
  flushIntervalMs?: number;
};

const KV_KEY = 'diag:xhttp:v1';
const DEFAULT_FLUSH_INTERVAL_MS = 5 * 60 * 1_000;

function dayOf(timestampMs: number): string {
  return new Date(timestampMs).toISOString().slice(0, 10);
}

function isRecord(value: unknown): value is XhttpDiagnosticsRecord {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<XhttpDiagnosticsRecord>;
  return (
    typeof record.day === 'string' &&
    typeof record.attempts === 'number' &&
    typeof record.success === 'number' &&
    (record.lastStatus === null || typeof record.lastStatus === 'number') &&
    (record.lastAt === null || typeof record.lastAt === 'string')
  );
}

/**
 * Redacted XHTTP attempt diagnostics for field retests.
 *
 * Purpose: during a production field retest, discriminate between
 * "the Cloudflare edge never delivered the request" (attempts stay flat while
 * the client fails) and "the Worker answered with an error status" (attempts
 * recorded with that status). Only aggregate counters, the last HTTP status
 * and timestamps are stored — never credentials, UUIDs, tokens or client IPs.
 * KV writes are throttled to stay far below the free-tier write budget.
 */
export type XhttpDiagnostics = {
  record(status: number): void;
  flushIfNeeded(): Promise<void>;
  snapshot(): Promise<XhttpDiagnosticsSnapshot>;
};

export function createXhttpDiagnostics(
  kv: KvStore,
  options: DiagnosticsOptions = {},
): XhttpDiagnostics {
  const now = options.now ?? Date.now;
  const flushIntervalMs = options.flushIntervalMs ?? DEFAULT_FLUSH_INTERVAL_MS;
  const startedAtMs = now();

  let day = dayOf(startedAtMs);
  let attempts = 0;
  let success = 0;
  let lastStatus: number | null = null;
  let lastAt: string | null = null;
  let lastFlushAtMs = Number.NEGATIVE_INFINITY;
  let flushedAttempts = 0;

  function rotateDayIfNeeded(): void {
    const currentDay = dayOf(now());
    if (currentDay === day) return;
    day = currentDay;
    attempts = 0;
    success = 0;
    lastStatus = null;
    lastAt = null;
    flushedAttempts = 0;
  }

  function localRecord(): XhttpDiagnosticsRecord {
    return { day, attempts, success, lastStatus, lastAt };
  }

  async function readPersisted(): Promise<XhttpDiagnosticsRecord | null> {
    try {
      const raw = await kv.get(KV_KEY);
      if (!raw) return null;
      const parsed: unknown = JSON.parse(raw);
      return isRecord(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  return {
    record(status: number): void {
      rotateDayIfNeeded();
      attempts += 1;
      if (status === 200) success += 1;
      lastStatus = status;
      lastAt = new Date(now()).toISOString();
    },

    async flushIfNeeded(): Promise<void> {
      if (attempts === flushedAttempts) return;
      const currentMs = now();
      if (currentMs - lastFlushAtMs < flushIntervalMs) return;
      lastFlushAtMs = currentMs;
      flushedAttempts = attempts;
      try {
        await kv.put(KV_KEY, JSON.stringify(localRecord()));
      } catch {
        // Diagnostics must never break the data path.
      }
    },

    async snapshot(): Promise<XhttpDiagnosticsSnapshot> {
      const local = localRecord();
      const persisted = await readPersisted();
      if (!persisted) return local;
      if (persisted.day !== local.day) {
        return persisted.day > local.day ? persisted : local;
      }
      const persistedFresher =
        (persisted.lastAt ?? '') > (local.lastAt ?? '') || persisted.attempts > local.attempts;
      return persistedFresher ? persisted : local;
    },
  };
}
