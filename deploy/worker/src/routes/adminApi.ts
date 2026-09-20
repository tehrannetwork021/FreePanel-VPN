import type { Env } from '../config/model';
import { loadProtocolConfig } from '../config/store';
import { ensureInstallationState } from '../db/migrations';
import { listAudit, listLoginEvents, writeAudit, type AuditDetail } from '../db/audit';
import { listAggregateUsage, listUserUsage, readOverviewMetrics } from '../db/usage';
import {
  createUser,
  deleteUser,
  deriveUserAccessSecrets,
  getUser,
  listUsers,
  rotateCredentialSecrets,
  rotateSubscriptionSecret,
  updateUser,
  UserRepositoryError,
  type UpdateUserInput,
  type UserRecord,
} from '../db/users';
import { authenticateAdminRequest, requireCsrf } from '../security/session';

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
    },
  });

const USER_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function isAdminApiPath(pathname: string): boolean {
  return (
    pathname === '/api/overview' ||
    pathname === '/api/users' ||
    pathname.startsWith('/api/users/') ||
    pathname === '/api/usage' ||
    pathname === '/api/audit' ||
    pathname === '/api/security/logins'
  );
}

async function parseJsonObject(request: Request): Promise<Record<string, unknown>> {
  const type = request.headers.get('content-type') ?? '';
  if (!type.toLowerCase().includes('application/json'))
    throw new UserRepositoryError('invalid-json');
  try {
    const value = await request.json();
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('not-object');
    return value as Record<string, unknown>;
  } catch {
    throw new UserRepositoryError('invalid-json');
  }
}

function auditDetail(before: UserRecord, after: UserRecord): AuditDetail {
  const fields: string[] = [];
  for (const key of [
    'name',
    'enabled',
    'quotaBytes',
    'dailyQuotaBytes',
    'expiresAt',
    'allowVless',
    'allowTrojan',
    'allowXhttp',
    'notes',
  ] as const) {
    if (before[key] !== after[key]) fields.push(key);
  }
  const detail: AuditDetail = { changedFields: fields };
  if (before.quotaBytes !== after.quotaBytes) {
    detail.quotaBytes = { before: before.quotaBytes, after: after.quotaBytes };
  }
  if (before.dailyQuotaBytes !== after.dailyQuotaBytes) {
    detail.dailyQuotaBytes = { before: before.dailyQuotaBytes, after: after.dailyQuotaBytes };
  }
  if (before.expiresAt !== after.expiresAt) {
    detail.expiresAt = { before: before.expiresAt, after: after.expiresAt };
  }
  if (before.enabled !== after.enabled) {
    detail.enabled = { before: before.enabled, after: after.enabled };
  }
  return detail;
}

function updateAction(before: UserRecord, after: UserRecord, detail: AuditDetail): string {
  if (detail.changedFields?.length === 1 && detail.changedFields[0] === 'enabled') {
    return after.enabled ? 'user.resume' : 'user.pause';
  }
  return 'user.update';
}

function errorResponse(error: unknown): Response {
  if (error instanceof UserRepositoryError) {
    if (error.code === 'not-found') return json({ ok: false, error: 'not-found' }, 404);
    if (error.code === 'version-conflict') return json({ ok: false, error: error.code }, 409);
    return json({ ok: false, error: error.code }, 400);
  }
  return json({ ok: false, error: 'internal-error' }, 500);
}

export async function handleAdminApi(
  request: Request,
  env: Env,
  now = Date.now(),
): Promise<Response | null> {
  const url = new URL(request.url);
  if (!isAdminApiPath(url.pathname)) return null;
  const session = await authenticateAdminRequest(request, env.DB, now);
  if (!session) return json({ ok: false, error: 'unauthorized' }, 401);
  if (request.method !== 'GET' && !(await requireCsrf(request, session))) {
    return json({ ok: false, error: 'forbidden' }, 403);
  }

  try {
    if (url.pathname === '/api/overview') {
      if (request.method !== 'GET') return json({ ok: false, error: 'method-not-allowed' }, 405);
      const [metrics, users] = await Promise.all([
        readOverviewMetrics(env.DB, now),
        listUsers(env.DB),
      ]);
      return json({
        ok: true,
        ...metrics,
        users: { total: users.length, enabled: metrics.enabledUsers },
      });
    }
    if (url.pathname === '/api/usage') {
      if (request.method !== 'GET') return json({ ok: false, error: 'method-not-allowed' }, 405);
      const days = Number(url.searchParams.get('days') ?? 14);
      return json({ ok: true, usage: await listAggregateUsage(env.DB, days, now) });
    }

    if (url.pathname === '/api/audit') {
      if (request.method !== 'GET') return json({ ok: false, error: 'method-not-allowed' }, 405);
      const limit = Number(url.searchParams.get('limit') ?? 50);
      return json({ ok: true, entries: await listAudit(env.DB, limit) });
    }
    if (url.pathname === '/api/security/logins') {
      if (request.method !== 'GET') return json({ ok: false, error: 'method-not-allowed' }, 405);
      const limit = Number(url.searchParams.get('limit') ?? 50);
      return json({ ok: true, events: await listLoginEvents(env.DB, limit) });
    }

    if (url.pathname === '/api/users') {
      if (request.method === 'GET') return json({ ok: true, users: await listUsers(env.DB) });
      if (request.method === 'POST') {
        const body = await parseJsonObject(request);
        const installation = await ensureInstallationState(env.DB);
        const user = await createUser(env.DB, body as never, now, installation.secretSeed);
        await writeAudit(env.DB, {
          ts: now,
          actor: 'admin',
          action: 'user.create',
          targetType: 'user',
          targetId: user.id,
          detail: {
            changedFields: [
              'name',
              'enabled',
              'quotaBytes',
              'dailyQuotaBytes',
              'expiresAt',
              'allowVless',
              'allowTrojan',
              'allowXhttp',
              'notes',
            ],
          },
        });
        return json({ ok: true, user }, 201);
      }
      return json({ ok: false, error: 'method-not-allowed' }, 405);
    }

    const prefix = '/api/users/';
    if (url.pathname.startsWith(prefix)) {
      const parts = url.pathname.slice(prefix.length).split('/');
      const id = parts[0] ?? '';
      const action = parts[1] ?? '';
      if (!USER_ID.test(id) || parts.length > 2)
        return json({ ok: false, error: 'not-found' }, 404);

      if (action === 'usage') {
        if (request.method !== 'GET') return json({ ok: false, error: 'method-not-allowed' }, 405);
        if (!(await getUser(env.DB, id))) throw new UserRepositoryError('not-found');
        const days = Number(url.searchParams.get('days') ?? 14);
        return json({ ok: true, usage: await listUserUsage(env.DB, id, days, now) });
      }
      if (action === 'access') {
        if (request.method !== 'GET') return json({ ok: false, error: 'method-not-allowed' }, 405);
        const user = await getUser(env.DB, id);
        if (!user) throw new UserRepositoryError('not-found');
        const installation = await ensureInstallationState(env.DB);
        const secrets = await deriveUserAccessSecrets(env.DB, installation.secretSeed, id);
        if (!secrets) throw new UserRepositoryError('not-found');
        const config = await loadProtocolConfig(env);
        const subscriptionPath = config?.subscription.path ?? '/sub';
        const subscriptionUrl = `${url.origin}${subscriptionPath}/${secrets.subscriptionToken}`;
        return json({
          ok: true,
          access: {
            subscriptionUrl,
            subscriptionToken: secrets.subscriptionToken,
            qr: { kind: 'subscription-url', payload: subscriptionUrl },
            vless: { uuid: secrets.vlessUuid, version: secrets.vless },
            trojan: { password: secrets.trojanPassword, version: secrets.trojan },
            subscriptionVersion: secrets.subscription,
          },
        });
      }
      if (action === 'rotate-subscription') {
        if (request.method !== 'POST') return json({ ok: false, error: 'method-not-allowed' }, 405);
        if (!(await getUser(env.DB, id))) throw new UserRepositoryError('not-found');
        const installation = await ensureInstallationState(env.DB);
        await rotateSubscriptionSecret(env.DB, installation.secretSeed, id, now);
        await writeAudit(env.DB, {
          ts: now,
          actor: 'admin',
          action: 'user.rotate-subscription',
          targetType: 'user',
          targetId: id,
          detail: { changedFields: ['subscriptionVersion'] },
        });
        return json({ ok: true });
      }
      if (action === 'rotate-credentials') {
        if (request.method !== 'POST') return json({ ok: false, error: 'method-not-allowed' }, 405);
        if (!(await getUser(env.DB, id))) throw new UserRepositoryError('not-found');
        const body = await parseJsonObject(request);
        const protocol = body.protocol;
        if (protocol !== 'vless' && protocol !== 'trojan' && protocol !== 'all') {
          throw new UserRepositoryError('invalid-protocol');
        }
        if (Object.keys(body).some((key) => key !== 'protocol'))
          throw new UserRepositoryError('unknown-field');
        const installation = await ensureInstallationState(env.DB);
        await rotateCredentialSecrets(env.DB, installation.secretSeed, id, protocol);
        await writeAudit(env.DB, {
          ts: now,
          actor: 'admin',
          action: 'user.rotate-credentials',
          targetType: 'user',
          targetId: id,
          detail: { changedFields: [`credential:${protocol}`] },
        });
        return json({ ok: true });
      }
      if (action) return json({ ok: false, error: 'not-found' }, 404);
      if (request.method === 'GET') {
        const user = await getUser(env.DB, id);
        return user ? json({ ok: true, user }) : json({ ok: false, error: 'not-found' }, 404);
      }
      if (request.method === 'PATCH') {
        const body = await parseJsonObject(request);
        const version = body.version;
        if (!Number.isSafeInteger(version) || Number(version) < 1)
          throw new UserRepositoryError('invalid-version');
        const before = await getUser(env.DB, id);
        if (!before) throw new UserRepositoryError('not-found');
        const patch = { ...body };
        delete patch.version;
        const after = await updateUser(env.DB, id, patch as UpdateUserInput, Number(version), now);
        const detail = auditDetail(before, after);
        await writeAudit(env.DB, {
          ts: now,
          actor: 'admin',
          action: updateAction(before, after, detail),
          targetType: 'user',
          targetId: id,
          detail,
        });
        return json({ ok: true, user: after });
      }
      if (request.method === 'DELETE') {
        const before = await getUser(env.DB, id);
        if (!before) throw new UserRepositoryError('not-found');
        if (!(await deleteUser(env.DB, id))) throw new UserRepositoryError('not-found');
        await writeAudit(env.DB, {
          ts: now,
          actor: 'admin',
          action: 'user.delete',
          targetType: 'user',
          targetId: id,
          detail: { changedFields: [] },
        });
        return json({ ok: true });
      }
      return json({ ok: false, error: 'method-not-allowed' }, 405);
    }
    return null;
  } catch (error) {
    return errorResponse(error);
  }
}
