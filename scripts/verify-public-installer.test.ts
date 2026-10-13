import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { verifyPublicInstaller } from './verify-public-installer.mjs';

const manifest = JSON.parse(
  readFileSync('dist/installer-artifacts/edge-worker-manifest.json', 'utf8'),
);
const html = readFileSync('apps/installer-worker/public/index.html', 'utf8');
const healthy = {
  ok: true,
  edgeVersion: manifest.version,
  edgeSha256: manifest.sha256,
  schemaVersion: 1,
};
const serve = async (url: URL) =>
  url.pathname === '/api/health'
    ? Response.json(healthy)
    : url.pathname === '/'
      ? new Response(html)
      : new Response(readFileSync('apps/installer-worker/public' + url.pathname));

describe('public installer production proof', () => {
  it('accepts only matching health, UI fingerprint and exact asset bytes', async () => {
    await expect(verifyPublicInstaller('https://stage.workers.dev', serve)).resolves.toMatchObject({
      ok: true,
      edgeSha256: manifest.sha256,
    });
  });
  it.each([
    'http://stage.workers.dev',
    'https://user:secret@stage.workers.dev',
    'https://stage.workers.dev?token=secret',
  ])('rejects unsafe verifier URL before a network call', async (url) => {
    const fetch = vi.fn();
    await expect(verifyPublicInstaller(url, fetch)).rejects.toThrow('invalid-installer-url');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('fails on a legacy missing health endpoint', async () => {
    await expect(
      verifyPublicInstaller(
        'https://stage.workers.dev',
        async () => new Response('Not found', { status: 404 }),
      ),
    ).rejects.toThrow('installer-health-http-failed');
  });
  it('fails when the deployed embedded Worker differs from the release manifest', async () => {
    await expect(
      verifyPublicInstaller('https://stage.workers.dev', async () =>
        Response.json({ ...healthy, edgeSha256: '0'.repeat(64) }),
      ),
    ).rejects.toThrow('installer-artifact-mismatch');
  });
  it('fails when an asset has the right filename but wrong bytes', async () => {
    const fetch = async (url: URL) =>
      url.pathname.startsWith('/assets/') ? new Response('stale') : serve(url);
    await expect(verifyPublicInstaller('https://stage.workers.dev', fetch)).rejects.toThrow(
      'installer-asset-checksum-mismatch',
    );
  });
});
