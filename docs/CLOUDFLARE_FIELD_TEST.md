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
- Source commit `34bfd745927a441e0f79dfff231408465213c9f0` also passed every [CI job in run 38772987749](https://github.com/tehrannetwork021/FreePanel-VPN/actions/runs/38772987749): quality, browser-e2e and protocol-e2e (including the new real-workerd regression).
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

## Personal-account field test

The owner approved and manually created/rolled a token restricted to the personal account, Workers Scripts/KV/D1 Edit and Account Settings Read. The token table showed no expiry, despite the intended date. Its one-time secret was captured directly from the visible result into memory, verified active, and never printed or saved as plaintext. Account discovery returned only the approved personal account. After the checks, the owner explicitly approved deletion of this exact temporary token. The token was deleted through the dashboard; its filtered table then showed no results, and the transient key variable was cleared.

The preflight confirmed that `freepanel-edge-field-20261015`, its KV namespace and D1 database were absent. The existing personal `tehran-network-edge` was present and was never modified. The isolated installer bundle (872765 bytes, SHA-256 `33dc2a43d869be6a7a60341d50d5073d2e85d3ca8dd63c603f8e80b5e600207e`) changed only the destination Worker-name literal. Reversing that replacement reproduced the normal installer byte-for-byte.

After publishing the isolated bundle to the existing recovery installer, public `/api/health` and `/api/token/verify` both returned HTTP 200 (verification Ray `a4b089e26cc2bf9a-ATL`). The actual browser one-token install created the isolated Worker, KV and D1, but failed its receiver-health gate. Initial receiver version: `8d0f2abe-9be8-431f-b864-7800885c7bf1`.

The receiver's `/health` and `/api/status` returned Cloudflare's generic HTTP 500 / 1101 page. The deployed module read back from Cloudflare was 436597 UTF-8 bytes and matched the exact expected SHA-256 `acbd3946eb12397187bd5ea69584c3ec3b6f0b4e6b9bbadbf17e5c76fcf086dc`. Settings confirmed the correct KV namespace, D1 database, `ADMIN_PASSWORD` secret and `INSTALL_GENERATION`, compatibility date `2026-09-19`, and no flags. Its workers.dev route was enabled. Dashboard real-time Tail connected but delivered no event or exception for the failing health request (Ray `a4b09397aca8de55-ATL`). A failed CLI WebSocket transport is not evidence that Worker invocation logging succeeded.

## Controlled isolation and restoration

Only the new isolated receiver was used for these reversible controls. A minimal module with a fixed response first failed with the original bindings. A second minimal control removed KV/D1 and plain-text bindings while retaining the existing secret binding. After ten seconds, the deployments API confirmed control version `9bdaa08e-c5f1-435f-b076-671f59a87168` at 100%; its public health URL still returned HTTP 500 / 1101 instead of the fixed marker (Ray `a4b09eab7f25dce5-ATL`). The original receiver source and storage bindings were restored immediately; the restored health check remained 1101 (Ray `a4b09ec1bf76dce5-ATL`). No KV/D1 data was deleted.

This control narrows the problem beyond the panel's application logic and its storage bindings. It does not establish the internal platform cause or prove a repair. No speculative receiver code change was made on that evidence.

The recovery installer was restored to the normal destination and exact normal bundle SHA-256 `69191cee155e527b1bf3476e111dad97f1adcdcbefd09a94182c3353eb747edb`. Active restored version: `3f7c0d22-1190-4e68-afd8-aea1f846eab4`. Final checks:

- Recovery installer `/api/health`: HTTP 200, `ok=true`, edge version 0.3.1 (Ray `a4b0a07e5efcf5f5-ATL`).
- Preserved personal `tehran-network-edge` `/health`: HTTP 200, `ok=true`, version 0.2.0 (Ray `a4b0a085a9b3293e-ATL`).
- Isolated `freepanel-edge-field-20261015` `/health`: HTTP 500 / 1101 (Ray `a4b0a091e9c73ebb-ATL`).

The prepared Xray harness uses the already installed official Xray 26.3.27 Windows binary and configuration through `stdin:`. Admin login, private subscription and real VLESS-WS, Trojan-WS and VLESS-XHTTP field tests remain unexecuted because receiver health failed. No test user was created. Local protocol/CI success does not substitute for these field gates.

No production update, PR merge or stable release has been performed on the strength of these incomplete field results. No support or community message was sent.
