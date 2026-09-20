import { cp, mkdir, readdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const defaultDist = join(repoRoot, 'apps/installer/dist');
const defaultOutput = join(repoRoot, 'apps/installer-worker/public');

async function countFiles(dir) {
  let count = 0;
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    count += entry.isDirectory() ? await countFiles(join(dir, entry.name)) : 1;
  }
  return count;
}

export async function syncInstallerAssets({
  distDir = defaultDist,
  outputDir = defaultOutput,
} = {}) {
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });
  await cp(distDir, outputDir, { recursive: true });
  return { fileCount: await countFiles(outputDir) };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  syncInstallerAssets()
    .then(({ fileCount }) => {
      process.stdout.write(`Synced installer assets: ${fileCount} files\n`);
    })
    .catch((error) => {
      process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    });
}
