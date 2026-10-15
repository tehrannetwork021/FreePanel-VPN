# Field installation validation — 2026-10-15

Production promotion remains conditional on a complete real installation, admin login, and all three real protocol connections. Those gates have not passed yet.

## Confirmed installer runtime defect

The recovered installer served its UI and `/api/health`, but the first real token installation failed before creating resources. The token could read Cloudflare account metadata directly; the public installer's `/api/token/verify` returned HTTP 502 with `stage=token`, `code=cloudflare-api-failed` (Ray `a4af90649f6caf16-ATL`).

Cloudflare's workerd rejects `redirect: 'error'` in Request construction. Its implementation accepts only `follow` and `manual`: <https://github.com/cloudflare/workerd/blob/main/src/workerd/api/http.c%2B%2B>. The installer used the unsupported value in API requests, receiver health checks, and admin login verification.

All three requests now use `manual`. API 3xx responses are explicitly rejected and their bodies canceled. Health and login continue to reject non-success responses. Credentials are never forwarded to redirect targets.

## Verification

- New regression test bundles the actual API/provisioning functions into real local workerd through Wrangler's installed Miniflare. Before the fix, `/verify` returned 502 before reaching the mocked upstream (expected 200). After the fix, verification, account discovery, health and login all reach upstream; all four reject a redirect without fetching its target.
- Full `pnpm@10.15.1 check`: format, lint, all workspace typechecks, complete build and **50 files / 265 tests passed**. An initial sandbox run failed on Vitest temporary module files; the unchanged command passed outside that sandbox.
- Full `test:installer-runtime`: API runtime regression plus default and binding-free staging UI/API checks passed, exit 0.
- Tested binding-free installer bundle: **872755 bytes**, SHA-256 `69191cee155e527b1bf3476e111dad97f1adcdcbefd09a94182c3353eb747edb`.
- Uploaded to approved `freepanel-installer-recovery-20261015`; editor copy-back matched the exact bundle SHA. Active version prefix `bb4c719f`.
- Same real scoped token then passed public `/api/token/verify` with HTTP 200, `ok=true` (Ray `a4afa1d86953f3b1-ATL`). This confirms the installer outbound-request failure was fixed on Cloudflare.
- Receiver artifact remains version 0.3.1, SHA-256 `acbd3946eb12397187bd5ea69584c3ec3b6f0b4e6b9bbadbf17e5c76fcf086dc`; receiver code did not change in this patch.

## Real receiver installation: not yet healthy

Before installation, Honored Feather had only its original installer and installer-staging Workers, zero KV namespaces and zero D1 databases. The owner explicitly approved a temporary token scoped only to this account, Workers Scripts/KV/D1 Edit and Account Settings Read, ending October 16 at 20:00 Tehran.

After the runtime fix, the public one-token UI created:

- `tehran-network-edge`, active version prefix `5f79c84c` (API deployment, 100% Ready in the dashboard).
- KV `tehran-network-edge-config`, bound as `C`.
- D1 `tehran-network-edge-control`, bound as `DB`.

The receiver's `/health` still returned Cloudflare's generic HTTP 500 / 1101 page (Ray `a4b05427aab5adfe-ATL`). A real-time log session connected but delivered no invocation or exception for the health probe. The same account had previously failed the small-worker control. This does not establish the internal Cloudflare cause, and a generic 1101 must not be reported as a passing installation.

The browser environment reset during the test and cleared its transient key and tab state. No plaintext API token was saved in files, commands, chat or logs. Temporary cross-tool handoff used one-use RSA-OAEP ciphertext with the private key only in process memory; the ciphertext and public-key files were removed after use.

## Remaining field gate

Use the personal account for an isolated receiver named `freepanel-edge-field-20261015`, preserving its existing live `tehran-network-edge` and associated data. A throwaway test bundle changes only the destination Worker-name literal; an exact reverse replacement reproduces the verified original bundle. It is not the production artifact. Its temporary token requires separate action-time consent because its account scope differs.

The prepared Xray harness uses the already installed official Xray 26.3.27 Windows binary. Xray accepts configuration via `stdin:`, so protocol credentials need not be saved in configuration files. The harness will verify admin session/CSRF, a private three-link subscription and actual TLS VLESS-WS, Trojan-WS and VLESS-XHTTP traffic, then disable its own test user. The harness has not yet run against a healthy receiver; do not claim those connections passed.

No production update, PR merge or stable release has been performed on the strength of these incomplete field results. No support or community message was sent.
