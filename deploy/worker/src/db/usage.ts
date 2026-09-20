import { getUser, listUsers } from './users';

export type UsageDelta = {
  uploadBytes: number;
  downloadBytes: number;
  connections: number;
};

export type AccessState = {
  allowed: boolean;
  reason?: 'not-found' | 'disabled' | 'expired' | 'total-quota' | 'daily-quota';
  totalUsedBytes: number;
  todayUsedBytes: number;
};

export type UsageRow = {
  userId: string;
  dayUtc: string;
  uploadBytes: number;
  downloadBytes: number;
  totalBytes: number;
  connections: number;
  updatedAt: number;
};

type UsageDbRow = {
  user_id: string;
  day_utc: string;
  upload_bytes: number;
  download_bytes: number;
  total_bytes: number;
  connections: number;
  updated_at: number;
};

function dayUtc(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

function validateDelta(delta: UsageDelta): void {
  for (const value of [delta.uploadBytes, delta.downloadBytes, delta.connections]) {
    if (!Number.isSafeInteger(value) || value < 0) throw new Error('invalid-usage-delta');
  }
  if (!Number.isSafeInteger(delta.uploadBytes + delta.downloadBytes)) {
    throw new Error('invalid-usage-delta');
  }
}

function view(row: UsageDbRow): UsageRow {
  return {
    userId: row.user_id,
    dayUtc: row.day_utc,
    uploadBytes: row.upload_bytes,
    downloadBytes: row.download_bytes,
    totalBytes: row.total_bytes,
    connections: row.connections,
    updatedAt: row.updated_at,
  };
}

export async function readUsage(db: D1Database, userId: string, day: string): Promise<UsageRow> {
  const row = await db
    .prepare(
      `SELECT user_id, day_utc, upload_bytes, download_bytes, total_bytes, connections, updated_at
     FROM usage_daily WHERE user_id = ? AND day_utc = ?`,
    )
    .bind(userId, day)
    .first<UsageDbRow>();
  return row
    ? view(row)
    : {
        userId,
        dayUtc: day,
        uploadBytes: 0,
        downloadBytes: 0,
        totalBytes: 0,
        connections: 0,
        updatedAt: 0,
      };
}

export async function readAccessState(
  db: D1Database,
  userId: string,
  now: number,
): Promise<AccessState> {
  const user = await getUser(db, userId);
  if (!user) return { allowed: false, reason: 'not-found', totalUsedBytes: 0, todayUsedBytes: 0 };
  const todayUsedBytes = (await readUsage(db, userId, dayUtc(now))).totalBytes;
  const base = { totalUsedBytes: user.totalUsedBytes, todayUsedBytes };
  if (!user.enabled) return { ...base, allowed: false, reason: 'disabled' };
  if (user.expiresAt !== null && user.expiresAt <= now) {
    return { ...base, allowed: false, reason: 'expired' };
  }
  if (user.quotaBytes !== null && user.totalUsedBytes >= user.quotaBytes) {
    return { ...base, allowed: false, reason: 'total-quota' };
  }
  if (user.dailyQuotaBytes !== null && todayUsedBytes >= user.dailyQuotaBytes) {
    return { ...base, allowed: false, reason: 'daily-quota' };
  }
  return { ...base, allowed: true };
}

export async function recordUsageDelta(
  db: D1Database,
  userId: string,
  delta: UsageDelta,
  now: number,
): Promise<AccessState> {
  validateDelta(delta);
  const total = delta.uploadBytes + delta.downloadBytes;
  const day = dayUtc(now);
  await db.batch([
    db
      .prepare(
        `UPDATE users SET total_used_bytes = total_used_bytes + ?, last_tunnel_at = ?, updated_at = ?
       WHERE id = ?`,
      )
      .bind(total, now, now, userId),
    db
      .prepare(
        `INSERT INTO usage_daily(user_id, day_utc, upload_bytes, download_bytes, total_bytes, connections, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, day_utc) DO UPDATE SET
         upload_bytes = upload_bytes + excluded.upload_bytes,
         download_bytes = download_bytes + excluded.download_bytes,
         total_bytes = total_bytes + excluded.total_bytes,
         connections = connections + excluded.connections,
         updated_at = excluded.updated_at`,
      )
      .bind(userId, day, delta.uploadBytes, delta.downloadBytes, total, delta.connections, now),
  ]);
  return readAccessState(db, userId, now);
}

export type AggregateUsageRow = {
  dayUtc: string;
  uploadBytes: number;
  downloadBytes: number;
  totalBytes: number;
  connections: number;
};

function clampDays(days: number): number {
  if (!Number.isFinite(days)) return 14;
  return Math.max(1, Math.min(90, Math.trunc(days)));
}

function startDay(days: number, now: number): string {
  const span = (clampDays(days) - 1) * 86_400_000;
  return dayUtc(now - span);
}

export async function listUserUsage(
  db: D1Database,
  userId: string,
  days: number,
  now: number,
): Promise<UsageRow[]> {
  const result = await db
    .prepare(
      `SELECT user_id, day_utc, upload_bytes, download_bytes, total_bytes, connections, updated_at
     FROM usage_daily WHERE user_id = ? AND day_utc >= ? ORDER BY day_utc ASC`,
    )
    .bind(userId, startDay(days, now))
    .all<UsageDbRow>();
  return (result.results ?? []).map(view);
}

type AggregateDbRow = {
  day_utc: string;
  upload_bytes: number;
  download_bytes: number;
  total_bytes: number;
  connections: number;
};

export async function listAggregateUsage(
  db: D1Database,
  days: number,
  now: number,
): Promise<AggregateUsageRow[]> {
  const result = await db
    .prepare(
      `SELECT day_utc,
       SUM(upload_bytes) AS upload_bytes,
       SUM(download_bytes) AS download_bytes,
       SUM(total_bytes) AS total_bytes,
       SUM(connections) AS connections
     FROM usage_daily WHERE day_utc >= ? GROUP BY day_utc ORDER BY day_utc ASC`,
    )
    .bind(startDay(days, now))
    .all<AggregateDbRow>();
  return (result.results ?? []).map((row) => ({
    dayUtc: row.day_utc,
    uploadBytes: row.upload_bytes,
    downloadBytes: row.download_bytes,
    totalBytes: row.total_bytes,
    connections: row.connections,
  }));
}

export type OverviewMetrics = {
  enabledUsers: number;
  recentUsers: number;
  todayBytes: number;
  totalBytes: number;
  expiryWarnings: number;
};

export async function readOverviewMetrics(db: D1Database, now: number): Promise<OverviewMetrics> {
  const users = await listUsers(db);
  const recentCutoff = now - 24 * 60 * 60 * 1000;
  const warningCutoff = now + 7 * 24 * 60 * 60 * 1000;
  const aggregate = await listAggregateUsage(db, 1, now);
  return {
    enabledUsers: users.filter((user) => user.enabled).length,
    recentUsers: users.filter(
      (user) => Math.max(user.lastTunnelAt ?? 0, user.lastSubscriptionAt ?? 0) >= recentCutoff,
    ).length,
    todayBytes: aggregate.find((row) => row.dayUtc === dayUtc(now))?.totalBytes ?? 0,
    totalBytes: users.reduce((sum, user) => sum + user.totalUsedBytes, 0),
    expiryWarnings: users.filter(
      (user) =>
        user.enabled &&
        user.expiresAt !== null &&
        user.expiresAt > now &&
        user.expiresAt <= warningCutoff,
    ).length,
  };
}
