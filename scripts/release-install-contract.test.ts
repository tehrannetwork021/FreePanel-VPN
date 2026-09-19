import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const deployUrl =
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

  it('publishes a clear bilingual install path from the README', () => {
    const readme = readFileSync('README.md', 'utf8');
    expect(readme).toContain(deployUrl);
    expect(readme).toContain('docs/INSTALL_FA.md');
    expect(readme).toContain('docs/INSTALL_EN.md');
    expect(readme).toContain('Deploy to Cloudflare');
  });

  it('ships detailed Persian and English usage guides', () => {
    expect(existsSync('docs/INSTALL_FA.md')).toBe(true);
    expect(existsSync('docs/INSTALL_EN.md')).toBe(true);
    const fa = readFileSync('docs/INSTALL_FA.md', 'utf8');
    const en = readFileSync('docs/INSTALL_EN.md', 'utf8');
    expect(fa).toContain('نصب یک‌کلیکی');
    expect(fa).toContain('Cloudflare API Token');
    expect(en).toContain('One-click installation');
    expect(en).toContain('Cloudflare API Token');
  });
});

describe('public installer source', () => {
  it('ships the static installer source without claiming a live Pages deployment', () => {
    const readme = readFileSync('README.md', 'utf8');
    expect(readme).not.toContain('https://tehrannetwork021.github.io/FreePanel-VPN/');
    expect(existsSync('docs/site/index.html')).toBe(true);
  });
});
