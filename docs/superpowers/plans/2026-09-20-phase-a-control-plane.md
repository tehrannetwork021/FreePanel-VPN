# Phase A — Cloudflare-Only Control Plane Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the current single-owner Worker into a D1-backed, multi-user Cloudflare Free control plane with secure admin sessions, private per-user subscriptions, quota/expiry enforcement, audited CRUD, usage accounting, and a production dashboard shell without changing the no-terminal installer promise.

**Architecture:** Keep KV `C` as the low-write protocol/global config cache and add D1 binding `DB` as authoritative structured state. The installer creates/reuses D1 and atomically uploads KV + D1 + `ADMIN_PASSWORD` + a non-secret `INSTALL_GENERATION`; the Worker bootstraps versioned SQL migrations, creates one persistent 32-byte installation seed inside D1, synchronizes the selected admin password exactly once per install generation, derives per-user secrets from that persistent seed, indexes only lookup hashes, and keeps legacy owner credentials working during Phase A.

**Tech Stack:** TypeScript 5.9, Cloudflare Workers/`cloudflare:sockets`, Workers KV, Cloudflare D1/SQLite, Web Crypto, React 19 + Vite 8, Vitest 5, Playwright, Wrangler 4.135, pnpm 10.15.1.

**Spec:** `docs/superpowers/specs/2026-09-20-cloudflare-only-complete-panel-design.md`

## Global Constraints

- Normal users install on Cloudflare Free through the hosted installer; no VPS, Docker, paid domain, CLI, Wrangler, Git, or GitHub connection.
- `workers.dev` remains sufficient; custom-domain-only behavior cannot become a Phase A dependency.
- Installer API token remains request-memory-only and must never be persisted or logged.
- D1 is authoritative for users, sessions, quota/expiry, usage and audit; KV remains low-write config/cache/feature state.
- Do not write D1 or KV per packet/WebSocket message; accounting uses coarse in-memory buckets.
- Preserve working VLESS-WS, Trojan-WS and VLESS-XHTTP stream-one behavior, including legacy owner configs.
- Do not claim native VLESS/Trojan UDP or any unverified transport.
- Persian/English and RTL/LTR remain first-class; normal UI must work on desktop and mobile.
- Only verified items are checked in `AGENTS.md`; every code task follows red-green TDD and ends in a focused commit.
- Before every task commit, append the exact verification commands/results to `AGENTS.md`, check only what that task actually proved, and include `AGENTS.md` in the same commit.
## File Structure

- `deploy/worker/migrations/0001_control_plane.sql` — initial D1 schema and indexes.
- `deploy/worker/src/db/migrations.ts` — idempotent migration runner with isolate-level memoization.
- `deploy/worker/src/db/users.ts` — user CRUD, access-state lookup, credential/token index rows.
- `deploy/worker/src/db/auth.ts` — admin credential bootstrap, sessions and CSRF persistence.
- `deploy/worker/src/db/audit.ts` — redacted audit/login-event writes and bounded reads.
- `deploy/worker/src/db/usage.ts` — usage bucket writes and quota-state reads.
- `deploy/worker/src/security/derivedSecrets.ts` — HMAC-derived subscription/VLESS/Trojan secrets and lookup hashes.
- `deploy/worker/src/security/session.ts` — cookies, PBKDF2 verification, CSRF checks and request authentication.
- `deploy/worker/src/routes/adminApi.ts` — authenticated `/api/*` control-plane routes.
- `deploy/worker/src/routes/subscription.ts` — legacy plus per-user subscription resolution.
- `deploy/worker/src/protocols/{vless,trojan}.ts` — parse presented credentials separately from authorization.
- `deploy/worker/src/transport/{websocket,xhttp}.ts` — async first-packet auth plus accounting hooks.
- `apps/installer-worker/src/{cloudflare,provision}.ts` — D1 create/reuse and atomic D1/install-generation bindings.
- `apps/panel/src/api/client.ts` — session/CSRF-aware API client.
- `apps/panel/src/pages/{OverviewPage,UsersPage}.tsx` — real dashboard foundation and user management.
- `scripts/build-panel-assets.mjs` + `deploy/worker/src/generated/panelAssets.ts` — build-time embedded SPA assets; no runtime CDN.
- Existing tests stay beside each module; new cross-cutting browser/protocol tests live under `tests/e2e` and `deploy/worker/test`.

## Review Focus

1. Installer retry after KV or D1 exists but Worker upload previously failed must reuse resources and never create duplicates — Task 2 pins this.
2. Expired/disabled/over-quota users must fail both subscription access and tunnel authentication while legacy owner credentials remain valid — Tasks 5–7 pin this.
3. Two concurrent sessions/connections must not bypass password-version/session invalidation or quota accounting silently — Tasks 3 and 7 pin this.
4. CSRF/header/cookie mismatches and stale sessions must return 401/403 without leaking whether an admin credential or user token exists — Task 3 pins this.
5. Malformed IDs, negative quota values, oversized notes/names and token/path probing must be bounded and return sanitized 4xx responses — Tasks 4 and 5 pin this.

---
### Task 1: D1 schema and migration engine

**Files:**
- Create: `deploy/worker/migrations/0001_control_plane.sql`
- Create: `deploy/worker/src/db/migrations.ts`
- Create: `deploy/worker/src/db/migrations.test.ts`
- Create: `deploy/worker/src/types/sql.d.ts`
- Modify: `deploy/worker/src/config/model.ts:1-25`
- Modify: `deploy/worker/wrangler.jsonc:1-18`
- Modify: `scripts/build-edge-worker-artifact.mjs` and `scripts/build-edge-worker-artifact.test.ts`
- Test: `deploy/worker/src/db/migrations.test.ts`

**Interfaces:**
- Consumes: Cloudflare `D1Database` binding as `env.DB`.
- Produces: `CONTROL_PLANE_SCHEMA_VERSION = 1`, `ensureControlPlaneSchema(db: D1Database): Promise<number>`, `ensureInstallationState(db,...): Promise<InstallationState>`, and `Env.DB: D1Database` / `Env.INSTALL_GENERATION: string`.

- [ ] **Step 1: Write the failing migration contract tests**

```ts
it('applies migration 1 once and reports schema version 1', async () => {
  const db = makeD1Mock();
  await expect(ensureControlPlaneSchema(db)).resolves.toBe(1);
  await expect(ensureControlPlaneSchema(db)).resolves.toBe(1);
  expect(db.appliedMigrationVersions()).toEqual([1]);
});

it('rejects a database whose recorded version is newer than this Worker', async () => {
  const db = makeD1Mock({ schemaVersion: 99 });
  await expect(ensureControlPlaneSchema(db)).rejects.toThrow('schema-too-new');
});

it('converges concurrent installation-state initialization on one persistent seed', async () => {
  const db = makeD1Mock();
  const [a, b] = await Promise.all([
    ensureInstallationState(db, () => 1_000, () => fixedBytes(0x11)),
    ensureInstallationState(db, () => 1_001, () => fixedBytes(0x22)),
  ]);
  expect(a.secretSeed).toBe(b.secretSeed);
  expect(base64urlDecode(a.secretSeed)).toHaveLength(32);
});

it('fails closed on a mismatched migration checksum or corrupted installation seed', async () => {
  await expect(ensureControlPlaneSchema(makeD1Mock({ migration1Checksum: 'wrong' })))
    .rejects.toThrow('migration-checksum-mismatch');
  await expect(ensureInstallationState(makeD1Mock({ secretSeed: 'broken' })))
    .rejects.toThrow('invalid-installation-state');
});
```
- [ ] **Step 2: Run the focused test and prove RED**

Run: `pnpm --dir deploy/worker test -- src/db/migrations.test.ts`

Expected: FAIL because `ensureControlPlaneSchema` and the migration do not exist.

- [ ] **Step 3: Add migration 0001 with the complete Phase A tables**

```sql
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY, name TEXT NOT NULL, checksum TEXT NOT NULL, applied_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS installation_state (
  id INTEGER PRIMARY KEY CHECK(id = 1), secret_seed TEXT NOT NULL,
  admin_bootstrap_generation TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS admin_credentials (
  id INTEGER PRIMARY KEY CHECK(id = 1), password_salt TEXT NOT NULL, password_hash TEXT NOT NULL,
  iterations INTEGER NOT NULL, password_version INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  id_hash TEXT PRIMARY KEY, csrf_hash TEXT NOT NULL, password_version INTEGER NOT NULL,
  created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, last_seen_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1,
  quota_bytes INTEGER, daily_quota_bytes INTEGER, expires_at INTEGER, total_used_bytes INTEGER NOT NULL DEFAULT 0,
  allow_vless INTEGER NOT NULL DEFAULT 1, allow_trojan INTEGER NOT NULL DEFAULT 1, allow_xhttp INTEGER NOT NULL DEFAULT 1,
  notes TEXT NOT NULL DEFAULT '', last_subscription_at INTEGER, last_tunnel_at INTEGER,
  version INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
```
```sql
CREATE TABLE IF NOT EXISTS user_credentials (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  protocol TEXT NOT NULL CHECK(protocol IN ('vless','trojan')),
  secret_version INTEGER NOT NULL DEFAULT 1, lookup_hash TEXT NOT NULL UNIQUE, enabled INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY(user_id, protocol)
);
CREATE TABLE IF NOT EXISTS subscription_tokens (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  token_version INTEGER NOT NULL DEFAULT 1, lookup_hash TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL, rotated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS usage_daily (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, day_utc TEXT NOT NULL,
  upload_bytes INTEGER NOT NULL DEFAULT 0, download_bytes INTEGER NOT NULL DEFAULT 0,
  total_bytes INTEGER NOT NULL DEFAULT 0, connections INTEGER NOT NULL DEFAULT 0, updated_at INTEGER NOT NULL,
  PRIMARY KEY(user_id, day_utc)
);
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, actor TEXT NOT NULL,
  action TEXT NOT NULL, target_type TEXT NOT NULL, target_id TEXT, detail_json TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit_log(ts DESC);
CREATE TABLE IF NOT EXISTS login_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, success INTEGER NOT NULL,
  country TEXT, colo TEXT, user_agent_hash TEXT
);
CREATE INDEX IF NOT EXISTS idx_login_events_ts ON login_events(ts DESC);
CREATE TABLE IF NOT EXISTS login_throttle (
  key_hash TEXT PRIMARY KEY, window_start INTEGER NOT NULL, failures INTEGER NOT NULL
);
```
- [ ] **Step 4: Implement the migration runner and Env bindings**

```ts
export const CONTROL_PLANE_SCHEMA_VERSION = 1;
const ready = new WeakMap<D1Database, Promise<number>>();

export function ensureControlPlaneSchema(db: D1Database): Promise<number> {
  const existing = ready.get(db);
  if (existing) return existing;
  const pending = applyMigrations(db).catch((error) => {
    ready.delete(db);
    throw error;
  });
  ready.set(db, pending);
  return pending;
}
```

The runner must create `schema_migrations` first, reject `MAX(version) > 1`, execute migration 1 as one idempotent `db.exec()` batch, then `INSERT OR IGNORE` `{version:1,name:'0001_control_plane',checksum:<sha256>}` and verify the stored checksum; changing migration bytes without bumping the version fails with `migration-checksum-mismatch`. `ensureInstallationState` generates 32 random bytes with Web Crypto, base64url-encodes them, uses `INSERT OR IGNORE` for row `id=1`, then SELECTs the winning row so concurrent isolates converge on one persistent seed. Existing state is accepted only when the decoded seed is exactly 32 bytes; corruption fails closed. Add `DB: D1Database` and `INSTALL_GENERATION: string` to `Env`; add a local-placeholder D1 binding and install-generation var in `wrangler.jsonc`.

Import the canonical SQL file directly as text:

```ts
import migration001 from '../../migrations/0001_control_plane.sql';
```

Add `declare module '*.sql' { const text: string; export default text; }`, a Wrangler `Text` module rule for `**/*.sql`, and `loader: { '.sql': 'text' }` in `scripts/build-edge-worker-artifact.mjs` so both direct Wrangler deploys and the installer artifact bundle consume the same migration bytes.

- [ ] **Step 5: Verify migration behavior and SQL validity**

Run: `pnpm --dir deploy/worker test -- src/db/migrations.test.ts`

Run: `pnpm --dir deploy/worker typecheck`

Run a real local D1 application with Wrangler using a temporary persist directory; expected: migration applies once, second run is a no-op, and all tables/indexes exist.

- [ ] **Step 6: Commit**

```bash
git add deploy/worker/migrations deploy/worker/src/db deploy/worker/src/types/sql.d.ts deploy/worker/src/config/model.ts deploy/worker/wrangler.jsonc scripts/build-edge-worker-artifact* AGENTS.md
git commit -m "feat: add D1 control-plane schema"
```
### Task 2: One-click installer provisions D1 and an install generation

**Files:**
- Modify: `packages/shared/src/installer.ts:1-49`
- Modify: `apps/installer-worker/src/cloudflare.ts:1-187`
- Modify: `apps/installer-worker/src/cloudflare.test.ts:1-177`
- Modify: `apps/installer-worker/src/provision.ts:1-167`
- Modify: `apps/installer-worker/src/provision.test.ts:1-115`
- Modify: `apps/installer/src/App.tsx:1-338`
- Modify: `apps/installer/src/App.test.tsx`
- Modify: `README.md`, `docs/INSTALL_FA.md`, `docs/INSTALL_EN.md`, `scripts/release-install-contract.test.ts`

**Interfaces:**
- Produces: `findOrCreateD1Database(token, accountId, workerName): Promise<{uuid:string;name:string}>`.
- Changes: `uploadWorkerModule(..., namespaceId, databaseId, source, adminPassword, installGeneration)` binds `C`, `DB`, `ADMIN_PASSWORD`, `INSTALL_GENERATION` in one Worker version.
- Changes: `InstallStage` gains `d1`; `InstallErrorCode` gains `d1-failed`; `InstallResult` gains `adminUrl` and `schemaVersion` after health verification.

- [ ] **Step 1: Add failing Cloudflare API and provisioning tests**

```ts
it('reuses a deterministic D1 database and binds it atomically', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok([{ uuid: 'db-1', name: 'pvnetwork-client-control' }])));
  await expect(findOrCreateD1Database('token', 'acct', 'pvnetwork-client')).resolves.toMatchObject({ uuid: 'db-1' });
});

it('provisions account -> KV -> D1 -> Worker -> subdomain -> schema health', async () => {
  const events: string[] = [];
  const result = await provisionPanel(accessToken, request, makeDeps(events));
  expect(events).toEqual(['account','kv','d1','worker','subdomain','enable','health']);
  expect(result.schemaVersion).toBe(1);
});
```
- [ ] **Step 2: Prove RED**

Run: `pnpm test -- apps/installer-worker/src/cloudflare.test.ts apps/installer-worker/src/provision.test.ts apps/installer/src/App.test.tsx`

Expected: FAIL because D1 provisioning/stage/result fields do not exist.

- [ ] **Step 3: Implement deterministic D1 create/reuse**

```ts
type D1DatabaseView = { uuid: string; name: string };
export async function findOrCreateD1Database(token: string, accountId: string, workerName: string) {
  const name = `${workerName}-control`;
  const { result } = await cfRequest<D1DatabaseView[]>(
    token,
    `/accounts/${encodeURIComponent(accountId)}/d1/database?name=${encodeURIComponent(name)}&per_page=100`,
  );
  const existing = result.find((db) => db.name === name);
  if (existing) return existing;
  return (
    await cfRequest<D1DatabaseView>(token, `/accounts/${encodeURIComponent(accountId)}/d1/database`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name }),
    })
  ).result;
}
```

Use only official Cloudflare endpoints: list/create D1 at `/accounts/{account_id}/d1/database`; token requires `D1 Write`. Do not call the D1 HTTP query API for schema bootstrap — the deployed Worker migration runner owns schema versioning.

- [ ] **Step 4: Add atomic D1/install-generation Worker bindings**

Generate a fresh non-secret UUID in `provision.ts` through an injected `generateInstallGeneration()` dependency so tests are deterministic. The generation is bound as plain text and changes on every successful/retried install attempt; it exists only to make admin-password bootstrap run once for that deployed generation.
```ts
bindings: [
  { type: 'kv_namespace', name: 'C', namespace_id: namespaceId },
  { type: 'd1', name: 'DB', database_id: databaseId },
  { type: 'secret_text', name: 'ADMIN_PASSWORD', text: adminPassword },
  { type: 'plain_text', name: 'INSTALL_GENERATION', text: installGeneration },
]
```

Update `/health` in Task 1/Task 2 integration so installer success requires `{ok:true, version:<artifact>, schemaVersion:1, d1:true}`. A missing binding or migration failure must end as `health-failed`, never a false successful install.

- [ ] **Step 5: Update the Cloudflare token template and installer copy**

Add `{ key: 'd1', type: 'edit' }` to `apps/installer/src/App.tsx` permission template and assert it in `App.test.tsx` plus `scripts/release-install-contract.test.ts`. Document why D1 Write is required and keep token-memory wording unchanged.

- [ ] **Step 6: Pin the retry case from Review Focus**

Test two runs where run 1 creates KV+D1 then upload fails; run 2 must call `findOrCreateKvNamespace` and `findOrCreateD1Database`, receive the same IDs, upload once, and create no second resources.

- [ ] **Step 7: Verify**

Run: `pnpm test -- apps/installer-worker/src/cloudflare.test.ts apps/installer-worker/src/provision.test.ts apps/installer/src/App.test.tsx scripts/release-install-contract.test.ts`

Run: `pnpm --filter @tehrannetwork/installer-worker build`

Expected: tests PASS; Wrangler dry-run metadata contains both `kv_namespace:C` and `d1:DB`, with secrets absent from emitted source text/logs.

- [ ] **Step 8: Commit**

```bash
git add packages/shared apps/installer apps/installer-worker README.md docs scripts/release-install-contract.test.ts AGENTS.md
git commit -m "feat: provision D1 in one-click installer"
```
### Task 3: PBKDF2 admin auth, D1 sessions and CSRF

**Files:**
- Create: `deploy/worker/src/db/auth.ts`
- Create: `deploy/worker/src/db/auth.test.ts`
- Create: `deploy/worker/src/db/audit.ts`
- Create: `deploy/worker/src/security/session.ts`
- Create: `deploy/worker/src/security/session.test.ts`
- Create: `deploy/worker/src/routes/auth.ts`
- Create: `deploy/worker/src/routes/auth.test.ts`
- Modify: `deploy/worker/src/index.ts:1-92`
- Modify: `deploy/worker/src/panel.ts:1-157` only to retain a compatibility login handoff until the SPA replaces it in Task 8.

**Interfaces:**
- `ensureAdminCredential(db, configuredSecret, installGeneration, now): Promise<AdminCredential>` synchronizes D1 from `ADMIN_PASSWORD` exactly once when `installation_state.admin_bootstrap_generation !== INSTALL_GENERATION`.
- `verifyAdminCredential(db, candidate): Promise<AdminCredential | null>` verifies only the authoritative D1 hash after bootstrap, using PBKDF2-HMAC-SHA-256, 100,000 iterations.
- `createSession(db, passwordVersion, now): Promise<{sessionToken:string;csrfToken:string;expiresAt:number}>` with 12-hour absolute TTL.
- `authenticateAdminRequest(request, db, now): Promise<AdminSession | null>` hashes the cookie token before lookup.
- `requireCsrf(request, session): Promise<boolean>` requires header + cookie + D1-bound hash.
- `checkLoginThrottle(db, seed, request, now): Promise<{allowed:boolean;retryAfterSeconds:number}>` uses an HMAC of `CF-Connecting-IP` as a short-lived key; raw IP is never stored or logged.

- [ ] **Step 1: Write failing crypto/session tests**

```ts
it('stores only PBKDF2 material and a hashed session id', async () => {
  const db = makeD1Mock();
  const credential = await ensureAdminCredential(db, 'correct-horse', 'gen-1', 1_000);
  expect(credential.iterations).toBe(100_000);
  expect(JSON.stringify(db.rows())).not.toContain('correct-horse');
  const session = await createSession(db, credential.passwordVersion, 1_000);
  expect(JSON.stringify(db.rows())).not.toContain(session.sessionToken);
});

it('does not revert a UI password change in the same install generation but resets on a new install', async () => {
  await ensureAdminCredential(db, 'installer-one', 'gen-1', 1_000);
  await changeAdminPassword(db, 'installer-one', 'panel-changed', 2_000);
  await ensureAdminCredential(db, 'installer-one', 'gen-1', 3_000);
  await expect(verifyAdminCredential(db, 'panel-changed')).resolves.toBeTruthy();
  await ensureAdminCredential(db, 'installer-two', 'gen-2', 4_000);
  await expect(verifyAdminCredential(db, 'installer-two')).resolves.toBeTruthy();
  await expect(verifyAdminCredential(db, 'panel-changed')).resolves.toBeNull();
  expect(await countSessions(db)).toBe(0);
});
```
```ts
it('rejects stale session versions and CSRF mismatches without account-detail leaks', async () => {
  const session = await loginFixture();
  await bumpPasswordVersion();
  await expect(authenticateAdminRequest(session.request, db, now)).resolves.toBeNull();
  const response = await mutateWith(session.cookie, 'wrong-csrf');
  expect(response.status).toBe(403);
  expect(await response.text()).not.toMatch(/hash|salt|password|session/i);
});

it('throttles the ninth failed login in 15 minutes without storing the raw source IP', async () => {
  const request = requestFromIp('203.0.113.7');
  for (let i = 0; i < 8; i += 1) await recordFailedLogin(db, seed, request, 10_000 + i);
  await expect(checkLoginThrottle(db, seed, request, 20_000)).resolves.toMatchObject({ allowed: false });
  expect(JSON.stringify(db.rows())).not.toContain('203.0.113.7');
});
```

- [ ] **Step 2: Prove RED**

Run: `pnpm --dir deploy/worker test -- src/db/auth.test.ts src/security/session.test.ts src/routes/auth.test.ts`

Expected: FAIL because credential/session APIs do not exist.

- [ ] **Step 3: Implement PBKDF2 credential bootstrap and password change**

```ts
const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_HASH = 'SHA-256';

async function derivePasswordHash(password: string, salt: Uint8Array, iterations = PBKDF2_ITERATIONS) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: PBKDF2_HASH, salt, iterations }, key, 256,
  ));
}
```

`ensureAdminCredential` first calls `ensureInstallationState`. When the stored bootstrap generation differs from `env.INSTALL_GENERATION`, it PBKDF2-hashes the current `env.ADMIN_PASSWORD`, upserts the admin credential, increments `password_version` if a credential already exists, deletes all sessions, and updates `admin_bootstrap_generation` in the same D1 batch. When the generation already matches, it never compares or rewrites from `ADMIN_PASSWORD`; this prevents an in-panel password change from being reverted on the next request. Reinstalling with a fresh generation intentionally resets the admin password to the password the installer shows while preserving the D1 installation seed and every user secret version.

`changeAdminPassword` must require the current D1 password, write a new random salt/hash, increment `password_version`, and delete **all** sessions in the same D1 batch. The caller receives cleared auth cookies and must log in again.
- [ ] **Step 4: Implement session cookies and CSRF**

Use cookie names `tn_session` and `tn_csrf`. `tn_session` is `HttpOnly; Secure; SameSite=Strict; Path=/`; `tn_csrf` is `Secure; SameSite=Strict; Path=/` and readable by the SPA. Generate both values from 32 random bytes and store only SHA-256 hashes in D1. `createSession` deletes expired sessions in the same batch as the new insert. Do not update `last_seen_at` on every request; Phase A avoids a session-write-per-API-call pattern.

Routes:

```text
POST /api/auth/login          { password }
GET  /api/auth/session        -> { authenticated, expiresAt }
POST /api/auth/logout         CSRF required
POST /api/auth/password       { currentPassword, newPassword }, CSRF required
```

`POST /api/auth/login` calls `ensureAdminCredential` before verification so a manual deployment that has not been health-polled still performs the one-time generation sync. Login failures always return `{ok:false,error:'invalid-credentials'}`. Add `login_events` with success flag, `request.cf?.colo`, `CF-IPCountry`, and SHA-256(User-Agent); never record source IP or the candidate password. Before PBKDF2 work, apply an 8-failures/15-minute best-effort throttle keyed by `HMAC(installationSeed, 'login-ip:' + CF-Connecting-IP)` in `login_throttle`; return 429 with only a rounded `Retry-After`. Success deletes that key. A missing edge IP falls back to a single `unknown` bucket rather than trusting a client-supplied alternate header.

- [ ] **Step 5: Wire auth routes before admin APIs**

In `index.ts`, call `ensureControlPlaneSchema(env.DB)` and `ensureInstallationState(env.DB)` only for health/admin/subscription/tunnel paths that need D1. `/health` must also call `ensureAdminCredential(env.DB, env.ADMIN_PASSWORD, env.INSTALL_GENERATION, Date.now())` before returning schema 1, so installer success guarantees that the displayed password is authoritative for that install generation. Route `/api/auth/*` before generic admin APIs. Existing `/setup` stays as a temporary compatibility handoff and must delegate to the same D1 credential verifier rather than create a second auth mechanism.

- [ ] **Step 6: Benchmark the fixed PBKDF2 cost**

Run 20 successful + 20 failed password verifications in Workerd and record median/p95 wall time in the test log. The task is not complete unless the real Cloudflare field gate in Task 9 also accepts login under the Free 10 ms CPU request budget; if it does not, reduce the constant in a measured follow-up commit rather than silently disabling PBKDF2.

- [ ] **Step 7: Verify and commit**

Run: `pnpm --dir deploy/worker test -- src/db/auth.test.ts src/security/session.test.ts src/routes/auth.test.ts`

Run: `pnpm --dir deploy/worker typecheck`

```bash
git add deploy/worker/src/db deploy/worker/src/security deploy/worker/src/routes/auth* deploy/worker/src/index.ts deploy/worker/src/panel.ts AGENTS.md
git commit -m "feat: add secure admin sessions"
```
### Task 4: User repository, validated admin API and audit trail

**Files:**
- Create: `deploy/worker/src/db/users.ts`
- Create: `deploy/worker/src/db/users.test.ts`
- Create: `deploy/worker/src/routes/adminApi.ts`
- Create: `deploy/worker/src/routes/adminApi.test.ts`
- Modify: `deploy/worker/src/db/audit.ts`
- Modify: `deploy/worker/src/index.ts`
- Modify: `packages/shared/src/index.ts` with JSON DTO types shared by panel tests/build only; Worker must not gain a workspace runtime dependency.

**Interfaces:**
- `UserRecord`: `{id,name,enabled,quotaBytes,dailyQuotaBytes,expiresAt,totalUsedBytes,allowVless,allowTrojan,allowXhttp,notes,lastSubscriptionAt,lastTunnelAt,version,createdAt,updatedAt}`.
- `createUser(db,input,now): Promise<UserRecord>`, `listUsers(db): Promise<UserRecord[]>`, `getUser(db,id)`, `updateUser(db,id,input,expectedVersion,now)`, `deleteUser(db,id)`.
- `writeAudit(db,{ts,actor,action,targetType,targetId,detail})`; `detail` accepts only a known redacted object, never arbitrary request bodies.

- [ ] **Step 1: Write failing repository validation/version tests**

```ts
it.each([
  [{ name: '' }, 'invalid-name'],
  [{ name: 'x'.repeat(81) }, 'invalid-name'],
  [{ name: 'ok', quotaBytes: -1 }, 'invalid-quota'],
  [{ name: 'ok', dailyQuotaBytes: Number.MAX_SAFE_INTEGER + 1 }, 'invalid-quota'],
  [{ name: 'ok', notes: 'x'.repeat(501) }, 'invalid-notes'],
])('rejects bounded invalid input', async (input, code) => {
  await expect(createUser(db, input as never, now)).rejects.toMatchObject({ code });
});
```
```ts
it('uses optimistic versioning so stale concurrent edits fail with 409', async () => {
  const user = await createUser(db, { name: 'A' }, now);
  await updateUser(db, user.id, { name: 'B' }, user.version, now + 1);
  await expect(updateUser(db, user.id, { name: 'C' }, user.version, now + 2))
    .rejects.toMatchObject({ code: 'version-conflict' });
});
```

- [ ] **Step 2: Prove RED**

Run: `pnpm --dir deploy/worker test -- src/db/users.test.ts src/routes/adminApi.test.ts`

Expected: FAIL because user repository/API does not exist.

- [ ] **Step 3: Implement bounded CRUD with optimistic updates**

Validation constants are fixed in code: name `1..80` Unicode characters after trim; notes `0..500`; quota fields `null` or safe integer `0..9_007_199_254_740_991`; expiry `null` or positive integer epoch milliseconds. Generate IDs with `crypto.randomUUID()` and use `UPDATE ... WHERE id=? AND version=?` with `version=version+1`.

- [ ] **Step 4: Expose authenticated REST endpoints**

```text
GET    /api/overview
GET    /api/users
POST   /api/users
GET    /api/users/:id
PATCH  /api/users/:id
DELETE /api/users/:id
GET    /api/audit?limit=50
GET    /api/security/logins?limit=50
```

All non-GET routes require valid admin session + CSRF. Audit and login-event reads clamp `limit` to `1..100`. Unknown UUIDs return generic 404. Stale `version` returns 409. Never echo raw SQL/D1 errors. API serializers expose `lastSubscriptionAt` and `lastTunnelAt` but never the installation seed, lookup hashes or raw credential material.
- [ ] **Step 5: Audit every mutation with redacted details**

Use stable action names: `user.create`, `user.update`, `user.delete`, `user.pause`, `user.resume`. Audit details may include changed field names and numeric before/after quota/expiry values; they must not include derived secrets, subscription tokens, protocol credentials, admin password, session cookie, CSRF token, installation seed or Cloudflare token. `writeAudit` retains at most the newest 5,000 audit rows; login-event writes retain at most the newest 1,000 rows. Retention cleanup is part of the same D1 batch as the new insert so growth is bounded without a cron/VPS dependency.

```ts
expect(JSON.stringify(await listAudit(db, 100))).not.toMatch(
  /ADMIN_PASSWORD|secret_seed|tn_session|tn_csrf|subscriptionToken|trojanPassword/i,
);
```

- [ ] **Step 6: Pin malformed-input behavior from Review Focus**

Test invalid JSON, non-UUID route IDs, 81-character names, 501-character notes, negative quota, unsafe integer quota, `NaN`-like string values, stale versions, and unknown JSON fields. Expected: 400/404/409 with `{ok:false,error:<local-code>}` and no raw exception text.

- [ ] **Step 7: Verify and commit**

Run: `pnpm --dir deploy/worker test -- src/db/users.test.ts src/routes/adminApi.test.ts`

Run: `pnpm --dir deploy/worker typecheck`

```bash
git add deploy/worker/src/db/users* deploy/worker/src/db/audit* deploy/worker/src/routes/adminApi* deploy/worker/src/index.ts packages/shared/src AGENTS.md
git commit -m "feat: add audited multi-user control API"
```
### Task 5: Derived per-user secrets and private subscriptions

**Files:**
- Create: `deploy/worker/src/security/derivedSecrets.ts`
- Create: `deploy/worker/src/security/derivedSecrets.test.ts`
- Modify: `deploy/worker/src/db/users.ts`
- Modify: `deploy/worker/src/routes/subscription.ts:1-32`
- Modify: `deploy/worker/src/routes/subscription.test.ts`
- Modify: `deploy/worker/src/subscription/links.ts`
- Modify: `deploy/worker/src/subscription/subscription.test.ts`
- Modify: `deploy/worker/src/routes/adminApi.ts`

**Interfaces:**
- `deriveSubscriptionToken(seed,userId,version): Promise<string>`; `deriveVlessUuid(...)`; `deriveTrojanPassword(...)`.
- `subscriptionLookupHash(token): Promise<string>` and protocol-specific `credentialLookupHash` functions.
- `createUserSecrets(db, seed, userId, now)` writes only version numbers + lookup hashes; raw per-user tokens/passwords are reproducible from HMAC while the persistent installation seed remains internal to D1 and is never returned by an API.
- `resolveSubscriptionPrincipal(db, token, now): Promise<UserRecord | null>` uses the token hash index and current quota/expiry state.
- `buildUserProtocolConfig(globalConfig,user,secrets): ProtocolConfig` reuses global paths/XHTTP mode while replacing owner credentials and protocol enable flags with the selected user's derived values.

- [ ] **Step 1: Write failing deterministic-secret tests**

```ts
it('derives stable purpose-separated secrets without persisting plaintext', async () => {
  const seed = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
  const sub = await deriveSubscriptionToken(seed, 'user-1', 1);
  const vless = await deriveVlessUuid(seed, 'user-1', 1);
  const trojan = await deriveTrojanPassword(seed, 'user-1', 1);
  expect(new Set([sub, vless, trojan]).size).toBe(3);
  expect(await deriveSubscriptionToken(seed, 'user-1', 1)).toBe(sub);
  expect(await deriveSubscriptionToken(seed, 'user-1', 2)).not.toBe(sub);
});
```
- [ ] **Step 2: Prove RED**

Run: `pnpm --dir deploy/worker test -- src/security/derivedSecrets.test.ts src/routes/subscription.test.ts src/subscription/subscription.test.ts`

Expected: FAIL because derived secrets and per-user token resolution do not exist.

- [ ] **Step 3: Implement HMAC purpose separation**

```ts
async function deriveBytes(seed: string, purpose: string, userId: string, version: number) {
  const raw = base64urlDecode(seed);
  if (raw.byteLength !== 32) throw new Error('invalid-installation-seed');
  const key = await crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const msg = new TextEncoder().encode(`tn:v1:${purpose}:${userId}:${version}`);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, msg));
}
```

Use purpose strings `subscription`, `vless`, and `trojan`. Subscription token = first 24 bytes base64url. Trojan password = first 24 bytes base64url. VLESS UUID = first 16 bytes with RFC 4122 v4/variant bits forced before formatting. Lookup hashes are SHA-256 hex over the client-presented credential form.

- [ ] **Step 4: Create/rotate index rows atomically**

On user creation, derive version 1 secrets and batch-insert `users`, `subscription_tokens`, and both `user_credentials` rows. Add admin actions:

```text
POST /api/users/:id/rotate-subscription
POST /api/users/:id/rotate-credentials   { protocol: "vless" | "trojan" | "all" }
GET  /api/users/:id/access              -> subscription URL + QR payload metadata, never the installation seed or admin secret
```

Rotation increments only the requested version and replaces its lookup hash; the old token/credential must fail immediately on the next lookup.
- [ ] **Step 5: Extend subscription routing without breaking the owner link**

`handleSubscriptionRoute` now receives `env`. For `/sub/<token>`:

1. constant-time check against the existing legacy `config.subscription.token`; if it matches, render the current owner/global subscription unchanged;
2. otherwise SHA-256 the supplied token, resolve `subscription_tokens.lookup_hash`, load the user, and deny with generic 404 if disabled, expired, over total quota, or over daily quota;
3. load the persistent installation seed from D1, derive that user's VLESS/Trojan secret from seed + stored version, call `buildUserProtocolConfig`, and render through the existing `renderSubscription` pipeline with user protocol toggles applied;
4. update `users.last_subscription_at` only when it is null or older than one hour, preventing a D1 write on every client refresh.

No token goes into logs, audit detail, cache keys visible to operators, or error bodies.

- [ ] **Step 6: Pin old-token and probing behavior**

```ts
expect((await fetchSub(rotatedOldToken)).status).toBe(404);
expect((await fetchSub(disabledUserToken)).status).toBe(404);
expect((await fetchSub(expiredUserToken)).status).toBe(404);
expect((await fetchSub('a/'.repeat(200))).status).toBe(404);
expect((await fetchSub(legacyOwnerToken)).status).toBe(200);
```

Cap the decoded path token at 128 characters before hashing; reject embedded `/`, invalid percent encoding and empty tokens without D1 lookup.

- [ ] **Step 7: Verify and commit**

Run: `pnpm --dir deploy/worker test -- src/security/derivedSecrets.test.ts src/routes/subscription.test.ts src/subscription/subscription.test.ts src/routes/adminApi.test.ts`

```bash
git add deploy/worker/src/security/derivedSecrets* deploy/worker/src/db/users.ts deploy/worker/src/routes/subscription* deploy/worker/src/routes/adminApi.ts deploy/worker/src/subscription AGENTS.md
git commit -m "feat: add private per-user subscriptions"
```
### Task 6: Per-user tunnel authentication with legacy-owner fallback

**Files:**
- Create: `deploy/worker/src/security/tunnelAuth.ts`
- Create: `deploy/worker/src/security/tunnelAuth.test.ts`
- Modify: `deploy/worker/src/core/uuid.ts`
- Modify: `deploy/worker/src/protocols/vless.ts` and `vless.test.ts`
- Modify: `deploy/worker/src/protocols/trojan.ts` and `trojan.test.ts`
- Modify: `deploy/worker/src/transport/websocket.ts` and `websocket.test.ts`
- Modify: `deploy/worker/src/transport/xhttp.ts` and `xhttp.test.ts`
- Modify: `deploy/worker/src/routes/ws.ts` and `ws.test.ts`
- Modify: `deploy/worker/src/routes/xhttp.ts` and `xhttp.test.ts`
- Modify: `deploy/worker/src/db/users.ts`

**Interfaces:**
- `TunnelChannel = 'vless-ws' | 'trojan-ws' | 'vless-xhttp'`; `TunnelPrincipal = { kind:'user'; userId:string; channel:TunnelChannel } | { kind:'legacy'; channel:TunnelChannel }`.
- `TunnelAuthResult = {kind:'authorized';principal:TunnelPrincipal} | {kind:'not-found'} | {kind:'denied-user'}`.
- `parseVlessCandidate(input)` and `parseTrojanCandidate(input)` expose presented credential bytes plus destination/payload without authorizing them.
- `resolveTunnelPrincipal(db, channel, presentedCredential, now): Promise<TunnelAuthResult>` hashes the wire credential, maps the channel to the VLESS/Trojan credential row, and enforces the matching `allow_vless` / `allow_trojan` / `allow_xhttp` flag plus quota/expiry state.
- `FirstPacketParser` becomes async-capable: `(input) => ParseResult<ParsedFirstPacket> | Promise<ParseResult<ParsedFirstPacket>>`.

- [ ] **Step 1: Write failing candidate-parser and async-auth tests**

```ts
it('does not connect TCP until async per-user authorization succeeds', async () => {
  const auth = deferred<ParseResult<ParsedFirstPacket>>();
  const connectTcp = vi.fn();
  runWebSocketTunnel({ webSocket, parseFirstPacket: () => auth.promise, connectTcp, selfHost: 'w.example' });
  emitBinary(validVlessPacket);
  await tick();
  expect(connectTcp).not.toHaveBeenCalled();
  auth.resolve({ kind: 'error', code: 'auth' });
  await tick();
  expect(connectTcp).not.toHaveBeenCalled();
});
```
```ts
it.each(['disabled','expired','total-quota','daily-quota'] as const)(
  'rejects %s users and does not fall through to the legacy owner credential', async (state) => {
    const fixture = await userCredentialFixture(state);
    await expect(resolveTunnelPrincipal(db, fixture.channel, fixture.presented, now)).resolves.toEqual({ kind: 'denied-user' });
    expect(await authorizeCandidate(fixture.candidate, fixture.legacyConfig)).toMatchObject({ kind: 'error', code: 'auth' });
  },
);
```

- [ ] **Step 2: Prove RED**

Run: `pnpm --dir deploy/worker test -- src/security/tunnelAuth.test.ts src/protocols/vless.test.ts src/protocols/trojan.test.ts src/transport/websocket.test.ts src/transport/xhttp.test.ts src/routes/ws.test.ts src/routes/xhttp.test.ts`

Expected: FAIL because candidate parsing, async parsers and D1 authorization do not exist.

- [ ] **Step 3: Split parsing from authorization without breaking existing parser contracts**

`parseVlessCandidate` returns `{ presentedCredential: input.slice(1,17), destination, payload, responseHeader }`; `parseVlessRequest(input, expectedUuid)` remains exported and implements its old behavior by comparing those bytes to `uuidToBytes(expectedUuid)`.

`parseTrojanCandidate` returns the first 56 lowercase ASCII SHA-224 bytes plus destination/payload; `parseTrojanRequest(input, expectedHash)` remains exported and compares those bytes exactly as today. This preserves all current protocol unit/E2E call sites while enabling D1 lookup.

- [ ] **Step 4: Implement D1 tunnel principal resolution**

Hash the exact wire credential bytes with SHA-256 hex, map `vless-ws`/`vless-xhttp` to the VLESS credential row and `trojan-ws` to Trojan, join `users`, and read today's `usage_daily` row. Enforce `allow_vless`, `allow_xhttp`, or `allow_trojan` according to the requested channel. If a credential row exists but its user is disabled/expired/over quota/channel-disabled, return `denied-user` so the route **must not** try legacy fallback. If no credential row exists, return `not-found`, allowing a constant-time legacy-owner credential check. Successful resolution returns `authorized` with the exact channel on the principal.
- [ ] **Step 5: Make both streaming transports await authorization before TCP connect**

Change the parser call in WebSocket and XHTTP to:

```ts
const parsed = await input.parseFirstPacket(handshakeOrFirstPacket);
if (parsed.kind === 'need-more') continue;
if (parsed.kind === 'error') returnOrCloseAuthFailure(parsed.code);
```

Routes build a parser that parses the candidate, resolves a D1 principal for the exact channel, and only then returns `kind:'ok'`. `not-found` is the only result allowed to attempt legacy owner comparison; `denied-user` becomes an auth failure immediately. VLESS-XHTTP uses the VLESS wire credential with the separate `vless-xhttp` permission. Legacy owner authorization stays constant-time and produces `principal:{kind:'legacy',channel}`.

- [ ] **Step 6: Pin two independent user credentials and legacy-owner compatibility**

Create two users with different derived versions, send real VLESS/Trojan handshake fixtures for each, and assert the route returns the correct `userId`. Assert cross-user credentials fail, disabled/expired/quota-exhausted users fail, and the current global owner VLESS/Trojan/XHTTP fixtures still connect.

- [ ] **Step 7: Verify protocol regression suite and commit**

Run: `pnpm --dir deploy/worker test -- src/security/tunnelAuth.test.ts src/protocols src/transport src/routes/ws.test.ts src/routes/xhttp.test.ts`

Run: `cd deploy/worker && node test/protocol-e2e.mjs`

Expected: existing VLESS-WS/Trojan-WS/XHTTP/negative-auth E2E remains green before Phase A user E2E is added in Task 9.

```bash
git add deploy/worker/src/core/uuid.ts deploy/worker/src/protocols deploy/worker/src/transport deploy/worker/src/routes/ws* deploy/worker/src/routes/xhttp* deploy/worker/src/security/tunnelAuth* deploy/worker/src/db/users.ts AGENTS.md
git commit -m "feat: authenticate proxy tunnels per user"
```
### Task 7: Coarse usage accounting and quota checkpoints

**Files:**
- Create: `deploy/worker/src/db/usage.ts`
- Create: `deploy/worker/src/db/usage.test.ts`
- Create: `deploy/worker/src/transport/usageMeter.ts`
- Create: `deploy/worker/src/transport/usageMeter.test.ts`
- Modify: `deploy/worker/src/transport/websocket.ts` and `websocket.test.ts`
- Modify: `deploy/worker/src/transport/xhttp.ts` and `xhttp.test.ts`
- Modify: `deploy/worker/src/routes/ws.ts`, `routes/xhttp.ts`, and tests
- Modify: `deploy/worker/src/routes/adminApi.ts` and `adminApi.test.ts`

**Interfaces:**
- `readAccessState(db,userId,now): Promise<{allowed:boolean;reason?:string;totalUsedBytes:number;todayUsedBytes:number}>`.
- `recordUsageDelta(db,userId,{uploadBytes,downloadBytes,connections},now): Promise<AccessState>` atomically increments `users.total_used_bytes`, updates `users.last_tunnel_at`, and increments UTC `usage_daily`.
- `UsageMeter` exposes `addUpload(bytes)`, `addDownload(bytes)`, `flush(force?)`, and `close()`; only per-user principals receive a meter.
- Checkpoint defaults: `4 * 1024 * 1024` pending bytes or 60 seconds since previous flush; close always flushes a non-zero remainder.

- [ ] **Step 1: Write failing atomic-accounting and concurrent-flush tests**

```ts
it('atomically accumulates concurrent deltas without lost updates', async () => {
  await Promise.all([
    recordUsageDelta(db, userId, { uploadBytes: 100, downloadBytes: 200, connections: 1 }, now),
    recordUsageDelta(db, userId, { uploadBytes: 400, downloadBytes: 500, connections: 1 }, now),
  ]);
  expect(await readUsage(db, userId, '2026-09-20')).toMatchObject({
    uploadBytes: 500, downloadBytes: 700, totalBytes: 1200, connections: 2,
  });
});
```
```ts
it('does not write per packet and flushes at threshold, age, and close', async () => {
  const write = vi.fn().mockResolvedValue({ allowed: true, totalUsedBytes: 0, todayUsedBytes: 0 });
  const meter = createUsageMeter({ write, now: fakeNow, byteThreshold: 4 * 1024 * 1024, ageMs: 60_000 });
  meter.addUpload(1024);
  meter.addDownload(2048);
  expect(write).not.toHaveBeenCalled();
  meter.addUpload(4 * 1024 * 1024);
  await meter.flush();
  expect(write).toHaveBeenCalledTimes(1);
  meter.addDownload(10);
  await meter.close();
  expect(write).toHaveBeenCalledTimes(2);
});
```

- [ ] **Step 2: Prove RED**

Run: `pnpm --dir deploy/worker test -- src/db/usage.test.ts src/transport/usageMeter.test.ts`

Expected: FAIL because usage repository/meter do not exist.

- [ ] **Step 3: Implement UTC daily buckets with atomic SQL increments**

Use one `db.batch()` transaction containing:

```sql
UPDATE users
SET total_used_bytes = total_used_bytes + ?1, last_tunnel_at = ?2, updated_at = ?2
WHERE id = ?3;

INSERT INTO usage_daily(user_id, day_utc, upload_bytes, download_bytes, total_bytes, connections, updated_at)
VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
ON CONFLICT(user_id, day_utc) DO UPDATE SET
  upload_bytes = upload_bytes + excluded.upload_bytes,
  download_bytes = download_bytes + excluded.download_bytes,
  total_bytes = total_bytes + excluded.total_bytes,
  connections = connections + excluded.connections,
  updated_at = excluded.updated_at;
```

After the transaction, read current total/daily quota state once and return it. Use `YYYY-MM-DD` UTC derived from the injected epoch time. Quota semantics are explicit: `NULL` means unlimited; numeric `0` means exhausted/no allowance; an expiry `<= now` is expired.
- [ ] **Step 4: Implement the meter without per-packet writes**

The meter starts with `connectionsPending = 1`; only the first successful flush includes that connection increment. Each `addUpload/addDownload` changes local counters only. `flush(false)` returns immediately unless pending bytes reach 4 MiB or age reaches 60 seconds. `close()` forces a flush when either bytes **or the one pending connection count** remain, so a successful zero-payload tunnel can still be counted once. Serialize flushes through one promise chain so two simultaneous threshold crossings cannot submit the same delta twice.

If a flush returns `allowed:false`, mark the meter exhausted. Subsequent transport processing closes/stops the stream with a generic quota reason and performs no TCP reconnect. The documented enforcement overshoot is bounded by checkpoint size × concurrent connections; the dashboard/README calls this **periodic edge quota enforcement**, not exact packet billing.

- [ ] **Step 5: Count actual proxied payload bytes in both transports**

For WebSocket: count `parsed.value.payload` and subsequent client binary frames as upload; count bytes read from the remote TCP socket as download; do not count protocol handshake bytes or VLESS response header bytes. For XHTTP: same rule—count parsed payload + later request-body chunks as upload and remote TCP bytes as download.

Only `{kind:'user'}` principals create a `UsageMeter`; `{kind:'legacy'}` keeps current zero-D1-accounting behavior for compatibility.

- [ ] **Step 6: Add real usage/overview read endpoints**

```text
GET /api/usage?days=14               -> aggregate UTC daily totals, clamp days to 1..90
GET /api/users/:id/usage?days=14     -> per-user daily totals
GET /api/overview                    -> enabledUsers, recentUsers, todayBytes, totalBytes, expiryWarnings
```

`recentUsers` is the count whose `last_tunnel_at` or `last_subscription_at` is within the last 24 hours; admin edits do not count as activity. It is explicitly labeled recent, not “currently online”. `expiryWarnings` counts enabled users expiring within seven days.

- [ ] **Step 7: Verify quota checkpoints and concurrent connections**

Test two meters for one user crossing quota in parallel: both SQL increments must be preserved, and after their next checkpoint both report `allowed:false`. Test disabled/expired states before TCP connect through Task 6 resolver and quota exhaustion after an active connection flush.

- [ ] **Step 8: Commit**

Run: `pnpm --dir deploy/worker test -- src/db/usage.test.ts src/transport/usageMeter.test.ts src/transport/websocket.test.ts src/transport/xhttp.test.ts src/routes/adminApi.test.ts`

```bash
git add deploy/worker/src/db/usage* deploy/worker/src/transport deploy/worker/src/routes/ws* deploy/worker/src/routes/xhttp* deploy/worker/src/routes/adminApi* AGENTS.md
git commit -m "feat: add quota-aware usage accounting"
```
### Task 8: Replace the simple panel with the real embedded React control plane

**Files:**
- Create: `apps/panel/src/api/client.ts`
- Create: `apps/panel/src/auth/AuthGate.tsx`
- Create: `apps/panel/src/pages/OverviewPage.tsx`
- Create: `apps/panel/src/pages/UsersPage.tsx`
- Create: `apps/panel/src/pages/UsagePage.tsx`
- Create: `apps/panel/src/pages/SecurityPage.tsx`
- Create: `apps/panel/src/components/UserEditor.tsx`
- Create: `apps/panel/src/components/UserAccess.tsx`
- Modify: `apps/panel/src/App.tsx`, `App.test.tsx`, `app.css`, `package.json`, `vite.config.ts`
- Modify: `packages/i18n/src/dictionaries/fa.ts`, `en.ts`, `parity.test.ts`
- Create: `scripts/build-panel-assets.mjs`, `scripts/build-panel-assets.test.ts`
- Generate: `deploy/worker/src/generated/panelAssets.ts`
- Create: `deploy/worker/src/routes/panelAssets.ts`, `panelAssets.test.ts`
- Modify: `deploy/worker/src/index.ts`, `deploy/worker/src/panel.ts`, root `package.json`
- Modify: `apps/installer/src/App.tsx` and tests to surface `result.adminUrl`.

**Interfaces:**
- `PanelApi` wraps auth/session, overview, users, user access/rotation, usage, audit/login-events, password change and logout.
- Mutating calls read `tn_csrf` from `document.cookie`, set `X-CSRF-Token`, and always use `credentials:'same-origin'`.
- Worker serves the SPA at `/admin` and generated assets under `/panel-assets/*`; there is no runtime CDN, font, QR service or external JavaScript dependency.

- [ ] **Step 1: Write failing UI tests against real API-shaped fixtures**

```tsx
it('shows real overview values and never the old hard-coded FRA/28ms preview', async () => {
  render(<App api={fakeApi({ overview: { enabledUsers: 3, recentUsers: 2, todayBytes: 1234, totalBytes: 5678, expiryWarnings: 1 } })} />);
  expect(await screen.findByText('3')).toBeVisible();
  expect(screen.queryByText('28 ms')).not.toBeInTheDocument();
  expect(screen.queryByText('FRA')).not.toBeInTheDocument();
});
```
```tsx
it('creates, pauses and rotates a user through CSRF-protected API calls', async () => {
  const api = fakeApi();
  render(<App api={api} />);
  await userEvent.click(await screen.findByRole('button', { name: /new user|کاربر جدید/i }));
  await userEvent.type(screen.getByLabelText(/name|نام/i), 'Test User');
  await userEvent.click(screen.getByRole('button', { name: /save|ذخیره/i }));
  expect(await screen.findByText('Test User')).toBeVisible();
  await userEvent.click(screen.getByRole('button', { name: /pause|توقف/i }));
  await userEvent.click(screen.getByRole('button', { name: /rotate subscription|تعویض لینک/i }));
  expect(api.mutations).not.toContainEqual(expect.objectContaining({ csrf: '' }));
});
```

- [ ] **Step 2: Prove RED**

Run: `pnpm test -- apps/panel/src/App.test.tsx scripts/build-panel-assets.test.ts`

Expected: FAIL because the API client, real pages and embedded asset builder do not exist.

- [ ] **Step 3: Implement the session-aware API client**

```ts
function csrfCookie(): string {
  return document.cookie.split('; ').find((part) => part.startsWith('tn_csrf='))?.slice('tn_csrf='.length) ?? '';
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.method && init.method !== 'GET') headers.set('x-csrf-token', decodeURIComponent(csrfCookie()));
  headers.set('content-type', 'application/json');
  const response = await fetch(path, { ...init, headers, credentials: 'same-origin' });
  const body = await response.json();
  if (!response.ok) throw new PanelApiError(response.status, body.error ?? 'request-failed');
  return body as T;
}
```

Login is the sole mutation exempt from CSRF because no authenticated cookie exists yet. A 401 from any authenticated request returns the SPA to the login view without exposing endpoint-specific details.
- [ ] **Step 4: Build only working Phase A navigation and screens**

Navigation contains **Overview, Users, Usage, Logs & Security** only. Do not show clickable ProxyIP/WARP/Fragment/Clean-IP/DNS pages until their later phases exist.

Overview displays API values for enabled users, recent users, today bytes, total bytes and expiry warnings. Users provides create/edit/delete, enable/pause, quota/daily-quota/expiry, protocol toggles, access-link/QR view, and credential/token rotation. Usage renders the real 1–90-day aggregate returned by Task 7. Security shows real audit + login-event rows, logout, and password change.

`UserAccess` renders the returned private subscription URL, copy button and local QR with the already-used `uqr` package; it must not request a third-party QR endpoint.

- [ ] **Step 5: Expand bilingual strings and responsive UI tests**

Add matching FA/EN keys for every Phase A label/error/action. Keep `packages/i18n/src/parity.test.ts` green. Add App tests for Persian `dir="rtl"`, English `dir="ltr"`, empty users, API error state, session expiry, quota display in bytes/GB, and mobile navigation at a 390px viewport in Playwright.

- [ ] **Step 6: Build and embed the SPA into the Worker artifact**

Set Vite `base: '/panel-assets/'`. `scripts/build-panel-assets.mjs` reads `apps/panel/dist/index.html` plus every emitted asset and generates a deterministic TypeScript module:

```ts
export const PANEL_INDEX_HTML = "<!doctype html>...";
export const PANEL_ASSETS: Record<string, { contentType: string; body: string }> = {
  '/panel-assets/assets/index-ABC.js': { contentType: 'text/javascript; charset=utf-8', body: '...' },
  '/panel-assets/assets/index-DEF.css': { contentType: 'text/css; charset=utf-8', body: '...' },
};
```

The generator rejects absolute `http://` or `https://` script/style/font references in built HTML/CSS. `panelAssets.ts` serves `/admin`/`/admin/` with no-store and assets with immutable cache headers plus `nosniff`, CSP/frame/referrer headers.
- [ ] **Step 7: Make release builds regenerate panel assets before the edge artifact**

Change `apps/panel/package.json` build to `vite build && node ../../scripts/build-panel-assets.mjs`. Change root scripts so `pnpm build` executes the panel build first, then `pnpm build:edge-artifact`, then the remaining workspace builds. Add a contract test that deliberately changes a panel sentinel string and proves the regenerated `dist/edge-worker.js` contains it; this prevents shipping a stale UI inside the installer artifact.

The generated `deploy/worker/src/generated/panelAssets.ts` is committed, like the existing edge Worker artifact, so a clean public-installer deployment never needs Vite or a Git checkout at runtime.

- [ ] **Step 8: Replace the old public owner page without breaking compatibility endpoints**

`GET /admin` becomes the supported owner UI. Keep `/api/setup` and the legacy `/setup` POST only as compatibility APIs during Phase A; root `/` returns a small neutral Tehran Network decoy/status page with no credentials, user counts or admin-path secrets. Existing protocol and subscription routes remain ahead of SPA routing.

The installer result screen adds separate **Open Admin Panel** (`result.adminUrl`) and **Worker URL** buttons plus the generated admin password. It still clears the Cloudflare API token immediately.

- [ ] **Step 9: Verify UI/embed gates and commit**

Run: `pnpm test -- apps/panel/src/App.test.tsx packages/i18n/src/parity.test.ts scripts/build-panel-assets.test.ts deploy/worker/src/routes/panelAssets.test.ts`

Run: `pnpm --filter @tehrannetwork/panel build && pnpm build:edge-artifact`

Run: `pnpm --dir deploy/worker exec wrangler deploy --dry-run --outdir /tmp/tn-phase-a-dry`

Expected: no external runtime asset URLs; `/admin` assets are inside the Worker; dry-run uncompressed bundle remains below Cloudflare's 64 MiB limit.

```bash
git add apps/panel apps/installer packages/i18n scripts/build-panel-assets* deploy/worker/src/generated/panelAssets.ts deploy/worker/src/routes/panelAssets* deploy/worker/src/index.ts deploy/worker/src/panel.ts package.json dist apps/installer-worker/src/generated/edgeWorkerArtifact.ts AGENTS.md
git commit -m "feat: ship the real control-plane dashboard"
```
### Task 9: Legacy upgrade, end-to-end gates, bilingual docs and real Cloudflare field gate

**Files:**
- Modify: `deploy/worker/test/protocol-e2e.mjs`
- Create: `deploy/worker/test/phase-a-e2e.mjs`
- Create: `deploy/worker/test/fixtures/legacy-protocol-config.json`
- Modify: `tests/e2e/installer.spec.ts`, `tests/e2e/panel.spec.ts`
- Modify: `scripts/build-edge-worker-artifact.test.ts`, `scripts/installer-manifest-contract.test.ts`, `scripts/release-install-contract.test.ts`
- Modify: `README.md`, `docs/INSTALL_FA.md`, `docs/INSTALL_EN.md`, `SECURITY.md`, `CHANGELOG.md`, `AGENTS.md`
- Modify: root `package.json`, `deploy/worker/package.json`, `apps/installer-worker/package.json` for release version parity.

**Interfaces:**
- Release candidate version: `0.3.0`; Worker `/health`, root package, installer-worker and artifact manifest must agree.
- Upgrade path for an existing `workerName`: installer reuses `${workerName}-config` and `${workerName}-control`, uploads the new Worker with a fresh `INSTALL_GENERATION`, preserves the D1 installation seed and per-user secret versions, and leaves `protocol:config:v1` unchanged.
- Phase A is not marked field-stable until the owner completes the real clean-account/upgrade checklist below.

- [ ] **Step 1: Write the legacy-upgrade regression before changing release state**

Use `test/fixtures/legacy-protocol-config.json` with the exact current schema-1 KV shape. Start a local Worker with that KV record plus an empty D1, run migration 1, and assert:

```js
assert.equal((await get('/health')).schemaVersion, 1);
assert.equal((await getLegacySubscription()).status, 200);
await assertVlessWsLegacyConnects();
await assertTrojanWsLegacyConnects();
await assertXhttpLegacyConnects();
assert.deepEqual(await readKv('protocol:config:v1'), originalLegacyFixture);
```

The D1 migration must never rewrite the existing owner UUID, Trojan password/hash, XHTTP path or subscription token.
- [ ] **Step 2: Add a real Phase A local E2E user flow**

`phase-a-e2e.mjs` starts Workerd/Wrangler with real local KV + D1 bindings, then:

1. logs in with the configured admin password and captures session + CSRF;
2. creates user `e2e-user` with quota, expiry and all three current channels enabled;
3. obtains the private subscription link and imports/validates it;
4. connects real Xray-core through that user's VLESS-WS, Trojan-WS and VLESS-XHTTP credentials to a local/public HTTP destination;
5. verifies usage rows increase after connection close;
6. pauses the user and proves subscription + all three connection attempts fail;
7. resumes, exhausts quota through a controlled transfer/checkpoint and proves the next subscription/tunnel start fails;
8. rotates the subscription token and proves old URL 404 / new URL 200;
9. rotates protocol credentials and proves old credentials fail/new credentials connect;
10. confirms the legacy owner subscription and three existing protocol E2Es still pass.

The script prints only user IDs/status counts; it must never print raw derived credentials, tokens, admin password or the D1 installation seed.

- [ ] **Step 3: Expand browser E2E for the actual deployed dashboard UX**

`tests/e2e/panel.spec.ts` covers login, FA RTL, EN LTR, create/edit/pause/resume user, quota/expiry fields, access modal + QR, token rotation, usage view, audit/security view, password change invalidating the session, logout, and 390×844 mobile navigation.

`tests/e2e/installer.spec.ts` covers token -> account -> D1/KV/Worker mock provisioning -> result showing Worker URL + `/admin` URL + admin password. Assert token input/value is cleared before result screen and no token appears in page text/localStorage/sessionStorage.

- [ ] **Step 4: Add security/secret regression scans**

Run tests that search generated Worker source, panel assets, installer dist and log fixtures for sentinel values `SECRET_TOKEN_SENTINEL`, `INSTALLATION_SEED_SENTINEL`, `ADMIN_PASSWORD_SENTINEL`, and a sample private subscription token. Expected: none appear except inside test source fixtures themselves.

Add HTTP assertions for CSP, frame protection, referrer policy, `nosniff`, no-store on admin/API responses, secure auth cookies, sanitized D1/JSON errors, and generic 404 for private-token probing.
- [ ] **Step 5: Bump to v0.3.0 and regenerate immutable artifacts only after E2E is green**

Update root/Worker/installer-worker versions and `VERSION` in the Worker together. Run the panel build first, regenerate `deploy/worker/src/generated/panelAssets.ts`, then run `pnpm build:edge-artifact`; update manifest/hash contract tests so a stale Worker or stale panel asset fails CI.

- [ ] **Step 6: Rewrite operator/user docs around the actual Phase A behavior**

README + INSTALL_FA/EN must state the regular-user path exactly: hosted installer -> scoped token with Workers/KV/D1 permissions -> account -> Install -> admin URL/password. Document user CRUD, quota/expiry, private links, periodic quota-checkpoint semantics, current stable protocol matrix, legacy owner compatibility, D1/KV split, backup limitations until the later backup phase, and that speed limiting is not yet claimed. Explicitly document reinstall semantics: the persistent D1 installation seed keeps per-user links/credentials stable, while a fresh `INSTALL_GENERATION` intentionally resets the admin password once to the new password shown by the installer and invalidates old admin sessions.

`SECURITY.md` documents D1 sessions, CSRF, PBKDF2, derived per-user credentials, redaction rules, installation-seed handling and the fact that subscription links are credentials. `CHANGELOG.md` lists only functionality proven by local gates; real Cloudflare field status remains explicitly pending until Step 8.

- [ ] **Step 7: Run the complete local release gate fresh**

Run, in this order:

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm test:e2e
pnpm --dir deploy/worker check
cd deploy/worker && node test/protocol-e2e.mjs && node test/phase-a-e2e.mjs
cd ../.. && pnpm --dir deploy/worker exec wrangler deploy --dry-run --outdir /tmp/tn-v030-dry
```

Expected: zero test/type/lint/format/build failures; legacy and per-user protocol E2E pass; generated artifact and panel are current; dry-run includes `C`, `DB`, `ADMIN_PASSWORD`, and `INSTALL_GENERATION` binding declarations without secret values; bundle stays under the 64 MiB uncompressed Worker limit.
- [ ] **Step 8: Push the verified branch and run the real Cloudflare field checklist**

Push `feat/complete-cloudflare-control-plane` only after Step 7 is green. Deploy a temporary hosted installer built from this exact commit. The owner performs two tests from the browser with no CLI:

**Clean account:** generate the documented scoped token -> install -> confirm `/health` reports v0.3.0/schema 1/D1 -> login `/admin` -> create one user -> import its subscription -> connect VLESS-WS, Trojan-WS and XHTTP -> confirm usage rises -> pause and confirm denial -> resume. Then change the admin password in-panel, reinstall the **same Worker name**, confirm the newly shown installer password works, and confirm the existing user's private subscription/protocol credentials still work unchanged.

**Existing v0.2 account:** install again with the same Worker name -> verify the existing KV namespace and owner credentials are preserved -> D1 is added -> log in with the newly shown installer password -> legacy owner VLESS/Trojan/XHTTP still work -> create a Phase A user and test its private link.

Record exact PASS/FAIL per item in `AGENTS.md`. Do not mark Phase A complete, merge to `main`, or call v0.3.0 stable while any required real-field item is unverified.

- [ ] **Step 9: Commit the release-candidate documentation state**

Before field verification, the ledger says `local gate PASS / field gate pending`. After the owner reports results, update only the verified checkboxes and failure notes in a separate commit.

```bash
git add README.md docs SECURITY.md CHANGELOG.md AGENTS.md package.json deploy/worker apps/installer-worker apps/installer scripts tests dist
git commit -m "release: prepare Cloudflare control-plane v0.3.0"
git push origin feat/complete-cloudflare-control-plane
```

If the field gate is fully green, use a separate final ledger commit such as `docs: record v0.3.0 Cloudflare field verification`; merging/tagging remains a distinct release decision.

---

## Plan Self-Review Checklist

- [x] **Spec coverage:** Tasks 1–9 map every approved Phase A deliverable: D1 provisioning/migrations, sessions/CSRF, multi-user CRUD, quota/expiry, private links, per-user tunnel auth, usage/audit, real dashboard shell, legacy compatibility and field verification. Phase B–F capabilities are intentionally outside this plan.
- [x] **Unresolved-marker scan:** the implementation body was scanned for unfinished marker words and vague stub phrases; zero matches were found.
- [x] **Type consistency:** `Env.DB`, `Env.INSTALL_GENERATION`, D1 `uuid` → upload `databaseId`, user/edit versions, token/credential versions, `TunnelChannel`/`TunnelPrincipal`, `UsageMeter`, installer result and API DTO names were cross-checked; no contradictory naming remains.
- [x] **Review Focus:** all five top-level failure classes have explicit tests: resource-retry reuse, disabled/expired/quota denial, session/password concurrency, CSRF/stale-session handling and malformed/bounded inputs.
- [x] **Scope check:** the plan stops at a field-gated Phase A. Clean-IP/ProxyIP/WARP/Fragment/DNS/ECH and additional subscription formats remain separate later implementation plans rather than fake UI switches.
