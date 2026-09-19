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

</div>

> [!IMPORTANT]
> **وضعیت فعلی:** Foundation، رابط فارسی/English، Dashboard و Installer امن ساخته شده‌اند. موتور نصب واقعی Cloudflare و هسته VLESS/Trojan/XHTTP هنوز **در حال توسعه** هستند.  
> **Current status:** Foundation, bilingual UI, dashboard and secure installer UX are complete. Real Cloudflare provisioning and VLESS/Trojan/XHTTP cores are **in development**.

![Tehran Network one-click installer](assets/readme/installer-fa.png)
## فارسی

### پروژه چیست؟
Tehran Network Edge Panel قرار است تجربه‌ی پروژه‌های فنی Cloudflare را از «کپی اسکریپت و تنظیم دستی KV/Worker» به یک نصب ساده و قابل‌فهم تبدیل کند. هدف نهایی این است که کاربر فقط توکن محدود Cloudflare را بسازد، در Installer وارد کند و باقی مراحل به‌صورت خودکار انجام شوند.

### تجربه نصب هدف
1. روی **دریافت Cloudflare API Token** بزنید.
2. صفحه رسمی Cloudflare با دسترسی‌های پیشنهادی Workers/KV/Routes از قبل پر می‌شود.
3. Token را بسازید و Copy کنید.
4. به Installer برگردید و Paste کنید.
5. Installer محلی Token را بررسی می‌کند و مراحل Account → KV → Worker را انجام می‌دهد.
6. Token بعد از پایان عملیات از حافظه پاک می‌شود و در LocalStorage/SessionStorage/Cookie ذخیره نمی‌شود.

> موتور واقعی مرحله ۵ در Milestone بعدی پیاده‌سازی می‌شود؛ UI و قرارداد امنیتی آن همین حالا آماده و تست‌شده است.

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
> برای توسعه محلی فعلی. Installer نهایی یک لانچر ساده خواهد داشت تا کاربر عادی نیاز به ابزار توسعه نداشته باشد.

```bash
git clone https://github.com/tehrannetwork021/FreePanel-VPN.git
cd FreePanel-VPN
corepack enable
corepack prepare pnpm@10.15.1 --activate
pnpm install --frozen-lockfile
pnpm --filter @tehrannetwork/installer dev
```

سپس `http://127.0.0.1:4174` را باز کنید. برای مشاهده Dashboard:

```bash
pnpm --filter @tehrannetwork/panel dev
```

### تست‌ها
```bash
pnpm check
pnpm test:e2e
```

CI همین Quality Gateها را در Pull Request اجرا می‌کند.
## English

### What is it?
Tehran Network Edge Panel is a clean-room, modular Cloudflare Workers control panel focused on a simple local-first installation experience. The end goal is straightforward: create a scoped Cloudflare token, paste it into the installer, and let the installer provision the required Cloudflare resources automatically.

### Target one-click flow
1. Click **Get Cloudflare API Token**.
2. Cloudflare opens its official token builder with Workers/KV/Routes permissions pre-filled.
3. Create and copy the token.
4. Return to the local installer and paste it.
5. The local installer verifies the token and provisions Account → KV → Worker.
6. The token is cleared from memory after the operation and is never written to LocalStorage, SessionStorage, or cookies.

> Step 5's real provisioning backend is the next milestone. The installer UI and volatile-token security contract are already implemented and tested.

### Why this project?
- **Local-first credentials** — designed so Cloudflare credentials do not need to be stored by a Tehran Network server.
- **Persian + English** — tested RTL/LTR parity, not a translated afterthought.
- **Distinct visual system** — a colorful Prismatic Network Console instead of a generic admin template.
- **Responsive by test** — browser tests cover desktop and 375px mobile layouts.
- **Modular codebase** — installer, dashboard, translations and future worker core are isolated packages.
- **Security-oriented boundaries** — Cloudflare token, admin auth, subscriptions and protocol secrets are separate concerns.

### Quick start
```bash
git clone https://github.com/tehrannetwork021/FreePanel-VPN.git
cd FreePanel-VPN
corepack enable
corepack prepare pnpm@10.15.1 --activate
pnpm install --frozen-lockfile
pnpm --filter @tehrannetwork/installer dev
```
### Architecture
```text
apps/installer  → local-first setup UI → /api/install (next milestone)
apps/panel      → bilingual network dashboard
packages/ui     → Prismatic Network Console design primitives
packages/i18n   → Persian/English dictionaries + RTL/LTR rules
packages/shared → product contracts shared across apps
```

## نقشه راه / Roadmap

| بخش / Area | وضعیت / Status |
|---|---|
| TypeScript monorepo + CI | ✅ Ready |
| Persian/English RTL/LTR | ✅ Ready |
| Responsive dashboard | ✅ Ready |
| One-click token creation UX | ✅ Ready |
| Volatile token handling | ✅ Ready |
| Real Cloudflare token verification | 🚧 In development |
| Account discovery + KV provisioning | 🚧 In development |
| Worker deployment / rollback | 🚧 In development |
| VLESS core | 🧭 Planned |
| Trojan core | 🧭 Planned |
| XHTTP core | 🧭 Planned |
| Smart endpoints / rotation | 🧭 Planned |
| Subscription generator | 🧭 Planned |
| DNS / ECH / Network Lab | 🧭 Planned |

## امنیت / Security
اگر مشکل امنیتی پیدا کردید، Secret یا Token را داخل Issue عمومی قرار ندهید. قبل از گزارش، [SECURITY.md](SECURITY.md) را بخوانید.  
If you find a security issue, never paste tokens or secrets into a public issue. Read [SECURITY.md](SECURITY.md) first.

## مشارکت / Contributing
PR و Issue خوش‌آمد است. قبل از تغییر بزرگ، [CONTRIBUTING.md](CONTRIBUTING.md) و [AGENTS.md](AGENTS.md) را بخوانید. AGENTS.md دفتر وضعیت پروژه است و فقط کار تست‌شده در آن تیک می‌خورد.

## License
MIT. پروژه‌های ثالثی که فقط به‌عنوان مرجع معماری بررسی شده‌اند در [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) فهرست شده‌اند.

---
<div align="center"><sub>Built by Tehran Network · Cloudflare Workers · Serverless · Persian RTL · Open Source</sub></div>
