import { resolve } from 'node:path';
import process from 'node:process';
import { generatePanelAssets } from './build-panel-assets.mjs';

const root = resolve(import.meta.dirname, '..');
generatePanelAssets({
  distDir: resolve(root, 'apps/installer/dist'),
  outputFile: resolve(root, 'apps/installer-worker/src/generated/installerAssets.ts'),
  assetPrefix: '/',
  exportPrefix: 'INSTALLER',
})
  .then(({ assetCount, indexBytes }) => {
    process.stdout.write(`Embedded installer: ${assetCount} assets, ${indexBytes} index bytes\n`);
  })
  .catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
