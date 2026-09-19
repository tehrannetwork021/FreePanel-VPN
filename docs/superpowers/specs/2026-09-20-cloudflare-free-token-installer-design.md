# Cloudflare Free Token Installer Design

## Product rule

Tehran Network Edge Panel is a zero-cost project. The normal user path must require only a free Cloudflare account and must not require a VPS, paid Cloudflare feature, custom domain, GitHub connection, Wrangler, local terminal, or manual Worker/KV setup.

The installed VPN panel runs entirely inside the user's own Cloudflare account and remains usable if the Tehran Network installer is later unavailable.

## Primary user flow

1. User opens the GitHub repository and clicks **Install Free on Cloudflare**.
2. The link opens the Tehran Network installer on the project's free `*.workers.dev` address.
3. User clicks **Generate Cloudflare Key**.
4. Cloudflare opens its API-token creation screen with the required permissions preselected as far as Cloudflare supports.
5. User confirms **Create Token**, copies the one-time displayed token, returns to the installer, and pastes it.
6. As soon as the token is accepted, the installer automatically provisions everything else.
7. Installer verifies the token, resolves the target Cloudflare account, creates/reuses the KV namespace, uploads the immutable Worker artifact, binds KV as `C`, sets `ADMIN_PASSWORD` as a Worker secret, enables `workers.dev`, and polls `/health`.
8. Installer shows the final `https://<worker>.<account-subdomain>.workers.dev` URL plus subscription/QR onboarding.
9. The pasted API token is cleared from browser memory and installer memory immediately after success or failure. It is never persisted.

There is no OAuth client, custom-domain verification, repository clone, or Cloudflare Git integration in the primary path.

## Free hosting model

The public installer itself is hosted on a Tehran Network Cloudflare Worker using its free `workers.dev` hostname. A custom domain is optional branding only and must never be required for installation.

Cloudflare documents `workers.dev` as the built-in route for deploying Workers without onboarding a custom domain. The user-created panel also uses the user's own `workers.dev` hostname.

## Token permissions

The generated token must be limited to the smallest practical permission set needed for provisioning:

- Workers Scripts Write
- Workers KV Storage Write
- minimum account visibility required to resolve/select the target account

Do not request DNS, R2, billing, Zero Trust, zone routing, or API-token-management permissions unless a proven Cloudflare API requirement makes one necessary.
Cloudflare's built-in **Edit Cloudflare Workers** template currently includes more permissions than this product needs. The installer should prefer the existing prefilled custom-token builder with only the required Worker/KV/account permissions; if Cloudflare changes that UI contract, fall back to a short guided custom-token screen rather than silently broadening permissions.

The installer must verify the token before doing any provisioning and must reject tokens that cannot perform the minimum required operations.

## Token lifecycle and privacy

The token is a setup credential, not a panel credential.

- Keep it only in volatile browser state and in the current installer request/process.
- Never write it to KV, D1, logs, analytics, source control, localStorage, sessionStorage, cookies, or error bodies.
- Never embed it in the installed Worker source or bindings.
- Clear it immediately after the installation attempt.
- Do not request API Token Management permission just to delete the token automatically; that would materially expand privilege.
- After success, show a short optional link/instruction for the user to revoke the setup token from Cloudflare. The deployed panel must not depend on that token afterward.

## Provisioning sequence

1. Verify token with Cloudflare.
2. Resolve accessible account(s); auto-select when exactly one account is available, otherwise show a minimal account picker.
3. Validate Worker name and admin password locally.
4. Create or reuse deterministic KV namespace `<worker>-config`.
5. Verify the embedded release artifact SHA-256.
6. Upload Worker module with KV binding `C`.
7. Upload `ADMIN_PASSWORD` as `secret_text`.
8. Ensure the account has a `workers.dev` subdomain; create one automatically when Cloudflare permits it.
9. Enable the script's `workers.dev` route.
10. Poll `/health` with bounded retries and verify expected release version.
11. Return final URL and clear installer credential state.

## Installer control plane

Reuse `apps/installer-worker` as the setup-time backend, but remove OAuth/client-secret/session-cookie responsibilities from the primary path. It serves the React installer and accepts a single install request carrying the user-pasted Cloudflare token plus the requested Worker configuration.

The backend must not become a generic deployment API. It may deploy only the repository's embedded, versioned, hash-verified Edge Worker artifact and fixed bindings required by this product.

The existing OAuth implementation may remain temporarily on the feature branch only while migration tests are rewritten; it must not be reachable from the final primary UI or required for release.

## Reliability and differentiation

The installer should be stronger than typical free Worker scripts through measurable behavior rather than marketing claims:

- idempotent retry after partial KV/Worker failures,
- deterministic resource naming,
- artifact hash verification,
- automatic `workers.dev` setup,
- automatic health verification before presenting success,
- bilingual Persian/English responsive UI,
- VLESS WebSocket, Trojan WebSocket, and VLESS XHTTP stream-one from one panel,
- generated links, subscriptions, and QR onboarding,
- no central VPS and no post-install dependency on Tehran Network infrastructure.

Future competitive features may be added only when they preserve the zero-cost/no-VPS rule and have automated tests.

## Failure behavior

Errors are grouped into token verification, account selection, KV, Worker upload, secret, workers.dev, and health stages. Responses expose only safe error codes/stages, never Cloudflare response bodies containing credentials or stack traces.

A retry after a partial failure must converge on the same Worker/KV instead of creating duplicates.

## Tests and release gate

Automated coverage must prove:

- token is never persisted or logged,
- invalid/insufficient token performs no destructive provisioning,
- single-account auto-selection and multi-account selection,
- KV create/reuse and partial-failure retry,
- Worker metadata/bindings and secret isolation,
- workers.dev setup and health polling,
- generated artifact hash verification,
- Persian RTL / English LTR UI,
- mobile and desktop no-overflow behavior,
- existing protocol tests and Xray compatibility remain unchanged.

Before public README switch, perform a real smoke using a Cloudflare account unrelated to the project GitHub account: create the scoped token, paste it, complete automatic install, verify Worker + KV exist, verify `/health`, complete owner setup, verify the three protocol outputs, then revoke the setup token and confirm the panel still works.

## Success criteria

A new user can start from the GitHub README and reach a working VPN panel using only a free Cloudflare account. The only unavoidable Cloudflare security actions are confirming token creation and copying the generated token once. Everything after pasting the token is automatic.

No custom domain, paid service, VPS, GitHub connection, repository clone, Cloudflare OAuth client, or local tooling is required. The final panel is served from the user's free `workers.dev` URL and continues working after the installer token is cleared or revoked.
