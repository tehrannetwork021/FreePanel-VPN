import { constantTimeEqual } from '../core/bytes';
import type { ProtocolConfig } from '../config/model';
import { chooseFormat, renderSubscription } from '../subscription/formats';

function secureEqual(left: string, right: string): boolean {
  const encoder = new TextEncoder();
  return constantTimeEqual(encoder.encode(left), encoder.encode(right));
}

export async function handleSubscriptionRoute(
  request: Request,
  config: ProtocolConfig | null,
): Promise<Response | null> {
  const url = new URL(request.url);
  const prefix = config ? `${config.subscription.path}/` : '/sub/';
  if (!url.pathname.startsWith(prefix)) return null;
  if (request.method !== 'GET' || !config) return new Response('Not found', { status: 404 });
  const token = decodeURIComponent(url.pathname.slice(prefix.length));
  if (!token || token.includes('/') || !secureEqual(token, config.subscription.token)) {
    return new Response('Not found', { status: 404 });
  }
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
