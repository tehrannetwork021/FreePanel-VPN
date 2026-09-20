import { PANEL_ASSETS, PANEL_INDEX_HTML } from '../generated/panelAssets';

const SECURITY_HEADERS = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'content-security-policy':
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
};

function response(
  body: string | null,
  status: number,
  contentType: string,
  cacheControl: string,
): Response {
  return new Response(body, {
    status,
    headers: {
      ...SECURITY_HEADERS,
      'content-type': contentType,
      'cache-control': cacheControl,
    },
  });
}

export function handlePanelAssetRoute(request: Request): Response | null {
  const { pathname } = new URL(request.url);
  const isAdmin = pathname === '/admin' || pathname === '/admin/';
  const isAsset = pathname.startsWith('/panel-assets/');
  if (!isAdmin && !isAsset) return null;

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return response('Method not allowed', 405, 'text/plain; charset=utf-8', 'no-store');
  }
  const bodyAllowed = request.method === 'GET';
  if (isAdmin) {
    return response(
      bodyAllowed ? PANEL_INDEX_HTML : null,
      200,
      'text/html; charset=utf-8',
      'no-store',
    );
  }

  const asset = PANEL_ASSETS[pathname];
  if (!asset) {
    return response('Not found', 404, 'text/plain; charset=utf-8', 'no-store');
  }
  return response(
    bodyAllowed ? asset.body : null,
    200,
    asset.contentType,
    'public, max-age=31536000, immutable',
  );
}
