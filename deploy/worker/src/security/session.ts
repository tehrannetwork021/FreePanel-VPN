import { constantTimeEqual } from '../core/bytes';

export const SESSION_COOKIE = 'tn_session';
export const CSRF_COOKIE = 'tn_csrf';
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

export type AdminSession = {
  idHash: string;
  csrfHash: string;
  passwordVersion: number;
  createdAt: number;
  expiresAt: number;
  lastSeenAt: number;
};

type SessionRow = {
  id_hash: string;
  csrf_hash: string;
  password_version: number;
  created_at: number;
  expires_at: number;
  last_seen_at: number;
};

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/u, '');
}
async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function parseCookies(request: Request): Map<string, string> {
  const out = new Map<string, string>();
  const raw = request.headers.get('cookie') ?? '';
  for (const part of raw.split(';')) {
    const index = part.indexOf('=');
    if (index <= 0) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key && value) out.set(key, value);
  }
  return out;
}

export async function createSession(
  db: D1Database,
  passwordVersion: number,
  now: number,
): Promise<{ sessionToken: string; csrfToken: string; expiresAt: number }> {
  const sessionToken = randomToken();
  const csrfToken = randomToken();
  const expiresAt = now + SESSION_TTL_MS;
  const [idHash, csrfHash] = await Promise.all([sha256Hex(sessionToken), sha256Hex(csrfToken)]);
  await db.batch([
    db.prepare('DELETE FROM sessions WHERE expires_at <= ?').bind(now),
    db
      .prepare(
        `INSERT INTO sessions(
          id_hash, csrf_hash, password_version, created_at, expires_at, last_seen_at
        ) VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(idHash, csrfHash, passwordVersion, now, expiresAt, now),
  ]);
  return { sessionToken, csrfToken, expiresAt };
}

export async function authenticateAdminRequest(
  request: Request,
  db: D1Database,
  now: number,
): Promise<AdminSession | null> {
  const token = parseCookies(request).get(SESSION_COOKIE);
  if (!token || token.length > 256) return null;
  const idHash = await sha256Hex(token);
  const row = await db
    .prepare(
      `SELECT s.id_hash, s.csrf_hash, s.password_version, s.created_at, s.expires_at, s.last_seen_at
       FROM sessions s JOIN admin_credentials a ON a.id = 1
       WHERE s.id_hash = ? AND s.expires_at > ? AND s.password_version = a.password_version`,
    )
    .bind(idHash, now)
    .first<SessionRow>();
  if (!row) return null;
  return {
    idHash: row.id_hash,
    csrfHash: row.csrf_hash,
    passwordVersion: row.password_version,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    lastSeenAt: row.last_seen_at,
  };
}

export async function requireCsrf(request: Request, session: AdminSession): Promise<boolean> {
  const cookie = parseCookies(request).get(CSRF_COOKIE) ?? '';
  const header = request.headers.get('x-csrf-token') ?? '';
  if (!cookie || !header || cookie.length > 256 || header.length > 256) return false;
  const encoder = new TextEncoder();
  if (!constantTimeEqual(encoder.encode(cookie), encoder.encode(header))) return false;
  return constantTimeEqual(
    encoder.encode(await sha256Hex(cookie)),
    encoder.encode(session.csrfHash),
  );
}

export async function deleteSession(db: D1Database, session: AdminSession): Promise<void> {
  await db.prepare('DELETE FROM sessions WHERE id_hash = ?').bind(session.idHash).run();
}
