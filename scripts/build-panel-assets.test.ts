import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { generatePanelAssets } from './build-panel-assets.mjs';

describe('embedded panel asset generator', () => {
  it('generates deterministic local-only HTML/CSS/JS assets', async () => {
    const root = await mkdtemp(join(tmpdir(), 'tn-panel-assets-'));
    const dist = join(root, 'dist');
    await mkdir(join(dist, 'assets'), { recursive: true });
    await writeFile(
      join(dist, 'index.html'),
      '<!doctype html><link rel="stylesheet" href="/panel-assets/assets/a.css"><script type="module" src="/panel-assets/assets/a.js"></script>',
    );
    await writeFile(join(dist, 'assets/a.css'), '.sentinel{content:"PANEL_SENTINEL"}');
    await writeFile(join(dist, 'assets/a.js'), 'console.log("PANEL_SENTINEL")');
    const output = join(root, 'panelAssets.ts');
    await generatePanelAssets({ distDir: dist, outputFile: output });
    const generated = await readFile(output, 'utf8');
    expect(generated).toContain('PANEL_SENTINEL');
    expect(generated).toContain('/panel-assets/assets/a.js');
    expect(generated).not.toMatch(/https?:\/\//u);
  });

  it('rejects runtime external script/style/font references', async () => {
    const root = await mkdtemp(join(tmpdir(), 'tn-panel-assets-bad-'));
    const dist = join(root, 'dist');
    await mkdir(dist, { recursive: true });
    await writeFile(
      join(dist, 'index.html'),
      '<script src="https://evil.example/app.js"></script>',
    );
    await expect(
      generatePanelAssets({ distDir: dist, outputFile: join(root, 'out.ts') }),
    ).rejects.toThrow(/external-panel-asset/u);
  });
});
