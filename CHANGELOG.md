# Changelog

## v0.3.0 Release Candidate — 2026-09-21

Phase A adds the Cloudflare-only multi-user control plane. This entry records locally proven behavior only; the real Cloudflare field checklist is still pending and this release is not yet marked stable.

### Added

- D1 schema/migrations for installation state, admin sessions, users, per-user credential indexes, private subscription tokens, UTC usage, audit/login events and throttling.
- Real `/admin` React dashboard with Persian RTL / English LTR, overview, users, usage and security/audit views.
- Multi-user CRUD with optimistic versions, pause/resume, expiry, total quota, daily quota and per-channel VLESS/Trojan/XHTTP flags.
- Private per-user subscriptions and QR payloads with deterministic HMAC-derived VLESS UUID, Trojan password and subscription token; D1 stores only versions + lookup hashes.
- Per-user tunnel authentication for VLESS-WS, Trojan-WS and VLESS-XHTTP stream-one while preserving the legacy owner credentials/config.
- Coarse usage accounting and quota checkpoints at 4 MiB, 60 seconds or connection close; no per-packet billing claim.
- Subscription and protocol credential rotation, redacted audit trail, login telemetry/throttling, PBKDF2 admin credentials, D1 sessions and CSRF protection.
- Final regular-user installer UX is one-token only: Generate API Token → Paste → Install. Account selection, Worker name and admin password are automatic and no pre-install configuration form is shown.
- Installer success now requires v0.3 health/schema readiness plus a real `/api/auth/login` using the exact generated password, preventing false-success password handoffs.
- Installer Worker assets are rebuilt and synchronized deterministically from `apps/installer/dist`; stale public assets are deleted before every release build.

### Upgrade semantics

- Reinstalling the same Worker name reuses `${workerName}-config` KV and `${workerName}-control` D1. Existing protocol config, installation seed and per-user secret versions are preserved.
- A fresh `INSTALL_GENERATION` intentionally syncs the admin password once to the new value shown by the installer and invalidates older admin sessions. Existing user subscription/protocol credentials remain stable when persistent D1 state is preserved.

### Locally verified

- Legacy upgrade: schema 1 initializes on empty D1 while the existing KV protocol record remains byte-for-byte equivalent and owner VLESS-WS / Trojan-WS / XHTTP continue to connect.
- Phase A Xray-core flow: login → user create → private subscription → all three channels → usage → pause/resume → quota denial → subscription rotation → credential rotation → legacy compatibility.
- Desktop/mobile browser flows cover installer handoff and dashboard operations; release security scans cover secret sentinels and response hardening.
- Release version/artifact contract pins root package, Worker package, installer-worker, runtime health version and immutable manifest to `0.3.0`; generated Worker SHA-256 is verified.
- Final gate: repository `pnpm check` PASS with 48 test files / 216 tests; Playwright PASS 9 executed / 3 intentional project skips; standalone Worker PASS 26 files / 152 tests; VLESS-WS, Trojan-WS, VLESS-XHTTP stream-one, negative-auth, Phase A lifecycle and legacy-upgrade E2E all PASS.
- Final edge artifact: 434,492 bytes, SHA-256 `58ffdc316263268f1f5beb587dfabe716ec4d754758dae04ab8690f2dc37824f`.

### Not ready / pending

- Real Cloudflare clean-account + existing-v0.2 upgrade field gate is pending.
- Full Backup/Restore is not implemented.
- Speed limiting is not implemented; quota enforcement is checkpoint-based.

## Unreleased — 2026-09-20

### Changed

- **مسیر اول نصب دوباره «بدون ترمینال» شد:** README و راهنماها اکنون فلوی «Deploy Installer → لینک workers.dev → ساخت کلید → Paste → Install» را به‌عنوان مسیر پیشنهادی نشان می‌دهند و اسکریپت‌های ترمینال به بخش جایگزین منتقل شدند؛ دلیل: دانلود اسکریپت پشت فیلتر ایران خطا می‌دهد و کاربر ترمینال ندارد.
- **رمز مدیریت خودکار:** نصب‌کنندهٔ وب اکنون در گام تنظیمات یک رمز قوی تصادفی (18 نویسه، بدون نویسه‌های گیج‌کننده) تولید می‌کند و در صفحهٔ نتیجه همراه آدرس پنل با دکمهٔ کپی نمایش می‌دهد؛ کاربر می‌تواند آن را عوض کند.

### Fixed

- **مقاوم‌سازی دکمهٔ Deploy در برابر خطای build:** `apps/installer-worker` دیگر هیچ وابستگی `workspace:*` ندارد (توابع اعتبارسنجی به `src/validation.ts` vendored شدند، بقیهٔ importهای `@tehrannetwork/shared` فقط type هستند و tsconfig با `paths` مستقیماً به سورس shared ارجاع می‌دهد). باندل wrangler بدون هیچ نصبی و با هر package manager ساخته می‌شود — تست قرارداد جدید این را پین می‌کند.

### Added

- **نصب با اسکریپت (Easy Installer script edition):** `install.sh` برای Linux/macOS/WSL/Git Bash و `install.ps1` برای Windows PowerShell 5.1+. توکن را Paste می‌کنید؛ اسکریپت خودش توکن را verify می‌کند، حساب را پیدا/انتخاب می‌کند، KV را می‌سازد، Worker امضاشده را با بایندینگ `C` و سکرت `ADMIN_PASSWORD` آپلود می‌کند، workers.dev را فعال می‌کند، health را چک می‌کند و در پایان آدرس پنل + لینک‌های VLESS-WS/Trojan-WS/XHTTP و Subscription را چاپ می‌کند.
- باندل خام `dist/edge-worker.js` به مخزن اضافه شد تا اسکریپت‌ها بتوانند با بررسی SHA-256 (از `edge-worker-manifest.json`) آن را از GitHub یا jsDelivr دانلود کنند.
- `scripts/mock-cloudflare-api.py`: سرور Mock برای تست E2E اسکریپت‌ها بدون توکن واقعی.
- توکن در هر دو اسکریپت فقط در حافظه می‌ماند؛ در دیسک، تاریخچه یا خروجی نوشته نمی‌شود و پیام‌های خطای `token-invalid` / `insufficient-scope` به فارسی/انگلیسی نمایش داده می‌شود.

### Verified

- هر دو اسکریپت با Mock سرور به‌صورت E2E تست شدند (مسیر jq و مسیر بدون-jq در bash؛ PowerShell 7.4.6 روی لینوکس): آپلود با metadata درست (KV binding `C` + `secret_text`)، SHA-256 باندل درست، health و /api/setup پاس شدند.
- آرتیفکت (TS تولیدشده + manifest + باندل خام) از یک build مشترک بازتولید شد تا هر سه هم‌SHA باشند (`0b24b3d6…`).

## v0.2.0 — 2026-09-20

نسخهٔ «نصب رایگان با توکن Cloudflare» — کل مسیر نصب بدون VPS، دامنه، GitHub یا ترمینال.

### Added

- **نصب‌کنندهٔ رایگان مبتنی بر توکن Cloudflare** (`apps/installer-worker`): کلید بساز → Paste کن → Verify → انتخاب حساب → نصب خودکار KV/Worker/Secret/workers.dev با خروجی URL پنل.
- توکن کاربر فقط برای همان request پردازش می‌شود؛ در KV، کوکی، localStorage، sessionStorage، لاگ یا URL ذخیره نمی‌شود و پس از هر تلاش نصب از حافظهٔ مرورگر پاک می‌شود.
- Artifact امضاشدهٔ Worker با تأیید SHA-256 قبل از آپلود؛ نصب idempotent است و اجرای دوباره منبع تکراری نمی‌سازد.
- UI چهارمرحله‌ای فارسی/English با لینک پیش‌پرشدهٔ رسمی Token Builder کلادفلر (Workers Scripts Edit، Workers KV Storage Edit، Account Settings Read) و لینک اختیاری حذف توکن پس از نصب.
- دکمهٔ **Deploy Installer** در README به‌عنوان مسیر اصلی نصب؛ مسیر قبلی Deploy to Cloudflare به‌عنوان مسیر توسعه‌دهنده برچسب‌گذاری شد.
- `apps/installer/dist` به مخزن اضافه شد تا دکمهٔ Deploy بدون نیاز به build در خط لولهٔ Cloudflare کار کند.
- Diagnostics محدودشدهٔ XHTTP در `/api/status` (کلید KV `diag:xhttp:v1`): فقط شمارندهٔ تلاش/موفق، آخرین وضعیت HTTP و زمان — بدون هیچ credential، UUID یا IP — برای تفکیک خطای edge از خطای Worker در field retest.

### Fixed

- XHTTP stream-one برای deployment واقعی Cloudflare اصلاح شد: پاسخ Worker به‌جای `text/event-stream` اکنون `application/octet-stream` با `X-Accel-Buffering: no` است تا edge درخواست‌های gRPC-نما را درست پاس کند (ریشه‌یابی از سورس Xray، مستندات Cloudflare و discussion رسمی XHTTP).
- لینک اشتراک XHTTP اکنون `extra={"noGRPCHeader":true}` و `host=` را نیز ارسال می‌کند تا کلاینت Xray هدر `Content-Type: application/grpc` نفرستد و درخواست قبل از رسیدن به Worker به‌عنوان gRPC طبقه‌بندی نشود.
- حداقل رمز `ADMIN_PASSWORD` از ۱۶ کاراکتر اجباری به «هر مقدار غیرخالی» تغییر کرد (UI + اعتبارسنج مشترک + فرم Setup پنل + تست‌ها)؛ همچنان رمز قوی قویاً توصیه می‌شود.
- Artifact داخلی نصب‌کننده که منسوخ شده بود (فاقد فیکس XHTTP) با نسخهٔ تازه `v0.2.0` و SHA-256 روز بازتولید شد.

### Internal

- `@tehrannetwork/installer` به devDependencies مربوط به `installer-worker` اضافه شد تا ترتیب build در `pnpm -r build` قطعی باشد (dry-run Wrangler به `apps/installer/dist` نیاز دارد).
- نسخهٔ root، `deploy/worker` و `apps/installer-worker` به `0.2.0` ارتقا یافت و `VERSION` پنل با Artifact health-check همگام شد.

## v0.1.0 — 2026-09-19

اولین Release عمومی Tehran Network Edge Panel.

### Added

- رابط گرافیکی فارسی/English با RTL/LTR واقعی.
- Dashboard رنگی و Responsive.
- Installer امن با Token موقت در حافظه.
- سورس صفحه نصب گرافیکی در `docs/site` (انتشار GitHub Pages در این Release فعال نشده است).
- دکمه رسمی **Deploy to Cloudflare**.
- قالب مستقل `deploy/worker` برای نصب روی Cloudflare Workers.
- Provision خودکار KV و Binding با نام `C`.
- هسته واقعی VLESS over WebSocket + TLS.
- هسته واقعی Trojan over WebSocket + TLS.
- VLESS XHTTP در حالت `stream-one`.
- TCP forwarding با `cloudflare:sockets` و جلوگیری از مقصدهای private/loop/self.
- پنل Owner محافظت‌شده با `ADMIN_PASSWORD` مستقل.
- QR و لینک مستقیم کانفیگ‌ها.
- Subscription محافظت‌شده با فرمت‌های links/base64/Sing-box/Mihomo.
- تست end-to-end روی Wrangler/workerd برای هر سه پروتکل و تست auth منفی.
- تست اتصال واقعی هر سه مسیر با Xray-core v26.9.9 و SOCKS client.
- صفحه وضعیت Worker و API مسیر `/api/status`.
- README و راهنمای نصب کامل فارسی و انگلیسی.
- CI، تست Unit، تست مرورگر Desktop/Mobile و audit وابستگی‌ها.

### Not ready yet

- Smart endpoints / rotation
- Advanced API-token deployer backend
- Safe upgrade / rollback
- Multi-user / quota / expiry
