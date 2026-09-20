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

export type UpdateUserInput = Partial<CreateUserInput> & { version: number };

export type Overview = {
  enabledUsers: number;
  recentUsers: number;
  todayBytes: number;
  totalBytes: number;
  expiryWarnings: number;
};

export type UsagePoint = {
  dayUtc: string;
  uploadBytes: number;
  downloadBytes: number;
  totalBytes: number;
  connections: number;
};

export type UserAccess = {
  subscriptionUrl: string;
  subscriptionToken: string;
  qr: { kind: 'subscription-url'; payload: string };
  vless: { uuid: string; version: number };
  trojan: { password: string; version: number };
  subscriptionVersion: number;
};

export type AuditEntry = {
  id?: number;
  ts: number;
  actor: string;
  action: string;
  target_type?: string;
  targetType?: string;
  target_id?: string | null;
  targetId?: string | null;
  detail_json?: string;
  detailJson?: string;
};

export type LoginEvent = {
  id?: number;
  ts: number;
  success: number | boolean;
  country?: string | null;
  colo?: string | null;
  user_agent_hash?: string | null;
  userAgentHash?: string | null;
};

export type SessionState = { authenticated: boolean; expiresAt?: number };
export type LoginResult = { ok: true; expiresAt: number };
export type OkResult = { ok: true };

export class PanelApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
  ) {
    super(code);
    this.name = 'PanelApiError';
  }
}

export function csrfCookie(): string {
  if (typeof document === 'undefined') return '';
  const value = document.cookie
    .split('; ')
    .find((part) => part.startsWith('tn_csrf='))
    ?.slice('tn_csrf='.length);
  if (!value) return '';
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

async function requestJson<T>(
  fetcher: FetchLike,
  path: string,
  init: RequestInit = {},
  options: { csrf?: boolean } = {},
): Promise<T> {
  const method = (init.method ?? 'GET').toUpperCase();
  const headers = new Headers(init.headers);
  if (init.body !== undefined && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }
  if (method !== 'GET' && options.csrf !== false) {
    const csrf = csrfCookie();
    if (csrf) headers.set('x-csrf-token', csrf);
  }
  const response = await fetcher(path, {
    ...init,
    method,
    headers,
    credentials: 'same-origin',
  });
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (!response.ok) {
    const code =
      body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
        ? body.error
        : 'request-failed';
    throw new PanelApiError(response.status, code);
  }
  return body as T;
}

export type PanelApi = {
  session(): Promise<SessionState>;
  login(password: string): Promise<LoginResult>;
  logout(): Promise<OkResult>;
  changePassword(currentPassword: string, newPassword: string): Promise<OkResult>;
  overview(): Promise<Overview>;
  listUsers(): Promise<UserRecord[]>;
  createUser(input: CreateUserInput): Promise<UserRecord>;
  updateUser(id: string, input: UpdateUserInput): Promise<UserRecord>;
  deleteUser(id: string): Promise<void>;
  userAccess(id: string): Promise<UserAccess>;
  rotateSubscription(id: string): Promise<void>;
  rotateCredentials(id: string, protocol?: 'vless' | 'trojan' | 'all'): Promise<void>;
  aggregateUsage(days?: number): Promise<UsagePoint[]>;
  userUsage(id: string, days?: number): Promise<UsagePoint[]>;
  audit(limit?: number): Promise<AuditEntry[]>;
  loginEvents(limit?: number): Promise<LoginEvent[]>;
};

export function createPanelApi(fetcher: FetchLike = fetch): PanelApi {
  return {
    session: () => requestJson(fetcher, '/api/auth/session'),
    login: (password) =>
      requestJson(
        fetcher,
        '/api/auth/login',
        {
          method: 'POST',
          body: JSON.stringify({ password }),
        },
        { csrf: false },
      ),
    logout: () => requestJson(fetcher, '/api/auth/logout', { method: 'POST', body: '{}' }),
    changePassword: (currentPassword, newPassword) =>
      requestJson(fetcher, '/api/auth/password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      }),
    overview: async () => {
      const body = await requestJson<{ ok: true } & Overview>(fetcher, '/api/overview');
      return {
        enabledUsers: body.enabledUsers,
        recentUsers: body.recentUsers,
        todayBytes: body.todayBytes,
        totalBytes: body.totalBytes,
        expiryWarnings: body.expiryWarnings,
      };
    },
    listUsers: async () =>
      (await requestJson<{ ok: true; users: UserRecord[] }>(fetcher, '/api/users')).users,
    createUser: async (input) =>
      (
        await requestJson<{ ok: true; user: UserRecord }>(fetcher, '/api/users', {
          method: 'POST',
          body: JSON.stringify(input),
        })
      ).user,
    updateUser: async (id, input) =>
      (
        await requestJson<{ ok: true; user: UserRecord }>(fetcher, `/api/users/${id}`, {
          method: 'PATCH',
          body: JSON.stringify(input),
        })
      ).user,
    deleteUser: async (id) => {
      await requestJson(fetcher, `/api/users/${id}`, { method: 'DELETE', body: '{}' });
    },
    userAccess: async (id) =>
      (await requestJson<{ ok: true; access: UserAccess }>(fetcher, `/api/users/${id}/access`))
        .access,
    rotateSubscription: async (id) => {
      await requestJson(fetcher, `/api/users/${id}/rotate-subscription`, {
        method: 'POST',
        body: '{}',
      });
    },
    rotateCredentials: async (id, protocol = 'all') => {
      await requestJson(fetcher, `/api/users/${id}/rotate-credentials`, {
        method: 'POST',
        body: JSON.stringify({ protocol }),
      });
    },
    aggregateUsage: async (days = 14) =>
      (await requestJson<{ ok: true; usage: UsagePoint[] }>(fetcher, `/api/usage?days=${days}`))
        .usage,
    userUsage: async (id, days = 14) =>
      (
        await requestJson<{ ok: true; usage: UsagePoint[] }>(
          fetcher,
          `/api/users/${id}/usage?days=${days}`,
        )
      ).usage,
    audit: async (limit = 50) =>
      (await requestJson<{ ok: true; entries: AuditEntry[] }>(fetcher, `/api/audit?limit=${limit}`))
        .entries,
    loginEvents: async (limit = 50) =>
      (
        await requestJson<{ ok: true; events: LoginEvent[] }>(
          fetcher,
          `/api/security/logins?limit=${limit}`,
        )
      ).events,
  };
}

export const browserPanelApi = createPanelApi();
