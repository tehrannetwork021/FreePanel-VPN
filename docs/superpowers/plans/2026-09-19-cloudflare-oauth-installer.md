# Cloudflare OAuth Installer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the confusing Git-based primary install flow with a public Cloudflare OAuth installer that provisions the Tehran Network Worker, KV binding, admin secret, and workers.dev URL without requiring GitHub, Wrangler, or API-token copy/paste from end users.

**Architecture:** Keep `deploy/worker` as the self-contained VPN panel artifact. Add a separate `apps/installer-worker` Cloudflare Worker that serves the existing React installer UI, performs Authorization Code OAuth, keeps authorization only in encrypted short-lived cookies, calls the Cloudflare API to provision the user's Worker/KV/secret, verifies health, then revokes and clears the installer session. Generate and embed a versioned, hash-verified Worker artifact from `deploy/worker`; retain API-token and Git-based installation only as advanced fallbacks.

**Tech Stack:** TypeScript, React 19, Vite 8, Cloudflare Workers, Web Crypto AES-GCM, Cloudflare OAuth 2.0 Authorization Code, Cloudflare Workers/KV APIs, esbuild, Vitest 5, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-19-cloudflare-oauth-installer-design.md`

## Global Constraints

- Primary install flow MUST NOT require a GitHub account, Git clone, Wrangler, manual KV creation, or API-token copy/paste.
- Installed VPN traffic MUST remain entirely in the end user's Cloudflare account; the installer MUST NOT be in the data path after installation.
- OAuth access tokens MUST NOT be persisted in databases, KV, analytics, localStorage, sessionStorage, logs, or source control.
- Installer authorization state MUST live only in `HttpOnly; Secure; SameSite=Lax` encrypted cookies and expire within 10 minutes.
- `ADMIN_PASSWORD` MUST be at least 16 characters, MUST be uploaded as a Worker `secret_text` binding, and MUST NOT be serialized into Worker source, metadata, responses, or logs.
- Worker deployment MUST use an allowlisted immutable artifact generated from `deploy/worker` and verify its SHA-256 before upload.
- Provisioning MUST be retry-safe: deterministic KV title, idempotent Worker upload, idempotent secret update, and no unbounded duplicate resources.
- Primary OAuth scopes MUST be configured by operator from Cloudflare's current scope catalog; do not hard-code guessed legacy permission IDs.
- Existing API-token installer remains Advanced/fallback and retains volatile-memory-only token handling.
- Existing VLESS-WS, Trojan-WS, VLESS XHTTP stream-one behavior is unchanged by this milestone.
- README primary install link MUST NOT change to OAuth until a real Cloudflare-account smoke test passes.

## Review Focus

- OAuth callback with missing, expired, tampered, or replayed `state` must fail closed, clear state, and never exchange the authorization code.
- Accounts where public OAuth is disabled or required scopes are missing must receive a clear permission-stage error and a fresh consent action, never a request for a manual token in the primary path.
- Accounts without a workers.dev subdomain must get one created automatically with bounded collision retries; existing account subdomains must be reused unchanged.
- Retry after KV creation but before Worker/secret completion must reuse the exact namespace and converge to one working Worker instead of creating duplicates.
- Session expiry during account selection or installation must return a localized “authorization expired” state, clear cookies, and restart OAuth without leaking Cloudflare response bodies.

---

## File Structure

- `packages/shared/src/installer.ts` — shared request/response/stage/error contracts plus worker-name/admin-password validation.
- `packages/shared/src/index.ts` — re-export installer contracts.
- `apps/installer-worker/src/env.ts` — installer Worker bindings and environment validation.
- `apps/installer-worker/src/session.ts` — AES-GCM cookie sealing/opening, state/session cookie helpers, expiry checks.
- `apps/installer-worker/src/oauth.ts` — authorization URL, callback validation, code exchange, revoke.
- `apps/installer-worker/src/cloudflare.ts` — narrowly-scoped Cloudflare API client with sanitized errors.
- `apps/installer-worker/src/provision.ts` — retry-safe installation orchestration.
- `apps/installer-worker/src/router.ts` — `/api/*` routing and static-asset fallback.
- `apps/installer-worker/src/index.ts` — Worker entrypoint only.
- `apps/installer-worker/src/generated/edgeWorkerArtifact.ts` — generated immutable Worker source/hash/version; never hand-edited.
- `apps/installer-worker/wrangler.jsonc` — installer Worker assets/config vars; secrets documented but not committed.
- `apps/installer-worker/package.json`, `tsconfig.json` — isolated Worker package scripts/types.
- `scripts/build-edge-worker-artifact.mjs` — bundles `deploy/worker`, hashes it, writes generated module + manifest.
- `dist/installer-artifacts/edge-worker-manifest.json` — generated release manifest used by verification/release checks.
- `apps/installer/src/installClient.ts` — browser API client for session/accounts/install/logout.
- `apps/installer/src/App.tsx` — OAuth-first wizard with Advanced fallback.
- `apps/installer/src/App.test.tsx` — RTL/LTR OAuth wizard behavior.
- `packages/i18n/src/*` — localized OAuth/install stages and actionable failures.
- `scripts/export-cloudflare-template.mjs` — exports an isolated root-level developer fallback template.
- `docs/INSTALL_FA.md`, `docs/INSTALL_EN.md`, `README.md` — primary OAuth path after smoke passes; advanced fallbacks documented separately.
- `docs/OAUTH_OPERATOR_SETUP.md` — one-time OAuth client/domain/secrets deployment instructions.
- `docs/ops/OAUTH_INSTALLER_SMOKE.md` — exact real-account acceptance record before public-link switch.

### Task 1: Shared installer contracts and validation

**Files:**
- Create: `packages/shared/src/installer.ts`
- Modify: `packages/shared/src/index.ts`
- Test: `packages/shared/src/installer.test.ts`

**Interfaces:**
- Consumes: none.
- Produces: `InstallStage`, `InstallErrorCode`, `InstallerSessionView`, `CloudflareAccountView`, `InstallRequest`, `InstallResult`, `validateWorkerName(name)`, `validateAdminPassword(password)`.

- [ ] **Step 1: Write failing validation/contract tests**

```ts
import { describe, expect, it } from 'vitest';
import { validateAdminPassword, validateWorkerName } from './installer';

describe('installer validation', () => {
  it('accepts a safe Worker name and rejects unsafe names', () => {
    expect(validateWorkerName('pvnetwork-client')).toEqual({ ok: true, value: 'pvnetwork-client' });
    expect(validateWorkerName('../bad')).toMatchObject({ ok: false });
    expect(validateWorkerName('UPPER CASE')).toMatchObject({ ok: false });
  });

  it('requires an admin password of at least 16 characters', () => {
    expect(validateAdminPassword('123456789012345')).toMatchObject({ ok: false });
    expect(validateAdminPassword('correct-horse-1234')).toEqual({ ok: true });
  });
});
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `pnpm exec vitest run packages/shared/src/installer.test.ts`
Expected: FAIL because `./installer` does not exist.

- [ ] **Step 3: Implement exact shared types and validators**

```ts
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
export type InstallerSessionView = { connected: boolean; expiresAt?: number; accounts?: CloudflareAccountView[] };
export type InstallRequest = { accountId: string; workerName: string; adminPassword: string };
export type InstallResult = { ok: true; workerUrl: string; workerName: string; version: string };

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
```

- [ ] **Step 4: Run focused and package tests**

Run: `pnpm exec vitest run packages/shared/src/installer.test.ts packages/shared/src/index.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/installer.ts packages/shared/src/installer.test.ts packages/shared/src/index.ts
git commit -m "feat: add OAuth installer contracts"
```

### Task 2: Encrypted OAuth state and install session cookies

**Files:**
- Create: `apps/installer-worker/package.json`
- Create: `apps/installer-worker/tsconfig.json`
- Create: `apps/installer-worker/src/env.ts`
- Create: `apps/installer-worker/src/session.ts`
- Create: `apps/installer-worker/src/session.test.ts`

**Interfaces:**
- Consumes: Web Crypto `crypto.subtle`.
- Produces: `InstallerEnv`, `sealCookie(payload, keyB64)`, `openCookie<T>(value, keyB64)`, `makeOAuthStateCookie()`, `readOAuthStateCookie()`, `makeInstallSessionCookie()`, `clearInstallerCookies()`.

- [ ] **Step 1: Scaffold the package with exact scripts/types, then write failing cookie tests**

Create `apps/installer-worker/package.json` with:

```json
{
  "name": "@tehrannetwork/installer-worker",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "wrangler deploy --dry-run",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run",
    "check": "pnpm typecheck && pnpm test"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "5.20260919.1",
    "typescript": "5.9.3",
    "vitest": "5.0.1",
    "wrangler": "4.135.0"
  },
  "dependencies": {
    "@tehrannetwork/shared": "workspace:*"
  }
}
```

Create `tsconfig.json` using `ES2022`, `module: ESNext`, `moduleResolution: Bundler`, `types: ["@cloudflare/workers-types"]`, `strict: true`, `noEmit: true`, and `skipLibCheck: true`. Create `env.ts` with the exact `InstallerEnv` interface defined in Task 3. Then write the failing test:

```ts
it('round-trips an encrypted session and rejects tampering/expiry', async () => {
  const key = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
  const now = 1_800_000_000_000;
  const sealed = await sealCookie({ accessToken: 'secret-token', issuedAt: now, expiresAt: now + 600_000 }, key);
  await expect(openCookie(sealed, key, now + 1)).resolves.toMatchObject({ accessToken: 'secret-token' });
  await expect(openCookie(`${sealed.slice(0, -1)}x`, key, now + 1)).rejects.toThrow('invalid-session');
  await expect(openCookie(sealed, key, now + 600_001)).rejects.toThrow('expired-session');
});
```

Also assert serialized cookies contain `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, and `Max-Age=600` but never contain the plaintext token.

- [ ] **Step 2: Run test and confirm RED**

Run: `pnpm exec vitest run apps/installer-worker/src/session.test.ts`
Expected: FAIL because session helpers do not exist.

- [ ] **Step 3: Implement AES-GCM cookie sealing**

Use a 32-byte base64 key, random 12-byte IV, UTF-8 JSON payload, AES-GCM, and base64url envelope `v1.<iv>.<ciphertext>`. Reject wrong version, decode errors, authentication failure, and `expiresAt <= now` with generic local errors only.

```ts
export type OAuthState = { state: string; issuedAt: number; expiresAt: number };
export type InstallSession = { accessToken: string; issuedAt: number; expiresAt: number };

export const OAUTH_STATE_COOKIE = '__Host-tn_oauth_state';
export const INSTALL_SESSION_COOKIE = '__Host-tn_install_session';
```

- [ ] **Step 4: Add replay/expiry/tamper coverage from Review Focus**

Test that a consumed OAuth-state cookie is explicitly cleared on callback success or failure, and that `openCookie` never returns expired content.

- [ ] **Step 5: Run package tests/typecheck**

Run: `pnpm --filter @tehrannetwork/installer-worker test && pnpm --filter @tehrannetwork/installer-worker typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/installer-worker
git commit -m "feat: add encrypted installer sessions"
```

### Task 3: Cloudflare OAuth authorization, callback, and revoke

**Files:**
- Create: `apps/installer-worker/src/oauth.ts`
- Create: `apps/installer-worker/src/oauth.test.ts`
- Modify: `apps/installer-worker/src/env.ts`

**Interfaces:**
- Consumes: `InstallerEnv`, cookie helpers from Task 2.
- Produces: `startOAuth(request, env)`, `finishOAuth(request, env)`, `revokeOAuth(accessToken, env)`.

- [ ] **Step 1: Write failing OAuth URL/callback tests**

Assert the start response redirects to `https://dash.cloudflare.com/oauth2/auth` with `response_type=code`, configured `client_id`, exact `redirect_uri`, space-delimited configured scopes, and random `state`; callback must reject mismatched/missing/expired state before any token endpoint call.

```ts
expect(fetchMock).not.toHaveBeenCalledWith('https://dash.cloudflare.com/oauth2/token', expect.anything());
```

- [ ] **Step 2: Run tests and confirm RED**

Run: `pnpm exec vitest run apps/installer-worker/src/oauth.test.ts`
Expected: FAIL because OAuth module does not exist.

- [ ] **Step 3: Implement server-side Authorization Code flow**

Use these current Cloudflare endpoints:
- Authorization: `https://dash.cloudflare.com/oauth2/auth`
- Token: `https://dash.cloudflare.com/oauth2/token`
- Revoke: `https://dash.cloudflare.com/oauth2/revoke`

Environment:

```ts
export interface InstallerEnv {
  ASSETS: Fetcher;
  CF_OAUTH_CLIENT_ID: string;
  CF_OAUTH_CLIENT_SECRET: string;
  CF_OAUTH_SCOPES: string;
  COOKIE_KEY_B64: string;
  INSTALLER_ORIGIN: string;
}
```

Exchange with `client_secret_basic`; do not request refresh tokens. Store only `access_token` and bounded expiry in the encrypted install-session cookie.

- [ ] **Step 4: Add insufficient-scope/denial/expired-session tests**

Map `error=access_denied` to `authorization-denied`; map token responses indicating missing authorization to `insufficient-scope`; never include raw token response bodies in returned error messages.

- [ ] **Step 5: Run OAuth + session tests**

Run: `pnpm exec vitest run apps/installer-worker/src/oauth.test.ts apps/installer-worker/src/session.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/installer-worker/src/oauth.ts apps/installer-worker/src/oauth.test.ts apps/installer-worker/src/env.ts
git commit -m "feat: add Cloudflare OAuth flow"
```

### Task 4: Immutable Worker artifact generation and hash verification

**Files:**
- Create: `scripts/build-edge-worker-artifact.mjs`
- Create: `scripts/build-edge-worker-artifact.test.ts`
- Create/generated: `apps/installer-worker/src/generated/edgeWorkerArtifact.ts`
- Create/generated: `dist/installer-artifacts/edge-worker-manifest.json`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Consumes: `deploy/worker/src/index.ts`, root version, esbuild.
- Produces: `EDGE_WORKER_SOURCE`, `EDGE_WORKER_SHA256`, `EDGE_WORKER_VERSION`, and manifest `{version, sha256, bytes}`.

- [ ] **Step 1: Add `esbuild` dev dependency and failing artifact-contract test**

Test that running the generator creates one ESM artifact whose SHA-256 exactly matches both generated TS and manifest, and that output contains no unresolved local relative imports.

- [ ] **Step 2: Run test and confirm RED**

Run: `pnpm exec vitest run scripts/build-edge-worker-artifact.test.ts`
Expected: FAIL because generator/generated files do not exist.

- [ ] **Step 3: Implement bundler script**

Use esbuild with `bundle:true`, `format:'esm'`, `platform:'browser'`, `target:'es2022'`, and `external:['cloudflare:sockets']`; hash the emitted UTF-8 bytes with SHA-256. Write the generated TS module with `JSON.stringify(source)` so arbitrary template characters cannot break source generation.

- [ ] **Step 4: Add runtime verifier helper**

In generated module export:

The generator must emit the module from computed values rather than hand-written literals:

```js
const generated = [
  `export const EDGE_WORKER_VERSION = ${JSON.stringify(version)};`,
  `export const EDGE_WORKER_SHA256 = ${JSON.stringify(sha256)};`,
  `export const EDGE_WORKER_SOURCE = ${JSON.stringify(source)};`,
  '',
].join('\n');
```

Provisioning must recompute SHA-256 before every upload and throw `artifact-integrity-failed` if it differs.

- [ ] **Step 5: Run generator twice and prove deterministic hash**

Run:
```bash
pnpm build:edge-artifact
cp dist/installer-artifacts/edge-worker-manifest.json /tmp/manifest-a.json
pnpm build:edge-artifact
diff -u /tmp/manifest-a.json dist/installer-artifacts/edge-worker-manifest.json
```
Expected: no diff.

- [ ] **Step 6: Run existing Worker checks**

Run: `cd deploy/worker && npm run check && npx wrangler deploy --dry-run`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-lock.yaml scripts/build-edge-worker-artifact.mjs scripts/build-edge-worker-artifact.test.ts apps/installer-worker/src/generated/edgeWorkerArtifact.ts dist/installer-artifacts/edge-worker-manifest.json
git commit -m "build: generate immutable Worker install artifact"
```

### Task 5: Narrow Cloudflare provisioning API client

**Files:**
- Create: `apps/installer-worker/src/cloudflare.ts`
- Create: `apps/installer-worker/src/cloudflare.test.ts`

**Interfaces:**
- Consumes: OAuth access token.
- Produces: `listAccounts`, `findOrCreateKvNamespace`, `uploadWorkerModule`, `putAdminSecret`, `ensureAccountSubdomain`, `enableScriptSubdomain`.

- [ ] **Step 1: Write mocked API contract tests**

Cover exact methods/paths:
- `GET /client/v4/accounts?per_page=50&page=N`
- `GET /client/v4/accounts/{id}/storage/kv/namespaces?per_page=100&page=N`
- `POST /client/v4/accounts/{id}/storage/kv/namespaces`
- `PUT /client/v4/accounts/{id}/workers/scripts/{name}` multipart upload
- `PUT /client/v4/accounts/{id}/workers/scripts/{name}/secrets`
- `GET /client/v4/accounts/{id}/workers/subdomain`
- `PUT /client/v4/accounts/{id}/workers/subdomain` only when missing
- `POST /client/v4/accounts/{id}/workers/scripts/{name}/subdomain`

- [ ] **Step 2: Run tests and confirm RED**

Run: `pnpm exec vitest run apps/installer-worker/src/cloudflare.test.ts`
Expected: FAIL because API client does not exist.

- [ ] **Step 3: Implement sanitized `cfFetch`**

```ts
async function cfFetch<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
  });
  const body = await response.json() as { success: boolean; result: T; errors?: Array<{code:number; message:string}> };
  if (!response.ok || !body.success) throw new CloudflareApiError(response.status, body.errors?.[0]?.code);
  return body.result;
}
```

`CloudflareApiError.message` must be a local constant such as `cloudflare-api-failed`, never Cloudflare's raw message/body.

- [ ] **Step 4: Implement deterministic KV reuse**

Use namespace title `${workerName}-config`. Page through namespace results and reuse exact-title match; only create when absent. Test a retry where the first attempt already created KV and the second attempt sees/reuses the same namespace ID.

- [ ] **Step 5: Implement exact Worker multipart metadata**

```ts
const metadata = {
  main_module: 'worker.mjs',
  compatibility_date: '2026-09-19',
  bindings: [{ type: 'kv_namespace', name: 'C', namespace_id: namespaceId }],
};
```

Multipart source part name is `worker.mjs`, content type `application/javascript+module`. Test that `ADMIN_PASSWORD` never appears in metadata or script source.

- [ ] **Step 6: Implement secret/subdomain behavior**

Secret body must be exactly `{ "name":"ADMIN_PASSWORD", "text": adminPassword, "type":"secret_text" }`. Reuse existing account workers.dev subdomain; if absent, generate `tn-${workerName.slice(0,30)}-${randomHex(3)}` and retry creation at most 3 times on collision. Enable the script via `{enabled:true, previews_enabled:false}`.

- [ ] **Step 7: Add scope-disabled/account-error tests from Review Focus**

403 from account/list/provision calls maps to a local `insufficient-scope` error. Never surface the original response body.

- [ ] **Step 8: Run client tests**

Run: `pnpm exec vitest run apps/installer-worker/src/cloudflare.test.ts`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/installer-worker/src/cloudflare.ts apps/installer-worker/src/cloudflare.test.ts
git commit -m "feat: add Cloudflare provisioning client"
```

### Task 6: Retry-safe provisioning orchestrator and health verification

**Files:**
- Create: `apps/installer-worker/src/provision.ts`
- Create: `apps/installer-worker/src/provision.test.ts`

**Interfaces:**
- Consumes: Task 1 validators, Task 4 artifact, Task 5 API client.
- Produces: `provisionPanel(session, request, deps): Promise<InstallResult>`.

- [ ] **Step 1: Write orchestration tests before implementation**

Tests must prove operation order: validate → account access → artifact verify → KV reuse/create → Worker upload → secret upload → account subdomain → script enable → `/health` polling. Invalid worker/password must cause zero Cloudflare API calls.

- [ ] **Step 2: Add partial-failure retry test**

First run: KV create succeeds, Worker upload fails. Second run: namespace list returns the existing deterministic KV; assert no second KV create call and installation continues.

- [ ] **Step 3: Add health timeout test**

Inject `fetchHealth` and fake timers. Poll for at most 30 seconds with bounded delays; require JSON `{ok:true}` and matching `EDGE_WORKER_VERSION`. On timeout return `health-failed` without deleting the created Worker/KV.

- [ ] **Step 4: Run tests and confirm RED**

Run: `pnpm exec vitest run apps/installer-worker/src/provision.test.ts`
Expected: FAIL because orchestrator does not exist.

- [ ] **Step 5: Implement minimal orchestrator**

Return final URL exactly `https://${workerName}.${accountSubdomain}.workers.dev`. Ensure no secret/token values are included in thrown error objects or return values.

- [ ] **Step 6: Run provisioning + API tests**

Run: `pnpm exec vitest run apps/installer-worker/src/provision.test.ts apps/installer-worker/src/cloudflare.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/installer-worker/src/provision.ts apps/installer-worker/src/provision.test.ts
git commit -m "feat: provision Cloudflare panel without GitHub"
```

### Task 7: Installer Worker API router and static application hosting

**Files:**
- Create: `apps/installer-worker/src/router.ts`
- Create: `apps/installer-worker/src/router.test.ts`
- Create: `apps/installer-worker/src/index.ts`
- Create: `apps/installer-worker/wrangler.jsonc`
- Modify: `apps/installer-worker/package.json`

**Interfaces:**
- Consumes: OAuth/session/provision modules and `env.ASSETS`.
- Produces HTTP endpoints: `GET /api/oauth/start`, `GET /api/oauth/callback`, `GET /api/session`, `POST /api/install`, `POST /api/logout`; all other GETs fall through to static assets.

- [ ] **Step 1: Write failing router tests**

Test unauthenticated `/api/session` → `{connected:false}`; authenticated session → accounts; expired session → 401 + cookie clear; install requires JSON + valid session; success revokes OAuth and clears session cookie; terminal permission errors clear session; retryable provisioning failures keep the unexpired session.

- [ ] **Step 2: Add log/secret leakage test**

Spy on `console.log/error/warn` and invoke callback/install with sentinel token/password values; assert no console call contains either sentinel. Also assert API error responses contain only `{ok:false, stage, code}` plus localized-safe metadata, no raw body/stack.

- [ ] **Step 3: Run tests and confirm RED**

Run: `pnpm exec vitest run apps/installer-worker/src/router.test.ts`
Expected: FAIL because router does not exist.

- [ ] **Step 4: Implement API routes and clear/revoke semantics**

On successful install call `revokeOAuth`, clear both cookies, return `InstallResult`. On terminal `authorization-expired`, `authorization-denied`, `insufficient-scope`, clear session; on retryable `kv/worker/secret/subdomain/health` failure preserve valid OAuth session until its 10-minute expiry so Retry works.

- [ ] **Step 5: Configure static assets**

Create `wrangler.jsonc` with this structure (real production values are supplied at deploy time, not committed):

```jsonc
{
  "name": "tehran-network-installer",
  "main": "./src/index.ts",
  "compatibility_date": "2026-09-19",
  "workers_dev": true,
  "assets": {
    "directory": "../installer/dist",
    "binding": "ASSETS",
    "not_found_handling": "single-page-application"
  },
  "vars": {
    "CF_OAUTH_CLIENT_ID": "set-at-deploy-time",
    "CF_OAUTH_SCOPES": "set-at-deploy-time",
    "INSTALLER_ORIGIN": "set-at-deploy-time"
  }
}
```

`CF_OAUTH_CLIENT_SECRET` and `COOKIE_KEY_B64` are Wrangler secrets and must never appear in this file. During production deployment override/remove the sentinel var values before deploy; CI must reject a production deploy manifest that still contains `set-at-deploy-time`.

- [ ] **Step 6: Run Worker package checks/dry-run**

Run: `pnpm --filter @tehrannetwork/installer-worker check && pnpm --filter @tehrannetwork/installer-worker exec wrangler deploy --dry-run`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/installer-worker
git commit -m "feat: serve OAuth installer control plane"
```

### Task 8: OAuth-first React installer wizard

**Files:**
- Modify: `apps/installer/src/installClient.ts`
- Modify: `apps/installer/src/App.tsx`
- Modify: `apps/installer/src/App.test.tsx`
- Modify: `apps/installer/src/app.css`
- Modify: `packages/i18n/src/dictionaries/fa.ts`
- Modify: `packages/i18n/src/dictionaries/en.ts`
- Modify: `packages/i18n/src/parity.test.ts`.

**Interfaces:**
- Consumes installer API from Task 7.
- Produces user flow: connect Cloudflare → select account → Worker name/admin password → progress → final URL; Advanced section exposes existing token/Git fallback separately.

- [ ] **Step 1: Replace old token-primary UI tests with OAuth-primary failing tests**

Test first screen contains exactly one primary CTA named `نصب با Cloudflare` in Persian / `Install with Cloudflare` in English, and does not show a GitHub requirement or token input until Advanced is expanded.

- [ ] **Step 2: Add connected/account/install success test**

Mock `/api/session` with two accounts, select one, enter `pvnetwork-client` + a 16+ char password, submit, mock success URL, assert final URL and copy/open controls appear and password field is cleared.

- [ ] **Step 3: Add RTL/LTR and expiry/permission failure tests**

Persian root must be `dir=rtl`, English `dir=ltr`. `authorization-expired` shows reconnect CTA; `insufficient-scope` explains Cloudflare permission/account policy and offers reauthorize, not manual API token in the main flow.

- [ ] **Step 4: Run UI tests and confirm RED**

Run: `pnpm exec vitest run apps/installer/src/App.test.tsx packages/i18n/src/parity.test.ts`
Expected: FAIL against token-primary UI.

- [ ] **Step 5: Implement typed browser client**

Expose `getSession()`, `startOAuth()` (location redirect to `/api/oauth/start`), `installPanel(request)`, and `logout()`. Do not accept OAuth token arguments in browser APIs.

- [ ] **Step 6: Implement the wizard**

Keep current visual language, but use four visible stages: Cloudflare authorization, account, configuration, result. Keep “Advanced installation” collapsed; inside it retain API-token fallback and label Git deploy as Developer install.

- [ ] **Step 7: Run UI/i18n tests**

Run: `pnpm exec vitest run apps/installer/src/App.test.tsx packages/i18n/src/parity.test.ts`
Expected: PASS.

- [ ] **Step 8: Run browser E2E locally**

Add/update Playwright assertions for mobile 390×844 and desktop 1440×900; verify no horizontal overflow, OAuth CTA visible, Advanced collapsed, language switch works.

Run: `pnpm test:e2e`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/installer packages/i18n
git commit -m "feat: make OAuth the primary installer flow"
```

### Task 9: Operator setup, scope discovery, and real-account smoke gate

**Files:**
- Create: `scripts/cloudflare-oauth-scopes.mjs`
- Create: `docs/OAUTH_OPERATOR_SETUP.md`
- Create: `docs/ops/OAUTH_INSTALLER_SMOKE.md`
- Modify: `.gitignore` only if local operator env files need exclusion.

**Interfaces:**
- Consumes: Cloudflare OAuth scope catalog `GET https://api.cloudflare.com/client/v4/oauth/scopes` during one-time operator setup.
- Produces: exact configured `CF_OAUTH_SCOPES`, OAuth client registration checklist, production smoke acceptance record.

- [ ] **Step 1: Add scope-discovery helper**

The script accepts an operator token only via environment variable `CLOUDFLARE_OPERATOR_TOKEN`, fetches the OAuth scope catalog, prints only scope IDs/names (never token), and exits nonzero if the catalog does not contain permissions corresponding to Workers Scripts Write and Workers KV Storage Write plus the minimum account visibility permission needed for account selection.

- [ ] **Step 2: Document one-time OAuth client registration**

Use Authorization Code, `client_secret_basic`, redirect URI `${INSTALLER_ORIGIN}/api/oauth/callback`, required scope IDs copied from the helper output, verified client URI/domain, and public visibility. Record current endpoints from Cloudflare docs: `/oauth2/auth`, `/oauth2/token`, `/oauth2/revoke`.

- [ ] **Step 3: Document installer deployment secrets/vars**

Secrets: `CF_OAUTH_CLIENT_SECRET`, random 32-byte `COOKIE_KEY_B64`. Vars: `CF_OAUTH_CLIENT_ID`, exact `CF_OAUTH_SCOPES`, `INSTALLER_ORIGIN`. Include commands that read secret values interactively via Wrangler rather than committing them.

- [ ] **Step 4: Execute mocked full suite before real smoke**

Run: `pnpm check && pnpm test:e2e && pnpm --filter @tehrannetwork/installer-worker check`
Expected: all green.

- [ ] **Step 5: Perform real-account smoke before changing public docs**

Using a Cloudflare account that has no GitHub relation to `tehrannetwork021`: open installer in private/incognito browser, authorize the public OAuth app, select account, install a uniquely named Worker, confirm no GitHub page/repository/API-token step appears, confirm Worker/KV exist in the user's Cloudflare dashboard, open returned workers.dev URL, call `/health`, complete owner setup, verify VLESS-WS/Trojan-WS/XHTTP outputs are available, then disable the installer Worker temporarily and confirm the deployed panel still responds.

Record date, installer commit SHA, installed Worker name, `/health` version, and PASS/FAIL for each acceptance item in `docs/ops/OAUTH_INSTALLER_SMOKE.md`. Do not record account IDs, tokens, passwords, UUIDs, or subscription URLs.

- [ ] **Step 6: Commit operator docs and smoke evidence after PASS**

```bash
git add scripts/cloudflare-oauth-scopes.mjs docs/OAUTH_OPERATOR_SETUP.md docs/ops/OAUTH_INSTALLER_SMOKE.md .gitignore
git commit -m "docs: add OAuth installer operator runbook"
```

### Task 10: Isolated Developer fallback template

**Files:**
- Create: `scripts/export-cloudflare-template.mjs`
- Create: `scripts/export-cloudflare-template.test.ts`
- Create/generated: `dist/cloudflare-template/*`
- Modify: root scripts in `package.json`.

**Interfaces:**
- Consumes: `deploy/worker/*`.
- Produces: a standalone root-level Cloudflare template containing only Worker package files, suitable for publication to orphan branch `cloudflare-template`.

- [ ] **Step 1: Write failing export contract test**

Assert exported root contains `package.json`, `package-lock.json`, `wrangler.jsonc`, `src/`, `.dev.vars.example`, but no monorepo root `apps/`, `packages/`, or root workspace config.

- [ ] **Step 2: Run test and confirm RED**

Run: `pnpm exec vitest run scripts/export-cloudflare-template.test.ts`
Expected: FAIL because exporter does not exist.

- [ ] **Step 3: Implement exporter and validate isolated install**

Copy only allowlisted paths from `deploy/worker`, then run inside export directory:

```bash
npm ci
npm run check
npx wrangler deploy --dry-run
```

Expected: PASS from directory root.

- [ ] **Step 4: Publish/update orphan branch only after primary OAuth smoke passes**

Create/update `cloudflare-template` so its root is exactly `dist/cloudflare-template`. The Developer Deploy-to-Cloudflare URL must target that branch root, not `/tree/main/deploy/worker`.

- [ ] **Step 5: Commit exporter**

```bash
git add scripts/export-cloudflare-template.mjs scripts/export-cloudflare-template.test.ts package.json pnpm-lock.yaml
git commit -m "build: export isolated Cloudflare developer template"
```

### Task 11: Public docs switch, final verification, and release

**Files:**
- Modify: `README.md`
- Modify: `docs/INSTALL_FA.md`
- Modify: `docs/INSTALL_EN.md`
- Modify: `CHANGELOG.md`
- Modify: `AGENTS.md`
- Modify: release/install contract tests.

**Interfaces:**
- Consumes: successful Task 9 smoke record and Task 10 developer fallback URL.
- Produces: public OAuth-first install docs and release-ready branch.

- [ ] **Step 1: Update contract tests first**

Assert README primary CTA points to the verified public installer domain and text says GitHub/API token are not required. Assert API-token fallback and Developer Git install are present only under Advanced/Developer sections. Assert docs link to `docs/ops/OAUTH_INSTALLER_SMOKE.md` as release evidence.

- [ ] **Step 2: Run contract tests and confirm RED**

Run: `pnpm exec vitest run scripts/release-install-contract.test.ts scripts/readme-contract.test.ts`
Expected: FAIL until docs switch.

- [ ] **Step 3: Update bilingual docs after smoke PASS only**

Persian and English quick path must be: open installer → Install with Cloudflare → consent/account → Worker name/admin password → install → workers.dev. Remove any wording that suggests ordinary users need GitHub or Wrangler.

- [ ] **Step 4: Run the complete release gate fresh**

```bash
pnpm check
pnpm test:e2e
cd deploy/worker && npm run check && npm audit --audit-level=high && npx wrangler deploy --dry-run
cd ../../
pnpm --filter @tehrannetwork/installer-worker check
pnpm --filter @tehrannetwork/installer-worker exec wrangler deploy --dry-run
git diff --check
git status --short
```

Expected: all commands exit 0; final `git status --short` contains only intended documentation/release changes before commit.

- [ ] **Step 5: Commit public switch**

```bash
git add README.md docs/INSTALL_FA.md docs/INSTALL_EN.md CHANGELOG.md AGENTS.md scripts
git commit -m "release: make Cloudflare OAuth installer primary"
```

- [ ] **Step 6: Push dev, merge/update main, tag next release only after GitHub CI succeeds**

Push the tested branch, wait for both `quality` and `browser-e2e` GitHub jobs to conclude `success`, then update `main` and create the release tag. Do not publish a success claim from local-only verification.
