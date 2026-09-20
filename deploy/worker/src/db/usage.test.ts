import { describe, expect, it } from 'vitest';
import { createUser } from './users';
import { createFakeD1 } from '../test/fakeD1';
import { readAccessState, readUsage, recordUsageDelta } from './usage';

const now = Date.parse('2026-09-20T12:00:00Z');

describe('D1 usage accounting', () => {
  it('atomically accumulates concurrent deltas without lost updates', async () => {
    const db = createFakeD1();
    const user = await createUser(db, { name: 'Metered' }, now);
    await Promise.all([
      recordUsageDelta(db, user.id, { uploadBytes: 100, downloadBytes: 200, connections: 1 }, now),
      recordUsageDelta(db, user.id, { uploadBytes: 400, downloadBytes: 500, connections: 1 }, now),
    ]);
    await expect(readUsage(db, user.id, '2026-09-20')).resolves.toMatchObject({
      uploadBytes: 500,
      downloadBytes: 700,
      totalBytes: 1200,
      connections: 2,
    });
    await expect(readAccessState(db, user.id, now)).resolves.toMatchObject({
      allowed: true,
      totalUsedBytes: 1200,
      todayUsedBytes: 1200,
    });
  });
  it('treats numeric zero quota as exhausted and NULL as unlimited', async () => {
    const db = createFakeD1();
    const unlimited = await createUser(db, { name: 'Unlimited' }, now);
    const zero = await createUser(db, { name: 'Zero', quotaBytes: 0 }, now);
    await expect(readAccessState(db, unlimited.id, now)).resolves.toMatchObject({ allowed: true });
    await expect(readAccessState(db, zero.id, now)).resolves.toMatchObject({
      allowed: false,
      reason: 'total-quota',
    });
  });

  it('returns exhausted after the checkpoint that crosses quota', async () => {
    const db = createFakeD1();
    const user = await createUser(db, { name: 'Capped', quotaBytes: 1000 }, now);
    const state = await recordUsageDelta(
      db,
      user.id,
      { uploadBytes: 600, downloadBytes: 500, connections: 1 },
      now,
    );
    expect(state).toMatchObject({ allowed: false, reason: 'total-quota', totalUsedBytes: 1100 });
  });
});
