import { describe, expect, it } from 'vitest';
import type { Env } from '../config/model';
import { ensureAdminCredential } from '../db/auth';
import { recordUsageDelta } from '../db/usage';
import { createSession } from '../security/session';
import { createFakeD1, type FakeD1 } from '../test/fakeD1';
import { handleAdminApi } from './adminApi';

function env(db: FakeD1): Env {
  return {
    C: { get: async () => null, put: async () => undefined } as never,
    DB: db,
    ADMIN_PASSWORD: 'admin-api-test',
    INSTALL_GENERATION: 'gen-admin-api',
  };
}

async function adminHeaders(db: FakeD1, now = 10_000) {
  const credential = await ensureAdminCredential(db, 'admin-api-test', 'gen-admin-api', now);
  const session = await createSession(db, credential.passwordVersion, now);
  return {
    cookie: `tn_session=${session.sessionToken}; tn_csrf=${session.csrfToken}`,
    'x-csrf-token': session.csrfToken,
    'content-type': 'application/json',
  };
}

function request(path: string, init: RequestInit = {}) {
  return new Request(`https://worker.example${path}`, init);
}

describe('admin user API', () => {
  it('requires an authenticated admin session even for reads', async () => {
    const db = createFakeD1();
    const response = await handleAdminApi(request('/api/users'), env(db), 10_000);
    expect(response?.status).toBe(401);
    expect(response!.headers.get('cache-control')).toBe('no-store');
    expect(response!.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response!.headers.get('referrer-policy')).toBe('no-referrer');
    await expect(response!.json()).resolves.toEqual({ ok: false, error: 'unauthorized' });
  });

  it('creates and mutates users with CSRF, optimistic versions and redacted audit', async () => {
    const db = createFakeD1();
    const headers = await adminHeaders(db);
    const createdResponse = await handleAdminApi(
      request('/api/users', {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: 'Alice', quotaBytes: 1_000, notes: 'safe note' }),
      }),
      env(db),
      11_000,
    );
    expect(createdResponse?.status).toBe(201);
    const created = (await createdResponse!.json()) as any;
    expect(created.user).toMatchObject({ name: 'Alice', version: 1 });

    const patched = await handleAdminApi(
      request(`/api/users/${created.user.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ name: 'Alice B', version: 1 }),
      }),
      env(db),
      12_000,
    );
    expect(patched?.status).toBe(200);
    await expect(patched!.json()).resolves.toMatchObject({ user: { name: 'Alice B', version: 2 } });

    const stale = await handleAdminApi(
      request(`/api/users/${created.user.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ name: 'stale', version: 1 }),
      }),
      env(db),
      13_000,
    );
    expect(stale?.status).toBe(409);
    await expect(stale!.json()).resolves.toEqual({ ok: false, error: 'version-conflict' });

    const audit = await handleAdminApi(
      request('/api/audit?limit=100', { headers }),
      env(db),
      14_000,
    );
    expect(audit?.status).toBe(200);
    const auditText = await audit!.text();
    expect(auditText).toContain('user.create');
    expect(auditText).toContain('user.update');
    expect(auditText).not.toMatch(
      /ADMIN_PASSWORD|secret_seed|tn_session|tn_csrf|subscriptionToken|trojanPassword/i,
    );
  });

  it.each([
    ['invalid-json', '{bad', 400, 'invalid-json'],
    ['unknown-field', JSON.stringify({ name: 'A', surprise: true }), 400, 'unknown-field'],
    ['long-name', JSON.stringify({ name: 'x'.repeat(81) }), 400, 'invalid-name'],
    ['long-notes', JSON.stringify({ name: 'A', notes: 'x'.repeat(501) }), 400, 'invalid-notes'],
    ['negative-quota', JSON.stringify({ name: 'A', quotaBytes: -1 }), 400, 'invalid-quota'],
    [
      'unsafe-quota',
      JSON.stringify({ name: 'A', quotaBytes: Number.MAX_SAFE_INTEGER + 1 }),
      400,
      'invalid-quota',
    ],
    ['string-quota', JSON.stringify({ name: 'A', quotaBytes: 'NaN' }), 400, 'invalid-quota'],
  ])('returns safe bounded errors for %s', async (_name, body, status, error) => {
    const db = createFakeD1();
    const headers = await adminHeaders(db);
    const response = await handleAdminApi(
      request('/api/users', {
        method: 'POST',
        headers,
        body,
      }),
      env(db),
      15_000,
    );
    expect(response?.status).toBe(status);
    await expect(response!.json()).resolves.toEqual({ ok: false, error });
  });

  it('returns generic 404 for malformed/unknown user ids and 403 for bad CSRF', async () => {
    const db = createFakeD1();
    const headers = await adminHeaders(db);
    const badId = await handleAdminApi(
      request('/api/users/not-a-uuid', { headers }),
      env(db),
      16_000,
    );
    expect(badId?.status).toBe(404);
    await expect(badId!.json()).resolves.toEqual({ ok: false, error: 'not-found' });

    const badCsrf = await handleAdminApi(
      request('/api/users', {
        method: 'POST',
        headers: { ...headers, 'x-csrf-token': 'wrong' },
        body: JSON.stringify({ name: 'A' }),
      }),
      env(db),
      17_000,
    );
    expect(badCsrf?.status).toBe(403);
    expect(await badCsrf!.text()).not.toMatch(/hash|salt|password|session/i);
  });

  it('clamps audit and login-event limits and exposes a compact overview', async () => {
    const db = createFakeD1();
    const headers = await adminHeaders(db);
    const overview = await handleAdminApi(request('/api/overview', { headers }), env(db), 18_000);
    expect(overview?.status).toBe(200);
    await expect(overview!.json()).resolves.toMatchObject({
      ok: true,
      users: { total: 0, enabled: 0 },
    });
    expect(
      (await handleAdminApi(request('/api/audit?limit=9999', { headers }), env(db), 18_001))
        ?.status,
    ).toBe(200);
    expect(
      (await handleAdminApi(request('/api/security/logins?limit=0', { headers }), env(db), 18_002))
        ?.status,
    ).toBe(200);
  });
});

// Task 5 pins access/rotation on the same authenticated API surface.
describe('admin user secret rotation', () => {
  it('creates indexed secrets, exposes access metadata, and rotates only requested material', async () => {
    const db = createFakeD1();
    const headers = await adminHeaders(db, 30_000);
    const e = env(db);
    const created = await handleAdminApi(
      request('/api/users', {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: 'Rotate Me' }),
      }),
      e,
      30_001,
    );
    const user = ((await created!.json()) as any).user;

    const access1 = await handleAdminApi(
      request(`/api/users/${user.id}/access`, { headers }),
      e,
      30_002,
    );
    expect(access1?.status).toBe(200);
    const first = ((await access1!.json()) as any).access;
    expect(first.subscriptionUrl).toContain('/sub/');
    expect(first.qr.payload).toBe(first.subscriptionUrl);
    expect(first).not.toHaveProperty('installationSeed');

    const rotatedSub = await handleAdminApi(
      request(`/api/users/${user.id}/rotate-subscription`, {
        method: 'POST',
        headers,
        body: '{}',
      }),
      e,
      30_003,
    );
    expect(rotatedSub?.status).toBe(200);
    const access2 = (
      (await (await handleAdminApi(
        request(`/api/users/${user.id}/access`, { headers }),
        e,
        30_004,
      ))!.json()) as any
    ).access;
    expect(access2.subscriptionToken).not.toBe(first.subscriptionToken);
    expect(access2.vless.uuid).toBe(first.vless.uuid);

    const rotatedCredentials = await handleAdminApi(
      request(`/api/users/${user.id}/rotate-credentials`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ protocol: 'vless' }),
      }),
      e,
      30_005,
    );
    expect(rotatedCredentials?.status).toBe(200);
    const access3 = (
      (await (await handleAdminApi(
        request(`/api/users/${user.id}/access`, { headers }),
        e,
        30_006,
      ))!.json()) as any
    ).access;
    expect(access3.vless.uuid).not.toBe(access2.vless.uuid);
    expect(access3.trojan.password).toBe(access2.trojan.password);
  });
});

describe('admin usage and overview API', () => {
  it('returns aggregate/user UTC usage and real recent/expiry overview metrics', async () => {
    const db = createFakeD1();
    const now = Date.parse('2026-09-20T12:00:00Z');
    const headers = await adminHeaders(db, now - 1_000);
    const e = env(db);
    const create = async (body: Record<string, unknown>) => {
      const response = await handleAdminApi(
        request('/api/users', {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        }),
        e,
        now - 900,
      );
      return ((await response!.json()) as any).user;
    };
    const active = await create({ name: 'Active', expiresAt: now + 2 * 86_400_000 });
    await create({ name: 'Idle' });
    await recordUsageDelta(
      db,
      active.id,
      {
        uploadBytes: 100,
        downloadBytes: 200,
        connections: 1,
      },
      now - 500,
    );

    const aggregate = await handleAdminApi(request('/api/usage?days=14', { headers }), e, now);
    expect(aggregate?.status).toBe(200);
    await expect(aggregate!.json()).resolves.toMatchObject({
      ok: true,
      usage: [{ dayUtc: '2026-09-20', totalBytes: 300, connections: 1 }],
    });

    const perUser = await handleAdminApi(
      request(`/api/users/${active.id}/usage?days=14`, { headers }),
      e,
      now,
    );
    expect(perUser?.status).toBe(200);
    await expect(perUser!.json()).resolves.toMatchObject({
      ok: true,
      usage: [{ userId: active.id, totalBytes: 300 }],
    });

    const overview = await handleAdminApi(request('/api/overview', { headers }), e, now);
    expect(overview?.status).toBe(200);
    await expect(overview!.json()).resolves.toMatchObject({
      ok: true,
      enabledUsers: 2,
      recentUsers: 1,
      todayBytes: 300,
      totalBytes: 300,
      expiryWarnings: 1,
    });
  });
});
