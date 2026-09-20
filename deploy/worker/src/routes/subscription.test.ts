import { describe, expect, it } from 'vitest';
import type { Env, ProtocolConfig } from '../config/model';
import { ensureInstallationState } from '../db/migrations';
import { createUser, createUserSecrets, rotateSubscriptionSecret } from '../db/users';
import { deriveSubscriptionToken } from '../security/derivedSecrets';
import { createFakeD1, type FakeD1 } from '../test/fakeD1';
import { handleSubscriptionRoute } from './subscription';

const config: ProtocolConfig = {
  schemaVersion: 1,
  createdAt: '2026-09-20T00:00:00.000Z',
  vless: { enabled: true, uuid: '27848739-7e62-4138-9fd3-098a63964b6b', path: '/vless' },
  trojan: {
    enabled: true,
    password: 'owner-trojan',
    passwordHash: 'a'.repeat(56),
    path: '/trojan',
  },
  xhttp: { enabled: true, path: '/xhttp', mode: 'stream-one' },
  subscription: { token: 'owner-legacy-token', path: '/sub' },
};

function env(db = createFakeD1()): Env {
  return {
    C: { get: async () => null, put: async () => undefined } as never,
    DB: db,
    ADMIN_PASSWORD: 'admin',
    INSTALL_GENERATION: 'gen',
  };
}

async function userFixture(input: Record<string, unknown> = {}) {
  const db = createFakeD1();
  const e = env(db);
  const state = await ensureInstallationState(
    e.DB,
    () => 1_000,
    () => new Uint8Array(32).fill(7),
  );
  const user = await createUser(e.DB, { name: 'User', ...input } as never, 1_000);
  await createUserSecrets(e.DB, state.secretSeed, user.id, 1_000);
  const token = await deriveSubscriptionToken(state.secretSeed, user.id, 1);
  return { db, e, state, user, token };
}

describe('private per-user subscriptions', () => {
  it('renders a user-specific subscription while preserving the legacy owner link', async () => {
    const { e, token } = await userFixture({ allowTrojan: false });
    const userResponse = await handleSubscriptionRoute(
      new Request(`https://edge.example/sub/${token}?format=links`),
      config,
      e,
    );
    expect(userResponse?.status).toBe(200);
    const body = await userResponse!.text();
    expect(body).toContain('vless://');
    expect(body).not.toContain('trojan://');
    expect(body).not.toContain(config.vless.uuid);

    const legacy = await handleSubscriptionRoute(
      new Request(`https://edge.example/sub/${config.subscription.token}?format=links`),
      config,
      e,
    );
    expect(legacy?.status).toBe(200);
    expect(await legacy!.text()).toContain(config.vless.uuid);
  });

  it.each([
    ['disabled', { enabled: false }],
    ['expired', { expiresAt: 999 }],
    ['total quota', { quotaBytes: 0 }],
  ])('hides %s users behind the same generic 404', async (_label, input) => {
    const { e, token } = await userFixture(input);
    const response = await handleSubscriptionRoute(
      new Request(`https://edge.example/sub/${token}?format=links`),
      config,
      e,
    );
    expect(response?.status).toBe(404);
    expect(await response!.text()).toBe('Not found');
  });

  it('rejects probing/invalid token paths before a useful response leaks', async () => {
    const e = env();
    for (const path of ['/sub/', `/sub/${'a'.repeat(129)}`, '/sub/a%2Fb', '/sub/%E0%A4%A']) {
      const response = await handleSubscriptionRoute(
        new Request(`https://edge.example${path}`),
        config,
        e,
      );
      expect(response?.status).toBe(404);
    }
  });
});

describe('subscription rotation and quota probing', () => {
  it('invalidates the old subscription token immediately after rotation', async () => {
    const { e, state, user, token } = await userFixture();
    await rotateSubscriptionSecret(e.DB, state.secretSeed, user.id, 2_000);
    const oldResponse = await handleSubscriptionRoute(
      new Request(`https://edge.example/sub/${token}?format=links`),
      config,
      e,
      2_001,
    );
    expect(oldResponse?.status).toBe(404);
    const next = await deriveSubscriptionToken(state.secretSeed, user.id, 2);
    const newResponse = await handleSubscriptionRoute(
      new Request(`https://edge.example/sub/${next}?format=links`),
      config,
      e,
      2_001,
    );
    expect(newResponse?.status).toBe(200);
  });

  it('hides a user whose UTC daily quota is exhausted', async () => {
    const { db, e, user, token } = await userFixture({ dailyQuotaBytes: 100 });
    const day = new Date(50_000).toISOString().slice(0, 10);
    (db as FakeD1).state().usageDaily.set(`${user.id}:${day}`, {
      user_id: user.id,
      day_utc: day,
      upload_bytes: 40,
      download_bytes: 60,
      total_bytes: 100,
      connections: 1,
      updated_at: 50_000,
    });
    const response = await handleSubscriptionRoute(
      new Request(`https://edge.example/sub/${token}?format=links`),
      config,
      e,
      50_000,
    );
    expect(response?.status).toBe(404);
    expect(await response!.text()).toBe('Not found');
  });
});

describe('private token probing regression', () => {
  it('returns the same generic 404 for an unknown private-token sentinel', async () => {
    const response = await handleSubscriptionRoute(
      new Request('https://edge.example/sub/PRIVATE_SUBSCRIPTION_TOKEN_SENTINEL_7f9a?format=links'),
      config,
      env(),
    );
    expect(response?.status).toBe(404);
    expect(response?.headers.get('cache-control')).toBe('no-store');
    expect(await response!.text()).toBe('Not found');
  });
});
