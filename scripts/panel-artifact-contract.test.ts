import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('embedded panel release contract', () => {
  it('builds panel assets before bundling the edge Worker', () => {
    const root = JSON.parse(readFileSync('package.json', 'utf8')) as {
      scripts: Record<string, string>;
    };
    const build = root.scripts.build ?? '';
    const panel = build.indexOf('@tehrannetwork/panel build');
    const edge = build.indexOf('build:edge-artifact');
    expect(panel).toBeGreaterThanOrEqual(0);
    expect(edge).toBeGreaterThan(panel);
  });

  it('embeds the current real control-plane bundle in the install artifact', () => {
    const outdir = mkdtempSync(join(tmpdir(), 'tn-panel-artifact-test-'));
    try {
      execFileSync(process.execPath, [
        'scripts/build-edge-worker-artifact.mjs',
        '--outdir',
        outdir,
      ]);
      const source = readFileSync(join(outdir, 'dist/edge-worker.js'), 'utf8');
      expect(source).toContain('/panel-assets/');
      expect(source).toContain('Edge Control Plane');
      expect(source).toContain('Control overview');
      expect(source).toContain('Logs & Security');
    } finally {
      rmSync(outdir, { recursive: true, force: true });
    }
  });
});
