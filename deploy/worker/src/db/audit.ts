const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 8;

type ThrottleRow = { key_hash: string; window_start: number; failures: number };

function decodeSeed(value: string): Uint8Array {
  const base64 = value.replaceAll('-', '+').replaceAll('_', '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  const decoded = Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
  if (decoded.byteLength !== 32) throw new Error('invalid-installation-seed');
  return decoded;
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function throttleKey(seed: string, request: Request): Promise<string> {
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const key = await crypto.subtle.importKey(
    'raw',
    decodeSeed(seed),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`login-ip:${ip}`),
  );
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, '0')).join(
    '',
  );
}
export async function checkLoginThrottle(
  db: D1Database,
  seed: string,
  request: Request,
  now: number,
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const keyHash = await throttleKey(seed, request);
  const row = await db
    .prepare('SELECT key_hash, window_start, failures FROM login_throttle WHERE key_hash = ?')
    .bind(keyHash)
    .first<ThrottleRow>();
  if (!row || now - row.window_start >= LOGIN_WINDOW_MS || row.failures < MAX_FAILURES) {
    return { allowed: true, retryAfterSeconds: 0 };
  }
  return {
    allowed: false,
    retryAfterSeconds: Math.max(1, Math.ceil((row.window_start + LOGIN_WINDOW_MS - now) / 1000)),
  };
}

export async function recordFailedLogin(
  db: D1Database,
  seed: string,
  request: Request,
  now: number,
): Promise<void> {
  const keyHash = await throttleKey(seed, request);
  const row = await db
    .prepare('SELECT key_hash, window_start, failures FROM login_throttle WHERE key_hash = ?')
    .bind(keyHash)
    .first<ThrottleRow>();
  if (!row || now - row.window_start >= LOGIN_WINDOW_MS) {
    await db
      .prepare('INSERT INTO login_throttle(key_hash, window_start, failures) VALUES (?, ?, ?)')
      .bind(keyHash, now, 1)
      .run();
    return;
  }
  await db
    .prepare('UPDATE login_throttle SET window_start = ?, failures = ? WHERE key_hash = ?')
    .bind(row.window_start, row.failures + 1, keyHash)
    .run();
}

export async function clearLoginThrottle(
  db: D1Database,
  seed: string,
  request: Request,
): Promise<void> {
  const keyHash = await throttleKey(seed, request);
  await db.prepare('DELETE FROM login_throttle WHERE key_hash = ?').bind(keyHash).run();
}

export async function recordLoginEvent(
  db: D1Database,
  request: Request,
  success: boolean,
  now: number,
): Promise<void> {
  const userAgentHash = await sha256Hex(request.headers.get('user-agent') ?? '');
  const country = request.headers.get('cf-ipcountry');
  const colo = (request as Request & { cf?: { colo?: string } }).cf?.colo ?? null;
  await db.batch([
    db
      .prepare(
        'INSERT INTO login_events(ts, success, country, colo, user_agent_hash) VALUES (?, ?, ?, ?, ?)',
      )
      .bind(now, success ? 1 : 0, country, colo, userAgentHash),
    db.prepare(
      'DELETE FROM login_events WHERE id NOT IN (SELECT id FROM login_events ORDER BY id DESC LIMIT 1000)',
    ),
  ]);
}

export type AuditDetail = {
  changedFields?: string[];
  quotaBytes?: { before: number | null; after: number | null };
  dailyQuotaBytes?: { before: number | null; after: number | null };
  expiresAt?: { before: number | null; after: number | null };
  enabled?: { before: boolean; after: boolean };
};

export type AuditEntry = {
  id: number;
  ts: number;
  actor: string;
  action: string;
  targetType: string;
  targetId: string | null;
  detail: AuditDetail;
};

type AuditRow = {
  id: number;
  ts: number;
  actor: string;
  action: string;
  target_type: string;
  target_id: string | null;
  detail_json: string;
};

type LoginEventRow = {
  id: number;
  ts: number;
  success: number;
  country: string | null;
  colo: string | null;
  user_agent_hash: string | null;
};

export async function writeAudit(
  db: D1Database,
  entry: {
    ts: number;
    actor: string;
    action: string;
    targetType: string;
    targetId: string | null;
    detail: AuditDetail;
  },
): Promise<void> {
  const detail = JSON.stringify(entry.detail);
  await db.batch([
    db
      .prepare(
        `INSERT INTO audit_log(ts, actor, action, target_type, target_id, detail_json)
       VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(entry.ts, entry.actor, entry.action, entry.targetType, entry.targetId, detail),
    db.prepare(
      'DELETE FROM audit_log WHERE id NOT IN (SELECT id FROM audit_log ORDER BY id DESC LIMIT 5000)',
    ),
  ]);
}

function clampLimit(limit: number): number {
  if (!Number.isFinite(limit)) return 50;
  return Math.max(1, Math.min(100, Math.trunc(limit)));
}

export async function listAudit(db: D1Database, limit = 50): Promise<AuditEntry[]> {
  const result = await db
    .prepare(
      `SELECT id, ts, actor, action, target_type, target_id, detail_json
     FROM audit_log ORDER BY id DESC LIMIT ?`,
    )
    .bind(clampLimit(limit))
    .all<AuditRow>();
  return (result.results ?? []).map((row) => ({
    id: row.id,
    ts: row.ts,
    actor: row.actor,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    detail: JSON.parse(row.detail_json || '{}') as AuditDetail,
  }));
}

export async function listLoginEvents(db: D1Database, limit = 50) {
  const result = await db
    .prepare(
      `SELECT id, ts, success, country, colo, user_agent_hash
     FROM login_events ORDER BY id DESC LIMIT ?`,
    )
    .bind(clampLimit(limit))
    .all<LoginEventRow>();
  return (result.results ?? []).map((row) => ({
    id: row.id,
    ts: row.ts,
    success: row.success === 1,
    country: row.country,
    colo: row.colo,
    userAgentHash: row.user_agent_hash,
  }));
}
