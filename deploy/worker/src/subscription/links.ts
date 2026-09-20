import type { ProtocolConfig } from '../config/model';
import { sha224Hex } from '../core/sha224';
import type { UserAccessSecrets, UserRecord } from '../db/users';

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
    // Xray stream-one clients send Content-Type: application/grpc unless
    // noGRPCHeader is set in the client-side extra config. Cloudflare's edge
    // classifies gRPC requests before they ever reach the Worker (and answers
    // 403 for zones without gRPC enabled), so the shared link must opt out.
    const extra = JSON.stringify({ noGRPCHeader: true });
    const params =
      `encryption=none&security=tls&sni=${q(cleanHost)}&fp=chrome&type=xhttp` +
      `&host=${q(cleanHost)}&path=${q(config.xhttp.path)}&mode=stream-one&extra=${q(extra)}`;
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

export function buildUserProtocolConfig(
  globalConfig: ProtocolConfig,
  user: UserRecord,
  secrets: UserAccessSecrets,
): ProtocolConfig {
  return {
    ...globalConfig,
    vless: {
      ...globalConfig.vless,
      enabled: globalConfig.vless.enabled && user.allowVless,
      uuid: secrets.vlessUuid,
    },
    trojan: {
      ...globalConfig.trojan,
      enabled: globalConfig.trojan.enabled && user.allowTrojan,
      password: secrets.trojanPassword,
      passwordHash: sha224Hex(secrets.trojanPassword),
    },
    xhttp: {
      ...globalConfig.xhttp,
      enabled: globalConfig.xhttp.enabled && user.allowVless && user.allowXhttp,
    },
    subscription: {
      ...globalConfig.subscription,
      token: secrets.subscriptionToken,
    },
  };
}
