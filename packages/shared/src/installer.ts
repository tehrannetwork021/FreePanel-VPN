export type InstallStage =
  | 'oauth'
  | 'account'
  | 'kv'
  | 'worker'
  | 'secret'
  | 'subdomain'
  | 'health'
  | 'complete';

export type InstallErrorCode =
  | 'authorization-expired'
  | 'authorization-denied'
  | 'insufficient-scope'
  | 'invalid-account'
  | 'invalid-worker-name'
  | 'invalid-admin-password'
  | 'kv-failed'
  | 'worker-upload-failed'
  | 'secret-failed'
  | 'subdomain-failed'
  | 'health-failed';

export type CloudflareAccountView = { id: string; name: string };
export type InstallerSessionView = {
  connected: boolean;
  expiresAt?: number;
  accounts?: CloudflareAccountView[];
};
export type InstallRequest = {
  accountId: string;
  workerName: string;
  adminPassword: string;
};

export type InstallResult = {
  ok: true;
  workerUrl: string;
  workerName: string;
  version: string;
};

export function validateWorkerName(input: string) {
  const value = input.trim();
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(value)
    ? ({ ok: true, value } as const)
    : ({ ok: false, error: 'invalid-worker-name' as const } as const);
}

export function validateAdminPassword(password: string) {
  return password.length >= 16
    ? ({ ok: true } as const)
    : ({ ok: false, error: 'invalid-admin-password' as const } as const);
}
