import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('free installer Worker manifest', () => {
  it('uses workers.dev and static assets without OAuth/domain configuration', () => {
    const text = readFileSync('apps/installer-worker/wrangler.jsonc', 'utf8');
    expect(text).toContain('"workers_dev": true');
    expect(text).toContain('"binding": "ASSETS"');
    expect(text).toContain('"not_found_handling": "single-page-application"');
    for (const forbidden of [
      'CF_OAUTH',
      'COOKIE_KEY',
      'INSTALLER_ORIGIN',
      'custom_domain',
      'set-at-deploy-time',
      '"routes"',
    ]) {
      expect(text).not.toContain(forbidden);
    }
  });
});
