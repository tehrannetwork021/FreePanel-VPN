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

## V1 Future Work

- [x] Installer links directly to official pre-filled Cloudflare Workers token template
- [x] Installer token stays volatile and clears after install handoff
- [ ] Local /api/install deployer backend performs real Cloudflare installation
- [ ] Cloudflare scoped-token verification
- [ ] Account discovery
- [ ] KV create/reuse/bind
- [ ] Worker upload/update/rollback
- [ ] workers.dev enablement
- [ ] Admin auth/session
- [ ] VLESS core
- [ ] Trojan core
- [ ] XHTTP core
- [ ] Direct/SOCKS5/HTTP(S) outbound
- [ ] Smart endpoints + rotation
- [ ] Subscription generator
- [ ] DNS/ECH
- [ ] Network Lab
- [ ] Redacted logs/diagnostics
- [ ] Backup/Restore
- [ ] Safe upgrade
- [ ] Release + changelog

## Handoff Notes

- مالک در 2026-09-19 Spec، Scope و اجرای Native را تایید کرد.
- شاخه توسعه: `dev/tehran-edge-v1`.
- Foundation در 2026-09-19 با Unit، Build، Desktop/Mobile E2E، Secret scan و تصاویر واقعی verify شد.
- GitHub connector فعلی هنوز push ندارد؛ تا فعال شدن Write Access، توسعه روی workspace ایزوله سرور انجام می‌شود.
