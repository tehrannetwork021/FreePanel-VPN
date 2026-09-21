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

## فقط همین دکمه را بزنید — Just click this button

[![Install Free on Cloudflare](https://img.shields.io/badge/Install%20Free%20on%20Cloudflare-OPEN%20INSTALLER-F38020?style=for-the-badge&logo=cloudflare&logoColor=white)](https://tehran-network-installer.honored-feather.workers.dev)

**دکمه بالا مستقیماً Installer را باز می‌کند؛ قبل از Installer هیچ Cloudflare Account Picker یا Deploy Button وجود ندارد.**
**The button opens the installer directly; there is no Cloudflare account picker or Deploy Button before it.**

**کاربر عادی هیچ Deploy، GitHub account، Worker setup، Wrangler یا ترمینالی لازم ندارد.**
**Regular users do not need Deploy steps, a GitHub account, Worker setup, Wrangler, or a terminal.**

1. دکمه بالا را بزنید / Click the button above.
2. **Generate Cloudflare Key** → در Cloudflare روی **Create Token** بزنید → Copy.
3. به Installer برگردید → Token را Paste کنید → **Install**.

تمام. Installer خودش Account، KV، D1، Worker، Secret و `workers.dev` را آماده می‌کند و **آدرس `/admin` + آدرس Worker + رمز مدیریت** را تحویل می‌دهد.
Done. The installer provisions Account, KV, D1, Worker, secret and `workers.dev`, then returns the **`/admin` URL + Worker URL + admin password**.

**[راهنمای فارسی](docs/INSTALL_FA.md)** · **[English guide](docs/INSTALL_EN.md)**

> مسیرهای توسعه‌دهنده و self-host فقط در مستندات فنی هستند و جزو نصب کاربر عادی نیستند.
> Developer/self-hosted paths live in the technical docs and are not part of the regular-user install flow.

</div>

> [!IMPORTANT]
> **وضعیت فعلی:** `v0.3.0` یک **Release Candidate برای Phase A** است. نصب عمومی Cloudflare، D1 control plane، مولتی‌یوزر، quota/expiry، لینک خصوصی، rotation، audit/usage و هر سه مسیر **VLESS-WS، Trojan-WS و VLESS-XHTTP stream-one** در gate محلی واقعی تست شده‌اند. **Field gate واقعی Cloudflare هنوز pending است؛ تا پایان آن v0.3.0 را stable نمی‌نامیم.**
> **Current status:** `v0.3.0` is a **Phase A release candidate**. The public Cloudflare installer, D1 control plane, multi-user lifecycle, quota/expiry, private subscriptions, rotation, audit/usage, and **VLESS-WS, Trojan-WS and VLESS-XHTTP stream-one** have passed real local gates. **The real Cloudflare field gate is still pending; v0.3.0 is not called stable until it passes.**

![Tehran Network one-click installer](assets/readme/installer-fa.png)

## فارسی

### پروژه چیست؟

Tehran Network Edge Panel تجربه‌ی «کپی اسکریپت و تنظیم دستی KV/Worker» را به یک نصب رایگان و خودکار تبدیل می‌کند. کافی است یک توکن محدود Cloudflare بسازید و به نصب‌کننده بدهید؛ بقیهٔ کار — ساخت KV، آپلود Worker امضاشده، ست‌کردن رمز مدیریت و فعال‌سازی `workers.dev` — در چند ثانیه و داخل اکانت خودتان انجام می‌شود. مسیر کاربر عادی فقط همین Installer عمومی است؛ مسیرهای توسعه‌دهنده در مستندات فنی نگه‌داری می‌شوند.

### نصب برای کاربر عادی

**فقط همین لینک را باز کنید:** [https://tehran-network-installer.honored-feather.workers.dev](https://tehran-network-installer.honored-feather.workers.dev)

1. Installer آماده باز می‌شود؛ نه GitHub account لازم دارید، نه مرحلهٔ Deploy، نه Wrangler و نه ترمینال.
2. روی **ساخت کلید Cloudflare** بزنید. صفحهٔ رسمی Cloudflare با دسترسی‌های لازم باز می‌شود: Workers Scripts Edit، Workers KV Storage Edit، D1 Write و Account Settings Read.
3. **Create Token** را بزنید و Token را کپی کنید.
4. به Installer برگردید، Token را Paste کنید و **نصب با کلید** را بزنید. Installer اولین Account قابل‌دسترسی را خودکار انتخاب می‌کند، Worker ثابت `tehran-network-edge` و یک رمز مدیریت تصادفی می‌سازد.
5. KV + D1 + Worker + Secret + workers.dev خودکار ساخته/reuse می‌شوند و Installer همان رمز را با login واقعی verify می‌کند.
6. فقط آدرس پنل و رمز مدیریت تحویل داده می‌شود؛ آن را Copy و وارد `/admin` شوید.

Token فقط برای همین درخواست نصب از طریق HTTPS به Installer Worker ارسال می‌شود، در KV/DB/Cookie/localStorage/log ذخیره نمی‌شود و بعد از تلاش نصب پاک می‌شود. پنل نهایی هیچ وابستگی‌ای به Installer ندارد و می‌توانید Token نصب را بعداً از Cloudflare حذف کنید.

راهنمای گام‌به‌گام: [آموزش کامل فارسی](docs/INSTALL_FA.md)

### چرا متفاوت است؟

- **رایگان و بدون سرور:** همه‌چیز روی پلن رایگان Cloudflare و داخل اکانت خود شما ساخته می‌شود؛ نه VPS می‌خواهد نه دامنه.
- **Token کم‌عمر و بدون ذخیره‌سازی:** Token فقط برای درخواست نصب روی Installer Worker استفاده می‌شود، هیچ‌جا persist نمی‌شود و بعد از هر تلاش پاک می‌شود.
- **فارسی واقعی + English:** RTL/LTR در تست‌های Unit و Browser کنترل می‌شود.
- **ظاهر اختصاصی:** Prismatic Network Console به‌جای Dashboard templateهای تکراری.
- **Responsive:** تست خودکار در عرض موبایل و Desktop انجام می‌شود.
- **کد ماژولار:** UI، i18n، Installer و Worker از هم جدا هستند.
- **Security-first:** Artifact نصب‌شده SHA-256 امضادار است و Secretها از هم جدا طراحی می‌شوند.
- **مولتی‌یوزر واقعی روی D1:** کاربر، انقضا، سهمیه کل/روزانه، لینک خصوصی و credential مستقل بدون VPS نگه‌داری می‌شوند.
- **اعمال سهمیهٔ دوره‌ای روی Edge:** مصرف واقعی upload/download در checkpointهای ۴ MiB یا ۶۰ ثانیه ثبت می‌شود؛ این سیستم billing دقیقِ هر packet نیست و overshoot حداکثر به اندازهٔ checkpoint × اتصال‌های هم‌زمان است.
- **Upgrade بدون تعویض credential کاربر:** نصب دوباره با همان Worker name، KV و D1 نام‌دار را reuse می‌کند؛ installation seed و نسخهٔ secretهای کاربران ثابت می‌ماند، اما `INSTALL_GENERATION` جدید رمز ادمین را به رمز تازهٔ نمایش‌داده‌شده در Installer sync می‌کند و sessionهای قبلی را باطل می‌کند.
- **محدودیت‌های صریح Phase A:** Backup/Restore کامل و speed limiting هنوز آماده نیستند؛ quota فقط با checkpoint اجرا می‌شود.

### داشبورد فارسی

![Persian dashboard](assets/readme/dashboard-fa.png)

### Dashboard انگلیسی

![English dashboard](assets/readme/dashboard-en.png)

### نصب سریع

**برای کاربر عادی هیچ ابزار توسعه‌ای لازم نیست.**

1. [https://tehran-network-installer.honored-feather.workers.dev](https://tehran-network-installer.honored-feather.workers.dev) را باز کنید.
2. Generate Key → Create Token → Copy → Paste.
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

Tehran Network Edge Panel turns "copy a script and wire KV/Worker by hand" into a free, automated installation. Create a narrowly scoped Cloudflare token, paste it into the installer, and everything else — KV provisioning, signed Worker upload, admin secret and `workers.dev` enablement — happens inside your own account in seconds. The regular-user path is only the public installer; developer workflows live in the technical documentation.

### One-click installation

**Open the public installer:** [https://tehran-network-installer.honored-feather.workers.dev](https://tehran-network-installer.honored-feather.workers.dev)

1. The ready-to-use installer opens directly. No GitHub account, installer deployment, Wrangler or terminal is required.
2. Click **Generate Cloudflare Key**. Cloudflare opens the official token builder with Workers Scripts Edit, Workers KV Storage Edit, D1 Write and Account Settings Read.
3. Click **Create Token**, copy it, return to the installer and paste/verify it.
4. Return to the installer, paste the token and click **Install with key**. The installer automatically picks the first accessible account, uses the fixed `tehran-network-edge` Worker name, and generates a random admin password.
5. KV + D1 + Worker + secret + workers.dev are created/reused automatically, and the installer verifies the exact password with a real login before success.
6. Keep the returned admin URL and generated password; no account/Worker/password configuration form is shown.

The token is sent over HTTPS to the installer Worker only for the current install request. It is never persisted to KV/database/cookies/browser storage/logs and is cleared after the attempt. The installed panel is independent from the public installer, so you may revoke the setup token afterwards.

Step-by-step guide: [English installation guide](docs/INSTALL_EN.md)

### Why this project?

- **Free and serverless** — everything runs on the Cloudflare Free plan inside your own account; no VPS, no custom domain.
- **Ephemeral install credential** — the token is used only for the current HTTPS install request, is never persisted, and is cleared after every attempt.
- **Persian + English** — tested RTL/LTR parity, not a translated afterthought.
- **Distinct visual system** — a colorful Prismatic Network Console instead of a generic admin template.
- **Responsive by test** — browser tests cover desktop and mobile layouts.
- **Modular codebase** — installer, dashboard, translations and worker core are isolated packages.
- **Security-oriented boundaries** — the deployed artifact is SHA-256 pinned and secrets are separated by concern.
- **Real D1 multi-user control** — users, expiry, total/daily quota, private subscriptions and independent credentials stay Cloudflare-only with no VPS.
- **Periodic edge quota enforcement** — actual upload/download is checkpointed at 4 MiB or 60 seconds; this is not exact per-packet billing, and bounded overshoot is checkpoint size × concurrent connections.
- **Credential-stable reinstall** — reinstalling the fixed `tehran-network-edge` Worker reuses named KV/D1 state, preserving the installation seed and per-user secret versions; a fresh `INSTALL_GENERATION` intentionally synchronizes the admin password to the newly displayed installer password and invalidates older admin sessions.
- **Explicit Phase A limits** — full Backup/Restore and speed limiting are not implemented yet; quota enforcement is checkpoint-based only.

### Quick start

**Regular users do not need local development tools.**

1. Open [https://tehran-network-installer.honored-feather.workers.dev](https://tehran-network-installer.honored-feather.workers.dev).
2. Generate Key → Create Token → Copy → Paste.
3. Click Install and receive your panel's `*.workers.dev` URL.

Full guide: [docs/INSTALL_EN.md](docs/INSTALL_EN.md)

For local UI development, see [docs/QUICKSTART_EN.md](docs/QUICKSTART_EN.md).

### Architecture

```text
apps/installer-worker → token-based provisioning Worker (KV + D1 + Worker + secret + workers.dev)
apps/installer        → free installer UI served by installer-worker
deploy/worker         → isolated panel Worker template (developer path)
apps/panel            → bilingual network dashboard
packages/ui           → Prismatic Network Console design primitives
packages/i18n         → Persian/English dictionaries + RTL/LTR rules
packages/shared       → product contracts shared across apps
```

## نقشه راه / Roadmap

| بخش / Area                         | وضعیت / Status    |
| ---------------------------------- | ----------------- |
| TypeScript monorepo + CI           | ✅ Ready          |
| Persian/English RTL/LTR            | ✅ Ready          |
| Responsive dashboard               | ✅ Ready          |
| Free Cloudflare token installer    | ✅ Ready          |
| Automatic KV/D1/secret/workers.dev | ✅ Ready          |
| Volatile token handling            | ✅ Ready          |
| Worker rollback                    | 🚧 In development |
| VLESS-WS core                      | ✅ Ready          |
| Trojan-WS core                     | ✅ Ready          |
| VLESS-XHTTP stream-one             | 🧪 Field retest   |
| Smart endpoints / rotation         | 🧭 Planned        |
| Subscription + QR                  | ✅ Ready          |
| D1 multi-user / quota / expiry     | ✅ Ready          |
| Periodic usage accounting          | ✅ Ready          |
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
