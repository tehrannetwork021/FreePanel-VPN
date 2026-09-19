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
- [x] Graphical GitHub Pages installer landing
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
- [ ] Push tested release to GitHub
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

## Handoff Notes

- مالک در 2026-09-19 Spec، Scope و اجرای Native را تایید کرد.
- شاخه توسعه: `dev/tehran-edge-v1`.
- Foundation در 2026-09-19 با Unit، Build، Desktop/Mobile E2E، Secret scan و تصاویر واقعی verify شد.
- هسته سه‌موتوره در 2026-09-19 با Wrangler/workerd واقعی و اتصال TCP به مقصد عمومی verify شد.
- VLESS-WS، Trojan-WS، VLESS-XHTTP stream-one و negative-auth همگی PASS شدند.
- Xray-core v26.9.9 به‌عنوان کلاینت واقعی برای هر سه مسیر تست شد و هر سه از طریق SOCKS به مقصد HTTP واقعی متصل شدند.
- انتشار فقط بعد از Quality Gate نهایی و Push انجام می‌شود.
