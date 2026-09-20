import type { InstallResult, TokenInstallRequest, TokenVerifyResult } from '@tehrannetwork/shared';

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
  verifyToken(token: string): Promise<TokenVerifyResult>;
  installPanel(request: TokenInstallRequest): Promise<InstallResult>;
}

async function readError(response: Response): Promise<InstallerClientError> {
  try {
    const body = (await response.json()) as { code?: string; error?: string; stage?: string };
    return new InstallerClientError(body.code ?? body.error ?? 'installation-failed', body.stage);
  } catch {
    return new InstallerClientError('installation-failed');
  }
}
export async function verifyToken(token: string): Promise<TokenVerifyResult> {
  const response = await fetch('/api/token/verify', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ token }),
    cache: 'no-store',
    credentials: 'same-origin',
  });
  if (!response.ok) throw await readError(response);
  return (await response.json()) as TokenVerifyResult;
}

export async function installPanel(request: TokenInstallRequest): Promise<InstallResult> {
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

export const browserInstallerApi: InstallerApi = {
  verifyToken,
  installPanel,
};
