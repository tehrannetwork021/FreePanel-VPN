import type { AccessState, UsageDelta } from '../db/usage';

export type UsageMeter = {
  addUpload(bytes: number): void;
  addDownload(bytes: number): void;
  flush(force?: boolean): Promise<AccessState | null>;
  close(): Promise<AccessState | null>;
  exhausted(): boolean;
};

type UsageMeterOptions = {
  write(delta: UsageDelta): Promise<AccessState>;
  now?: () => number;
  byteThreshold?: number;
  ageMs?: number;
};

const DEFAULT_BYTE_THRESHOLD = 4 * 1024 * 1024;
const DEFAULT_AGE_MS = 60_000;

function checkedBytes(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error('invalid-usage-bytes');
  return value;
}

export function createUsageMeter(options: UsageMeterOptions): UsageMeter {
  const now = options.now ?? (() => Date.now());
  const byteThreshold = options.byteThreshold ?? DEFAULT_BYTE_THRESHOLD;
  const ageMs = options.ageMs ?? DEFAULT_AGE_MS;
  let uploadPending = 0;
  let downloadPending = 0;
  let connectionsPending = 1;
  let lastFlushAt = now();
  let isExhausted = false;
  let isClosed = false;
  let chain: Promise<void> = Promise.resolve();

  function add(kind: 'upload' | 'download', bytes: number): void {
    if (isClosed || isExhausted) return;
    const value = checkedBytes(bytes);
    if (kind === 'upload') uploadPending = checkedBytes(uploadPending + value);
    else downloadPending = checkedBytes(downloadPending + value);
  }

  function flush(force = false): Promise<AccessState | null> {
    let result: AccessState | null = null;
    const operation = chain.then(async () => {
      if (isExhausted) return;
      const current = now();
      const pendingBytes = uploadPending + downloadPending;
      const due = force || pendingBytes >= byteThreshold || current - lastFlushAt >= ageMs;
      if (!due || (pendingBytes === 0 && connectionsPending === 0)) return;

      const delta: UsageDelta = {
        uploadBytes: uploadPending,
        downloadBytes: downloadPending,
        connections: connectionsPending,
      };
      uploadPending = 0;
      downloadPending = 0;
      connectionsPending = 0;
      try {
        result = await options.write(delta);
        lastFlushAt = current;
        if (!result.allowed) isExhausted = true;
      } catch (error) {
        uploadPending = checkedBytes(uploadPending + delta.uploadBytes);
        downloadPending = checkedBytes(downloadPending + delta.downloadBytes);
        connectionsPending += delta.connections;
        throw error;
      }
    });
    chain = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation.then(() => result);
  }

  async function close(): Promise<AccessState | null> {
    if (isClosed) return null;
    isClosed = true;
    return flush(true);
  }

  return {
    addUpload: (bytes) => add('upload', bytes),
    addDownload: (bytes) => add('download', bytes),
    flush,
    close,
    exhausted: () => isExhausted,
  };
}
