# Tehran Network Edge Panel — Agent Ledger

> قانون: قبل از هر کار این فایل خوانده شود. فقط کاری که واقعاً تست/تأیید شده `[x]` می‌شود. کار تکراری ممنوع.

## Phase 0 — Design & Governance

- [x] انتخاب معماری Serverless / No VPS
- [x] تایید برند Tehran Network
- [x] تایید UI فارسی/English و RTL/LTR
- [x] تایید Local-first Installer
- [x] تایید Clean Implementation
- [x] تایید Spec توسط مالک — 2026-09-19
- [x] تایید Scope V1 توسط مالک — 2026-09-19
- [x] MIT License
- [x] SECURITY.md دو زبانه
- [x] Third-party policy

## Foundation Milestone

- [x] Task 1 Governance
- [x] Task 2 Monorepo & Toolchain
- [x] Task 3 i18n
- [x] Task 4 Design System
- [x] Task 5 Dashboard Preview
- [x] Task 6 Installer Token Safety
- [x] Task 7 CI
- [x] Task 8 GitHub Discoverability
- [x] Task 9 Milestone Verification

## Cloudflare Auto Deployer Milestone

- [ ] Task 1 Cloudflare API client + token verification
- [ ] Task 2 Account discovery + explicit multi-account selection
- [ ] Task 3 Idempotent KV provisioning
- [ ] Task 4 Deployable Tehran Network bootstrap Worker
- [ ] Task 5 Worker upload + KV binding + workers.dev enablement
- [ ] Task 6 Local-only /api/install orchestrator
- [ ] Task 7 Installer UX + full mocked deploy E2E
- [ ] Task 8 Documentation + final verification

## Release v0.1.0

- [x] Official Deploy to Cloudflare template
- [x] Automatic KV provisioning (`C`)
- [x] Persian installation guide
- [x] English installation guide
- [ ] Publish graphical installer to GitHub Pages (workflow permission required)
- [ ] Publish GitHub Release `v0.1.0`

## Three-Protocol Worker Milestone

- [x] Shared destination validation + constant-time auth primitives
- [x] VLESS TCP parser
- [x] Trojan TCP parser + SHA-224 auth
- [x] Protected protocol config in KV
- [x] WebSocket ↔ TCP bridge
- [x] VLESS-WS runtime route
- [x] Trojan-WS runtime route
- [x] VLESS-XHTTP stream-one runtime route
- [x] Owner panel + QR + protected subscription
- [x] Workerd end-to-end test: VLESS-WS / Trojan-WS / XHTTP / negative auth
- [x] Final release verification
- [x] Push tested release to GitHub
- [ ] Publish GitHub Release `v0.1.0`

## V1 Future Work

- [x] Installer links directly to official pre-filled Cloudflare Workers token template
- [x] Installer token stays volatile and clears after install handoff
- [ ] Local /api/install deployer backend performs real Cloudflare installation
- [ ] Cloudflare scoped-token verification
- [ ] Account discovery
- [ ] KV create/reuse/bind
- [ ] Worker upload/update/rollback
- [ ] workers.dev enablement
- [x] Admin auth/session
- [x] VLESS core
- [x] Trojan core
- [x] XHTTP core
- [ ] Direct/SOCKS5/HTTP(S) outbound
- [ ] Smart endpoints + rotation
- [x] Subscription generator
- [ ] DNS/ECH
- [ ] Network Lab
- [ ] Redacted logs/diagnostics
- [ ] Backup/Restore
- [ ] Safe upgrade
- [x] Release + changelog

## Post-v0.1 Competitive / Field-Test Milestone — 2026-09-20

- [x] Free token-based installer implemented: Generate Cloudflare Key → Paste → Account → automatic KV/Worker/Secret/workers.dev
- [x] Installer unit suite + browser E2E green before field test
- [x] Clean-user field install completed by owner from separate Cloudflare account
- [x] Real VLESS-WS connectivity confirmed by owner on deployed workers.dev panel
- [x] Removed fixed 16-character ADMIN_PASSWORD minimum; any non-empty owner password accepted (UI + shared validator + deployed panel setup form + tests)
- [x] XHTTP production failure root-caused from Xray-core source, Cloudflare gRPC docs and the official XHTTP discussion: stream-one clients send `Content-Type: application/grpc` unless `noGRPCHeader` is set, and the Worker answered SSE (`text/event-stream`) to those gRPC-typed requests — the exact pattern flagged as CDN-problematic; fixed by answering `application/octet-stream` + `X-Accel-Buffering: no` and sharing `extra={"noGRPCHeader":true}` in the generated link
- [x] Redacted XHTTP attempt diagnostics (`xhttpDiag` in `/api/status`, KV key `diag:xhttp:v1`) added so the next field retest discriminates edge-level blocking (flat attempts) from Worker-level errors (attempts with status); stores only counters/status/timestamps — never credentials, UUIDs or IPs
- [x] Local workerd E2E re-run after fix: VLESS-WS / Trojan-WS / VLESS-XHTTP stream-one / negative-auth all PASS; full gate PASS (format + lint + typecheck + 118 tests + build incl. installer-worker dry-run)
- [ ] **Field retest required:** owner re-imports the regenerated XHTTP link (or reinstalls) and confirms stream-one on the real deployment; if the client still fails, read `xhttpDiag.attempts` on `/api/status`: `0` ⇒ Cloudflare edge blocks before the Worker (gRPC classification/bot challenge — escalate to stream-up/packet-up design), `>0` ⇒ inspect the recorded status codes
- [ ] Competitive transport/protocol expansion after field-stable core; benchmark BPB + yonggekkk/3Kmfi6HP-style Worker panels before adding each feature
- [ ] Clean IP / preferred endpoint support with manual IP/domain list, operator-aware testing, health/latency metadata and safe fallback
- [ ] ProxyIP / chain outbound support for fixed egress where Cloudflare Worker architecture permits it
- [ ] Community Clean-IP Registry in this GitHub project: store candidate endpoint + first/last-seen date + daily confirmation/use counts; never store Cloudflare tokens, VPN credentials or user identity
- [ ] Panel shows dated Trending Clean IPs (e.g. confirmations today / recent success) and lets each installer opt to contribute a tested endpoint
- [ ] Fragment controls for compatible subscription outputs
- [ ] Private/custom DoH + DNS settings
- [ ] Routing profiles and QUIC/LAN/ad-malware blocking options in generated client configs
- [ ] Chain proxy inputs: VLESS / Trojan / Shadowsocks / SOCKS / HTTP where supported by generated client config / architecture
- [ ] Subscription output parity for Xray, Sing-box and Clash/Mihomo; proxy aggregation/node-sharing evaluated after core reliability
- [ ] Warp/WireGuard and Warp endpoint scanner evaluated as separate module; do not claim Worker UDP support for VLESS/Trojan

## Release v0.2.0 — Free Token Installer Publication — 2026-09-20

- [x] Stale embedded edge artifact detected and regenerated: committed artifact predated the XHTTP stream-one fix, so the installer would have uploaded the old Worker; fresh artifact is `v0.2.0` / SHA-256 `52cdcff6bd5fd2d64aac793bb295ec73f668aadd148cc78867f26e4e98d14abc`
- [x] Version bump to `0.2.0` across root, `deploy/worker` (+ lockfile sync) and `apps/installer-worker`; panel `VERSION` kept in parity with artifact health-check
- [x] `apps/installer/dist` committed (gitignore negation) so the Deploy-to-Cloudflare button installs the installer without a build step; `dist/installer-artifacts` manifest negation added too
- [x] README reworked: **Deploy Installer** is now the primary install action (token flow), old Deploy to Cloudflare labeled Developer/advanced path; roadmap updated
- [x] INSTALL_FA/INSTALL_EN rewritten around the free token flow: Generate Key → Paste → Verify → Account → Install → panel URL, plus error meanings (`token-invalid`, `insufficient-scope`, `health-failed`) and workers.dev restriction note
- [x] `scripts/release-install-contract.test.ts` updated to pin the new primary/developer path order, token scopes, v0.2.0 manifest and committed installer dist
- [x] CHANGELOG published as `v0.2.0` with the free token installer, XHTTP fix, ADMIN_PASSWORD relax and artifact refresh
- [x] Full local gates re-run on the release candidate: `pnpm check` (format + lint + typecheck + 118 tests + build + installer dry-run), `deploy/worker` check (72 tests), workerd E2E (VLESS-WS / Trojan-WS / XHTTP stream-one / negative-auth PASS), `wrangler deploy --dry-run` with KV binding `C`
- [ ] Owner deploys the installer via the README button and performs the real token install (field retest including XHTTP stream-one)
- [ ] GitHub Release `v0.2.0` published after CI green on `main`

## No-Terminal Web Install First + Self-Contained Deploy Button — 2026-09-20

- [x] Owner feedback: PowerShell/script path errored (download hosts filtered in Iran) and the owner refuses any terminal — primary install path must be a pure link flow (Deploy button → installer page → token → Paste → Install)
- [x] Re-verified Cloudflare API has no CORS; the web wizard (served by installer-worker, same-origin `/api/*`) remains the only no-terminal provisioning mechanism
- [x] `apps/installer-worker` made fully self-contained: runtime validators vendored into `src/validation.ts`, remaining `@tehrannetwork/shared` imports are `import type` only, tsconfig `paths` resolves shared types from source, all `workspace:*` deps removed from package.json + lockfile — the Deploy button builds with any package manager or no install at all (verified: `wrangler deploy --dry-run --outdir` bundle has zero workspace references)
- [x] Installer UI: auto-generates a strong admin password (18 chars, crypto.getRandomValues, no ambiguous glyphs) with a "New password" button; result screen now shows the panel URL **and** the admin password with copy buttons — no typing beyond the token
- [x] README + INSTALL_FA/EN restructured: no-terminal web flow is path 1 (3-click table), terminal scripts demoted to a collapsible alternative with an Iran-filter warning; contract test updated (self-containment + path order)
- [ ] Owner: click **Deploy Installer** → open the shown `*.workers.dev` link → Generate Key → Create Token → Paste → Install → confirm panel URL + auto password work (field retest including XHTTP stream-one)

## Script Easy Installer — 2026-09-20

- [x] Cloudflare API CORS checked: no `access-control-allow-origin` on api.cloudflare.com — browser-only static installer impossible; terminal scripts CAN call the API directly
- [x] `install.sh` (bash, Linux/macOS/WSL/Git Bash): token paste → verify → account pick → KV → multipart Worker upload (KV `C` + `secret_text` in metadata) → subdomain → workers.dev enable → health → `/api/setup` link printing; jq preferred with pure sed/grep fallback (`TN_NO_JQ=1`)
- [x] `install.ps1` (Windows PowerShell 5.1+): same flow with manual multipart construction, raw→jsDelivr fallback download and SHA-256 verification; UTF-8 BOM for Persian output
- [x] `dist/edge-worker.js` raw bundle committed and manifest extended (`file` field); build script emits TS + manifest + raw bundle from one build so all three share SHA `0b24b3d6…`
- [x] `scripts/mock-cloudflare-api.py` added; both scripts tested E2E against the mock (bash with and without jq; pwsh 7.4.6 on Linux) — correct upload metadata, health and links output
- [x] README + INSTALL_FA/EN document the script path as the fastest route (`irm … | iex` / `curl … && bash install.sh`)
- [ ] Owner runs the script with a real token (paste → panel URL) and confirms VLESS-WS connectivity

### Competitive references checked 2026-09-20

- BPB-Worker-Panel current README: VLESS, Trojan, Warp, private DoH, Fragment, routing rules, chain proxies (VLESS/Trojan/Shadowsocks/SOCKS/HTTP), Clean IP/domain, Proxy IP, Warp endpoints, Xray/Sing-box/Clash-Mihomo subscriptions, node sharing and aggregation.
- BPB explicitly documents that VLESS/Trojan UDP on Workers is not reliable; Tehran Network must not advertise unsupported UDP merely to increase protocol count.
- Product rule: keep install free/no-VPS/no-custom-domain for normal users; new features must not reintroduce GitHub connection, local Wrangler, or paid infrastructure.

## Direct Public Installer Publication — 2026-09-20

- [x] Re-read approved free-token installer spec/plan: normal user path explicitly requires GitHub README → public Tehran Network `workers.dev` installer → Generate Key → Paste → Install; user must NOT deploy the installer first.
- [x] Root cause of current UX regression identified: commit `2c19573` made `Deploy Installer` the README primary action, contradicting the already-approved Task 5 public-installer design.
- [x] Fresh public installer candidate deployed from current `main`: `https://tehran-network-installer.honored-feather.workers.dev`.
- [x] Public smoke: installer root HTTP 200 with Tehran Network UI; synthetic invalid token returns HTTP 401 / `token-invalid` without raw Cloudflare body.
- [x] TDD docs contract changed to require the direct public installer before all developer/self-host paths; README + INSTALL_FA/EN updated accordingly.
- [x] Privacy wording corrected for hosted installer: scoped token traverses the installer Worker over HTTPS for the current request but is never persisted/logged; VPN traffic never traverses Tehran Network installer infrastructure.
- [x] Owner claimed the Cloudflare preview account; screenshot-confirmed persistent public installer opens at `https://tehran-network-installer.honored-feather.workers.dev`.
- [ ] Real-token smoke on the claimed public installer: Verify → account → Install → `/health` → VLESS-WS plus Trojan/XHTTP field retest.
- [x] Owner explicitly approved publishing the direct public-installer entry point to `main` for the final real-token field test; README must no longer require each user to deploy the installer first.

## Locked Regular-User Install UX — 2026-09-20

- [x] Public installer is live and externally verified: `https://tehran-network-installer.honored-feather.workers.dev` returns HTTP 200 and `/api/token/verify` handles requests.
- [x] README regular-user flow is locked to exactly one primary action: **Install Free on Cloudflare / Open Installer**.
- [x] Regular users must never be asked to deploy the installer, connect GitHub, use Wrangler, create KV/Workers manually, or open a terminal.
- [x] Required user flow: GitHub button → public installer → Generate Cloudflare Key → Cloudflare Create Token → Copy → Paste → Install → receive panel URL + admin password.
- [x] Deploy-to-Cloudflare/self-host/terminal paths are removed from the public README landing flow; technical alternatives belong only in developer documentation.
- [ ] Owner field-retests the exact README button flow and reports Token / Install / VLESS-WS / Trojan-WS / XHTTP results.

## Admin Password Field Bug Fix — 2026-09-20

- [x] Field report reproduced conceptually across two independent Cloudflare installs: install succeeds, selected/admin password is rejected by deployed panel.
- [x] Root cause #1 confirmed with RED test: installer accepts any non-empty password, but deployed Worker still rejected configured secrets shorter than 16 characters in `deploy/worker/src/config/admin.ts`. Runtime validation now matches installer policy: only empty/placeholder values are rejected.
- [x] Root cause #2 hardened: `ADMIN_PASSWORD` is now uploaded atomically as a `secret_text` binding in the same multipart Worker deploy as KV `C`, instead of a second `/secrets` call that creates a separate Worker version.
- [x] Regression tests added for 1/5/10-character passwords and for atomic KV + secret metadata upload; focused suite PASS (19 tests).
- [x] Embedded edge Worker artifact regenerated from the fixed source.
- [x] Full repository gate PASS: format, lint, typecheck, 124 tests, build; browser E2E PASS 6/6 after clearing stale local preview ports.
- [x] Fix pushed to `main` as `59f05ca` and GitHub CI run `35504024677` completed successfully.
- [x] Fixed temporary installer deployed for immediate field retest: `https://tehran-network-installer.slow-saturday.workers.dev`.
- [ ] Stable public installer `https://tehran-network-installer.honored-feather.workers.dev` is still on the previous deployment and must NOT be used for this password retest until redeployed.
- [ ] After owner confirms the fixed temporary installer accepts the chosen password, promote/claim the fixed installer and switch README primary link if needed.

## Handoff Notes

- مالک در 2026-09-19 Spec، Scope و اجرای Native را تایید کرد.
- شاخه توسعه: `dev/tehran-edge-v1`.
- Foundation در 2026-09-19 با Unit، Build، Desktop/Mobile E2E، Secret scan و تصاویر واقعی verify شد.
- هسته سه‌موتوره در 2026-09-19 با Wrangler/workerd واقعی و اتصال TCP به مقصد عمومی verify شد.
- VLESS-WS، Trojan-WS، VLESS-XHTTP stream-one و negative-auth همگی PASS شدند.
- Xray-core v26.9.9 به‌عنوان کلاینت واقعی برای هر سه مسیر تست شد و هر سه از طریق SOCKS به مقصد HTTP واقعی متصل شدند.
- انتشار فقط بعد از Quality Gate نهایی و Push انجام می‌شود.
- Session 2026-09-20 (release prep): branch `feat/cloudflare-free-token-installer` verified end-to-end locally, stale artifact regenerated, docs/contracts switched to the free token installer as primary path, release candidate committed for merge into `main` + tag `v0.2.0` after CI.
- Field test 2026-09-20: owner installed from a separate Cloudflare account; VLESS-WS connection works in real use; XHTTP currently does not and is the immediate P0 debug target.
- Current feature branch published for testing: `feat/cloudflare-free-token-installer`; local worktree may still retain the older branch name.
- Immediate order after reading this file: (1) commit/push this ledger, (2) relax ADMIN_PASSWORD minimum with TDD, (3) reproduce/fix production XHTTP with real Xray semantics, (4) design Clean-IP/ProxyIP + GitHub community registry, (5) expand only tested protocols/transports.
- Session 2026-09-20 (XHTTP P0): `7f05672` already contained the ADMIN_PASSWORD fix; verified instead of redoing. XHTTP root cause was chased through Xray-core sources (`splithttp/config.go` `FillStreamRequest` sets `Content-Type: application/grpc`; `client.go` requires HTTP 200 and never checks response content-type; default padding goes to the `Referer` header, not the body), Cloudflare docs (gRPC content-type without the zone toggle ⇒ edge answers 403 before origin; no toggle exists for workers.dev) and cmliu/edgetunnel (field-proven: `application/octet-stream` + `X-Accel-Buffering: no` response). Fixes shipped with TDD: octet-stream response, `extra={"noGRPCHeader":true}` in the XHTTP link (+ `host=` parity), redacted `xhttpDiag` in `/api/status`, and `@tehrannetwork/installer` added to installer-worker devDependencies so `pnpm -r build` orders the installer dist before the wrangler dry-run (gate was order-flaky).
- Local workerd E2E from a clean checkout: `cd deploy/worker && pnpm install --ignore-workspace && node test/protocol-e2e.mjs` (deps are outside the pnpm workspace on purpose; do not commit the generated lockfile).

## Complete Cloudflare-Only Control Plane — Design Gate — 2026-09-20

- [x] Re-read current `main`, recent commits and this ledger before starting the expansion.
- [x] Re-reviewed current reference capabilities: CFnew, BPB Worker Panel, CFNext, Nahan, Nova Proxy, Re_edgetunnel, edcloudwasm and SubLink Worker.
- [x] Re-checked current official Cloudflare Free limits for Workers, KV and D1 before choosing the storage split.
- [x] Architecture decision captured: D1 is authoritative for users/quota/expiry/usage/audit/sessions; KV is low-write config/cache/feature state; isolate memory is cache only.
- [x] Normal-user install remains Cloudflare-only/no-terminal/no-VPS/no-Docker/no-paid-domain and keeps the public scoped-token installer flow.
- [x] Full design written to `docs/superpowers/specs/2026-09-20-cloudflare-only-complete-panel-design.md`.
- [x] Owner reviewed and approved the written design — 2026-09-20.
- [x] Phase A implementation plan written and self-reviewed: `docs/superpowers/plans/2026-09-20-phase-a-control-plane.md` — 2026-09-20.
- [x] Owner reviewed the implementation plan and chose Native/inline execution — 2026-09-20.
- [ ] Phase A implementation: D1 provisioning + migrations + multi-user/quota/expiry/private links/audit + redesigned dashboard shell.
- [ ] Phase B implementation: native multi-format subscription engine.
- [ ] Phase C implementation: Clean-IP/preferred endpoint platform + optional privacy-preserving community registry.
- [ ] Phase D implementation: ProxyIP/chain/DNS/ECH/routing.
- [ ] Phase E implementation: WARP/Fragment/extra clients/Shadowsocks only after separate tests.
- [ ] Phase F: security hardening, Free-plan budget tests, clean-account real Cloudflare field verification and release docs.

### Phase A Task 1 — D1 schema/migration engine — 2026-09-20

- [x] RED observed: `pnpm --dir deploy/worker test -- src/db/migrations.test.ts` failed because `./migrations` did not exist.
- [x] D1 schema v1 added with installation state, admin/session, users, credential indexes, subscription tokens, daily usage, audit/login/throttle tables.
- [x] Persistent 32-byte installation seed initialization is race-safe (`INSERT OR IGNORE`) and corrupted state/checksum fails closed.
- [x] Canonical SQL import is bundled as text; build script has `.sql` text loader and Wrangler has matching Text-module rule.
- [x] `Env` now declares `DB` and `INSTALL_GENERATION`; local Wrangler config includes KV + D1 + install-generation bindings.
- [x] GREEN: worker test suite 14 files / 78 tests passed, including 4 migration tests.
- [x] GREEN: root suite 32 files / 128 tests passed after artifact-loader contract update.
- [x] GREEN: `pnpm --dir deploy/worker typecheck` passed.
- [x] Real local Wrangler D1: migration SQL applied twice idempotently; `installation_state`, `users`, `usage_daily`, `idx_sessions_expiry` verified present.
- [x] Wrangler dry-run passed; bindings reported `C`, `DB`, `INSTALL_GENERATION`; upload 74.50 KiB / gzip 20.65 KiB.

### Phase A Task 2 — One-click D1 provisioning — 2026-09-20

- [x] RED observed: D1 resolver absent, D1/install-generation bindings absent, provisioning skipped D1, token template/docs lacked D1 Write, and `/health` did not prove schema readiness.
- [x] Installer API now reuses/creates deterministic `${workerName}-control` D1 databases via Cloudflare API; retry resolves KV + D1 again instead of duplicating named resources.
- [x] Worker upload metadata atomically binds `C`, `DB`, `ADMIN_PASSWORD`, and non-secret `INSTALL_GENERATION`.
- [x] Installer token template/docs now require exactly Workers Scripts Edit, Workers KV Storage Edit, D1 Write, Account Settings Read.
- [x] Provisioning health succeeds only when artifact version matches and Worker reports `d1:true` + `schemaVersion:1`; result includes `/admin` URL and schema version.
- [x] Embedded Worker artifact regenerated from current source; migration SQL and D1 health gate verified present in `dist/edge-worker.js`.
- [x] Tooling ruling verified: Wrangler Text modules require bare `.sql`; root/worker Vitest use test-only SQL text loaders. Worker Wrangler dry-run passes with canonical SQL bundled.
- [x] GREEN: root suite 33 files / 130 tests passed.
- [x] GREEN: root workspace typecheck passed; standalone Worker typecheck passed.
- [x] GREEN: Worker Wrangler dry-run passed (80.08 KiB / gzip 22.05 KiB) with C + DB + INSTALL_GENERATION bindings.
- [x] GREEN: installer-worker Wrangler dry-run build passed (93.12 KiB / gzip 25.08 KiB).

### Phase A Task 3 — Secure admin auth/session/CSRF — 2026-09-20

- [x] RED observed for missing PBKDF2 credential/session/auth-route APIs, then route-specific RED for session/logout/password CSRF behavior.
- [x] Admin password is authoritative in D1 after one-time `INSTALL_GENERATION` bootstrap; PBKDF2-HMAC-SHA-256 uses 100,000 iterations and stores no plaintext password.
- [x] D1 sessions store only hashed 32-byte tokens, use 12-hour absolute TTL, password-version invalidation, `HttpOnly; Secure; SameSite=Strict` session cookie, and D1-bound CSRF hash.
- [x] Login throttle blocks the ninth failure in 15 minutes using HMAC(installation seed, source IP); raw IP and candidate password are never stored or logged.
- [x] Login/session/logout/password routes and legacy setup handoff now use the same D1 credential authority; password changes invalidate every session.
- [x] Real Workerd exposed D1 `exec()` newline semantics; migration execution now normalizes canonical SQL to one complete statement per line while checksum remains over exact source bytes.
- [x] Workerd benchmark: 20 success median/p95 137.063/162.983 ms; 20 failure median/p95 131.522/151.766 ms wall-clock. Task 9 remains the Cloudflare Free CPU field gate.
- [x] GREEN: focused Worker suite 18 files / 90 tests passed; root suite 36 files / 141 tests passed; root + Worker typechecks passed.
- [x] GREEN: Worker Wrangler dry-run passed (97.62 KiB / gzip 26.21 KiB); installer-worker dry-run build passed (109.76 KiB / gzip 28.94 KiB).

### Phase A Task 4 — Audited multi-user control API — 2026-09-20

- [x] RED observed for absent user repository/Admin API, plus RED at Worker integration before `/api/overview` was routed.
- [x] User CRUD validates bounded Unicode names/notes, safe quotas/expiry, protocol flags and unknown fields; IDs are UUIDv4 and updates use optimistic `version` checks.
- [x] Authenticated REST endpoints now expose overview, users, audit and login-event reads; every mutation requires the D1 admin session plus matching CSRF.
- [x] Mutations write redacted stable audit actions (`user.create/update/delete/pause/resume`); audit/login retention is bounded to 5,000/1,000 rows without cron/VPS.
- [x] Malformed JSON, invalid UUIDs, oversized fields, invalid quota types/ranges, stale versions and bad CSRF return local 4xx codes without raw D1/SQL detail.
- [x] Shared JSON DTOs added for panel/test consumers without introducing a Worker runtime workspace dependency.
- [x] Real local Workerd+D1 smoke passed: health/login → user create → optimistic PATCH v1→v2 → audit read (`user.create`, `user.update`).
- [x] GREEN: focused Worker suite 20 files / 111 tests passed; root suite 38 files / 162 tests passed; Worker + root workspace typechecks passed.
- [x] GREEN: Worker Wrangler dry-run passed (112.99 KiB / gzip 29.37 KiB); installer-worker dry-run build passed (124.54 KiB / gzip 31.89 KiB).

### Phase A Task 5 — Private derived per-user access — 2026-09-20

- [x] RED observed for missing HMAC-derived secret module, per-user subscription lookup and access/rotation Admin API.
- [x] Per-user subscription token, VLESS UUID and Trojan password are deterministically HMAC-derived from the persistent 32-byte installation seed with purpose/version separation.
- [x] D1 persists only secret versions + SHA-256 lookup hashes; raw subscription/VLESS/Trojan secrets remain reproducible and are never stored.
- [x] User creation can atomically batch the user row plus subscription/VLESS/Trojan indexes; per-secret rotation changes only the requested version/index.
- [x] `/sub/<token>` preserves the legacy owner link and adds private per-user rendering with protocol toggles, expiry, enabled, total quota and UTC daily-quota checks.
- [x] Invalid/probing/expired/disabled/exhausted tokens all return the same no-store `404 Not found`; old subscription tokens become invalid immediately after rotation.
- [x] Authenticated access/rotation APIs expose QR-ready subscription metadata and current derived client credentials without installation seed/admin material.
- [x] Workerd+D1 smoke passed v1 subscription → rotate → old 404/new 200; VLESS stayed stable and D1 index rows contained lookup hashes but no raw access secrets.
- [x] GREEN: focused Worker suite 22 files / 121 tests passed; root suite 40 files / 172 tests passed; Worker + root typechecks passed.
- [x] GREEN: Worker Wrangler dry-run passed (126.68 KiB / gzip 31.78 KiB); installer-worker dry-run build passed.

### Phase A Task 6 — Per-user tunnel authentication — 2026-09-20

- [x] RED observed for missing candidate parsers/tunnel resolver and for synchronous-only first-packet authorization.
- [x] VLESS/Trojan parsing is split into candidate parsing plus legacy wrappers; legacy parser error/auth ordering remains regression-compatible.
- [x] WebSocket and XHTTP transports now await async authorization before any TCP connect.
- [x] D1 tunnel lookup hashes exact wire credentials; Trojan indexes normalize to the SHA-224 wire form while raw derived passwords remain unstored.
- [x] Indexed users enforce enabled/expiry/total quota/daily quota plus per-channel VLESS/Trojan/XHTTP flags; denied indexed users never fall through to owner credentials.
- [x] VLESS-WS, Trojan-WS and VLESS-XHTTP routes attach exact per-user principals; `not-found` alone may use constant-time legacy-owner fallback.
- [x] Two independent VLESS users, per-user Trojan, paused-user denial, XHTTP channel authorization and owner compatibility are pinned in route/security tests.
- [x] Protocol E2E passed: VLESS-WS, Trojan-WS, VLESS-XHTTP stream-one and negative-auth.
- [x] GREEN: focused Worker suite 23 files / 134 tests passed; root suite 41 files / 185 tests passed; Worker + root workspace typechecks passed.
- [x] GREEN: Worker Wrangler dry-run passed (132.29 KiB / gzip 32.73 KiB); installer-worker dry-run passed (142.53 KiB / gzip 34.97 KiB).

### Phase A Task 7 — Coarse usage accounting and quota checkpoints — 2026-09-20

- [x] RED observed for absent D1 usage repository/meter and for transports that did not account proxied payload.
- [x] D1 usage writes atomically increment user totals + UTC daily upload/download/total/connections; `NULL` quota means unlimited and numeric `0` is exhausted.
- [x] UsageMeter keeps packet traffic in memory and checkpoints only at 4 MiB, 60 seconds, or close; concurrent flushes are serialized and a zero-payload successful connection is counted once.
- [x] WebSocket/XHTTP count proxied payload only (not handshake bytes or VLESS response headers) and stop after a checkpoint reports quota exhaustion.
- [x] Legacy owner tunnels remain zero-accounting; only exact per-user tunnel principals receive a meter.
- [x] `/api/usage`, `/api/users/:id/usage` and overview metrics expose UTC usage, enabled/recent users, today/total bytes and seven-day expiry warnings.
- [x] Parallel-meter quota tests preserve both SQL deltas and converge to exhausted state without per-packet D1 writes.
- [x] Real local Workerd+D1 smoke preserved concurrent deltas exactly: upload 500, download 700, total 1200, connections 2; aggregate/read-access matched the stored row.
- [x] README labels enforcement honestly as periodic edge quota enforcement, not exact packet billing; overshoot bound is checkpoint size × concurrent connections.
- [x] GREEN: Worker suite 25 files / 146 tests passed; root suite 43 files / 197 tests passed; Worker + root workspace typechecks passed.
- [x] GREEN: protocol E2E passed all four gates; Worker Wrangler dry-run passed (143.40 KiB / gzip 34.89 KiB); installer-worker dry-run passed (153.22 KiB / gzip 36.97 KiB).

### Phase A Task 8 — Embedded React control-plane dashboard — 2026-09-21

- [x] Real React `/admin` replaces the placeholder owner UI and keeps a login gate backed by D1 sessions/CSRF.
- [x] Overview, Users, Usage and Security/Audit views consume the real Worker APIs; FA RTL and EN LTR are covered by UI/browser tests.
- [x] User create/edit/pause/resume, quota/expiry, private access/QR and rotation workflows are wired to production APIs rather than demo state.
- [x] Vite output is converted into committed `panelAssets.ts` and embedded into the Worker; no external runtime JS/CSS dependency is required.
- [x] Public `/` is a neutral status page; `/admin` is the supported management UI while legacy `/setup` and `/api/setup` remain compatibility endpoints.
- [x] Build/test/typecheck/dry-run gate passed before commit `586fcbe` (`feat: embed real React control plane`).

### Phase A Task 9 — Legacy/release gates — 2026-09-21

- [x] Step 1 legacy-upgrade regression: empty D1 migrates to schema 1 while exact existing `protocol:config:v1` remains unchanged; legacy owner subscription + VLESS-WS/Trojan-WS/XHTTP pass (`927f9af`).
- [x] Step 2 real Phase A local E2E: login → create user → private subscription → Xray VLESS-WS/Trojan-WS/VLESS-XHTTP → usage → pause/resume → quota denial → token rotation → credential rotation → legacy compatibility (`180da4b`).
- [x] Step 2 portability hardening: Xray-core `26.3.27` is pinned, SHA-256 verified and cached outside the repo when `XRAY_BIN` is not supplied; clean-HOME provisioning + full flow PASS (`e257104`).
- [x] Step 3 browser E2E covers the deployed dashboard workflows and responsive installer/dashboard UX (`dd7119b`).
- [x] Step 4 security regression gates cover secret sentinels, HTTP hardening, cookies, sanitized errors and private-token probing (`354d445`).
- [x] Step 5 release state bumped in lockstep to `0.3.0`; stale-manifest RED was observed before regeneration, then panel → edge artifact regeneration produced verified SHA-256 and version parity (`e5ec6f0`).
- [x] Step 6 bilingual Phase A operator/user/security docs verified; README/install/security/changelog contracts and formatting PASS.
- [x] Step 7 complete fresh local release gate: `pnpm install --frozen-lockfile`; `pnpm check` PASS (48 files / 214 tests at the full gate); Playwright PASS (10 passed / 2 intentional project skips); standalone Worker check PASS (26 files / 152 tests); owner protocol E2E PASS (VLESS-WS, Trojan-WS, VLESS-XHTTP stream-one, negative auth); Phase A Xray E2E PASS through usage/pause/resume/quota/token+credential rotation/legacy compatibility; Wrangler 4.135 dry-run PASS with `C`, `DB`, `INSTALL_GENERATION`; `ADMIN_PASSWORD` separately verified in `secrets.required` and installer upload metadata as `secret_text`; generated Worker contains no secret sentinel/value; dry bundle 451,007 bytes (<64 MiB). Follow-up release/security contract run PASS (48 files / 215 tests).
- [x] GitHub one-click field path prepared: permanent `one-click` branch contains a self-contained `apps/installer-worker` with embedded built assets; isolated copy + fresh `npm install` + Wrangler 4.135 dry-run PASS. README/FA/EN install docs expose the official Cloudflare Deploy Button and document the expected Account-selection screen.
- [ ] Step 8 real Cloudflare clean-account + existing-v0.2 field checklist. **Do not mark stable before this passes.**
- [ ] Step 9 release-candidate ledger/push state after local gate; field results must be a separate evidence commit.

Current implementation branch: `feat/complete-cloudflare-control-plane`. Older branch names in historical ledger entries are retained only as history and are not the current execution target.

### Installer UX correction — 2026-09-21

- [x] Rejected Cloudflare Deploy Button/Account Picker as a normal-user install path after live UI review.
- [x] GitHub install CTA is locked back to the public token installer: open installer → Generate scoped API Token → Paste/Verify → select account inside installer → Install.
- [x] README contract now forbids `deploy.workers.cloudflare.com` in the primary GitHub landing page.

### Field gate blocker — stale public installer / admin-password verification — 2026-09-21

- [x] Field screenshot proved the public installer deployed the legacy `/setup` Worker instead of the v0.3 `/admin` control plane.
- [x] Public installer fingerprint is stale (`index-fun4E7D7.js`) versus current RC installer asset (`index-BTANVrJZ.js`).
- [x] RED regression reproduced the installer flaw: health could pass and provisioning could return success without proving the displayed admin password was accepted.
- [x] Provisioning now requires a real `POST /api/auth/login` with the exact displayed password after v0.3 health/schema/D1 readiness; a rejected password prevents success.
- [x] Login rejection is fail-fast to avoid filling the Worker login throttle; transient network failures remain health-poll retryable.
- [x] Focused verification PASS: installer-worker typecheck, 19/19 installer-worker tests, Wrangler dry-run, 5/5 installer UI tests, formatting and `git diff --check`.
- [ ] Redeploy the central public installer with this v0.3 build, then repeat clean-account field installation. Do not mark v0.3 stable before that field run passes.
