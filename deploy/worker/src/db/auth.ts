import { constantTimeEqual } from '../core/bytes';
import { ensureInstallationState } from './migrations';

export const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_HASH = 'SHA-256';

export type AdminCredential = {
  passwordSalt: string;
  passwordHash: string;
  iterations: number;
  passwordVersion: number;
  createdAt: number;
  updatedAt: number;
};

type AdminRow = {
  password_salt: string;
  password_hash: string;
  iterations: number;
  password_version: number;
  created_at: number;
  updated_at: number;
};

function base64url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}
function fromBase64url(value: string): Uint8Array {
  const base64 = value.replaceAll('-', '+').replaceAll('_', '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

async function derivePasswordHash(
  password: string,
  salt: Uint8Array,
  iterations = PBKDF2_ITERATIONS,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  return new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'PBKDF2', hash: PBKDF2_HASH, salt, iterations },
      key,
      256,
    ),
  );
}
function view(row: AdminRow): AdminCredential {
  return {
    passwordSalt: row.password_salt,
    passwordHash: row.password_hash,
    iterations: row.iterations,
    passwordVersion: row.password_version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function loadAdminCredential(db: D1Database): Promise<AdminCredential | null> {
  const row = await db
    .prepare(
      'SELECT password_salt, password_hash, iterations, password_version, created_at, updated_at FROM admin_credentials WHERE id = 1',
    )
    .first<AdminRow>();
  return row ? view(row) : null;
}

async function hashCredential(password: string, createdAt: number, version: number, now: number) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivePasswordHash(password, salt);
  return {
    passwordSalt: base64url(salt),
    passwordHash: base64url(hash),
    iterations: PBKDF2_ITERATIONS,
    passwordVersion: version,
    createdAt,
    updatedAt: now,
  } satisfies AdminCredential;
}
function credentialStatement(db: D1Database, value: AdminCredential) {
  return db
    .prepare(
      `INSERT INTO admin_credentials(
        id, password_salt, password_hash, iterations, password_version, created_at, updated_at
      ) VALUES (1, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        password_salt=excluded.password_salt,
        password_hash=excluded.password_hash,
        iterations=excluded.iterations,
        password_version=excluded.password_version,
        updated_at=excluded.updated_at`,
    )
    .bind(
      value.passwordSalt,
      value.passwordHash,
      value.iterations,
      value.passwordVersion,
      value.createdAt,
      value.updatedAt,
    );
}

export async function ensureAdminCredential(
  db: D1Database,
  configuredSecret: string,
  installGeneration: string,
  now: number,
): Promise<AdminCredential> {
  const state = await ensureInstallationState(db);
  const existing = await loadAdminCredential(db);
  if (existing && state.adminBootstrapGeneration === installGeneration) return existing;
  const credential = await hashCredential(
    configuredSecret,
    existing?.createdAt ?? now,
    (existing?.passwordVersion ?? 0) + 1,
    now,
  );
  await db.batch([
    credentialStatement(db, credential),
    db.prepare('DELETE FROM sessions'),
    db
      .prepare(
        'UPDATE installation_state SET admin_bootstrap_generation = ?, updated_at = ? WHERE id = 1',
      )
      .bind(installGeneration, now),
  ]);
  return credential;
}

export async function verifyAdminCredential(
  db: D1Database,
  candidate: string,
): Promise<AdminCredential | null> {
  const credential = await loadAdminCredential(db);
  if (!credential) return null;
  let salt: Uint8Array;
  let expected: Uint8Array;
  try {
    salt = fromBase64url(credential.passwordSalt);
    expected = fromBase64url(credential.passwordHash);
  } catch {
    return null;
  }
  const actual = await derivePasswordHash(candidate, salt, credential.iterations);
  return constantTimeEqual(actual, expected) ? credential : null;
}
export async function changeAdminPassword(
  db: D1Database,
  currentPassword: string,
  newPassword: string,
  now: number,
): Promise<AdminCredential | null> {
  if (!newPassword) return null;
  const existing = await verifyAdminCredential(db, currentPassword);
  if (!existing) return null;
  const credential = await hashCredential(
    newPassword,
    existing.createdAt,
    existing.passwordVersion + 1,
    now,
  );
  await db.batch([credentialStatement(db, credential), db.prepare('DELETE FROM sessions')]);
  return credential;
}
