import { INSTALLER_ASSETS, INSTALLER_INDEX_HTML } from './generated/installerAssets';

export function serveEmbeddedInstallerAsset(request: Request): Response {
  const path = new URL(request.url).pathname;
  const asset = INSTALLER_ASSETS[path];
  if (!asset && path.startsWith('/assets/')) {
    return new Response('not-found', { status: 404 });
  }
  const body = asset?.body ?? INSTALLER_INDEX_HTML;
  return new Response(request.method === 'HEAD' ? null : body, {
    headers: {
      'content-type': asset?.contentType ?? 'text/html; charset=utf-8',
      'cache-control': asset ? 'public, max-age=3600' : 'no-cache',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
    },
  });
}
