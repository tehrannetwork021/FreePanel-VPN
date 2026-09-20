import { describe, expect, it } from 'vitest';
import { createUser, updateUser } from '../db/users';
import { deriveTrojanPassword, deriveVlessUuid } from './derivedSecrets';
import { sha224Hex } from '../core/sha224';
import { uuidToBytes } from '../core/uuid';
import { createFakeD1 } from '../test/fakeD1';
import { resolveTunnelPrincipal } from './tunnelAuth';

const seed = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const now = 1_800_000_000_000;

async function fixture() {
  const db = createFakeD1();
  const user = await createUser(db, { name: 'Tunnel user' }, now, seed);
  const uuid = await deriveVlessUuid(seed, user.id, 1);
  const password = await deriveTrojanPassword(seed, user.id, 1);
  return { db, user, uuid, password };
}

describe('per-user tunnel authorization', () => {
  it('resolves VLESS and Trojan wire credentials to the exact user/channel', async () => {
    const { db, user, uuid, password } = await fixture();
    await expect(resolveTunnelPrincipal(db, 'vless-ws', uuidToBytes(uuid), now)).resolves.toEqual({
      kind: 'authorized',
      principal: { kind: 'user', userId: user.id, channel: 'vless-ws' },
    });
    const trojanWire = new TextEncoder().encode(sha224Hex(password));
    await expect(resolveTunnelPrincipal(db, 'trojan-ws', trojanWire, now)).resolves.toEqual({
      kind: 'authorized',
      principal: { kind: 'user', userId: user.id, channel: 'trojan-ws' },
    });
  });
  it('returns denied-user for disabled or channel-disabled indexed users', async () => {
    const { db, user, uuid } = await fixture();
    const paused = await updateUser(db, user.id, { enabled: false }, user.version, now + 1);
    expect(paused.enabled).toBe(false);
    await expect(
      resolveTunnelPrincipal(db, 'vless-ws', uuidToBytes(uuid), now + 2),
    ).resolves.toEqual({
      kind: 'denied-user',
    });

    const { db: db2, user: user2, uuid: uuid2 } = await fixture();
    await updateUser(db2, user2.id, { allowXhttp: false }, user2.version, now + 1);
    await expect(
      resolveTunnelPrincipal(db2, 'vless-xhttp', uuidToBytes(uuid2), now + 2),
    ).resolves.toEqual({
      kind: 'denied-user',
    });
  });

  it('returns not-found only when no indexed credential matches', async () => {
    const { db } = await fixture();
    await expect(
      resolveTunnelPrincipal(
        db,
        'vless-ws',
        uuidToBytes('11111111-2222-4333-8444-555555555555'),
        now,
      ),
    ).resolves.toEqual({ kind: 'not-found' });
  });
});

describe('quota and expiry tunnel denial', () => {
  it.each([
    ['expired', { expiresAt: now }],
    ['total-quota', { quotaBytes: 0 }],
    ['daily-quota', { dailyQuotaBytes: 0 }],
  ] as const)('returns denied-user for %s state', async (_label, input) => {
    const db = createFakeD1();
    const user = await createUser(db, { name: 'Denied', ...input }, now - 1, seed);
    const uuid = await deriveVlessUuid(seed, user.id, 1);
    await expect(resolveTunnelPrincipal(db, 'vless-ws', uuidToBytes(uuid), now)).resolves.toEqual({
      kind: 'denied-user',
    });
  });
});
