# Free Cloudflare Token Installer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the primary install path free and simple: GitHub → Generate Cloudflare Key → paste token → automatic KV/Worker/secret/workers.dev provisioning → usable VPN panel.

**Architecture:** Keep the tested Cloudflare provisioning client and immutable Worker artifact, but remove the OAuth/session subsystem. The public installer runs on a free `workers.dev` Worker, accepts a narrowly scoped Cloudflare user token only for the current request/flow, never persists it, and deploys only the embedded Tehran Network artifact.

**Tech Stack:** Cloudflare Workers, React 19, TypeScript 5.9, Wrangler 4.135, Vitest 5, Playwright, Workers KV, `cloudflare:sockets`.

**Spec:** `docs/superpowers/specs/2026-09-20-cloudflare-free-token-installer-design.md`

## Global Constraints

- End-user cost must be zero on Cloudflare Free within Cloudflare's published free-plan limits.
- No VPS, custom domain, OAuth client, GitHub connection, repository clone, Wrangler, or local terminal in the normal user flow.
- The only unavoidable manual Cloudflare action is creating/copying the scoped API token.
- Never persist the Cloudflare token in KV, cookies, localStorage, sessionStorage, logs, analytics, source control, or URLs.
- Do not request API-token-management permission merely to self-delete the install token; clear it locally after the attempt and offer an optional Cloudflare token-cleanup link on success.
- Deploy only the immutable allowlisted Worker artifact generated from `deploy/worker` and verify its SHA-256 before upload.
- Installed panel must remain independent from the installer after provisioning.
- Primary output is the user's own `https://<worker>.<account-subdomain>.workers.dev` URL.

## Review Focus

- Invalid/expired token: reject before provisioning and return only safe `token-invalid` metadata.
- Correct token with insufficient permissions: identify `insufficient-scope` without leaking Cloudflare response bodies.
- Multi-account token: return only accessible account IDs/names and require explicit account selection.
- Partial provisioning failure: retry must reuse the deterministic KV namespace rather than creating duplicates.
- Secret leakage: token and `ADMIN_PASSWORD` must never appear in console output, error responses, browser storage, or generated artifacts.

---

### Task 1: Token contracts and Cloudflare token verification

**Files:**

- Modify: `packages/shared/src/installer.ts`
- Modify: `packages/shared/src/installer.test.ts`
- Modify: `apps/installer-worker/src/cloudflare.ts`
- Modify: `apps/installer-worker/src/cloudflare.test.ts`

**Interfaces:**

- Produces `TokenVerifyRequest = { token: string }`.
- Produces `TokenVerifyResult = { ok: true; accounts: CloudflareAccountView[] }`.
- Produces `TokenInstallRequest = InstallRequest & { token: string }`.
- Produces `verifyApiToken(token: string): Promise<void>`; success means Cloudflare reports token status `active`.

- [ ] **Step 1: Write failing shared-contract tests**

Assert token-stage error codes include `token-invalid` and `insufficient-scope`, while install result remains `{ok:true, workerUrl, workerName, version}`. Keep worker-name/password validation unchanged.

- [ ] **Step 2: Write failing Cloudflare verification tests**

Mock `GET /user/tokens/verify` and assert an active token passes, disabled/expired/401 tokens throw `CloudflareApiError` with safe local code `token-invalid`, and raw token/Cloudflare body is absent from the thrown error.

- [ ] **Step 3: Run tests and confirm RED**

Run: `pnpm exec vitest run packages/shared/src/installer.test.ts apps/installer-worker/src/cloudflare.test.ts`
Expected: FAIL because token contracts and `verifyApiToken` do not exist.

- [ ] **Step 4: Implement minimal contracts and verification**

Use the existing `cfRequest` authorization path and Cloudflare's documented `GET /user/tokens/verify`. Accept only `result.status === 'active'`; map authentication failure to `token-invalid` and permission failures during later account/provision calls to `insufficient-scope`.

- [ ] **Step 5: Run focused tests/typecheck**

Run: `pnpm exec vitest run packages/shared/src/installer.test.ts apps/installer-worker/src/cloudflare.test.ts && pnpm --filter @tehrannetwork/installer-worker typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/installer.ts packages/shared/src/installer.test.ts apps/installer-worker/src/cloudflare.ts apps/installer-worker/src/cloudflare.test.ts
git commit -m "feat: verify scoped Cloudflare install tokens"
```

---

### Task 2: Stateless token installer API and OAuth removal

**Files:**

- Modify: `apps/installer-worker/src/router.ts`
- Modify: `apps/installer-worker/src/router.test.ts`
- Modify: `apps/installer-worker/src/env.ts`
- Modify: `apps/installer-worker/src/provision.ts`
- Modify: `apps/installer-worker/src/provision.test.ts`
- Delete: `apps/installer-worker/src/oauth.ts`
- Delete: `apps/installer-worker/src/oauth.test.ts`
- Delete: `apps/installer-worker/src/session.ts`
- Delete: `apps/installer-worker/src/session.test.ts`

**Interfaces:**

- Consumes `verifyApiToken`, `listAccounts`, and refactored `provisionPanel(accessToken, request, deps)`.
- Produces `POST /api/token/verify` with `{token}` → `{ok:true, accounts}`.
- Produces `POST /api/install` with `TokenInstallRequest` → existing `InstallResult`.
- `InstallerEnv` becomes assets-only; no OAuth/client/cookie secrets remain.

- [ ] **Step 1: Replace OAuth router tests with token-flow tests**

Test invalid JSON/content type, invalid token, insufficient scope, multi-account response, successful install, and retryable provisioning failure. Assert `/api/oauth/start`, `/api/oauth/callback`, `/api/session`, and `/api/logout` return 404 after migration.

- [ ] **Step 2: Add secret-leak and body-size tests**

Use sentinel token/password strings, spy on `console.log/error/warn`, and assert neither sentinel appears in logs or API responses. Reject request bodies whose `content-length` exceeds 16 KiB with `{ok:false,stage:'token',code:'invalid-request'}` before Cloudflare calls.

- [ ] **Step 3: Run router tests and confirm RED**

Run: `pnpm exec vitest run apps/installer-worker/src/router.test.ts`
Expected: FAIL against OAuth/session router.

- [ ] **Step 4: Implement stateless token routes**

For `/api/token/verify`, validate a non-empty token, call `verifyApiToken(token)`, then `listAccounts(token)`. Refactor `provisionPanel` from `(session, request, deps)` to `(accessToken: string, request, deps)` and update its tests. For `/api/install`, destructure `{token, accountId, workerName, adminPassword}`, verify the token first, then call `provisionPanel(token, {accountId, workerName, adminPassword}, defaultProvisionDeps)` without writing token state anywhere.

- [ ] **Step 5: Delete OAuth/session code and simplify environment**

Keep only `ASSETS: Fetcher` in `InstallerEnv`. Remove OAuth imports, cookie helpers, revoke logic, and associated dead endpoints.

- [ ] **Step 6: Run Worker package gate**

Run: `pnpm --filter @tehrannetwork/installer-worker check`
Expected: PASS with no OAuth/session tests remaining.

- [ ] **Step 7: Commit**

```bash
git add -A apps/installer-worker/src
git commit -m "feat: make installer stateless and token based"
```

---

### Task 3: Make Generate-Key the primary React installer flow

**Files:**

- Modify: `apps/installer/src/installClient.ts`
- Modify: `apps/installer/src/App.tsx`
- Modify: `apps/installer/src/App.test.tsx`
- Modify: `apps/installer/src/app.css`
- Modify: `packages/i18n/src/dictionaries/fa.ts`
- Modify: `packages/i18n/src/dictionaries/en.ts`
- Modify: `tests/e2e/installer.spec.ts`

**Interfaces:**

- Browser API exposes `verifyToken(token): Promise<TokenVerifyResult>` and `installPanel(request: TokenInstallRequest): Promise<InstallResult>`.
- `createVolatileTokenVault()` remains the only browser-side token holder.
- Primary flow is `generate → paste/verify → account/config → result`.

- [ ] **Step 1: Write failing OAuth-removal UI tests**

Assert the first screen has a primary `ساخت کلید Cloudflare` / `Generate Cloudflare Key` link and token password field, contains no OAuth/consent/client/domain language, and contains no GitHub connection requirement.

- [ ] **Step 2: Add verify/account/install tests**

Paste a token, submit verification, mock two accounts, choose the second account, set `pvnetwork-client` and a 16+ character admin password, submit install, and assert the final workers.dev URL is rendered.

- [ ] **Step 3: Add volatile-token security tests**

After verify, assert the visible token input is cleared while install still succeeds from the in-memory vault. After every install attempt, assert the vault is cleared. Spy on `localStorage.setItem`, `sessionStorage.setItem`, `history.pushState`, and `history.replaceState`; the token must never be written to any of them.

- [ ] **Step 4: Run UI tests and confirm RED**

Run: `pnpm exec vitest run apps/installer/src/App.test.tsx packages/i18n/src/parity.test.ts`
Expected: FAIL because OAuth is still primary.

- [ ] **Step 5: Implement typed token browser client**

`verifyToken(token)` posts `{token}` to `/api/token/verify`. `installPanel(request)` posts `TokenInstallRequest` to `/api/install`. Both use `cache:'no-store'` and `credentials:'same-origin'`; neither places the token in a URL/header visible to browser history.

- [ ] **Step 6: Implement the four-stage wizard**

Stage 1 links to the Cloudflare user-token template using only `workers_scripts:edit`, `workers_kv_storage:edit`, and `account_settings:read`, scoped to all accounts. Stage 2 verifies/picks an account. Stage 3 collects Worker name/admin password. Stage 4 shows final workers.dev URL, copy/open controls, subscription/QR onboarding link, and an optional `Delete installation key` link to Cloudflare API Tokens. Do not claim the Cloudflare-side token was revoked automatically.

- [ ] **Step 7: Update Persian/English copy**

State clearly: free Cloudflare account, no VPS, no custom domain, no GitHub connection. Tell users Cloudflare displays the token secret only once and the installer does not save it.

- [ ] **Step 8: Update browser E2E**

Desktop 1440×900 and mobile 390×844 must show Generate Key + token flow with no horizontal overflow. Switch Persian RTL ↔ English LTR and verify no OAuth copy appears.

- [ ] **Step 9: Run focused UI + E2E gates**

Run: `pnpm exec vitest run apps/installer/src/App.test.tsx packages/i18n/src/parity.test.ts && pnpm test:e2e`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add apps/installer packages/i18n tests/e2e/installer.spec.ts
git commit -m "feat: make Cloudflare key generation the primary installer"
```

---

### Task 4: Free `workers.dev` installer deployment package

**Files:**

- Modify: `apps/installer-worker/wrangler.jsonc`
- Modify: `apps/installer-worker/src/env.ts`
- Modify: `apps/installer-worker/package.json`
- Create: `scripts/installer-manifest-contract.test.ts`

**Interfaces:**

- Installer Worker requires only static `ASSETS`; no vars or secrets.
- Production installer runs at Cloudflare's free `*.workers.dev` hostname.

- [ ] **Step 1: Write failing manifest contract test**

Read `apps/installer-worker/wrangler.jsonc` and assert `workers_dev: true`, assets SPA handling is enabled, and the text contains none of `CF_OAUTH`, `COOKIE_KEY`, `INSTALLER_ORIGIN`, `routes`, `custom_domain`, or `set-at-deploy-time`.

- [ ] **Step 2: Run test and confirm RED**

Run: `pnpm exec vitest run scripts/installer-manifest-contract.test.ts`
Expected: FAIL because OAuth vars are still configured.

- [ ] **Step 3: Remove OAuth deployment configuration**

Keep `name: tehran-network-installer`, `main: ./src/index.ts`, compatibility date, `workers_dev: true`, and the existing assets binding. Remove all OAuth vars/secrets requirements.

- [ ] **Step 4: Build installer assets and dry-run Worker**

Run: `pnpm --filter @tehrannetwork/installer build && pnpm --filter @tehrannetwork/installer-worker check && pnpm --filter @tehrannetwork/installer-worker exec wrangler deploy --dry-run`
Expected: PASS and Wrangler reports only the `ASSETS` binding.

- [ ] **Step 5: Commit**

```bash
git add apps/installer-worker scripts/installer-manifest-contract.test.ts
git commit -m "build: make installer deploy free on workers.dev"
```

---

### Task 5: Real free-account smoke and public GitHub install path

**Files:**

- Modify: `README.md`
- Modify: `docs/INSTALL_FA.md`
- Modify: `docs/INSTALL_EN.md`
- Create: `docs/ops/TOKEN_INSTALLER_SMOKE.md`
- Delete if present: `docs/OAUTH_OPERATOR_SETUP.md`
- Delete if present: `docs/ops/OAUTH_INSTALLER_SMOKE.md`
- Delete if present: `scripts/cloudflare-oauth-scopes.mjs`
- Delete if present: `scripts/cloudflare-oauth-scopes.test.ts`
- Modify: `scripts/release-install-contract.test.ts`
- Modify: `scripts/readme-contract.test.ts`

**Interfaces:**

- Consumes the exact public installer `workers.dev` URL returned by the successful installer deployment.
- Produces the repository's primary **Install Free on Cloudflare** link.

- [ ] **Step 1: Deploy the installer Worker to the project owner's free Cloudflare account**

Authenticate Wrangler interactively or with an operator-scoped deployment token that is never committed. Run `pnpm --filter @tehrannetwork/installer-worker exec wrangler deploy` and record only the returned public `https://tehran-network-installer.<subdomain>.workers.dev` URL.

- [ ] **Step 2: Perform a clean-user smoke test**

From a Cloudflare account with no GitHub relation to `tehrannetwork021`, open the public installer, click Generate Cloudflare Key, create the prefilled token, paste it, verify account discovery, choose the account, install a uniquely named Worker, and open the returned workers.dev URL.

- [ ] **Step 3: Verify created resources and independence**

Confirm the user's Cloudflare dashboard contains exactly one deterministic `<worker>-config` KV namespace and the Worker. Confirm `/health` returns `{ok:true}` with the expected version; complete owner setup; verify VLESS-WS, Trojan-WS, and VLESS XHTTP stream-one subscription outputs. Then close/disable the installer and confirm the deployed panel still responds.

- [ ] **Step 4: Record smoke evidence without secrets**

Record date, installer commit SHA, installed Worker name, health version, and PASS/FAIL items. Never record account IDs, tokens, passwords, UUIDs, subscription URLs, or Cloudflare token IDs.

- [ ] **Step 5: Update contract tests first with the exact live installer URL**

Assert README and both install guides use the live workers.dev installer as the primary link, say no custom domain/VPS/GitHub connection is required, and describe Generate Key → Create/Copy → Paste → Install. Assert any Git-based deploy link is labeled Developer/Advanced only.

- [ ] **Step 6: Run contract tests and confirm RED**

Run: `pnpm exec vitest run scripts/release-install-contract.test.ts scripts/readme-contract.test.ts`
Expected: FAIL until docs are switched.

- [ ] **Step 7: Update public docs after smoke PASS**

Make the first README action a single **Install Free on Cloudflare** button to the verified workers.dev installer. Persian and English quick paths must match the tested flow and explain that Cloudflare shows the generated token once and Tehran Network does not store it.

- [ ] **Step 8: Run docs contracts**

Run: `pnpm exec vitest run scripts/release-install-contract.test.ts scripts/readme-contract.test.ts`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add -A README.md docs/INSTALL_FA.md docs/INSTALL_EN.md docs/ops docs/OAUTH_OPERATOR_SETUP.md scripts/cloudflare-oauth-scopes.mjs scripts/cloudflare-oauth-scopes.test.ts scripts/release-install-contract.test.ts scripts/readme-contract.test.ts
git commit -m "docs: publish free Cloudflare key installer"
```

---

### Task 6: Competitive reliability gate and final release verification

**Files:**

- Modify: `CHANGELOG.md`
- Modify: `AGENTS.md`
- Modify: release notes only after every gate below passes.

**Interfaces:**

- Confirms the installer simplification did not regress the existing three-protocol Worker core, subscriptions, QR/setup, or security boundaries.
- [ ] **Step 1: Bump the release version and regenerate immutable artifact**

Set root, `deploy/worker`, and `apps/installer-worker` package versions to `0.2.0`, then run `pnpm build:edge-artifact`. Assert generated artifact/manifest report `0.2.0` and matching SHA-256.

- [ ] **Step 2: Run the complete repository gate fresh**

```bash
pnpm check
pnpm test:e2e
```

Expected: all format, lint, typecheck, unit, build, desktop, and mobile tests pass.

- [ ] **Step 3: Run the installed Worker security/protocol gate**

```bash
cd deploy/worker
npm run check
npm audit --audit-level=high
npm run test:protocol
npx wrangler deploy --dry-run
cd ../..
```

Expected: zero high-or-higher audit findings; VLESS-WS, Trojan-WS, XHTTP stream-one, and negative-auth protocol tests pass; dry-run succeeds with KV binding `C`.

- [ ] **Step 4: Run installer-worker dry-run and repository hygiene checks**

```bash
pnpm --filter @tehrannetwork/installer-worker check
pnpm --filter @tehrannetwork/installer-worker exec wrangler deploy --dry-run
git diff --check
git status --short
```

Expected: installer Worker has only `ASSETS`; no OAuth vars/secrets; diff check is clean; status contains only intended release files.

- [ ] **Step 5: Update changelog/ledger with evidence**

Record the tested free install flow, three existing protocols, automatic KV/secret/workers.dev provisioning, test counts, audit result, and real-account smoke status. Do not claim capabilities not exercised by the gates.

- [ ] **Step 6: Commit release candidate**

```bash
git add package.json deploy/worker/package.json apps/installer-worker/package.json apps/installer-worker/src/generated dist/installer-artifacts CHANGELOG.md AGENTS.md
git commit -m "release: prepare free Cloudflare installer v0.2.0"
```

---

### Task 7: GitHub publish and release

**Files:**

- No product-code changes unless CI reveals a reproducible defect.
- Update `AGENTS.md` only after external publish steps actually succeed.

**Interfaces:**

- Publishes the tested branch to `tehrannetwork021/FreePanel-VPN`.
- Produces `main`, `dev/tehran-edge-v1`, and tag `v0.2.0` at the verified release commit.

- [ ] **Step 1: Push the feature branch**

Push `feat/cloudflare-oauth-installer` (or rename it to `feat/cloudflare-free-token-installer` before push if branch rename is clean). Do not move `main` or tag yet.

- [ ] **Step 2: Wait for GitHub CI**

Verify both repository jobs complete with `success`: the quality/unit/build job and browser E2E job. If either fails, reproduce locally, fix with a regression test, rerun all relevant gates, and push the fix.

- [ ] **Step 3: Fast-forward the public branches**

After CI success, update `dev/tehran-edge-v1` and `main` to the exact tested release commit. Refuse a non-fast-forward update unless the remote change is reviewed and reconciled first.

- [ ] **Step 4: Create release tag**

Create/push annotated tag `v0.2.0` at the same verified commit. Release notes must describe the free token installer, not the abandoned OAuth path.

- [ ] **Step 5: Verify public GitHub state**

Fetch remote refs and confirm `main`, `dev/tehran-edge-v1`, and `v0.2.0` resolve to the intended commit. Open the README primary install link and confirm it reaches the live workers.dev installer.

- [ ] **Step 6: Mark the ledger only after verification**

Record the deployed installer URL, GitHub CI result, release commit, and tag in `AGENTS.md`; never record Cloudflare secrets or user token values.

---

## Final acceptance

The release is complete only when a new user can start from the GitHub README, create the preconfigured Cloudflare token, paste it into the installer, receive a working workers.dev panel, and use the panel without GitHub, VPS, custom domain, OAuth, or paid infrastructure. The installer's temporary token must not remain in browser storage or server-side storage after the flow.
