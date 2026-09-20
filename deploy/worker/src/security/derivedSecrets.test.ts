import { describe, expect, it } from 'vitest';
import {
  credentialLookupHash,
  deriveSubscriptionToken,
  deriveTrojanPassword,
  deriveVlessUuid,
  subscriptionLookupHash,
} from './derivedSecrets';

const seed = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

describe('derived per-user secrets', () => {
  it('derives stable purpose-separated secrets without persisting plaintext material', async () => {
    const sub = await deriveSubscriptionToken(seed, 'user-1', 1);
    const vless = await deriveVlessUuid(seed, 'user-1', 1);
    const trojan = await deriveTrojanPassword(seed, 'user-1', 1);
    expect(new Set([sub, vless, trojan]).size).toBe(3);
    expect(await deriveSubscriptionToken(seed, 'user-1', 1)).toBe(sub);
    expect(await deriveSubscriptionToken(seed, 'user-1', 2)).not.toBe(sub);
    expect(sub).toMatch(/^[A-Za-z0-9_-]{32}$/u);
    expect(vless).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u);
    expect(trojan).toMatch(/^[A-Za-z0-9_-]{32}$/u);
  });

  it('hashes client-presented credentials into fixed lookup indexes', async () => {
    const sub = await deriveSubscriptionToken(seed, 'user-2', 1);
    expect(await subscriptionLookupHash(sub)).toMatch(/^[0-9a-f]{64}$/u);
    expect(await credentialLookupHash('vless', 'A-B-C')).toBe(
      await credentialLookupHash('vless', 'a-b-c'),
    );
    expect(await credentialLookupHash('trojan', 'CaseSensitive')).not.toBe(
      await credentialLookupHash('trojan', 'casesensitive'),
    );
  });
});
