import { describe, expect, it } from 'vitest';
import type { ProtocolConfig } from '../config/model';
import { buildProtocolLinks } from './links';
import { renderSubscription } from './formats';
import { handleSubscriptionRoute } from '../routes/subscription';

const config: ProtocolConfig = {
  schemaVersion: 1,
  createdAt: '2026-09-19T00:00:00.000Z',
  vless: { enabled: true, uuid: '27848739-7e62-4138-9fd3-098a63964b6b', path: '/vless' },
  trojan: { enabled: true, password: 'trojan-pass', passwordHash: 'a'.repeat(56), path: '/trojan' },
  xhttp: { enabled: true, path: '/xhttp', mode: 'stream-one' },
  subscription: { token: 'aabbccddeeff00112233445566778899', path: '/sub' },
};

const host = 'edge.example.workers.dev';

describe('subscription links and formats', () => {
  it('builds parseable WS and XHTTP share links', () => {
    const links = buildProtocolLinks(config, host);
    expect(links).toHaveLength(3);
    const vlessWs = new URL(links[0]!.replace('vless://', 'https://'));
    expect(vlessWs.username).toBe(config.vless.uuid);
    expect(vlessWs.searchParams.get('type')).toBe('ws');
    expect(vlessWs.searchParams.get('path')).toBe('/vless');
    const trojan = new URL(links[1]!.replace('trojan://', 'https://'));
    expect(decodeURIComponent(trojan.username)).toBe(config.trojan.password);
    expect(trojan.searchParams.get('type')).toBe('ws');
    const xhttp = new URL(links[2]!.replace('vless://', 'https://'));
    expect(xhttp.searchParams.get('type')).toBe('xhttp');
    expect(xhttp.searchParams.get('mode')).toBe('stream-one');
    expect(xhttp.searchParams.get('host')).toBe(host);
    // Xray sends Content-Type: application/grpc for stream-one unless the
    // client-side extra config sets noGRPCHeader; Cloudflare's edge classifies
    // gRPC requests before they reach the Worker, so the link must opt out.
    const extra = JSON.parse(xhttp.searchParams.get('extra') ?? '{}') as Record<string, unknown>;
    expect(extra).toEqual({ noGRPCHeader: true });
  });

  it('renders base64, sing-box and Mihomo without lying about unsupported XHTTP schemas', () => {
    const base64 = renderSubscription('base64', config, host);
    const decoded = atob(base64.body);
    expect(decoded).toContain('type=ws');
    expect(decoded).toContain('type=xhttp');

    const singbox = JSON.parse(renderSubscription('singbox', config, host).body);
    expect(singbox.outbounds).toHaveLength(2);
    expect(JSON.stringify(singbox)).not.toContain('xhttp');

    const mihomo = renderSubscription('mihomo', config, host).body;
    expect(mihomo).toContain('type: vless');
    expect(mihomo).toContain('type: trojan');
    expect(mihomo).not.toContain('xhttp');
  });

  it('protects subscription output with an independent token', async () => {
    const good = await handleSubscriptionRoute(
      new Request(`https://${host}/sub/${config.subscription.token}?format=links`),
      config,
    );
    expect(good?.status).toBe(200);
    expect(await good?.text()).toContain('vless://');
    const bad = await handleSubscriptionRoute(
      new Request(`https://${host}/sub/wrong-token?format=links`),
      config,
    );
    expect(bad?.status).toBe(404);
  });
});
