type InstallationRow = {
  id: number;
  secret_seed: string;
  admin_bootstrap_generation: string;
  created_at: number;
  updated_at: number;
};

type AdminRow = {
  id: number;
  password_salt: string;
  password_hash: string;
  iterations: number;
  password_version: number;
  created_at: number;
  updated_at: number;
};

type SessionRow = {
  id_hash: string;
  csrf_hash: string;
  password_version: number;
  created_at: number;
  expires_at: number;
  last_seen_at: number;
};
type ThrottleRow = { key_hash: string; window_start: number; failures: number };
type MigrationRow = { version: number; name: string; checksum: string; applied_at: number };
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
type AuditRow = {
  id: number;
  ts: number;
  actor: string;
  action: string;
  target_type: string;
  target_id: string | null;
  detail_json: string;
};
type SubscriptionTokenRow = {
  user_id: string;
  token_version: number;
  lookup_hash: string;
  created_at: number;
  rotated_at: number;
};
type UserCredentialRow = {
  user_id: string;
  protocol: 'vless' | 'trojan';
  secret_version: number;
  lookup_hash: string;
  enabled: number;
};
type UsageDailyRow = {
  user_id: string;
  day_utc: string;
  upload_bytes: number;
  download_bytes: number;
  total_bytes: number;
  connections: number;
  updated_at: number;
};

type State = {
  installation: InstallationRow | null;
  admin: AdminRow | null;
  sessions: Map<string, SessionRow>;
  throttle: Map<string, ThrottleRow>;
  loginEvents: Array<Record<string, unknown>>;
  migrations: Map<number, MigrationRow>;
  users: Map<string, UserRow>;
  auditLog: AuditRow[];
  nextAuditId: number;
  subscriptionTokens: Map<string, SubscriptionTokenRow>;
  credentials: Map<string, UserCredentialRow>;
  usageDaily: Map<string, UsageDailyRow>;
};

function normalized(sql: string): string {
  return sql.replace(/\s+/gu, ' ').trim().toLowerCase();
}

export type FakeD1 = D1Database & {
  rows(): unknown;
  state(): State;
};

export function createFakeD1(): FakeD1 {
  const state: State = {
    installation: null,
    admin: null,
    sessions: new Map(),
    throttle: new Map(),
    loginEvents: [],
    migrations: new Map(),
    users: new Map(),
    auditLog: [],
    nextAuditId: 1,
    subscriptionTokens: new Map(),
    credentials: new Map(),
    usageDaily: new Map(),
  };
  function prepare(sql: string) {
    const q = normalized(sql);
    let params: unknown[] = [];
    const statement = {
      bind(...values: unknown[]) {
        params = values;
        return statement;
      },
      async first<T>() {
        if (q.includes('max(version)') && q.includes('schema_migrations')) {
          const versions = [...state.migrations.keys()];
          return { version: versions.length ? Math.max(...versions) : null } as T;
        }
        if (q.includes('from schema_migrations') && q.includes('version = ?')) {
          return (state.migrations.get(Number(params[0])) ?? null) as T | null;
        }
        if (q.includes('from installation_state')) return state.installation as T | null;
        if (q.includes('from admin_credentials')) return state.admin as T | null;
        if (q.includes('from sessions') && q.includes('join admin_credentials')) {
          const row = state.sessions.get(String(params[0]));
          if (!row || !state.admin) return null;
          const now = Number(params[1]);
          if (row.expires_at <= now || row.password_version !== state.admin.password_version)
            return null;
          return row as T;
        }
        if (q.includes('from login_throttle')) {
          return (state.throttle.get(String(params[0])) ?? null) as T | null;
        }
        if (q.includes('from users') && q.includes('where id = ?')) {
          return (state.users.get(String(params[0])) ?? null) as T | null;
        }
        if (q.includes('from subscription_tokens') && q.includes('where user_id = ?')) {
          return (state.subscriptionTokens.get(String(params[0])) ?? null) as T | null;
        }
        if (q.includes('from subscription_tokens') && q.includes('where lookup_hash = ?')) {
          const hash = String(params[0]);
          return ([...state.subscriptionTokens.values()].find((row) => row.lookup_hash === hash) ??
            null) as T | null;
        }
        if (
          q.includes('from user_credentials') &&
          q.includes('where protocol = ? and lookup_hash = ?')
        ) {
          const protocol = String(params[0]);
          const lookupHash = String(params[1]);
          return ([...state.credentials.values()].find(
            (row) => row.protocol === protocol && row.lookup_hash === lookupHash,
          ) ?? null) as T | null;
        }
        if (
          q.includes('from user_credentials') &&
          q.includes('where user_id = ? and protocol = ?')
        ) {
          return (state.credentials.get(`${String(params[0])}:${String(params[1])}`) ??
            null) as T | null;
        }
        if (q.includes('from usage_daily')) {
          return (state.usageDaily.get(`${String(params[0])}:${String(params[1])}`) ??
            null) as T | null;
        }
        if (q.includes('count(*)') && q.includes('from users')) {
          const users = [...state.users.values()];
          return {
            total: users.length,
            enabled: users.filter((row) => row.enabled === 1).length,
          } as T;
        }
        if (q.includes('count(*)') && q.includes('from sessions')) {
          return { count: state.sessions.size } as T;
        }
        return null;
      },
      async all<T>() {
        if (q.includes('from usage_daily') && q.includes('where user_id = ?')) {
          const userId = String(params[0]);
          const start = String(params[1]);
          const rows = [...state.usageDaily.values()]
            .filter((row) => row.user_id === userId && row.day_utc >= start)
            .sort((a, b) => a.day_utc.localeCompare(b.day_utc));
          return { results: rows as T[], success: true, meta: {} };
        }
        if (q.includes('from usage_daily') && q.includes('group by day_utc')) {
          const start = String(params[0]);
          const grouped = new Map<string, UsageDailyRow>();
          for (const row of state.usageDaily.values()) {
            if (row.day_utc < start) continue;
            const current = grouped.get(row.day_utc) ?? {
              user_id: '',
              day_utc: row.day_utc,
              upload_bytes: 0,
              download_bytes: 0,
              total_bytes: 0,
              connections: 0,
              updated_at: row.updated_at,
            };
            current.upload_bytes += row.upload_bytes;
            current.download_bytes += row.download_bytes;
            current.total_bytes += row.total_bytes;
            current.connections += row.connections;
            current.updated_at = Math.max(current.updated_at, row.updated_at);
            grouped.set(row.day_utc, current);
          }
          const rows = [...grouped.values()].sort((a, b) => a.day_utc.localeCompare(b.day_utc));
          return { results: rows as T[], success: true, meta: {} };
        }
        if (q.includes('from users')) {
          const rows = [...state.users.values()].sort((a, b) => b.created_at - a.created_at);
          return { results: rows as T[], success: true, meta: {} };
        }
        if (q.includes('from user_credentials')) {
          const userId = String(params[0]);
          const rows = [...state.credentials.values()].filter((row) => row.user_id === userId);
          return { results: rows as T[], success: true, meta: {} };
        }
        if (q.includes('from audit_log')) {
          const limit = Number(params[0] ?? 50);
          const rows = [...state.auditLog].sort((a, b) => b.id - a.id).slice(0, limit);
          return { results: rows as T[], success: true, meta: {} };
        }
        if (q.includes('from login_events')) {
          const limit = Number(params[0] ?? 50);
          const rows = [...state.loginEvents].reverse().slice(0, limit);
          return { results: rows as T[], success: true, meta: {} };
        }
        return { results: [] as T[], success: true, meta: {} };
      },
      async run() {
        if (q.includes('insert or ignore into schema_migrations')) {
          const [version, name, checksum, appliedAt] = params;
          if (!state.migrations.has(Number(version))) {
            state.migrations.set(Number(version), {
              version: Number(version),
              name: String(name),
              checksum: String(checksum),
              applied_at: Number(appliedAt),
            });
          }
        } else if (q.includes('insert or ignore into installation_state')) {
          const [seed, createdAt, updatedAt] = params;
          state.installation ??= {
            id: 1,
            secret_seed: String(seed),
            admin_bootstrap_generation: '',
            created_at: Number(createdAt),
            updated_at: Number(updatedAt),
          };
        } else if (
          q.includes('insert into admin_credentials') ||
          q.includes('update admin_credentials')
        ) {
          const [salt, hash, iterations, version, createdAt, updatedAt] = params;
          state.admin = {
            id: 1,
            password_salt: String(salt),
            password_hash: String(hash),
            iterations: Number(iterations),
            password_version: Number(version),
            created_at: Number(createdAt),
            updated_at: Number(updatedAt),
          };
        }
        if (q.startsWith('insert into users')) {
          const [
            id,
            name,
            enabled,
            quota,
            dailyQuota,
            expiresAt,
            allowVless,
            allowTrojan,
            allowXhttp,
            notes,
            createdAt,
            updatedAt,
          ] = params;
          state.users.set(String(id), {
            id: String(id),
            name: String(name),
            enabled: Number(enabled),
            quota_bytes: quota === null ? null : Number(quota),
            daily_quota_bytes: dailyQuota === null ? null : Number(dailyQuota),
            expires_at: expiresAt === null ? null : Number(expiresAt),
            total_used_bytes: 0,
            allow_vless: Number(allowVless),
            allow_trojan: Number(allowTrojan),
            allow_xhttp: Number(allowXhttp),
            notes: String(notes),
            last_subscription_at: null,
            last_tunnel_at: null,
            version: 1,
            created_at: Number(createdAt),
            updated_at: Number(updatedAt),
          });
          return { success: true, meta: { changes: 1 } };
        }
        if (q.startsWith('insert into subscription_tokens')) {
          const [userId, lookupHash, createdAt, rotatedAt] = params;
          state.subscriptionTokens.set(String(userId), {
            user_id: String(userId),
            token_version: 1,
            lookup_hash: String(lookupHash),
            created_at: Number(createdAt),
            rotated_at: Number(rotatedAt),
          });
          return { success: true, meta: { changes: 1 } };
        }
        if (q.startsWith('insert into user_credentials')) {
          const protocol = q.includes("'vless'") ? 'vless' : 'trojan';
          const [userId, lookupHash] = params;
          state.credentials.set(`${String(userId)}:${protocol}`, {
            user_id: String(userId),
            protocol,
            secret_version: 1,
            lookup_hash: String(lookupHash),
            enabled: 1,
          });
          return { success: true, meta: { changes: 1 } };
        }
        if (q.startsWith('update subscription_tokens')) {
          const [version, lookupHash, rotatedAt, userId] = params;
          const row = state.subscriptionTokens.get(String(userId));
          if (!row) return { success: true, meta: { changes: 0 } };
          row.token_version = Number(version);
          row.lookup_hash = String(lookupHash);
          row.rotated_at = Number(rotatedAt);
          return { success: true, meta: { changes: 1 } };
        }
        if (q.startsWith('update user_credentials')) {
          const [version, lookupHash, userId, protocol] = params;
          const row = state.credentials.get(`${String(userId)}:${String(protocol)}`);
          if (!row) return { success: true, meta: { changes: 0 } };
          row.secret_version = Number(version);
          row.lookup_hash = String(lookupHash);
          return { success: true, meta: { changes: 1 } };
        }
        if (q.startsWith('update users set last_subscription_at')) {
          const [value, id] = params;
          const row = state.users.get(String(id));
          if (!row) return { success: true, meta: { changes: 0 } };
          row.last_subscription_at = Number(value);
          return { success: true, meta: { changes: 1 } };
        }
        if (q.startsWith('update users set total_used_bytes = total_used_bytes +')) {
          const [delta, lastTunnelAt, updatedAt, id] = params;
          const row = state.users.get(String(id));
          if (!row) return { success: true, meta: { changes: 0 } };
          row.total_used_bytes += Number(delta);
          row.last_tunnel_at = Number(lastTunnelAt);
          row.updated_at = Number(updatedAt);
          return { success: true, meta: { changes: 1 } };
        }
        if (q.startsWith('insert into usage_daily')) {
          const [userId, dayUtc, upload, download, total, connections, updatedAt] = params;
          const key = `${String(userId)}:${String(dayUtc)}`;
          const row = state.usageDaily.get(key);
          if (row) {
            row.upload_bytes += Number(upload);
            row.download_bytes += Number(download);
            row.total_bytes += Number(total);
            row.connections += Number(connections);
            row.updated_at = Number(updatedAt);
          } else {
            state.usageDaily.set(key, {
              user_id: String(userId),
              day_utc: String(dayUtc),
              upload_bytes: Number(upload),
              download_bytes: Number(download),
              total_bytes: Number(total),
              connections: Number(connections),
              updated_at: Number(updatedAt),
            });
          }
          return { success: true, meta: { changes: 1 } };
        }
        if (q.startsWith('update users set')) {
          const [
            name,
            enabled,
            quota,
            dailyQuota,
            expiresAt,
            allowVless,
            allowTrojan,
            allowXhttp,
            notes,
            updatedAt,
            id,
            expectedVersion,
          ] = params;
          const row = state.users.get(String(id));
          if (!row || row.version !== Number(expectedVersion))
            return { success: true, meta: { changes: 0 } };
          Object.assign(row, {
            name: String(name),
            enabled: Number(enabled),
            quota_bytes: quota === null ? null : Number(quota),
            daily_quota_bytes: dailyQuota === null ? null : Number(dailyQuota),
            expires_at: expiresAt === null ? null : Number(expiresAt),
            allow_vless: Number(allowVless),
            allow_trojan: Number(allowTrojan),
            allow_xhttp: Number(allowXhttp),
            notes: String(notes),
            version: row.version + 1,
            updated_at: Number(updatedAt),
          });
          return { success: true, meta: { changes: 1 } };
        }
        if (q.startsWith('delete from users where id')) {
          const id = String(params[0]);
          const changed = state.users.delete(id) ? 1 : 0;
          state.subscriptionTokens.delete(id);
          state.credentials.delete(`${id}:vless`);
          state.credentials.delete(`${id}:trojan`);
          return { success: true, meta: { changes: changed } };
        }
        if (q.startsWith('insert into audit_log')) {
          const [ts, actor, action, targetType, targetId, detailJson] = params;
          state.auditLog.push({
            id: state.nextAuditId++,
            ts: Number(ts),
            actor: String(actor),
            action: String(action),
            target_type: String(targetType),
            target_id: targetId === null ? null : String(targetId),
            detail_json: String(detailJson),
          });
        }
        if (q.startsWith('delete from audit_log')) {
          state.auditLog = state.auditLog.sort((a, b) => b.id - a.id).slice(0, 5000);
        }
        if (q.startsWith('delete from login_events') && q.includes('select id')) {
          state.loginEvents = state.loginEvents.slice(-1000);
        }
        if (q.startsWith('update installation_state')) {
          if (!state.installation) throw new Error('missing-installation-state');
          state.installation.admin_bootstrap_generation = String(params[0]);
          state.installation.updated_at = Number(params[1]);
        }
        if (q.startsWith('delete from sessions where expires_at')) {
          const now = Number(params[0]);
          for (const [key, row] of state.sessions)
            if (row.expires_at <= now) state.sessions.delete(key);
        } else if (q === 'delete from sessions') {
          state.sessions.clear();
        } else if (q.startsWith('delete from sessions where id_hash')) {
          state.sessions.delete(String(params[0]));
        }
        if (q.startsWith('insert into sessions')) {
          const [idHash, csrfHash, passwordVersion, createdAt, expiresAt, lastSeenAt] = params;
          state.sessions.set(String(idHash), {
            id_hash: String(idHash),
            csrf_hash: String(csrfHash),
            password_version: Number(passwordVersion),
            created_at: Number(createdAt),
            expires_at: Number(expiresAt),
            last_seen_at: Number(lastSeenAt),
          });
        }
        if (q.startsWith('insert into login_events')) {
          const [ts, success, country, colo, userAgentHash] = params;
          state.loginEvents.push({ ts, success, country, colo, user_agent_hash: userAgentHash });
        }
        if (q.startsWith('insert into login_throttle')) {
          const [keyHash, windowStart, failures] = params;
          state.throttle.set(String(keyHash), {
            key_hash: String(keyHash),
            window_start: Number(windowStart),
            failures: Number(failures),
          });
        }
        if (q.startsWith('update login_throttle')) {
          const row = state.throttle.get(String(params[2]));
          if (row) {
            row.window_start = Number(params[0]);
            row.failures = Number(params[1]);
          }
        }
        if (q.startsWith('delete from login_throttle')) state.throttle.delete(String(params[0]));
        return { success: true, meta: {} };
      },
    };
    return statement;
  }

  const db = {
    async exec() {
      return { count: 0, duration: 0 };
    },
    prepare,
    async batch(statements: Array<{ run(): Promise<unknown> }>) {
      return Promise.all(statements.map((statement) => statement.run()));
    },
    rows() {
      return {
        installation: state.installation,
        admin: state.admin,
        sessions: [...state.sessions.values()],
        throttle: [...state.throttle.values()],
        loginEvents: state.loginEvents,
        users: [...state.users.values()],
        auditLog: state.auditLog,
        subscriptionTokens: [...state.subscriptionTokens.values()],
        credentials: [...state.credentials.values()],
        usageDaily: [...state.usageDaily.values()],
      };
    },
    state() {
      return state;
    },
  };
  return db as unknown as FakeD1;
}
