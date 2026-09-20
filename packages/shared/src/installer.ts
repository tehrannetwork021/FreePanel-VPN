export type InstallStage =
  'token' | 'account' | 'kv' | 'd1' | 'worker' | 'secret' | 'subdomain' | 'health' | 'complete';

export type InstallErrorCode =
  | 'token-invalid'
  | 'insufficient-scope'
  | 'invalid-account'
  | 'invalid-worker-name'
  | 'invalid-admin-password'
  | 'kv-failed'
  | 'd1-failed'
  | 'worker-upload-failed'
  | 'secret-failed'
  | 'subdomain-failed'
  | 'health-failed';

export type CloudflareAccountView = { id: string; name: string };
export type TokenVerifyRequest = { token: string };
export type TokenVerifyResult = { ok: true; accounts: CloudflareAccountView[] };
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
export type TokenInstallRequest = InstallRequest & { token: string };

export type InstallResult = {
  ok: true;
  workerUrl: string;
  workerName: string;
  version: string;
  schemaVersion: number;
  adminUrl: string;
};

export function validateWorkerName(input: string) {
  const value = input.trim();
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(value)
    ? ({ ok: true, value } as const)
    : ({ ok: false, error: 'invalid-worker-name' as const } as const);
}

export function validateAdminPassword(password: string) {
  return password.length > 0
    ? ({ ok: true } as const)
    : ({ ok: false, error: 'invalid-admin-password' as const } as const);
}
