import type { ProtocolConfig } from '../config/model';

export type ProtocolLinks = {
  vlessWs?: string;
  trojanWs?: string;
  vlessXhttp?: string;
};

function q(value: string): string {
  return encodeURIComponent(value);
}

export function buildNamedProtocolLinks(config: ProtocolConfig, host: string): ProtocolLinks {
  const cleanHost = host.trim().toLowerCase();
  const links: ProtocolLinks = {};
  if (config.vless.enabled) {
    const params =
      `encryption=none&security=tls&sni=${q(cleanHost)}&fp=chrome&type=ws` +
      `&host=${q(cleanHost)}&path=${q(config.vless.path)}`;
    links.vlessWs = `vless://${config.vless.uuid}@${cleanHost}:443?${params}#Tehran-Network-VLESS-WS`;
  }
  if (config.trojan.enabled) {
    const params =
      `security=tls&sni=${q(cleanHost)}&fp=chrome&type=ws` +
      `&host=${q(cleanHost)}&path=${q(config.trojan.path)}`;
    links.trojanWs =
      `trojan://${q(config.trojan.password)}@${cleanHost}:443?${params}` +
      '#Tehran-Network-Trojan-WS';
  }
  if (config.xhttp.enabled) {
    const params =
      `encryption=none&security=tls&sni=${q(cleanHost)}&fp=chrome&type=xhttp` +
      `&path=${q(config.xhttp.path)}&mode=stream-one`;
    links.vlessXhttp =
      `vless://${config.vless.uuid}@${cleanHost}:443?${params}` + '#Tehran-Network-VLESS-XHTTP';
  }
  return links;
}

export function buildProtocolLinks(config: ProtocolConfig, host: string): string[] {
  return Object.values(buildNamedProtocolLinks(config, host)).filter((value): value is string =>
    Boolean(value),
  );
}

export function buildSubscriptionUrl(config: ProtocolConfig, host: string): string {
  return `https://${host}${config.subscription.path}/${config.subscription.token}`;
}
