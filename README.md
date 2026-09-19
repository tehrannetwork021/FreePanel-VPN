<div align="center">

# Tehran Network Edge Panel

**پنل Serverless رنگی و دو زبانه برای Cloudflare Workers — بدون VPS شخصی**
**A colorful bilingual serverless edge panel for Cloudflare Workers — no personal VPS required**

[فارسی](#فارسی) · [English](#english) · [Security](SECURITY.md) · [Roadmap](#نقشه-راه--roadmap)

![CI](https://github.com/tehrannetwork021/FreePanel-VPN/actions/workflows/ci.yml/badge.svg)
![License](https://img.shields.io/badge/license-MIT-8d6bff)
![Node](https://img.shields.io/badge/node-%3E%3D22-27e7ff)
![pnpm](https://img.shields.io/badge/pnpm-10.15.1-ffad42)
![RTL](https://img.shields.io/badge/Persian-RTL-8dff6a)

### 🚀 نصب / Install

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/tehrannetwork021/FreePanel-VPN/tree/main/deploy/worker)

**[راهنمای فارسی](docs/INSTALL_FA.md)** · **[English guide](docs/INSTALL_EN.md)**

</div>

> [!IMPORTANT]
> **وضعیت فعلی:** نسخه `v0.1.0` برای نصب مستقیم روی Cloudflare آماده است و هسته‌های **VLESS-WS، Trojan-WS و VLESS-XHTTP stream-one** با تست end-to-end واقعی فعال هستند.
> **Current status:** `v0.1.0` is ready for direct Cloudflare deployment with **VLESS-WS, Trojan-WS and VLESS-XHTTP stream-one** verified end-to-end and through Xray-core v26.9.9.

![Tehran Network one-click installer](assets/readme/installer-fa.png)

## فارسی

### پروژه چیست؟

Tehran Network Edge Panel تجربه‌ی «کپی اسکریپت و تنظیم دستی KV/Worker» را به نصب رسمی یک‌کلیکی Cloudflare تبدیل می‌کند. مسیر پیشنهادی از Deploy to Cloudflare استفاده می‌کند تا Worker و KV روی حساب خود کاربر ساخته شوند؛ مسیر پیشرفته‌ی API Token نیز جداگانه در حال توسعه است.

### نصب برای کاربر عادی

1. روی **Deploy to Cloudflare** بزنید.
2. وارد Cloudflare شوید و برای `ADMIN_PASSWORD` یک رمز قوی حداقل 16 کاراکتری تعیین کنید.
3. Deploy را تأیید کنید؛ Cloudflare به‌صورت خودکار Worker و KV را می‌سازد و Binding `C` را متصل می‌کند.
4. آدرس `*.workers.dev` را باز کنید، همان `ADMIN_PASSWORD` را وارد کنید و کانفیگ/QR/Subscription را بردارید.

برای جزئیات و مسیر پیشرفته‌ی API Token، [آموزش کامل فارسی](docs/INSTALL_FA.md) را ببینید.

### چرا متفاوت است؟

- **Local-first:** Credential قرار نیست روی سرور مرکزی Tehran Network ذخیره شود.
- **فارسی واقعی + English:** RTL/LTR در تست‌های Unit و Browser کنترل می‌شود.
- **ظاهر اختصاصی:** Prismatic Network Console به‌جای Dashboard templateهای تکراری.
- **Responsive:** تست خودکار در عرض 375px و Desktop انجام می‌شود.
- **کد ماژولار:** UI، i18n، Installer و بخش‌های آینده‌ی Worker از هم جدا هستند.
- **Security-first:** Secretها از Admin، Subscription و Protocol credentials جدا طراحی می‌شوند.

### داشبورد فارسی

![Persian dashboard](assets/readme/dashboard-fa.png)

### Dashboard انگلیسی

![English dashboard](assets/readme/dashboard-en.png)

### نصب سریع

**برای کاربر عادی هیچ ابزار توسعه‌ای لازم نیست.**

1. روی دکمه **Deploy to Cloudflare** در بالای همین صفحه بزنید.
2. وارد Cloudflare شوید و Deploy را تأیید کنید.
3. Cloudflare Worker و KV را خودکار می‌سازد و Binding `C` را متصل می‌کند.
4. پس از Build، آدرس `*.workers.dev` را باز کنید.

آموزش کامل: [docs/INSTALL_FA.md](docs/INSTALL_FA.md)

برای توسعه محلی UI، [docs/QUICKSTART_FA.md](docs/QUICKSTART_FA.md) را ببینید.

### تست‌ها

```bash
pnpm check
pnpm test:e2e
```

CI همین Quality Gateها را در Pull Request اجرا می‌کند.

## English

### What is it?

Tehran Network Edge Panel is a clean-room, modular Cloudflare Workers control panel with an official one-click Cloudflare deployment path. The recommended flow lets Cloudflare create and bind the Worker and KV directly in the user’s own account; an advanced scoped-token installer is developed separately.

### One-click installation

1. Click **Deploy to Cloudflare**.
2. Sign in to Cloudflare and set a strong `ADMIN_PASSWORD` of at least 16 characters.
3. Approve deployment; Cloudflare provisions the Worker and KV and binds it as `C`.
4. Open the generated `*.workers.dev` URL, enter the same `ADMIN_PASSWORD`, then copy a config/QR/subscription.

See the [English installation guide](docs/INSTALL_EN.md) for details and the advanced API-token path.

### Why this project?

- **Local-first credentials** — designed so Cloudflare credentials do not need to be stored by a Tehran Network server.
- **Persian + English** — tested RTL/LTR parity, not a translated afterthought.
- **Distinct visual system** — a colorful Prismatic Network Console instead of a generic admin template.
- **Responsive by test** — browser tests cover desktop and 375px mobile layouts.
- **Modular codebase** — installer, dashboard, translations and future worker core are isolated packages.
- **Security-oriented boundaries** — Cloudflare token, admin auth, subscriptions and protocol secrets are separate concerns.

### Quick start

**Regular users do not need local development tools.**

1. Click **Deploy to Cloudflare** at the top of this README.
2. Sign in to Cloudflare and set a strong `ADMIN_PASSWORD` of at least 16 characters.
3. Approve deployment; Cloudflare provisions the Worker and KV and binds it as `C`.
4. Open the generated `*.workers.dev` URL, enter the same `ADMIN_PASSWORD`, then copy a config/QR/subscription.

Full guide: [docs/INSTALL_EN.md](docs/INSTALL_EN.md)

For local UI development, see [docs/QUICKSTART_EN.md](docs/QUICKSTART_EN.md).

### Architecture

```text
deploy/worker   → isolated Cloudflare template → Worker + auto-provisioned KV
apps/installer  → advanced local-first token setup UI
apps/panel      → bilingual network dashboard
packages/ui     → Prismatic Network Console design primitives
packages/i18n   → Persian/English dictionaries + RTL/LTR rules
packages/shared → product contracts shared across apps
```

## نقشه راه / Roadmap

| بخش / Area                         | وضعیت / Status    |
| ---------------------------------- | ----------------- |
| TypeScript monorepo + CI           | ✅ Ready          |
| Persian/English RTL/LTR            | ✅ Ready          |
| Responsive dashboard               | ✅ Ready          |
| Official Deploy to Cloudflare      | ✅ Ready          |
| Automatic KV provisioning          | ✅ Ready          |
| Graphical installer source         | 📦 Source ready   |
| One-click token creation UX        | ✅ Ready          |
| Volatile token handling            | ✅ Ready          |
| Advanced token verification/deploy | 🚧 In development |
| Worker rollback                    | 🚧 In development |
| VLESS-WS core                      | ✅ Ready          |
| Trojan-WS core                     | ✅ Ready          |
| VLESS-XHTTP stream-one             | ✅ Ready          |
| Smart endpoints / rotation         | 🧭 Planned        |
| Subscription + QR                  | ✅ Ready          |
| DNS / ECH / Network Lab            | 🧭 Planned        |

## امنیت / Security

اگر مشکل امنیتی پیدا کردید، Secret یا Token را داخل Issue عمومی قرار ندهید. قبل از گزارش، [SECURITY.md](SECURITY.md) را بخوانید.
If you find a security issue, never paste tokens or secrets into a public issue. Read [SECURITY.md](SECURITY.md) first.

## مشارکت / Contributing

PR و Issue خوش‌آمد است. قبل از تغییر بزرگ، [CONTRIBUTING.md](CONTRIBUTING.md) و [AGENTS.md](AGENTS.md) را بخوانید. AGENTS.md دفتر وضعیت پروژه است و فقط کار تست‌شده در آن تیک می‌خورد.

## License

MIT. پروژه‌های ثالثی که فقط به‌عنوان مرجع معماری بررسی شده‌اند در [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) فهرست شده‌اند.

---

<div align="center"><sub>Built by Tehran Network · Cloudflare Workers · Serverless · Persian RTL · Open Source</sub></div>
