import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, rmSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const generatedPath = 'apps/installer-worker/src/generated/edgeWorkerArtifact.ts';
const manifestPath = 'dist/installer-artifacts/edge-worker-manifest.json';
const releaseVersion = '0.3.0';

function extractJsonString(source: string, name: string): string {
  const match = source.match(new RegExp(`export const ${name} = (.+);`));
  if (!match?.[1]) throw new Error(`missing-${name}`);
  return JSON.parse(match[1]) as string;
}

describe('edge Worker install artifact', () => {
  it('pins release version parity across packages, runtime and generated manifest', () => {
    const rootPackage = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };
    const workerPackage = JSON.parse(readFileSync('deploy/worker/package.json', 'utf8')) as {
      version: string;
    };
    const installerPackage = JSON.parse(
      readFileSync('apps/installer-worker/package.json', 'utf8'),
    ) as { version: string };
    const runtime = readFileSync('deploy/worker/src/index.ts', 'utf8');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { version: string };

    expect(rootPackage.version).toBe(releaseVersion);
    expect(workerPackage.version).toBe(releaseVersion);
    expect(installerPackage.version).toBe(releaseVersion);
    expect(runtime).toContain(`const VERSION = '${releaseVersion}';`);
    expect(manifest.version).toBe(releaseVersion);
  });

  it('generates a deterministic bundled artifact with matching SHA-256', () => {
    rmSync(generatedPath, { force: true });
    rmSync(manifestPath, { force: true });
    execFileSync(process.execPath, ['scripts/build-edge-worker-artifact.mjs']);

    const generated = readFileSync(generatedPath, 'utf8');
    const source = extractJsonString(generated, 'EDGE_WORKER_SOURCE');
    const hash = extractJsonString(generated, 'EDGE_WORKER_SHA256');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
      version: string;
      sha256: string;
      bytes: number;
    };

    const actualHash = createHash('sha256').update(source).digest('hex');
    expect(hash).toBe(actualHash);
    expect(manifest.sha256).toBe(actualHash);
    expect(manifest.bytes).toBe(Buffer.byteLength(source));
    expect(manifest.version).toBe(releaseVersion);
    expect(source).not.toMatch(/from\s+['"]\.\.?\//);
    const buildScript = readFileSync('scripts/build-edge-worker-artifact.mjs', 'utf8');
    expect(buildScript).toContain("loader: { '.sql': 'text' }");

    execFileSync(process.execPath, ['scripts/build-edge-worker-artifact.mjs']);
    const manifestAgain = readFileSync(manifestPath, 'utf8');
    expect(manifestAgain).toBe(JSON.stringify(manifest, null, 2) + '\n');
  });
});
