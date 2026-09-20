import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('GitHub landing page contract', () => {
  it('documents bilingual quick start, screenshots, security and honest status', () => {
    const readme = readFileSync('README.md', 'utf8');
    expect(readme).toContain('assets/readme/installer-fa.png');
    expect(readme).toContain('assets/readme/dashboard-fa.png');
    expect(readme).toContain('assets/readme/dashboard-en.png');
    expect(readme).toContain('## نصب سریع');
    expect(readme).toContain('## Quick start');
    expect(readme).toContain('SECURITY.md');
    expect(readme).toContain('https://tehran-network-installer.honored-feather.workers.dev');
    expect(readme).toContain('Install Free on Cloudflare');
    expect(readme).not.toContain('deploy.workers.cloudflare.com');
    expect(readme).toContain('Generate Cloudflare Key');
    expect(readme).toContain('Paste');
    expect(readme).toMatch(/در حال توسعه|In development/);
  });

  it('ships contribution, issue and social-preview assets', () => {
    expect(existsSync('CONTRIBUTING.md')).toBe(true);
    expect(existsSync('docs/QUICKSTART_FA.md')).toBe(true);
    expect(existsSync('docs/QUICKSTART_EN.md')).toBe(true);
    expect(existsSync('.github/ISSUE_TEMPLATE/bug_report.yml')).toBe(true);
    expect(existsSync('.github/ISSUE_TEMPLATE/feature_request.yml')).toBe(true);
    expect(existsSync('assets/readme/social-preview.png')).toBe(true);
  });
});
