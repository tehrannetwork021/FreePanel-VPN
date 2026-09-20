import { describe, expect, it } from 'vitest';
import type { Env } from './config/model';
import { ensureAdminCredential } from './db/auth';
import { createSession } from './security/session';
import worker from './index';
import { createFakeD1 } from './test/fakeD1';

function healthEnv(): Env {
  return {
    C: { get: async () => null, put: async () => undefined },
    DB: createFakeD1(),
    ADMIN_PASSWORD: 'HEALTH_SECRET_SENTINEL_42',
    INSTALL_GENERATION: 'gen-test',
  };
}

describe('Worker D1 control plane', () => {
  it('reports schema readiness and bootstraps the installer-selected admin credential', async () => {
    const env = healthEnv();
    const response = await worker.fetch(new Request('https://worker.example/health'), env);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, d1: true, schemaVersion: 1 });
    expect(JSON.stringify((env.DB as ReturnType<typeof createFakeD1>).rows())).not.toContain(
      'HEALTH_SECRET_SENTINEL_42',
    );
  });

  it('routes authenticated control-plane reads through the admin API', async () => {
    const env = healthEnv();
    await worker.fetch(new Request('https://worker.example/health'), env);
    const now = Date.now();
    const credential = await ensureAdminCredential(
      env.DB,
      env.ADMIN_PASSWORD,
      env.INSTALL_GENERATION,
      now,
    );
    const session = await createSession(env.DB, credential.passwordVersion, now);
    const response = await worker.fetch(
      new Request('https://worker.example/api/overview', {
        headers: { cookie: `tn_session=${session.sessionToken}; tn_csrf=${session.csrfToken}` },
      }),
      env,
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true, users: { total: 0 } });
  });
});

describe('embedded admin SPA routing', () => {
  it('serves /admin from the Worker while root stays neutral', async () => {
    const env = healthEnv();
    const admin = await worker.fetch(new Request('https://worker.example/admin'), env);
    expect(admin.status).toBe(200);
    expect(admin.headers.get('content-type')).toContain('text/html');
    expect(await admin.text()).toContain('/panel-assets/');

    const root = await worker.fetch(new Request('https://worker.example/'), env);
    const html = await root.text();
    expect(root.status).toBe(200);
    expect(html).toContain('Tehran Network');
    expect(html).not.toContain('ADMIN_PASSWORD');
    expect(html).not.toContain('/admin');
  });
});

describe('safe infrastructure failures', () => {
  it('returns a generic D1 error without exception or secret detail', async () => {
    const env = healthEnv();
    env.DB = {
      prepare() {
        throw new Error('D1_INTERNAL_SECRET_SENTINEL should never escape');
      },
      exec() {
        throw new Error('D1_INTERNAL_SECRET_SENTINEL should never escape');
      },
      batch() {
        throw new Error('D1_INTERNAL_SECRET_SENTINEL should never escape');
      },
      dump() {
        throw new Error('D1_INTERNAL_SECRET_SENTINEL should never escape');
      },
    } as never;
    const response = await worker.fetch(new Request('https://worker.example/health'), env);
    expect(response.status).toBe(500);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    const text = await response.text();
    expect(text).toContain('d1-unavailable');
    expect(text).not.toContain('D1_INTERNAL_SECRET_SENTINEL');
  });
});
