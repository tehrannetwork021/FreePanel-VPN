import type { ProtocolConfig } from '../config/model';
import { buildProtocolLinks } from './links';

export type SubscriptionFormat = 'base64' | 'links' | 'singbox' | 'mihomo';
export type SubscriptionOutput = { body: string; contentType: string };

function singbox(config: ProtocolConfig, host: string): string {
  const outbounds: unknown[] = [];
  if (config.vless.enabled) {
    outbounds.push({
      type: 'vless',
      tag: 'Tehran-Network-VLESS-WS',
      server: host,
      server_port: 443,
      uuid: config.vless.uuid,
      tls: { enabled: true, server_name: host, utls: { enabled: true, fingerprint: 'chrome' } },
      transport: { type: 'ws', path: config.vless.path, headers: { Host: host } },
    });
  }
  if (config.trojan.enabled) {
    outbounds.push({
      type: 'trojan',
      tag: 'Tehran-Network-Trojan-WS',
      server: host,
      server_port: 443,
      password: config.trojan.password,
      tls: { enabled: true, server_name: host, utls: { enabled: true, fingerprint: 'chrome' } },
      transport: { type: 'ws', path: config.trojan.path, headers: { Host: host } },
    });
  }
  return JSON.stringify({ outbounds }, null, 2);
}

function yamlQuote(value: string): string {
  return JSON.stringify(value);
}

function mihomo(config: ProtocolConfig, host: string): string {
  const rows: string[] = ['proxies:'];
  if (config.vless.enabled) {
    rows.push(
      '  - name: Tehran-Network-VLESS-WS',
      '    type: vless',
      `    server: ${yamlQuote(host)}`,
      '    port: 443',
      `    uuid: ${yamlQuote(config.vless.uuid)}`,
      '    tls: true',
      `    servername: ${yamlQuote(host)}`,
      '    network: ws',
      '    ws-opts:',
      `      path: ${yamlQuote(config.vless.path)}`,
      '      headers:',
      `        Host: ${yamlQuote(host)}`,
    );
  }
  if (config.trojan.enabled) {
    rows.push(
      '  - name: Tehran-Network-Trojan-WS',
      '    type: trojan',
      `    server: ${yamlQuote(host)}`,
      '    port: 443',
      `    password: ${yamlQuote(config.trojan.password)}`,
      '    tls: true',
      `    sni: ${yamlQuote(host)}`,
      '    network: ws',
      '    ws-opts:',
      `      path: ${yamlQuote(config.trojan.path)}`,
      '      headers:',
      `        Host: ${yamlQuote(host)}`,
    );
  }
  return `${rows.join('\n')}\n`;
}
export function renderSubscription(
  format: SubscriptionFormat,
  config: ProtocolConfig,
  host: string,
): SubscriptionOutput {
  const links = buildProtocolLinks(config, host);
  if (format === 'links') {
    return { body: `${links.join('\n')}\n`, contentType: 'text/plain; charset=utf-8' };
  }
  if (format === 'base64') {
    return { body: btoa(links.join('\n')), contentType: 'text/plain; charset=utf-8' };
  }
  if (format === 'singbox') {
    return { body: singbox(config, host), contentType: 'application/json; charset=utf-8' };
  }
  return { body: mihomo(config, host), contentType: 'text/yaml; charset=utf-8' };
}

export function chooseFormat(request: Request): SubscriptionFormat {
  const requested = new URL(request.url).searchParams.get('format')?.toLowerCase();
  if (
    requested === 'links' ||
    requested === 'base64' ||
    requested === 'singbox' ||
    requested === 'mihomo'
  ) {
    return requested;
  }
  const ua = request.headers.get('user-agent')?.toLowerCase() ?? '';
  if (ua.includes('sing-box') || ua.includes('singbox')) return 'singbox';
  if (ua.includes('clash') || ua.includes('mihomo')) return 'mihomo';
  return 'base64';
}
