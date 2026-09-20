import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { syncInstallerAssets } from './sync-installer-assets.mjs';

describe('installer asset sync', () => {
  it('replaces stale public assets with the exact installer build', async () => {
    const root = await mkdtemp(join(tmpdir(), 'tn-installer-sync-'));
    const dist = join(root, 'dist');
    const output = join(root, 'public');
    await mkdir(join(dist, 'assets'), { recursive: true });
    await mkdir(join(output, 'assets'), { recursive: true });
    await writeFile(join(dist, 'index.html'), '<script src="/assets/new.js"></script>');
    await writeFile(join(dist, 'assets/new.js'), 'ONE_TOKEN_INSTALLER');
    await writeFile(join(output, 'assets/stale.js'), 'STALE_INSTALLER');

    const result = await syncInstallerAssets({ distDir: dist, outputDir: output });

    expect(result.fileCount).toBe(2);
    expect(await readFile(join(output, 'index.html'), 'utf8')).toContain('new.js');
    expect(await readFile(join(output, 'assets/new.js'), 'utf8')).toBe('ONE_TOKEN_INSTALLER');
    await expect(readFile(join(output, 'assets/stale.js'), 'utf8')).rejects.toThrow();
  });
});
