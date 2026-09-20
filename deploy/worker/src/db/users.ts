import {
  credentialLookupHash,
  deriveSubscriptionToken,
  deriveTrojanPassword,
  deriveVlessUuid,
  subscriptionLookupHash,
  type CredentialProtocol,
} from '../security/derivedSecrets';

export type UserRecord = {
  id: string;
  name: string;
  enabled: boolean;
  quotaBytes: number | null;
  dailyQuotaBytes: number | null;
  expiresAt: number | null;
  totalUsedBytes: number;
  allowVless: boolean;
  allowTrojan: boolean;
  allowXhttp: boolean;
  notes: string;
  lastSubscriptionAt: number | null;
  lastTunnelAt: number | null;
  version: number;
  createdAt: number;
  updatedAt: number;
};

export type CreateUserInput = {
  name: string;
  enabled?: boolean;
  quotaBytes?: number | null;
  dailyQuotaBytes?: number | null;
  expiresAt?: number | null;
  allowVless?: boolean;
  allowTrojan?: boolean;
  allowXhttp?: boolean;
  notes?: string;
};

export type UpdateUserInput = Partial<CreateUserInput>;

export class UserRepositoryError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = 'UserRepositoryError';
  }
}

type UserRow = {
  id: string;
  name: string;
  enabled: number;
  quota_bytes: number | null;
  daily_quota_bytes: number | null;
  expires_at: number | null;
  total_used_bytes: number;
  allow_vless: number;
  allow_trojan: number;
  allow_xhttp: number;
  notes: string;
  last_subscription_at: number | null;
  last_tunnel_at: number | null;
  version: number;
  created_at: number;
  updated_at: number;
};

const USER_SELECT = `SELECT id, name, enabled, quota_bytes, daily_quota_bytes, expires_at,
 total_used_bytes, allow_vless, allow_trojan, allow_xhttp, notes,
 last_subscription_at, last_tunnel_at, version, created_at, updated_at FROM users`;
const MAX_QUOTA = Number.MAX_SAFE_INTEGER;
const CREATE_KEYS = new Set([
  'name',
  'enabled',
  'quotaBytes',
  'dailyQuotaBytes',
  'expiresAt',
  'allowVless',
  'allowTrojan',
  'allowXhttp',
  'notes',
]);

function unicodeLength(value: string): number {
  return Array.from(value).length;
}
function boundedQuota(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > MAX_QUOTA) {
    throw new UserRepositoryError('invalid-quota');
  }
  return value;
}
function boundedExpiry(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw new UserRepositoryError('invalid-expiry');
  }
  return value;
}
function boundedName(value: unknown): string {
  if (typeof value !== 'string') throw new UserRepositoryError('invalid-name');
  const name = value.trim();
  if (unicodeLength(name) < 1 || unicodeLength(name) > 80)
    throw new UserRepositoryError('invalid-name');
  return name;
}
function boundedNotes(value: unknown): string {
  if (value === undefined) return '';
  if (typeof value !== 'string' || unicodeLength(value) > 500)
    throw new UserRepositoryError('invalid-notes');
  return value;
}
function boundedBool(value: unknown, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  if (typeof value !== 'boolean') throw new UserRepositoryError('invalid-boolean');
  return value;
}

function rowToUser(row: UserRow): UserRecord {
  return {
    id: row.id,
    name: row.name,
    enabled: row.enabled === 1,
    quotaBytes: row.quota_bytes,
    dailyQuotaBytes: row.daily_quota_bytes,
    expiresAt: row.expires_at,
    totalUsedBytes: row.total_used_bytes,
    allowVless: row.allow_vless === 1,
    allowTrojan: row.allow_trojan === 1,
    allowXhttp: row.allow_xhttp === 1,
    notes: row.notes,
    lastSubscriptionAt: row.last_subscription_at,
    lastTunnelAt: row.last_tunnel_at,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function assertKnown(input: Record<string, unknown>): void {
  for (const key of Object.keys(input)) {
    if (!CREATE_KEYS.has(key)) throw new UserRepositoryError('unknown-field');
  }
}

function normalizeCreate(input: CreateUserInput) {
  assertKnown(input as Record<string, unknown>);
  return {
    name: boundedName(input.name),
    enabled: boundedBool(input.enabled, true),
    quotaBytes: boundedQuota(input.quotaBytes),
    dailyQuotaBytes: boundedQuota(input.dailyQuotaBytes),
    expiresAt: boundedExpiry(input.expiresAt),
    allowVless: boundedBool(input.allowVless, true),
    allowTrojan: boundedBool(input.allowTrojan, true),
    allowXhttp: boundedBool(input.allowXhttp, true),
    notes: boundedNotes(input.notes),
  };
}

function normalizeUpdate(input: UpdateUserInput, current: UserRecord) {
  assertKnown(input as Record<string, unknown>);
  return {
    name: input.name === undefined ? current.name : boundedName(input.name),
    enabled: boundedBool(input.enabled, current.enabled),
    quotaBytes:
      input.quotaBytes === undefined ? current.quotaBytes : boundedQuota(input.quotaBytes),
    dailyQuotaBytes:
      input.dailyQuotaBytes === undefined
        ? current.dailyQuotaBytes
        : boundedQuota(input.dailyQuotaBytes),
    expiresAt: input.expiresAt === undefined ? current.expiresAt : boundedExpiry(input.expiresAt),
    allowVless: boundedBool(input.allowVless, current.allowVless),
    allowTrojan: boundedBool(input.allowTrojan, current.allowTrojan),
    allowXhttp: boundedBool(input.allowXhttp, current.allowXhttp),
    notes: input.notes === undefined ? current.notes : boundedNotes(input.notes),
  };
}

export async function getUser(db: D1Database, id: string): Promise<UserRecord | null> {
  const row = await db.prepare(`${USER_SELECT} WHERE id = ?`).bind(id).first<UserRow>();
  return row ? rowToUser(row) : null;
}

export async function listUsers(db: D1Database): Promise<UserRecord[]> {
  const result = await db.prepare(`${USER_SELECT} ORDER BY created_at DESC`).all<UserRow>();
  return (result.results ?? []).map(rowToUser);
}

type SubscriptionTokenRow = { user_id: string; token_version: number; lookup_hash: string };
type CredentialRow = {
  user_id: string;
  protocol: CredentialProtocol;
  secret_version: number;
  lookup_hash: string;
  enabled: number;
};

export type UserSecretVersions = {
  subscription: number;
  vless: number;
  trojan: number;
};

export type UserAccessSecrets = UserSecretVersions & {
  subscriptionToken: string;
  vlessUuid: string;
  trojanPassword: string;
};

async function initialSecretStatements(db: D1Database, seed: string, userId: string, now: number) {
  const [subscriptionToken, vlessUuid, trojanPassword] = await Promise.all([
    deriveSubscriptionToken(seed, userId, 1),
    deriveVlessUuid(seed, userId, 1),
    deriveTrojanPassword(seed, userId, 1),
  ]);
  const [subHash, vlessHash, trojanHash] = await Promise.all([
    subscriptionLookupHash(subscriptionToken),
    credentialLookupHash('vless', vlessUuid),
    credentialLookupHash('trojan', trojanPassword),
  ]);
  return [
    db.prepare(`INSERT INTO subscription_tokens(user_id, token_version, lookup_hash, created_at, rotated_at)
      VALUES (?, 1, ?, ?, ?)`),
    db.prepare(`INSERT INTO user_credentials(user_id, protocol, secret_version, lookup_hash, enabled)
      VALUES (?, 'vless', 1, ?, 1)`),
    db.prepare(`INSERT INTO user_credentials(user_id, protocol, secret_version, lookup_hash, enabled)
      VALUES (?, 'trojan', 1, ?, 1)`),
  ].map((statement, index) =>
    index === 0
      ? statement.bind(userId, subHash, now, now)
      : statement.bind(userId, index === 1 ? vlessHash : trojanHash),
  );
}

export async function createUser(
  db: D1Database,
  input: CreateUserInput,
  now: number,
  installationSeed?: string,
): Promise<UserRecord> {
  const value = normalizeCreate(input);
  const id = crypto.randomUUID();
  const insert = db
    .prepare(
      `INSERT INTO users(
    id, name, enabled, quota_bytes, daily_quota_bytes, expires_at, total_used_bytes,
    allow_vless, allow_trojan, allow_xhttp, notes, last_subscription_at, last_tunnel_at,
    version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, NULL, NULL, 1, ?, ?)`,
    )
    .bind(
      id,
      value.name,
      value.enabled ? 1 : 0,
      value.quotaBytes,
      value.dailyQuotaBytes,
      value.expiresAt,
      value.allowVless ? 1 : 0,
      value.allowTrojan ? 1 : 0,
      value.allowXhttp ? 1 : 0,
      value.notes,
      now,
      now,
    );
  if (installationSeed) {
    const secrets = await initialSecretStatements(db, installationSeed, id, now);
    await db.batch([insert, ...secrets]);
  } else {
    await insert.run();
  }
  return (await getUser(db, id))!;
}

export async function updateUser(
  db: D1Database,
  id: string,
  input: UpdateUserInput,
  expectedVersion: number,
  now: number,
): Promise<UserRecord> {
  const current = await getUser(db, id);
  if (!current) throw new UserRepositoryError('not-found');
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1) {
    throw new UserRepositoryError('invalid-version');
  }
  const value = normalizeUpdate(input, current);
  const result = await db
    .prepare(
      `UPDATE users SET
    name = ?, enabled = ?, quota_bytes = ?, daily_quota_bytes = ?, expires_at = ?,
    allow_vless = ?, allow_trojan = ?, allow_xhttp = ?, notes = ?,
    version = version + 1, updated_at = ? WHERE id = ? AND version = ?`,
    )
    .bind(
      value.name,
      value.enabled ? 1 : 0,
      value.quotaBytes,
      value.dailyQuotaBytes,
      value.expiresAt,
      value.allowVless ? 1 : 0,
      value.allowTrojan ? 1 : 0,
      value.allowXhttp ? 1 : 0,
      value.notes,
      now,
      id,
      expectedVersion,
    )
    .run();
  const changes = Number((result.meta as { changes?: number } | undefined)?.changes ?? 0);
  if (changes < 1) {
    if (!(await getUser(db, id))) throw new UserRepositoryError('not-found');
    throw new UserRepositoryError('version-conflict');
  }
  const updated = await getUser(db, id);
  if (!updated) throw new UserRepositoryError('not-found');
  return updated;
}

export async function deleteUser(db: D1Database, id: string): Promise<boolean> {
  if (!(await getUser(db, id))) return false;
  const result = await db.prepare('DELETE FROM users WHERE id = ?').bind(id).run();
  return Number((result.meta as { changes?: number } | undefined)?.changes ?? 0) > 0;
}

export async function createUserSecrets(
  db: D1Database,
  seed: string,
  userId: string,
  now: number,
): Promise<void> {
  const statements = await initialSecretStatements(db, seed, userId, now);
  await db.batch(statements);
}

export async function getUserSecretVersions(
  db: D1Database,
  userId: string,
): Promise<UserSecretVersions | null> {
  const subscription = await db
    .prepare(
      'SELECT user_id, token_version, lookup_hash FROM subscription_tokens WHERE user_id = ?',
    )
    .bind(userId)
    .first<SubscriptionTokenRow>();
  if (!subscription) return null;
  const result = await db
    .prepare(
      'SELECT user_id, protocol, secret_version, lookup_hash, enabled FROM user_credentials WHERE user_id = ?',
    )
    .bind(userId)
    .all<CredentialRow>();
  const credentials = new Map((result.results ?? []).map((row) => [row.protocol, row]));
  const vless = credentials.get('vless');
  const trojan = credentials.get('trojan');
  if (!vless || !trojan) return null;
  return {
    subscription: subscription.token_version,
    vless: vless.secret_version,
    trojan: trojan.secret_version,
  };
}

export async function deriveUserAccessSecrets(
  db: D1Database,
  seed: string,
  userId: string,
): Promise<UserAccessSecrets | null> {
  const versions = await getUserSecretVersions(db, userId);
  if (!versions) return null;
  const [subscriptionToken, vlessUuid, trojanPassword] = await Promise.all([
    deriveSubscriptionToken(seed, userId, versions.subscription),
    deriveVlessUuid(seed, userId, versions.vless),
    deriveTrojanPassword(seed, userId, versions.trojan),
  ]);
  return { ...versions, subscriptionToken, vlessUuid, trojanPassword };
}

export async function rotateSubscriptionSecret(
  db: D1Database,
  seed: string,
  userId: string,
  now: number,
): Promise<number> {
  const row = await db
    .prepare(
      'SELECT user_id, token_version, lookup_hash FROM subscription_tokens WHERE user_id = ?',
    )
    .bind(userId)
    .first<SubscriptionTokenRow>();
  if (!row) throw new UserRepositoryError('not-found');
  const next = row.token_version + 1;
  const token = await deriveSubscriptionToken(seed, userId, next);
  const lookup = await subscriptionLookupHash(token);
  await db
    .prepare(
      'UPDATE subscription_tokens SET token_version = ?, lookup_hash = ?, rotated_at = ? WHERE user_id = ?',
    )
    .bind(next, lookup, now, userId)
    .run();
  return next;
}

export async function rotateCredentialSecret(
  db: D1Database,
  seed: string,
  userId: string,
  protocol: CredentialProtocol,
): Promise<number> {
  const row = await db
    .prepare(
      'SELECT user_id, protocol, secret_version, lookup_hash, enabled FROM user_credentials WHERE user_id = ? AND protocol = ?',
    )
    .bind(userId, protocol)
    .first<CredentialRow>();
  if (!row) throw new UserRepositoryError('not-found');
  const next = row.secret_version + 1;
  const presented =
    protocol === 'vless'
      ? await deriveVlessUuid(seed, userId, next)
      : await deriveTrojanPassword(seed, userId, next);
  const lookup = await credentialLookupHash(protocol, presented);
  await db
    .prepare(
      'UPDATE user_credentials SET secret_version = ?, lookup_hash = ? WHERE user_id = ? AND protocol = ?',
    )
    .bind(next, lookup, userId, protocol)
    .run();
  return next;
}

export async function rotateCredentialSecrets(
  db: D1Database,
  seed: string,
  userId: string,
  protocol: CredentialProtocol | 'all',
): Promise<void> {
  if (protocol === 'all' || protocol === 'vless')
    await rotateCredentialSecret(db, seed, userId, 'vless');
  if (protocol === 'all' || protocol === 'trojan')
    await rotateCredentialSecret(db, seed, userId, 'trojan');
}

function utcDay(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

export async function dailyUsageBytes(
  db: D1Database,
  userId: string,
  now: number,
): Promise<number> {
  const row = await db
    .prepare('SELECT total_bytes FROM usage_daily WHERE user_id = ? AND day_utc = ?')
    .bind(userId, utcDay(now))
    .first<{ total_bytes: number }>();
  return row?.total_bytes ?? 0;
}

export async function isUserAllowed(
  db: D1Database,
  user: UserRecord,
  now: number,
): Promise<boolean> {
  if (!user.enabled) return false;
  if (user.expiresAt !== null && user.expiresAt <= now) return false;
  if (user.quotaBytes !== null && user.totalUsedBytes >= user.quotaBytes) return false;
  if (
    user.dailyQuotaBytes !== null &&
    (await dailyUsageBytes(db, user.id, now)) >= user.dailyQuotaBytes
  ) {
    return false;
  }
  return true;
}

export async function resolveSubscriptionPrincipal(
  db: D1Database,
  token: string,
  now: number,
): Promise<UserRecord | null> {
  const lookup = await subscriptionLookupHash(token);
  const row = await db
    .prepare(
      'SELECT user_id, token_version, lookup_hash FROM subscription_tokens WHERE lookup_hash = ?',
    )
    .bind(lookup)
    .first<SubscriptionTokenRow>();
  if (!row) return null;
  const user = await getUser(db, row.user_id);
  if (!user || !(await isUserAllowed(db, user, now))) return null;
  return user;
}

export async function touchLastSubscription(
  db: D1Database,
  user: UserRecord,
  now: number,
): Promise<void> {
  if (user.lastSubscriptionAt !== null && now - user.lastSubscriptionAt < 60 * 60 * 1000) return;
  await db
    .prepare('UPDATE users SET last_subscription_at = ?, updated_at = updated_at WHERE id = ?')
    .bind(now, user.id)
    .run();
}
