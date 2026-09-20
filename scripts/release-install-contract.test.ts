import { createHash } from 'node:crypto';
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
    expect(fa).toContain('نصب بدون ترمینال');
    expect(fa).toContain('ساخت کلید Cloudflare');
    expect(fa).toContain('Workers Scripts');
    expect(fa).toContain(developerDeployUrl.slice(0, 60));
    expect(en).toContain('No-terminal install');
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

  it('keeps the installer Worker self-contained so the Deploy button never needs a monorepo install', () => {
    const pkg = JSON.parse(readFileSync('apps/installer-worker/package.json', 'utf8')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies };
    for (const [name, spec] of Object.entries(allDeps)) {
      expect([name, spec]).not.toContain('workspace:*');
      expect(spec).not.toMatch(/^workspace:/);
    }
    expect(pkg.dependencies ?? {}).toEqual({});

    for (const file of [
      'apps/installer-worker/src/provision.ts',
      'apps/installer-worker/src/router.ts',
    ]) {
      const body = readFileSync(file, 'utf8');
      expect(body).not.toMatch(/import \{[^}]*\} from '@tehrannetwork\/shared'/);
      expect(body).toMatch(/import type \{[^}]*\} from '@tehrannetwork\/shared'/);
    }
    expect(existsSync('apps/installer-worker/src/validation.ts')).toBe(true);
    const validation = readFileSync('apps/installer-worker/src/validation.ts', 'utf8');
    expect(validation).toContain('validateWorkerName');
    expect(validation).toContain('validateAdminPassword');

    const readme = readFileSync('README.md', 'utf8');
    expect(readme.indexOf('Deploy Installer')).toBeLessThan(readme.indexOf('<details>'));
  });

  it('ships the tested script easy installers and raw bundle for token-paste installs', () => {
    expect(existsSync('install.sh')).toBe(true);
    expect(existsSync('install.ps1')).toBe(true);
    expect(existsSync('scripts/mock-cloudflare-api.py')).toBe(true);
    expect(existsSync('dist/edge-worker.js')).toBe(true);

    for (const script of ['install.sh', 'install.ps1']) {
      const body = readFileSync(script, 'utf8');
      expect(body).toContain('/user/tokens/verify');
      expect(body).toContain('/storage/kv/namespaces');
      expect(body).toContain('/workers/scripts/');
      expect(body).toContain('ADMIN_PASSWORD');
      expect(body).toContain('edge-worker.js');
      expect(body).toContain('jsdelivr');
      expect(body).toContain('main_module');
      expect(body).not.toMatch(/TOKEN\s*=\s*['"][A-Za-z0-9_-]{20,}/);
    }

    const readme = readFileSync('README.md', 'utf8');
    expect(readme).toContain('install.ps1');
    expect(readme).toContain('install.sh');

    const bundle = readFileSync('dist/edge-worker.js', 'utf8');
    const manifest = JSON.parse(
      readFileSync('dist/installer-artifacts/edge-worker-manifest.json', 'utf8'),
    ) as { sha256: string };
    expect(createHash('sha256').update(bundle).digest('hex')).toBe(manifest.sha256);
  });
});

describe('public installer source', () => {
  it('ships the static installer source without claiming a live Pages deployment', () => {
    const readme = readFileSync('README.md', 'utf8');
    expect(readme).not.toContain('https://tehrannetwork021.github.io/FreePanel-VPN/');
    expect(existsSync('docs/site/index.html')).toBe(true);
  });
});
