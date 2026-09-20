import type {
  CloudflareAccountView,
  InstallErrorCode,
  InstallRequest,
  InstallResult,
  InstallStage,
} from '@tehrannetwork/shared';
import { validateAdminPassword, validateWorkerName } from './validation';
import {
  CloudflareApiError,
  enableScriptSubdomain,
  ensureAccountSubdomain,
  findOrCreateKvNamespace,
  listAccounts,
  uploadWorkerModule,
} from './cloudflare';
import {
  EDGE_WORKER_SHA256,
  EDGE_WORKER_SOURCE,
  EDGE_WORKER_VERSION,
} from './generated/edgeWorkerArtifact';

export class ProvisionError extends Error {
  constructor(
    public readonly stage: InstallStage,
    public readonly code: InstallErrorCode,
  ) {
    super(code);
    this.name = 'ProvisionError';
  }
}

type Artifact = { source: string; sha256: string; version: string };
type Kv = { id: string; title: string };

export type ProvisionDeps = {
  artifact: Artifact;
  listAccounts(token: string): Promise<CloudflareAccountView[]>;
  findOrCreateKvNamespace(token: string, accountId: string, workerName: string): Promise<Kv>;
  uploadWorkerModule(
    token: string,
    accountId: string,
    workerName: string,
    namespaceId: string,
    source: string,
    adminPassword: string,
  ): Promise<void>;
  ensureAccountSubdomain(token: string, accountId: string, workerName: string): Promise<string>;
  enableScriptSubdomain(token: string, accountId: string, workerName: string): Promise<void>;
  fetchHealth(url: string): Promise<{ ok: boolean; version?: string }>;
  now(): number;
  sleep(ms: number): Promise<void>;
};

async function sha256Hex(source: string): Promise<string> {
  const bytes = new TextEncoder().encode(source);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function verifyArtifact(artifact: Artifact): Promise<void> {
  if ((await sha256Hex(artifact.source)) !== artifact.sha256) {
    throw new Error('artifact-integrity-failed');
  }
}

export const defaultProvisionDeps: ProvisionDeps = {
  artifact: {
    source: EDGE_WORKER_SOURCE,
    sha256: EDGE_WORKER_SHA256,
    version: EDGE_WORKER_VERSION,
  },
  listAccounts,
  findOrCreateKvNamespace,
  uploadWorkerModule,
  ensureAccountSubdomain,
  enableScriptSubdomain,
  async fetchHealth(url) {
    const response = await fetch(`${url}/health`, { cache: 'no-store' });
    if (!response.ok) return { ok: false };
    return (await response.json()) as { ok: boolean; version?: string };
  },
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

async function stageCall<T>(
  stage: InstallStage,
  code: InstallErrorCode,
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof CloudflareApiError && error.message === 'insufficient-scope') {
      throw new ProvisionError(stage, 'insufficient-scope');
    }
    throw new ProvisionError(stage, code);
  }
}

export async function provisionPanel(
  accessToken: string,
  request: InstallRequest,
  deps: ProvisionDeps = defaultProvisionDeps,
): Promise<InstallResult> {
  const worker = validateWorkerName(request.workerName);
  if (!worker.ok) throw new ProvisionError('worker', worker.error);
  const password = validateAdminPassword(request.adminPassword);
  if (!password.ok) throw new ProvisionError('secret', password.error);

  const accounts = await stageCall('account', 'invalid-account', () =>
    deps.listAccounts(accessToken),
  );
  if (!accounts.some((account) => account.id === request.accountId)) {
    throw new ProvisionError('account', 'invalid-account');
  }

  try {
    await verifyArtifact(deps.artifact);
  } catch {
    throw new ProvisionError('worker', 'worker-upload-failed');
  }

  const kv = await stageCall('kv', 'kv-failed', () =>
    deps.findOrCreateKvNamespace(accessToken, request.accountId, worker.value),
  );
  await stageCall('worker', 'worker-upload-failed', () =>
    deps.uploadWorkerModule(
      accessToken,
      request.accountId,
      worker.value,
      kv.id,
      deps.artifact.source,
      request.adminPassword,
    ),
  );

  const subdomain = await stageCall('subdomain', 'subdomain-failed', () =>
    deps.ensureAccountSubdomain(accessToken, request.accountId, worker.value),
  );
  await stageCall('subdomain', 'subdomain-failed', () =>
    deps.enableScriptSubdomain(accessToken, request.accountId, worker.value),
  );

  const workerUrl = `https://${worker.value}.${subdomain}.workers.dev`;
  const deadline = deps.now() + 30_000;
  while (deps.now() < deadline) {
    try {
      const health = await deps.fetchHealth(workerUrl);
      if (health.ok && health.version === deps.artifact.version) {
        return {
          ok: true,
          workerUrl,
          workerName: worker.value,
          version: deps.artifact.version,
        };
      }
    } catch {
      // workers.dev may need a few seconds to become reachable after the upload.
    }
    const remaining = deadline - deps.now();
    if (remaining <= 0) break;
    await deps.sleep(Math.min(1000, remaining));
  }
  throw new ProvisionError('health', 'health-failed');
}
