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
