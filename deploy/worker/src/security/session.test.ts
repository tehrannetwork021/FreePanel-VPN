import { describe, expect, it } from 'vitest';
import { changeAdminPassword, ensureAdminCredential } from '../db/auth';
import { createFakeD1 } from '../test/fakeD1';
import { authenticateAdminRequest, createSession, requireCsrf } from './session';

describe('admin sessions', () => {
  it('stores only token hashes and authenticates matching secure cookies', async () => {
    const db = createFakeD1();
    const credential = await ensureAdminCredential(db, 'admin-one', 'gen-1', 1_000);
    const created = await createSession(db, credential.passwordVersion, 2_000);
    expect(JSON.stringify(db.rows())).not.toContain(created.sessionToken);
    expect(JSON.stringify(db.rows())).not.toContain(created.csrfToken);

    const request = new Request('https://worker.example/api/auth/session', {
      headers: { cookie: `tn_session=${created.sessionToken}; tn_csrf=${created.csrfToken}` },
    });
    await expect(authenticateAdminRequest(request, db, 3_000)).resolves.toMatchObject({
      expiresAt: created.expiresAt,
    });
  });
  it('requires matching CSRF header/cookie and rejects stale password-version sessions', async () => {
    const db = createFakeD1();
    const credential = await ensureAdminCredential(db, 'admin-one', 'gen-1', 1_000);
    const created = await createSession(db, credential.passwordVersion, 2_000);
    const good = new Request('https://worker.example/api/users', {
      method: 'POST',
      headers: {
        cookie: `tn_session=${created.sessionToken}; tn_csrf=${created.csrfToken}`,
        'x-csrf-token': created.csrfToken,
      },
    });
    const session = await authenticateAdminRequest(good, db, 3_000);
    expect(session).toBeTruthy();
    await expect(requireCsrf(good, session!)).resolves.toBe(true);

    const bad = new Request('https://worker.example/api/users', {
      method: 'POST',
      headers: {
        cookie: `tn_session=${created.sessionToken}; tn_csrf=${created.csrfToken}`,
        'x-csrf-token': 'wrong-csrf',
      },
    });
    await expect(requireCsrf(bad, session!)).resolves.toBe(false);
    await changeAdminPassword(db, 'admin-one', 'admin-two', 4_000);
    await expect(authenticateAdminRequest(good, db, 5_000)).resolves.toBeNull();
  });

  it('uses a twelve-hour absolute expiry', async () => {
    const db = createFakeD1();
    const credential = await ensureAdminCredential(db, 'admin-one', 'gen-1', 1_000);
    const created = await createSession(db, credential.passwordVersion, 2_000);
    expect(created.expiresAt).toBe(2_000 + 12 * 60 * 60 * 1000);
  });
});
