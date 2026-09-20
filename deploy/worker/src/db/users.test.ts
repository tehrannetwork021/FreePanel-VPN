import { describe, expect, it } from 'vitest';
import { createFakeD1 } from '../test/fakeD1';
import { createUser, deleteUser, getUser, listUsers, updateUser } from './users';

describe('user repository', () => {
  it.each([
    [{ name: '' }, 'invalid-name'],
    [{ name: 'x'.repeat(81) }, 'invalid-name'],
    [{ name: 'ok', quotaBytes: -1 }, 'invalid-quota'],
    [{ name: 'ok', dailyQuotaBytes: Number.MAX_SAFE_INTEGER + 1 }, 'invalid-quota'],
    [{ name: 'ok', notes: 'x'.repeat(501) }, 'invalid-notes'],
    [{ name: 'ok', expiresAt: 0 }, 'invalid-expiry'],
  ])('rejects bounded invalid input %#', async (input, code) => {
    await expect(createUser(createFakeD1(), input as never, 1_000)).rejects.toMatchObject({
      code,
    });
  });

  it('creates, lists, reads, updates and deletes a bounded user record', async () => {
    const db = createFakeD1();
    const created = await createUser(
      db,
      {
        name: '  Alice  ',
        quotaBytes: 1_000,
        notes: 'demo',
        allowTrojan: false,
      },
      2_000,
    );
    expect(created).toMatchObject({
      name: 'Alice',
      enabled: true,
      quotaBytes: 1_000,
      notes: 'demo',
      allowVless: true,
      allowTrojan: false,
      allowXhttp: true,
      version: 1,
    });
    expect(await listUsers(db)).toHaveLength(1);
    await expect(getUser(db, created.id)).resolves.toMatchObject({ id: created.id });

    const updated = await updateUser(
      db,
      created.id,
      {
        name: 'Alice B',
        enabled: false,
        dailyQuotaBytes: 250,
      },
      created.version,
      2_001,
    );
    expect(updated).toMatchObject({
      name: 'Alice B',
      enabled: false,
      dailyQuotaBytes: 250,
      version: 2,
    });
    await expect(deleteUser(db, created.id)).resolves.toBe(true);
    await expect(getUser(db, created.id)).resolves.toBeNull();
  });

  it('uses optimistic versioning so stale concurrent edits fail', async () => {
    const db = createFakeD1();
    const user = await createUser(db, { name: 'A' }, 3_000);
    await updateUser(db, user.id, { name: 'B' }, user.version, 3_001);
    await expect(updateUser(db, user.id, { name: 'C' }, user.version, 3_002)).rejects.toMatchObject(
      { code: 'version-conflict' },
    );
  });
});
