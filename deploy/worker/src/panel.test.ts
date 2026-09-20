import { describe, expect, it } from 'vitest';
import type { Env, KvBinding } from './config/model';
import { loadProtocolConfig } from './config/store';
import { handleAdminApiSetup, handleSetupForm, renderPublicPanel } from './panel';
import { createFakeD1 } from './test/fakeD1';

class MemoryKv implements KvBinding {
  private data = new Map<string, string>();
  async get(key: string) {
    return this.data.get(key) ?? null;
  }
  async put(key: string, value: string) {
    this.data.set(key, value);
  }
}
const password = 'owner-admin-password-12345';
const env = (): Env => ({
  C: new MemoryKv(),
  DB: createFakeD1(),
  ADMIN_PASSWORD: password,
  INSTALL_GENERATION: 'panel-test-gen',
});

function form(value: string) {
  return new Request('https://edge.example.workers.dev/setup', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ adminPassword: value }),
  });
}

describe('owner panel', () => {
  it('renders a public locked page without generated tunnel secrets', async () => {
    const e = env();
    const html = renderPublicPanel(null);
    expect(html).toContain('ADMIN_PASSWORD');
    expect(html).toContain('minlength="1"');
    expect(html).not.toContain('minlength="16"');
    expect(html).not.toContain('vless://');
    expect(await loadProtocolConfig(e)).toBeNull();
  });

  it('keeps an initialized public page redacted', async () => {
    const e = env();
    const setup = await handleSetupForm(form(password), e);
    expect(setup.status).toBe(200);
    const config = await loadProtocolConfig(e);
    const html = renderPublicPanel(config);
    expect(html).not.toContain(config!.vless.uuid);
    expect(html).not.toContain(config!.trojan.password);
    expect(html).not.toContain(config!.subscription.token);
  });

  it('does not initialize config with a wrong admin password', async () => {
    const e = env();
    const response = await handleSetupForm(form('wrong-admin-password-000'), e);
    expect(response.status).toBe(401);
    expect(await loadProtocolConfig(e)).toBeNull();
  });

  it('creates config only after admin auth and renders copyable links plus inline QR', async () => {
    const e = env();
    const response = await handleSetupForm(form(password), e);
    expect(response.status).toBe(200);
    const html = await response.text();
    const config = await loadProtocolConfig(e);
    expect(config).not.toBeNull();
    expect(html).toContain('vless://');
    expect(html).toContain('trojan://');
    expect(html).toContain('type=xhttp');
    expect(html).toContain('<svg');
    expect(html).toContain(`/sub/${config!.subscription.token}`);
  });

  it('offers a protected JSON setup API for automation and never returns config to bad auth', async () => {
    const e = env();
    const bad = await handleAdminApiSetup(
      new Request('https://edge.example.workers.dev/api/setup', { method: 'POST' }),
      e,
    );
    expect(bad.status).toBe(401);
    const good = await handleAdminApiSetup(
      new Request('https://edge.example.workers.dev/api/setup', {
        method: 'POST',
        headers: { authorization: `Bearer ${password}` },
      }),
      e,
    );
    expect(good.status).toBe(200);
    const body = (await good.json()) as any;
    expect(body.links).toHaveLength(3);
    expect(body.subscriptionUrl).toContain('/sub/');
  });
});

describe('neutral public root', () => {
  it('does not disclose admin paths, setup controls, credentials or user state', async () => {
    const { publicPanelResponse } = await import('./panel');
    const response = publicPanelResponse(null);
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const html = await response.text();
    expect(html).toContain('Tehran Network');
    expect(html).not.toContain('ADMIN_PASSWORD');
    expect(html).not.toContain('action="/setup"');
    expect(html).not.toContain('/admin');
    expect(html).not.toContain('vless://');
    expect(html).not.toContain('trojan://');
  });
});
