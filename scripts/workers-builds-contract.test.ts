import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Cloudflare-native public installer delivery', () => {
  it('keeps production publishing on GitHub + Cloudflare Workers Builds with no VPS hop', () => {
    const rootPackage = JSON.parse(readFileSync('package.json', 'utf8')) as {
      scripts: Record<string, string>;
    };
    const command = rootPackage.scripts['deploy:public-installer'];
    const wrangler = readFileSync('apps/installer-worker/wrangler.jsonc', 'utf8');

    expect(command).toContain('build:installer-assets');
    expect(command).toContain('@tehrannetwork/installer-worker');
    expect(command).toContain('wrangler deploy');
    expect(command.toLowerCase()).not.toContain('ssh');
    expect(command.toLowerCase()).not.toContain('vps');
    expect(wrangler).toContain('"name": "tehran-network-installer"');
    expect(wrangler).toContain('"workers_dev": true');
  });
});
