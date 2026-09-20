import { describe, expect, it } from 'vitest';
import { changeAdminPassword, ensureAdminCredential, verifyAdminCredential } from './auth';
import { createSession } from '../security/session';
import { createFakeD1 } from '../test/fakeD1';

describe('admin credentials', () => {
  it('stores only PBKDF2 material and never the configured plaintext', async () => {
    const db = createFakeD1();
    const credential = await ensureAdminCredential(db, 'correct-horse', 'gen-1', 1_000);
    expect(credential.iterations).toBe(100_000);
    expect(credential.passwordVersion).toBe(1);
    expect(JSON.stringify(db.rows())).not.toContain('correct-horse');
    await expect(verifyAdminCredential(db, 'correct-horse')).resolves.toBeTruthy();
    await expect(verifyAdminCredential(db, 'wrong')).resolves.toBeNull();
  });
  it('does not revert a UI password change in the same generation but resets on reinstall', async () => {
    const db = createFakeD1();
    await ensureAdminCredential(db, 'installer-one', 'gen-1', 1_000);
    const first = await verifyAdminCredential(db, 'installer-one');
    expect(first).toBeTruthy();
    await createSession(db, first!.passwordVersion, 1_500);

    await expect(
      changeAdminPassword(db, 'installer-one', 'panel-changed', 2_000),
    ).resolves.toBeTruthy();
    await ensureAdminCredential(db, 'installer-one', 'gen-1', 3_000);
    await expect(verifyAdminCredential(db, 'panel-changed')).resolves.toBeTruthy();
    await expect(verifyAdminCredential(db, 'installer-one')).resolves.toBeNull();

    await ensureAdminCredential(db, 'installer-two', 'gen-2', 4_000);
    await expect(verifyAdminCredential(db, 'installer-two')).resolves.toBeTruthy();
    await expect(verifyAdminCredential(db, 'panel-changed')).resolves.toBeNull();
    expect(db.state().sessions.size).toBe(0);
  });
});
