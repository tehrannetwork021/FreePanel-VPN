import migration001 from '../../migrations/0001_control_plane.sql';

export const CONTROL_PLANE_SCHEMA_VERSION = 1;
const MIGRATION_001_NAME = '0001_control_plane';
const ready = new WeakMap<D1Database, Promise<number>>();

export type InstallationState = {
  secretSeed: string;
  adminBootstrapGeneration: string;
  createdAt: number;
  updatedAt: number;
};

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}
function isValidSeed(value: string): boolean {
  try {
    const base64 = value.replaceAll('-', '+').replaceAll('_', '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    const decoded = atob(padded);
    return (
      decoded.length === 32 &&
      toBase64Url(Uint8Array.from(decoded, (c) => c.charCodeAt(0))) === value
    );
  } catch {
    return false;
  }
}

async function migration001Checksum(): Promise<string> {
  return sha256Hex(migration001);
}

function normalizeForD1Exec(sql: string): string {
  return sql
    .split(';')
    .map((statement) => statement.replace(/\s+/gu, ' ').trim())
    .filter(Boolean)
    .map((statement) => `${statement};`)
    .join('\n');
}

async function applyMigrations(db: D1Database): Promise<number> {
  await db.exec(
    'CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, checksum TEXT NOT NULL, applied_at INTEGER NOT NULL);',
  );

  const maxRow = await db
    .prepare('SELECT MAX(version) AS version FROM schema_migrations')
    .first<{ version: number | null }>();
  const maxVersion = maxRow?.version ?? 0;
  if (maxVersion > CONTROL_PLANE_SCHEMA_VERSION) throw new Error('schema-too-new');
  const checksum = await migration001Checksum();
  const existing = await db
    .prepare('SELECT version, name, checksum, applied_at FROM schema_migrations WHERE version = ?')
    .bind(1)
    .first<{ version: number; name: string; checksum: string; applied_at: number }>();

  if (existing) {
    if (existing.checksum !== checksum) throw new Error('migration-checksum-mismatch');
    return CONTROL_PLANE_SCHEMA_VERSION;
  }

  await db.exec(normalizeForD1Exec(migration001));
  await db
    .prepare(
      'INSERT OR IGNORE INTO schema_migrations(version, name, checksum, applied_at) VALUES (?, ?, ?, ?)',
    )
    .bind(1, MIGRATION_001_NAME, checksum, Date.now())
    .run();

  const inserted = await db
    .prepare('SELECT version, name, checksum, applied_at FROM schema_migrations WHERE version = ?')
    .bind(1)
    .first<{ version: number; name: string; checksum: string; applied_at: number }>();
  if (!inserted || inserted.checksum !== checksum) throw new Error('migration-checksum-mismatch');
  return CONTROL_PLANE_SCHEMA_VERSION;
}
export function ensureControlPlaneSchema(db: D1Database): Promise<number> {
  const existing = ready.get(db);
  if (existing) return existing;
  const pending = applyMigrations(db).catch((error) => {
    ready.delete(db);
    throw error;
  });
  ready.set(db, pending);
  return pending;
}

export async function ensureInstallationState(
  db: D1Database,
  now: () => number = () => Date.now(),
  randomBytes: () => Uint8Array = () => crypto.getRandomValues(new Uint8Array(32)),
): Promise<InstallationState> {
  const candidate = randomBytes();
  if (candidate.byteLength !== 32) throw new Error('invalid-installation-state');
  const timestamp = now();
  await db
    .prepare(
      "INSERT OR IGNORE INTO installation_state(id, secret_seed, admin_bootstrap_generation, created_at, updated_at) VALUES (1, ?, '', ?, ?)",
    )
    .bind(toBase64Url(candidate), timestamp, timestamp)
    .run();
  const row = await db
    .prepare(
      'SELECT secret_seed, admin_bootstrap_generation, created_at, updated_at FROM installation_state WHERE id = 1',
    )
    .first<{
      secret_seed: string;
      admin_bootstrap_generation: string;
      created_at: number;
      updated_at: number;
    }>();
  if (!row || !isValidSeed(row.secret_seed)) throw new Error('invalid-installation-state');
  return {
    secretSeed: row.secret_seed,
    adminBootstrapGeneration: row.admin_bootstrap_generation,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
