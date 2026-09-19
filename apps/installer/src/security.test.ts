import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('installer document security', () => {
  it('locks the credential-entry page to same-origin resources', () => {
    const html = readFileSync('apps/installer/index.html', 'utf8');
    expect(html).toContain('http-equiv="Content-Security-Policy"');
    expect(html).toContain("script-src 'self'");
    expect(html).toContain("connect-src 'self'");
    expect(html).toContain("object-src 'none'");
    expect(html).toContain("base-uri 'none'");
    expect(html).toContain("form-action 'self'");
    expect(html).toContain('name="referrer" content="no-referrer"');
  });
});
