# Changelog

## v0.1.0 — 2026-09-19

اولین Release عمومی Tehran Network Edge Panel.

### Added

- رابط گرافیکی فارسی/English با RTL/LTR واقعی.
- Dashboard رنگی و Responsive.
- Installer امن با Token موقت در حافظه.
- صفحه عمومی نصب گرافیکی روی GitHub Pages.
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
