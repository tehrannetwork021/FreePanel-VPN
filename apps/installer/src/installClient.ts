import type { InstallRequest, InstallResult, InstallerSessionView } from '@tehrannetwork/shared';

export class InstallerClientError extends Error {
  constructor(
    public readonly code: string,
    public readonly stage?: string,
  ) {
    super(code);
    this.name = 'InstallerClientError';
  }
}

export interface InstallerApi {
  getSession(): Promise<InstallerSessionView>;
  startOAuth(): void;
  installPanel(request: InstallRequest): Promise<InstallResult>;
  logout(): Promise<void>;
}

async function readError(response: Response): Promise<InstallerClientError> {
  try {
    const body = (await response.json()) as { code?: string; error?: string; stage?: string };
    return new InstallerClientError(body.code ?? body.error ?? 'installation-failed', body.stage);
  } catch {
    return new InstallerClientError('installation-failed');
  }
}

export async function getSession(): Promise<InstallerSessionView> {
  const response = await fetch('/api/session', { cache: 'no-store', credentials: 'same-origin' });
  if (!response.ok) throw await readError(response);
  return (await response.json()) as InstallerSessionView;
}

export function startOAuth(): void {
  window.location.assign('/api/oauth/start');
}

export async function installPanel(request: InstallRequest): Promise<InstallResult> {
  const response = await fetch('/api/install', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(request),
    cache: 'no-store',
    credentials: 'same-origin',
  });
  if (!response.ok) throw await readError(response);
  return (await response.json()) as InstallResult;
}

export async function logout(): Promise<void> {
  await fetch('/api/logout', {
    method: 'POST',
    cache: 'no-store',
    credentials: 'same-origin',
  });
}

export const browserInstallerApi: InstallerApi = {
  getSession,
  startOAuth,
  installPanel,
  logout,
};

export type TokenInstallFn = (token: string) => Promise<void>;
export const startTokenInstall: TokenInstallFn = async (token) => {
  const response = await fetch('/api/token-install', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token }),
    cache: 'no-store',
    credentials: 'same-origin',
  });
  if (!response.ok) throw new InstallerClientError('advanced-installer-unavailable');
};
