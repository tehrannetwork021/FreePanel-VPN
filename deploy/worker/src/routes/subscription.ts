import { constantTimeEqual } from '../core/bytes';
import type { Env, ProtocolConfig } from '../config/model';
import { ensureControlPlaneSchema, ensureInstallationState } from '../db/migrations';
import {
  deriveUserAccessSecrets,
  resolveSubscriptionPrincipal,
  touchLastSubscription,
} from '../db/users';
import { chooseFormat, renderSubscription } from '../subscription/formats';
import { buildUserProtocolConfig } from '../subscription/links';

function secureEqual(left: string, right: string): boolean {
  const encoder = new TextEncoder();
  return constantTimeEqual(encoder.encode(left), encoder.encode(right));
}

function notFound(): Response {
  return new Response('Not found', { status: 404, headers: { 'cache-control': 'no-store' } });
}

function parseToken(pathname: string, prefix: string): string | null {
  const encoded = pathname.slice(prefix.length);
  if (!encoded || encoded.length > 384) return null;
  try {
    const token = decodeURIComponent(encoded);
    if (!token || token.length > 128 || token.includes('/')) return null;
    return token;
  } catch {
    return null;
  }
}

function subscriptionResponse(request: Request, config: ProtocolConfig): Response {
  const url = new URL(request.url);
  const output = renderSubscription(chooseFormat(request), config, url.hostname);
  return new Response(output.body, {
    status: 200,
    headers: {
      'content-type': output.contentType,
      'cache-control': 'no-store',
      'content-disposition': 'inline',
      'x-content-type-options': 'nosniff',
    },
  });
}

export async function handleSubscriptionRoute(
  request: Request,
  config: ProtocolConfig | null,
  env?: Env,
  now = Date.now(),
): Promise<Response | null> {
  const url = new URL(request.url);
  const prefix = config ? `${config.subscription.path}/` : '/sub/';
  if (!url.pathname.startsWith(prefix)) return null;
  if (request.method !== 'GET' || !config) return notFound();
  const token = parseToken(url.pathname, prefix);
  if (!token) return notFound();

  if (secureEqual(token, config.subscription.token)) {
    return subscriptionResponse(request, config);
  }
  if (!env) return notFound();

  await ensureControlPlaneSchema(env.DB);
  const user = await resolveSubscriptionPrincipal(env.DB, token, now);
  if (!user) return notFound();
  const installation = await ensureInstallationState(env.DB);
  const secrets = await deriveUserAccessSecrets(env.DB, installation.secretSeed, user.id);
  if (!secrets) return notFound();
  const userConfig = buildUserProtocolConfig(config, user, secrets);
  await touchLastSubscription(env.DB, user, now);
  return subscriptionResponse(request, userConfig);
}
