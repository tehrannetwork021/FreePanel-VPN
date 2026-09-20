import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const installerDeployUrl =
  'https://deploy.workers.cloudflare.com/?url=https://github.com/tehrannetwork021/FreePanel-VPN/tree/main/apps/installer-worker';
const developerDeployUrl =
  'https://deploy.workers.cloudflare.com/?url=https://github.com/tehrannetwork021/FreePanel-VPN/tree/main/deploy/worker';

describe('public install and release contract', () => {
  it('ships an isolated Deploy to Cloudflare Worker template', () => {
    expect(existsSync('deploy/worker/package.json')).toBe(true);
    expect(existsSync('deploy/worker/wrangler.jsonc')).toBe(true);
    expect(existsSync('deploy/worker/src/index.ts')).toBe(true);

    const config = readFileSync('deploy/worker/wrangler.jsonc', 'utf8');
    expect(config).toContain('"binding": "C"');
    expect(config).not.toMatch(/"id"\s*:/);
  });

  it('declares an owner-only admin secret and worker-local quality gates', () => {
    expect(existsSync('deploy/worker/.dev.vars.example')).toBe(true);
    expect(existsSync('deploy/worker/tsconfig.json')).toBe(true);
    const vars = readFileSync('deploy/worker/.dev.vars.example', 'utf8');
    const config = readFileSync('deploy/worker/wrangler.jsonc', 'utf8');
    const pkg = JSON.parse(readFileSync('deploy/worker/package.json', 'utf8')) as {
      scripts?: Record<string, string>;
    };
    expect(vars).toContain('ADMIN_PASSWORD=');
    expect(config).toContain('"secrets"');
    expect(config).toContain('"ADMIN_PASSWORD"');
    expect(pkg.scripts).toMatchObject({
      typecheck: expect.any(String),
      test: expect.any(String),
      check: expect.any(String),
    });
  });

  it('publishes the free token installer as the primary path and the template as developer path', () => {
    const readme = readFileSync('README.md', 'utf8');
    expect(readme).toContain(installerDeployUrl);
    expect(readme).toContain(developerDeployUrl);
    expect(readme).toContain('docs/INSTALL_FA.md');
    expect(readme).toContain('docs/INSTALL_EN.md');
    expect(readme).toContain('Deploy Installer');
    expect(readme).toContain('Generate Cloudflare Key');
    expect(readme.indexOf(installerDeployUrl)).toBeLessThan(readme.indexOf(developerDeployUrl));
  });

  it('documents the token scopes required by the installer', () => {
    const readme = readFileSync('README.md', 'utf8');
    expect(readme).toContain('Workers Scripts Edit');
    expect(readme).toContain('Workers KV Storage Edit');
    expect(readme).toContain('Account Settings Read');
  });

  it('ships detailed Persian and English token-install guides', () => {
    expect(existsSync('docs/INSTALL_FA.md')).toBe(true);
    expect(existsSync('docs/INSTALL_EN.md')).toBe(true);
    const fa = readFileSync('docs/INSTALL_FA.md', 'utf8');
    const en = readFileSync('docs/INSTALL_EN.md', 'utf8');
    expect(fa).toContain('نصب رایگان با توکن Cloudflare');
    expect(fa).toContain('ساخت کلید Cloudflare');
    expect(fa).toContain('Workers Scripts');
    expect(fa).toContain(developerDeployUrl.slice(0, 60));
    expect(en).toContain('Free installation with a Cloudflare token');
    expect(en).toContain('Generate Cloudflare Key');
    expect(en).toContain('Workers Scripts');
    expect(en).toContain('no VPS, no custom domain, no GitHub connection');
  });

  it('keeps the installer deployment artifacts committed for the one-click button', () => {
    const manifest = JSON.parse(
      readFileSync('dist/installer-artifacts/edge-worker-manifest.json', 'utf8'),
    ) as { version: string; sha256: string };
    expect(manifest.version).toBe('0.2.0');
    expect(manifest.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(existsSync('apps/installer/dist/index.html')).toBe(true);
  });
});

describe('public installer source', () => {
  it('ships the static installer source without claiming a live Pages deployment', () => {
    const readme = readFileSync('README.md', 'utf8');
    expect(readme).not.toContain('https://tehrannetwork021.github.io/FreePanel-VPN/');
    expect(existsSync('docs/site/index.html')).toBe(true);
  });
});
