import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('GitHub CI contract', () => {
  it('runs frozen install, quality checks and browser E2E', () => {
    const workflow = readFileSync('.github/workflows/ci.yml', 'utf8');
    expect(workflow).toContain('pnpm install --frozen-lockfile');
    expect(workflow).toContain('pnpm check');
    expect(workflow).toContain('pnpm test:e2e');
    expect(workflow).toContain('playwright install --with-deps chromium');
  });
});
