<div align="center">

# Tehran Network Edge Panel

**پنل Serverless دو زبانه روی Cloudflare Workers — بدون VPS، بدون دامنه اجباری و بدون ابزار پولی**<br>
**A bilingual serverless edge panel on Cloudflare Workers — no VPS, no required domain, no paid tooling**

[فارسی](#فارسی) · [English](#english) · [Security](SECURITY.md) · [Roadmap](#نقشه-راه--roadmap)

![CI](https://github.com/tehrannetwork021/FreePanel-VPN/actions/workflows/ci.yml/badge.svg)
![License](https://img.shields.io/badge/license-MIT-8d6bff)
![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white)
![Persian RTL](https://img.shields.io/badge/Persian-RTL-8dff6a)

## 🚀 نصب یک‌کلیکی / One-click install

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/tehrannetwork021/FreePanel-VPN/tree/main/deploy/worker)

**مسیر رسمی نصب همین دکمه است.** کاربر نهایی VPS، SSH، Wrangler محلی، ترمینال، API Token دستی یا سرویس پولی لازم ندارد.<br>
**This button is the official install path.** End users do not need a VPS, SSH, local Wrangler, a terminal, a pasted API token, or paid tooling.

Cloudflare مستقیماً template مستقل `deploy/worker` را از GitHub می‌گیرد، Worker را build/deploy می‌کند و KV و D1 موردنیاز را provision و bind می‌کند. کاربر فقط یک `ADMIN_PASSWORD` شخصی وارد می‌کند؛ این مقدار Secret است و داخل GitHub ذخیره نمی‌شود.

Cloudflare pulls the isolated `deploy/worker` template directly from GitHub, builds/deploys the Worker, and provisions/binds the required KV and D1 resources. The user only supplies a private `ADMIN_PASSWORD`; it is a Cloudflare secret and is not committed to GitHub.

**[راهنمای فارسی](docs/INSTALL_FA.md)** · **[English guide](docs/INSTALL_EN.md)**

</div>

> [!IMPORTANT]
> **وضعیت فعلی:** `v0.3.x` هنوز Release Candidate برای Phase A است. هسته، control plane و تست‌های محلی سبز هستند؛ قبل از stable شدن، field test واقعی روی Cloudflare Free plan همچنان لازم است.<br>
> **Current status:** `v0.3.x` is still a Phase A release candidate. Core/control-plane tests are green; a real Cloudflare Free-plan field gate is still required before calling it stable.

## فارسی

### پروژه چیست؟

Tehran Network Edge Panel یک پنل Cloudflare-only است. کد عمومی روی GitHub است و runtime روی Cloudflare Workers اجرا می‌شود. KV برای state کم‌نوشتن و D1 برای control plane چندکاربره استفاده می‌شود. هیچ VPS مرکزی برای اجرای پنل لازم نیست.

### نصب برای کاربر عادی

1. دکمه **Deploy to Cloudflare** بالای همین README را بزنید.
2. اگر Cloudflare خواست، وارد Cloudflare/GitHub شوید و Account را انتخاب کنید.
3. نام‌های پیش‌فرض Worker/KV/D1 را قبول کنید و فقط برای `ADMIN_PASSWORD` یک رمز قوی وارد کنید.
4. Deploy را بزنید. Cloudflare خودش repo را clone/build می‌کند و KV + D1 + Worker را می‌سازد.
5. آدرس `*.workers.dev` را باز کنید و با همان رمز وارد `/admin` شوید.

**هیچ API Token دستی، VPS، دامنه، PowerShell، SSH یا Wrangler محلی لازم نیست.**

### چرا این مسیر بهتر است؟

- **GitHub منبع واحد:** template عمومی و قابل بررسی است.
- **Cloudflare-only:** runtime، KV و D1 همگی داخل حساب خود کاربر هستند.
- **بدون سرور واسط:** نصب به سرور تهران‌نتورک یا VPS شخصی وابسته نیست.
- **Provision خودکار:** Cloudflare از روی `wrangler.jsonc` منابع را می‌سازد و bind می‌کند.
- **Secret واقعی:** `ADMIN_PASSWORD` در صفحه Deploy خود Cloudflare وارد می‌شود و در repository قرار نمی‌گیرد.
- **Git-based updates:** Cloudflare Workers Builds می‌تواند pushهای repository ایجادشده را خودکار deploy کند.
- **فارسی + English:** رابط RTL/LTR و پنل responsive تست می‌شوند.
- **مولتی‌یوزر D1:** user، quota، expiry، usage، audit و session روی D1 نگه‌داری می‌شوند.
- **پروتکل‌ها:** VLESS-WS، Trojan-WS و VLESS-XHTTP stream-one در هسته موجودند.

### داشبورد فارسی

![Persian dashboard](assets/readme/dashboard-fa.png)

### Dashboard انگلیسی

![English dashboard](assets/readme/dashboard-en.png)

## نصب سریع

[**Deploy to Cloudflare**](https://deploy.workers.cloudflare.com/?url=https://github.com/tehrannetwork021/FreePanel-VPN/tree/main/deploy/worker) → انتخاب Account → تعیین `ADMIN_PASSWORD` → Deploy → بازکردن `/admin`.

آموزش کامل: [docs/INSTALL_FA.md](docs/INSTALL_FA.md)

### تست‌ها

```bash
pnpm check
pnpm test:e2e
```

CI همین Quality Gateها را روی GitHub اجرا می‌کند.

## English

### What is it?

Tehran Network Edge Panel is a Cloudflare-only panel. The public source lives on GitHub and the runtime lives on Cloudflare Workers. KV holds low-write configuration while D1 stores the multi-user control plane. No central VPS is required to run an installed panel.

### One-click installation

1. Click **Deploy to Cloudflare** at the top of this README.
2. Sign in to Cloudflare/GitHub if requested and choose the Cloudflare account.
3. Keep the default Worker/KV/D1 names and provide only a strong `ADMIN_PASSWORD`.
4. Click Deploy. Cloudflare clones/builds the GitHub template and provisions KV + D1 + Worker automatically.
5. Open the resulting `*.workers.dev` URL and sign in at `/admin` using the password you supplied.

**No pasted Cloudflare API token, VPS, custom domain, PowerShell, SSH, or local Wrangler is required.**

### Why this path?

- **GitHub is the source of truth** — the deploy template is public and reviewable.
- **Cloudflare-only runtime** — Worker, KV and D1 live in the user's own account.
- **No intermediary server** — installation does not depend on a Tehran Network VPS.
- **Automatic provisioning** — Cloudflare reads `wrangler.jsonc`, creates resources and binds them.
- **Real secret handling** — `ADMIN_PASSWORD` is entered in Cloudflare's deploy flow, not committed to GitHub.
- **Git-based updates** — Workers Builds can redeploy automatically from pushes to the generated repository.
- **Persian + English** — tested RTL/LTR UI and responsive layouts.
- **D1 multi-user control plane** — users, quota, expiry, usage, audit and sessions live in D1.
- **Protocols** — VLESS-WS, Trojan-WS and VLESS-XHTTP stream-one are present in the core.

## Quick start

[**Deploy to Cloudflare**](https://deploy.workers.cloudflare.com/?url=https://github.com/tehrannetwork021/FreePanel-VPN/tree/main/deploy/worker) → choose account → set `ADMIN_PASSWORD` → Deploy → open `/admin`.

Full guide: [docs/INSTALL_EN.md](docs/INSTALL_EN.md)

### Architecture

```text
deploy/worker         → isolated production template used by Deploy to Cloudflare
apps/panel            → bilingual dashboard source
packages/ui           → shared UI primitives
packages/i18n         → Persian/English dictionaries + RTL/LTR rules
apps/installer-worker → legacy/experimental token installer source; not the primary public path
```

The deploy-button target is deliberately isolated because Cloudflare treats a monorepo subdirectory as the root of the generated repository.

## نقشه راه / Roadmap

| بخش / Area                       | وضعیت / Status    |
| -------------------------------- | ----------------- |
| GitHub Deploy to Cloudflare path | ✅ Ready          |
| Automatic KV/D1 provisioning     | ✅ Ready          |
| Secret-based admin password      | ✅ Ready          |
| Persian/English RTL/LTR          | ✅ Ready          |
| Responsive dashboard             | ✅ Ready          |
| D1 multi-user / quota / expiry   | ✅ Ready          |
| Periodic usage accounting        | ✅ Ready          |
| VLESS-WS core                    | ✅ Ready          |
| Trojan-WS core                   | ✅ Ready          |
| VLESS-XHTTP stream-one           | 🧪 Field retest   |
| Backup / Restore                 | 🚧 In development |
| Worker rollback                  | 🚧 In development |
| Smart endpoints / rotation       | 🧭 Planned        |
| DNS / ECH / Network Lab          | 🧭 Planned        |

## امنیت / Security

رمز Admin، Subscription URL، credential پروتکل یا اطلاعات حساس D1/KV را داخل Issue یا Screenshot عمومی قرار ندهید. [SECURITY.md](SECURITY.md) را بخوانید.<br>
Never put admin passwords, subscription URLs, protocol credentials, or sensitive D1/KV data in a public issue or screenshot. Read [SECURITY.md](SECURITY.md).

## مشارکت / Contributing

PR و Issue خوش‌آمد است. قبل از تغییر بزرگ، [CONTRIBUTING.md](CONTRIBUTING.md) و [AGENTS.md](AGENTS.md) را بخوانید.

## License

MIT. Third-party architectural references are listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

---

<div align="center"><sub>Built by Tehran Network · GitHub · Cloudflare Workers · Serverless · Open Source</sub></div>
