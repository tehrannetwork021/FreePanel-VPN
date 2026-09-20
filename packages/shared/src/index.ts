export const PRODUCT_NAME = 'Tehran Network Edge Panel' as const;
export const PRODUCT_SLUG = 'tehran-network-edge-panel' as const;

export * from './installer';

export type UserDto = {
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

export type OverviewDto = {
  ok: true;
  users: { total: number; enabled: number };
};

export type AuditEntryDto = {
  id: number;
  ts: number;
  actor: string;
  action: string;
  targetType: string;
  targetId: string | null;
  detail: Record<string, unknown>;
};

export type LoginEventDto = {
  id: number;
  ts: number;
  success: boolean;
  country: string | null;
  colo: string | null;
  userAgentHash: string | null;
};

export type UsersResponseDto = { ok: true; users: UserDto[] };
export type UserResponseDto = { ok: true; user: UserDto };
