import { describe, expect, it, vi } from 'vitest';
import { createUsageMeter } from './usageMeter';
import { createUser } from '../db/users';
import { recordUsageDelta } from '../db/usage';
import { createFakeD1 } from '../test/fakeD1';

describe('coarse usage meter', () => {
  it('does not write per packet and flushes at threshold and close', async () => {
    let now = 1_000;
    const write = vi.fn().mockResolvedValue({
      allowed: true,
      totalUsedBytes: 0,
      todayUsedBytes: 0,
    });
    const meter = createUsageMeter({
      write,
      now: () => now,
      byteThreshold: 4 * 1024 * 1024,
      ageMs: 60_000,
    });
    meter.addUpload(1024);
    meter.addDownload(2048);
    expect(write).not.toHaveBeenCalled();
    await meter.flush();
    expect(write).not.toHaveBeenCalled();
    meter.addUpload(4 * 1024 * 1024);
    await meter.flush();
    expect(write).toHaveBeenCalledTimes(1);
    expect(write.mock.calls[0]?.[0]).toMatchObject({ connections: 1 });
    meter.addDownload(10);
    now += 1000;
    await meter.close();
    expect(write).toHaveBeenCalledTimes(2);
    expect(write.mock.calls[1]?.[0]).toMatchObject({ connections: 0, downloadBytes: 10 });
  });
  it('flushes a zero-payload connection on close and age-expired pending bytes', async () => {
    let now = 10_000;
    const write = vi
      .fn()
      .mockResolvedValue({ allowed: true, totalUsedBytes: 0, todayUsedBytes: 0 });
    const empty = createUsageMeter({ write, now: () => now, ageMs: 60_000 });
    await empty.close();
    expect(write).toHaveBeenCalledWith({ uploadBytes: 0, downloadBytes: 0, connections: 1 });

    const aged = createUsageMeter({ write, now: () => now, ageMs: 60_000 });
    aged.addUpload(5);
    now += 60_001;
    await aged.flush();
    expect(write.mock.calls.at(-1)?.[0]).toMatchObject({ uploadBytes: 5, connections: 1 });
  });

  it('serializes overlapping flushes and marks the meter exhausted', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const write = vi.fn(async () => {
      await gate;
      return { allowed: false, reason: 'total-quota', totalUsedBytes: 10, todayUsedBytes: 10 };
    });
    const meter = createUsageMeter({ write, byteThreshold: 1, now: () => 1_000 });
    meter.addUpload(2);
    const a = meter.flush();
    const b = meter.flush();
    release();
    await Promise.all([a, b]);
    expect(write).toHaveBeenCalledTimes(1);
    expect(meter.exhausted()).toBe(true);
  });
});

describe('parallel quota checkpoints', () => {
  it('preserves both connection deltas and converges both meters to exhausted', async () => {
    const db = createFakeD1();
    const now = Date.parse('2026-09-20T12:00:00Z');
    const user = await createUser(db, { name: 'Parallel', quotaBytes: 1_000 }, now);
    const make = () =>
      createUsageMeter({
        byteThreshold: 1,
        now: () => now,
        write: (delta) => recordUsageDelta(db, user.id, delta, now),
      });
    const a = make();
    const b = make();
    a.addUpload(600);
    b.addUpload(600);
    await Promise.all([a.flush(), b.flush()]);
    a.addUpload(1);
    b.addUpload(1);
    await Promise.all([a.flush(), b.flush()]);
    expect(a.exhausted()).toBe(true);
    expect(b.exhausted()).toBe(true);
    expect(db.state().users.get(user.id)?.total_used_bytes).toBeGreaterThanOrEqual(1_200);
  });
});
