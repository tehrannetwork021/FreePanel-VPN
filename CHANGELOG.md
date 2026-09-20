# Changelog

## Unreleased — 2026-09-20

### Fixed

- XHTTP stream-one برای deployment واقعی Cloudflare اصلاح شد: پاسخ Worker به‌جای `text/event-stream` اکنون `application/octet-stream` با `X-Accel-Buffering: no` است تا edge درخواست‌های gRPC-نما را درست پاس کند (ریشه‌یابی از سورس Xray، مستندات Cloudflare و discussion رسمی XHTTP).
- لینک اشتراک XHTTP اکنون `extra={"noGRPCHeader":true}` و `host=` را نیز ارسال می‌کند تا کلاینت Xray هدر `Content-Type: application/grpc` نفرستد و درخواست قبل از رسیدن به Worker به‌عنوان gRPC طبقه‌بندی نشود.

### Added

- Diagnostics محدودشدهٔ XHTTP در `/api/status` (کلید KV `diag:xhttp:v1`): فقط شمارندهٔ تلاش/موفق، آخرین وضعیت HTTP و زمان — بدون هیچ credential، UUID یا IP — برای تفکیک خطای edge از خطای Worker در field retest.

### Internal

- `@tehrannetwork/installer` به devDependencies مربوط به `installer-worker` اضافه شد تا ترتیب build در `pnpm -r build` قطعی باشد (dry-run Wrangler به `apps/installer/dist` نیاز دارد).

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
