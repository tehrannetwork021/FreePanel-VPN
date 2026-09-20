import { describe, expect, it } from 'vitest';
import { ensureControlPlaneSchema, ensureInstallationState } from './migrations';

type MockOptions = {
  schemaVersion?: number;
  migration1Checksum?: string;
  secretSeed?: string;
};

type MigrationRow = { version: number; name: string; checksum: string; applied_at: number };
type InstallationRow = {
  id: number;
  secret_seed: string;
  admin_bootstrap_generation: string;
  created_at: number;
  updated_at: number;
};
function makeD1Mock(options: MockOptions = {}) {
  const migrations = new Map<number, MigrationRow>();
  let installation: InstallationRow | null = null;
  if (options.schemaVersion) {
    migrations.set(options.schemaVersion, {
      version: options.schemaVersion,
      name: `migration-${options.schemaVersion}`,
      checksum: options.schemaVersion === 1 ? (options.migration1Checksum ?? 'wrong') : 'future',
      applied_at: 1,
    });
  }
  if (options.secretSeed !== undefined) {
    installation = {
      id: 1,
      secret_seed: options.secretSeed,
      admin_bootstrap_generation: '',
      created_at: 1,
      updated_at: 1,
    };
  }
  const db = {
    async exec(sql: string) {
      for (const line of sql
        .split('\n')
        .map((part) => part.trim())
        .filter(Boolean)) {
        if (!line.endsWith(';')) throw new Error('D1_EXEC_ERROR: incomplete input');
      }
      if (sql.includes('CREATE TABLE IF NOT EXISTS installation_state')) {
        return { count: 0, duration: 0 };
      }
      return { count: 0, duration: 0 };
    },
    prepare(sql: string) {
      let params: unknown[] = [];
      const statement = {
        bind(...values: unknown[]) {
          params = values;
          return statement;
        },
        async first<T>() {
          if (sql.includes('MAX(version)')) {
            const versions = [...migrations.keys()];
            return { version: versions.length ? Math.max(...versions) : null } as T;
          }
          if (sql.includes('FROM schema_migrations') && sql.includes('version = ?')) {
            return (migrations.get(Number(params[0])) ?? null) as T | null;
          }
          if (sql.includes('FROM installation_state')) return installation as T | null;
          return null;
        },
        async run() {
          if (sql.includes('INSERT OR IGNORE INTO schema_migrations')) {
            const [version, name, checksum, appliedAt] = params;
            if (!migrations.has(Number(version))) {
              migrations.set(Number(version), {
                version: Number(version),
                name: String(name),
                checksum: String(checksum),
                applied_at: Number(appliedAt),
              });
            }
          }
          if (sql.includes('INSERT OR IGNORE INTO installation_state')) {
            const [seed, createdAt, updatedAt] = params;
            installation ??= {
              id: 1,
              secret_seed: String(seed),
              admin_bootstrap_generation: '',
              created_at: Number(createdAt),
              updated_at: Number(updatedAt),
            };
          }
          return { success: true, meta: {} };
        },
      };
      return statement;
    },
    appliedMigrationVersions() {
      return [...migrations.keys()].sort((a, b) => a - b);
    },
  };
  return db;
}
function fixedBytes(value: number): Uint8Array {
  return new Uint8Array(32).fill(value);
}

function base64urlDecode(value: string): Uint8Array {
  const base64 = value.replaceAll('-', '+').replaceAll('_', '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

describe('D1 control-plane migrations', () => {
  it('applies migration 1 once and reports schema version 1', async () => {
    const db = makeD1Mock();
    await expect(ensureControlPlaneSchema(db as never)).resolves.toBe(1);
    await expect(ensureControlPlaneSchema(db as never)).resolves.toBe(1);
    expect(db.appliedMigrationVersions()).toEqual([1]);
  });

  it('rejects a database whose recorded version is newer than this Worker', async () => {
    const db = makeD1Mock({ schemaVersion: 99 });
    await expect(ensureControlPlaneSchema(db as never)).rejects.toThrow('schema-too-new');
  });
  it('converges concurrent installation-state initialization on one persistent seed', async () => {
    const db = makeD1Mock();
    const [a, b] = await Promise.all([
      ensureInstallationState(
        db as never,
        () => 1_000,
        () => fixedBytes(0x11),
      ),
      ensureInstallationState(
        db as never,
        () => 1_001,
        () => fixedBytes(0x22),
      ),
    ]);
    expect(a.secretSeed).toBe(b.secretSeed);
    expect(base64urlDecode(a.secretSeed)).toHaveLength(32);
  });

  it('fails closed on a mismatched migration checksum or corrupted installation seed', async () => {
    await expect(
      ensureControlPlaneSchema(
        makeD1Mock({ schemaVersion: 1, migration1Checksum: 'wrong' }) as never,
      ),
    ).rejects.toThrow('migration-checksum-mismatch');
    await expect(
      ensureInstallationState(makeD1Mock({ secretSeed: 'broken' }) as never),
    ).rejects.toThrow('invalid-installation-state');
  });
});
