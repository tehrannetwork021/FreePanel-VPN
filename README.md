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

**Install Free on Cloudflare — نصب رایگان روی کلادفلر**

[![Deploy Installer](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/tehrannetwork021/FreePanel-VPN/tree/main/apps/installer-worker)

**Generate Cloudflare Key → Paste → Automatic install — بدون VPS، دامنه، GitHub یا ترمینال**

**[راهنمای فارسی](docs/INSTALL_FA.md)** · **[English guide](docs/INSTALL_EN.md)**

**یا نصب با اسکریپت — توکن را Paste کن، خودش همه‌کاره می‌شود / Or install with a script — paste the token and it does everything:**

```powershell
# Windows PowerShell
irm https://cdn.jsdelivr.net/gh/tehrannetwork021/FreePanel-VPN@main/install.ps1 | iex
```

```bash
# Linux / macOS / WSL / Git Bash
curl -fsSL https://cdn.jsdelivr.net/gh/tehrannetwork021/FreePanel-VPN@main/install.sh -o install.sh && bash install.sh
```

Developer/advanced path: [![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/tehrannetwork021/FreePanel-VPN/tree/main/deploy/worker)

</div>

> [!IMPORTANT]
> **وضعیت فعلی:** نسخه `v0.2.0` با **نصب‌کنندهٔ رایگان مبتنی بر توکن Cloudflare** منتشر شد: کلید بساز → Paste کن → Worker، KV، Secret و workers.dev خودکار نصب می‌شوند. هسته‌های **VLESS-WS، Trojan-WS و VLESS-XHTTP stream-one** با تست end-to-end واقعی فعال هستند.
> **Current status:** `v0.2.0` ships the **free Cloudflare token installer**: generate the key, paste it, and the Worker, KV, secret and workers.dev are provisioned automatically. **VLESS-WS, Trojan-WS and VLESS-XHTTP stream-one** are verified end-to-end.

![Tehran Network one-click installer](assets/readme/installer-fa.png)

## فارسی

### پروژه چیست؟

Tehran Network Edge Panel تجربه‌ی «کپی اسکریپت و تنظیم دستی KV/Worker» را به یک نصب رایگان و خودکار تبدیل می‌کند. کافی است یک توکن محدود Cloudflare بسازید و به نصب‌کننده بدهید؛ بقیهٔ کار — ساخت KV، آپلود Worker امضاشده، ست‌کردن رمز مدیریت و فعال‌سازی `workers.dev` — در چند ثانیه و داخل اکانت خودتان انجام می‌شود. مسیر پیشرفتهٔ Deploy-to-Cloudflare برای توسعه‌دهندگان جداگانه باقی مانده است.

### نصب برای کاربر عادی

**راه اول — اسکریپت (سریع‌ترین):** یک پنجره PowerShell یا ترمینال باز کنید، دستور بالا را اجرا کنید و توکن را Paste کنید. اسکریپت خودش KV می‌سازد، Worker را آپلود می‌کند، workers.dev را فعال می‌کند و در پایان آدرس پنل، رمز مدیریت و لینک کانفیگ‌ها را چاپ می‌کند.

**راه دوم — نصب‌کنندهٔ وب:**

1. روی دکمهٔ **Deploy Installer** در بالای همین صفحه بزنید و با اکانت رایگان Cloudflare آن را نصب کنید؛ آدرس `*.workers.dev` نصب‌کننده را باز کنید.
2. در نصب‌کننده روی **ساخت کلید Cloudflare** بزنید؛ صفحهٔ رسمی Cloudflare با دسترسی‌های لازم (Workers Scripts Edit، Workers KV Storage Edit، Account Settings Read) از پیش تنظیم شده باز می‌شود.
3. توکن را که Cloudflare فقط یک بار نشان می‌دهد کپی کنید، در نصب‌کننده Paste و Verify کنید.
4. حساب، نام Worker و رمز مدیریت را انتخاب کنید و Install بزنید.
5. آدرس پنل شما آماده است؛ همان رمز مدیریت را وارد کنید و کانفیگ/QR/Subscription را بردارید.

راهنمای گام‌به‌گام: [آموزش کامل فارسی](docs/INSTALL_FA.md)

### چرا متفاوت است؟

- **رایگان و بدون سرور:** همه‌چیز روی پلن رایگان Cloudflare و داخل اکانت خود شما ساخته می‌شود؛ نه VPS می‌خواهد نه دامنه.
- **Local-first:** توکن Cloudflare فقط در حافظهٔ موقت مرورگر می‌ماند و پس از هر تلاش نصب پاک می‌شود.
- **فارسی واقعی + English:** RTL/LTR در تست‌های Unit و Browser کنترل می‌شود.
- **ظاهر اختصاصی:** Prismatic Network Console به‌جای Dashboard templateهای تکراری.
- **Responsive:** تست خودکار در عرض موبایل و Desktop انجام می‌شود.
- **کد ماژولار:** UI، i18n، Installer و Worker از هم جدا هستند.
- **Security-first:** Artifact نصب‌شده SHA-256 امضادار است و Secretها از هم جدا طراحی می‌شوند.

### داشبورد فارسی

![Persian dashboard](assets/readme/dashboard-fa.png)

### Dashboard انگلیسی

![English dashboard](assets/readme/dashboard-en.png)

### نصب سریع

**برای کاربر عادی هیچ ابزار توسعه‌ای لازم نیست.**

1. دکمهٔ **Deploy Installer** را بزنید تا نصب‌کننده روی اکانت Cloudflare شما ساخته شود.
2. داخل نصب‌کننده، با لینک «ساخت کلید Cloudflare» توکن بسازید و Paste کنید.
3. Install را بزنید و آدرس `*.workers.dev` پنل خود را بگیرید.

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

Tehran Network Edge Panel turns "copy a script and wire KV/Worker by hand" into a free, automated installation. Create a narrowly scoped Cloudflare token, paste it into the installer, and everything else — KV provisioning, signed Worker upload, admin secret and `workers.dev` enablement — happens inside your own account in seconds. The developer-focused Deploy-to-Cloudflare path remains as an advanced alternative.

### One-click installation

**Path 1 — Script (fastest):** open a PowerShell or terminal window, run the command above, paste your token. The script provisions KV, uploads the Worker, enables workers.dev and prints the panel URL, admin password and config links.

**Path 2 — Web installer:**

1. Click **Deploy Installer** at the top of this page and install it with your free Cloudflare account; open the installer's `*.workers.dev` URL.
2. Click **Generate Cloudflare Key**; Cloudflare's official page opens with the required scopes preselected (Workers Scripts Edit, Workers KV Storage Edit, Account Settings Read).
3. Copy the token (Cloudflare shows it once), paste it into the installer and verify.
4. Choose your account, a Worker name and an admin password, then click Install.
5. Your panel URL is ready; enter the same admin password and collect configs/QR/subscription.

Step-by-step guide: [English installation guide](docs/INSTALL_EN.md)

### Why this project?

- **Free and serverless** — everything runs on the Cloudflare Free plan inside your own account; no VPS, no custom domain.
- **Local-first credentials** — the Cloudflare token stays in volatile browser memory and is cleared after every attempt.
- **Persian + English** — tested RTL/LTR parity, not a translated afterthought.
- **Distinct visual system** — a colorful Prismatic Network Console instead of a generic admin template.
- **Responsive by test** — browser tests cover desktop and mobile layouts.
- **Modular codebase** — installer, dashboard, translations and worker core are isolated packages.
- **Security-oriented boundaries** — the deployed artifact is SHA-256 pinned and secrets are separated by concern.

### Quick start

**Regular users do not need local development tools.**

1. Click **Deploy Installer** to put the installer on your Cloudflare account.
2. Inside the installer, use "Generate Cloudflare Key", create the token and paste it.
3. Click Install and receive your panel's `*.workers.dev` URL.

Full guide: [docs/INSTALL_EN.md](docs/INSTALL_EN.md)

For local UI development, see [docs/QUICKSTART_EN.md](docs/QUICKSTART_EN.md).

### Architecture

```text
apps/installer-worker → token-based provisioning Worker (KV + Worker + secret + workers.dev)
apps/installer        → free installer UI served by installer-worker
deploy/worker         → isolated panel Worker template (developer path)
apps/panel            → bilingual network dashboard
packages/ui           → Prismatic Network Console design primitives
packages/i18n         → Persian/English dictionaries + RTL/LTR rules
packages/shared       → product contracts shared across apps
```

## نقشه راه / Roadmap

| بخش / Area                          | وضعیت / Status    |
| ----------------------------------- | ----------------- |
| TypeScript monorepo + CI            | ✅ Ready          |
| Persian/English RTL/LTR             | ✅ Ready          |
| Responsive dashboard                | ✅ Ready          |
| Free Cloudflare token installer     | ✅ Ready          |
| Automatic KV/secret/workers.dev     | ✅ Ready          |
| Official Deploy to Cloudflare (dev) | ✅ Ready          |
| Volatile token handling             | ✅ Ready          |
| Worker rollback                     | 🚧 In development |
| VLESS-WS core                       | ✅ Ready          |
| Trojan-WS core                      | ✅ Ready          |
| VLESS-XHTTP stream-one              | ✅ Ready          |
| Smart endpoints / rotation          | 🧭 Planned        |
| Subscription + QR                   | ✅ Ready          |
| DNS / ECH / Network Lab             | 🧭 Planned        |

## امنیت / Security

اگر مشکل امنیتی پیدا کردید، Secret یا Token را داخل Issue عمومی قرار ندهید. قبل از گزارش، [SECURITY.md](SECURITY.md) را بخوانید.
If you find a security issue, never paste tokens or secrets into a public issue. Read [SECURITY.md](SECURITY.md) first.

## مشارکت / Contributing

PR و Issue خوش‌آمد است. قبل از تغییر بزرگ، [CONTRIBUTING.md](CONTRIBUTING.md) و [AGENTS.md](AGENTS.md) را بخوانید. AGENTS.md دفتر وضعیت پروژه است و فقط کار تست‌شده در آن تیک می‌خورد.

## License

MIT. پروژه‌های ثالثی که فقط به‌عنوان مرجع معماری بررسی شده‌اند در [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) فهرست شده‌اند.

---

<div align="center"><sub>Built by Tehran Network · Cloudflare Workers · Serverless · Persian RTL · Open Source</sub></div>
