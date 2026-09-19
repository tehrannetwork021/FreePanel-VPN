import { describe, expect, it } from 'vitest';
import { ensureProtocolConfig, loadProtocolConfig, publicProtocolStatus } from './store';
import { validateAdminSecret, verifyAdminPassword } from './admin';
import type { Env, KvBinding } from './model';

class MemoryKv implements KvBinding {
  private data = new Map<string, string>();
  async get(key: string) {
    return this.data.get(key) ?? null;
  }
  async put(key: string, value: string) {
    this.data.set(key, value);
  }
}

const makeEnv = (): Env => ({
  C: new MemoryKv(),
  ADMIN_PASSWORD: 'a-very-long-admin-password-123',
});

describe('protocol config', () => {
  it('creates secure independent defaults once and reloads idempotently', async () => {
    const env = makeEnv();
    expect(await loadProtocolConfig(env)).toBeNull();
    const first = await ensureProtocolConfig(env);
    const second = await ensureProtocolConfig(env);
    expect(second).toEqual(first);
    expect(first.schemaVersion).toBe(1);
    expect(first.vless).toMatchObject({ enabled: true, path: '/vless' });
    expect(first.trojan).toMatchObject({ enabled: true, path: '/trojan' });
    expect(first.xhttp).toEqual({ enabled: true, path: '/xhttp', mode: 'stream-one' });
    expect(first.subscription.path).toBe('/sub');
    expect(first.vless.uuid).not.toBe(first.subscription.token);
    expect(first.trojan.password).not.toBe(first.subscription.token);
    expect(first.trojan.passwordHash).toMatch(/^[0-9a-f]{56}$/);
    expect(first.trojan.passwordHash).not.toContain(first.trojan.password);
  });

  it('public status does not leak tunnel or subscription secrets', async () => {
    const config = await ensureProtocolConfig(makeEnv());
    const status = publicProtocolStatus(config);
    const encoded = JSON.stringify(status);
    expect(status).toEqual({
      schemaVersion: 1,
      vless: { enabled: true, path: '/vless' },
      trojan: { enabled: true, path: '/trojan' },
      xhttp: { enabled: true, path: '/xhttp', mode: 'stream-one' },
    });
    expect(encoded).not.toContain(config.vless.uuid);
    expect(encoded).not.toContain(config.trojan.password);
    expect(encoded).not.toContain(config.subscription.token);
  });
});

describe('admin password', () => {
  it('accepts only the configured password', async () => {
    expect(
      await verifyAdminPassword('a-very-long-admin-password-123', 'a-very-long-admin-password-123'),
    ).toBe(true);
    expect(
      await verifyAdminPassword('wrong-but-long-password', 'a-very-long-admin-password-123'),
    ).toBe(false);
  });

  it.each(['', 'short', 'CHANGE-ME-TO-A-LONG-RANDOM-PASSWORD'])(
    'rejects unsafe deployment secret %j',
    (secret) => {
      expect(() => validateAdminSecret(secret)).toThrow();
    },
  );
});
