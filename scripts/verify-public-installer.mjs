import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import process from 'node:process';
import console from 'node:console';

const { fetch, AbortSignal } = globalThis;

const root = resolve(import.meta.dirname, '..');
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');

export async function verifyPublicInstaller(base, fetchImpl = fetch) {
  const url = new URL(base);
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/'
  )
    throw new Error('invalid-installer-url');
  const get = (path) =>
    fetchImpl(new URL(path, url), {
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(10000),
    });
  const manifest = JSON.parse(
    await readFile(resolve(root, 'dist/installer-artifacts/edge-worker-manifest.json'), 'utf8'),
  );
  const healthResponse = await get('/api/health');
  if (!healthResponse.ok) throw new Error('installer-health-http-failed');
  const health = await healthResponse.json();
  if (
    health?.ok !== true ||
    health.edgeVersion !== manifest.version ||
    health.edgeSha256 !== manifest.sha256 ||
    health.schemaVersion !== 1
  )
    throw new Error('installer-artifact-mismatch');
  const response = await get('/');
  if (!response.ok) throw new Error('installer-ui-http-failed');
  const html = await response.text();
  const paths = [...new Set(html.match(/\/assets\/[A-Za-z0-9_.-]+\.(?:js|css)/g) ?? [])];
  const expectedHtml = await readFile(
    resolve(root, 'apps/installer-worker/public/index.html'),
    'utf8',
  );
  const expectedPaths = [
    ...new Set(expectedHtml.match(/\/assets\/[A-Za-z0-9_.-]+\.(?:js|css)/g) ?? []),
  ];
  if (
    paths.length !== expectedPaths.length ||
    !paths.length ||
    paths.some((path) => !expectedPaths.includes(path))
  )
    throw new Error('installer-ui-fingerprint-mismatch');
  for (const path of paths) {
    const asset = await get(path);
    if (!asset.ok) throw new Error('installer-asset-http-failed');
    const expected = await readFile(resolve(root, 'apps/installer-worker/public', path.slice(1)));
    if (digest(new Uint8Array(await asset.arrayBuffer())) !== digest(expected))
      throw new Error('installer-asset-checksum-mismatch');
  }
  return {
    ok: true,
    url: url.origin,
    edgeVersion: health.edgeVersion,
    edgeSha256: health.edgeSha256,
    assets: paths,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  verifyPublicInstaller(
    process.argv[2] ?? 'https://tehran-network-installer.honored-feather.workers.dev',
  )
    .then((result) => console.log(JSON.stringify(result)))
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}
