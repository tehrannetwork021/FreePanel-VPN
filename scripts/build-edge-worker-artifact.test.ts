import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, rmSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const generatedPath = 'apps/installer-worker/src/generated/edgeWorkerArtifact.ts';
const manifestPath = 'dist/installer-artifacts/edge-worker-manifest.json';

function extractJsonString(source: string, name: string): string {
  const match = source.match(new RegExp(`export const ${name} = (.+);`));
  if (!match?.[1]) throw new Error(`missing-${name}`);
  return JSON.parse(match[1]) as string;
}

describe('edge Worker install artifact', () => {
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
    expect(manifest.version).toBe('0.2.0');
    expect(source).not.toMatch(/from\s+['"]\.\.?\//);

    execFileSync(process.execPath, ['scripts/build-edge-worker-artifact.mjs']);
    const manifestAgain = readFileSync(manifestPath, 'utf8');
    expect(manifestAgain).toBe(JSON.stringify(manifest, null, 2) + '\n');
  });
});
