import type { CloudflareAccountView } from '@tehrannetwork/shared';

const API_ROOT = 'https://api.cloudflare.com/client/v4';

type CfEnvelope<T> = {
  success: boolean;
  result: T;
  result_info?: { page?: number; total_pages?: number };
  errors?: Array<{ code?: number }>;
};

export class CloudflareApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code?: number,
  ) {
    super(status === 403 ? 'insufficient-scope' : 'cloudflare-api-failed');
    this.name = 'CloudflareApiError';
  }
}

async function cfRequest<T>(
  token: string,
  path: string,
  init: RequestInit = {},
): Promise<{ result: T; resultInfo?: CfEnvelope<T>['result_info'] }> {
  const headers = new Headers(init.headers);
  headers.set('authorization', `Bearer ${token}`);
  const response = await fetch(`${API_ROOT}${path}`, { ...init, headers });
  let body: CfEnvelope<T> | undefined;
  try {
    body = (await response.json()) as CfEnvelope<T>;
  } catch {
    body = undefined;
  }
  if (!response.ok || !body?.success) {
    throw new CloudflareApiError(response.status, body?.errors?.[0]?.code);
  }
  return { result: body.result, resultInfo: body.result_info };
}

export async function listAccounts(token: string): Promise<CloudflareAccountView[]> {
  const accounts: CloudflareAccountView[] = [];
  let page = 1;
  let totalPages = 1;
  do {
    const { result, resultInfo } = await cfRequest<CloudflareAccountView[]>(
      token,
      `/accounts?per_page=50&page=${page}`,
    );
    accounts.push(...result.map(({ id, name }) => ({ id, name })));
    totalPages = resultInfo?.total_pages ?? page;
    page += 1;
  } while (page <= totalPages);
  return accounts;
}

type KvNamespace = { id: string; title: string };

export async function findOrCreateKvNamespace(
  token: string,
  accountId: string,
  workerName: string,
): Promise<KvNamespace> {
  const title = `${workerName}-config`;
  let page = 1;
  let totalPages = 1;
  do {
    const { result, resultInfo } = await cfRequest<KvNamespace[]>(
      token,
      `/accounts/${encodeURIComponent(accountId)}/storage/kv/namespaces?per_page=100&page=${page}`,
    );
    const existing = result.find((namespace) => namespace.title === title);
    if (existing) return existing;
    totalPages = resultInfo?.total_pages ?? page;
    page += 1;
  } while (page <= totalPages);

  const { result } = await cfRequest<KvNamespace>(
    token,
    `/accounts/${encodeURIComponent(accountId)}/storage/kv/namespaces`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title }),
    },
  );
  return result;
}

export async function uploadWorkerModule(
  token: string,
  accountId: string,
  workerName: string,
  namespaceId: string,
  source: string,
): Promise<void> {
  const metadata = {
    main_module: 'worker.mjs',
    compatibility_date: '2026-09-19',
    bindings: [{ type: 'kv_namespace', name: 'C', namespace_id: namespaceId }],
  };
  const form = new FormData();
  form.set('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.set(
    'worker.mjs',
    new Blob([source], { type: 'application/javascript+module' }),
    'worker.mjs',
  );
  await cfRequest(
    token,
    `/accounts/${encodeURIComponent(accountId)}/workers/scripts/${encodeURIComponent(workerName)}`,
    { method: 'PUT', body: form },
  );
}

export async function putAdminSecret(
  token: string,
  accountId: string,
  workerName: string,
  adminPassword: string,
): Promise<void> {
  await cfRequest(
    token,
    `/accounts/${encodeURIComponent(accountId)}/workers/scripts/${encodeURIComponent(workerName)}/secrets`,
    {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'ADMIN_PASSWORD',
        text: adminPassword,
        type: 'secret_text',
      }),
    },
  );
}

function randomHex(bytes: number): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)), (value) =>
    value.toString(16).padStart(2, '0'),
  ).join('');
}

export async function ensureAccountSubdomain(
  token: string,
  accountId: string,
  workerName: string,
): Promise<string> {
  const basePath = `/accounts/${encodeURIComponent(accountId)}/workers/subdomain`;
  try {
    const { result } = await cfRequest<{ subdomain: string }>(token, basePath);
    if (result.subdomain) return result.subdomain;
  } catch (error) {
    if (!(error instanceof CloudflareApiError) || error.status !== 404) throw error;
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const candidate = `tn-${workerName.slice(0, 30)}-${randomHex(3)}`;
    try {
      const { result } = await cfRequest<{ subdomain: string }>(token, basePath, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ subdomain: candidate }),
      });
      return result.subdomain || candidate;
    } catch (error) {
      const collision =
        error instanceof CloudflareApiError && (error.status === 400 || error.status === 409);
      if (!collision || attempt === 2) throw error;
    }
  }
  throw new Error('subdomain-failed');
}

export async function enableScriptSubdomain(
  token: string,
  accountId: string,
  workerName: string,
): Promise<void> {
  await cfRequest(
    token,
    `/accounts/${encodeURIComponent(accountId)}/workers/scripts/${encodeURIComponent(workerName)}/subdomain`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ enabled: true, previews_enabled: false }),
    },
  );
}
