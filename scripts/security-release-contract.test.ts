import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const sentinels = [
  'SECRET_TOKEN_SENTINEL',
  'INSTALLATION_SEED_SENTINEL',
  'ADMIN_PASSWORD_SENTINEL',
  'PRIVATE_SUBSCRIPTION_TOKEN_SENTINEL_7f9a',
];

function textFiles(root: string): string[] {
  if (!existsSync(root)) return [];
  if (statSync(root).isFile()) return [root];
  return readdirSync(root).flatMap((name) => textFiles(join(root, name)));
}

function shippedText(): Array<[string, string]> {
  const roots = [
    'dist/edge-worker.js',
    'deploy/worker/src/generated/panelAssets.ts',
    'apps/installer-worker/src/generated/edgeWorkerArtifact.ts',
    'apps/installer/dist',
  ];
  return roots.flatMap((root) => textFiles(root).map((file) => [file, readFileSync(file, 'utf8')]));
}

describe('release secret regression', () => {
  it('keeps secret sentinels out of generated/shipped text', () => {
    const files = shippedText();
    expect(files.length).toBeGreaterThan(3);
    for (const [file, body] of files) {
      for (const sentinel of sentinels) {
        expect(body, `${file} leaked ${sentinel}`).not.toContain(sentinel);
      }
    }
  });

  it('does not commit runtime log fixtures containing the sentinels', () => {
    const logs = textFiles('deploy/worker/test/fixtures').filter((file) => file.endsWith('.log'));
    for (const file of logs) {
      const body = readFileSync(file, 'utf8');
      for (const sentinel of sentinels) expect(body).not.toContain(sentinel);
    }
  });
});
