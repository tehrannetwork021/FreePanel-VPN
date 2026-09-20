# آموزش نصب و استفاده — فارسی

## نصب بدون ترمینال (پیشنهادی — فقط لینک و Paste)

این مسیر رسمی برای کاربر عادی است: **بدون VPS، دامنه، GitHub account، Deploy Installer، Wrangler، PowerShell یا ترمینال**.

### گام ۱ — Installer آماده را باز کنید

[https://tehran-network-installer.honored-feather.workers.dev](https://tehran-network-installer.honored-feather.workers.dev)

این Worker عمومی فقط کنترل‌پلین نصب است؛ ترافیک VPN شما از آن عبور نمی‌کند و پنل نهایی بعد از نصب مستقل است.

### گام ۲ — ساخت کلید Cloudflare و نصب پنل

1. روی **ساخت کلید Cloudflare** بزنید؛ Cloudflare با `Workers Scripts: Edit`، `Workers KV Storage: Edit` و `Account Settings: Read` باز می‌شود.
2. **Create Token** را بزنید و مقدار Token را که Cloudflare فقط یک بار نشان می‌دهد کپی کنید.
3. به Installer برگردید، Token را Paste و Verify کنید.
4. Account را انتخاب کنید. نام Worker و رمز مدیریت قابل تغییرند؛ رمز پیش‌فرض خودکار ساخته می‌شود و حتی یک مقدار کوتاهِ غیرخالی هم پذیرفته می‌شود.
5. **Install** را بزنید. Installer به‌صورت خودکار KV، Worker، Secret و workers.dev را می‌سازد و `/health` را بررسی می‌کند.
6. آدرس پنل و رمز مدیریت را بردارید؛ پنل را باز کنید و کانفیگ/QR/Subscription را بگیرید.

### حریم خصوصی Token

Token در درخواست HTTPS به Installer Worker ارسال می‌شود چون Cloudflare API از مرورگر CORS مستقیم نمی‌پذیرد. Token فقط در همان درخواست/حافظهٔ موقت استفاده می‌شود و در KV، DB، Cookie، localStorage، sessionStorage، analytics یا log ذخیره نمی‌شود. پس از موفقیت یا خطا، Token از state نصب‌کننده پاک می‌شود. پنل نصب‌شده به آن وابسته نیست و می‌توانید Token را از Cloudflare حذف کنید.

### معنی خطاهای رایج

- `token-invalid` — توکن اشتباه، منقضی یا غیرفعال است؛ توکن تازه بسازید.
- `insufficient-scope` — یکی از سه دسترسی بالا در توکن نیست؛ توکن را با همان لینک پیش‌پرشده دوباره بسازید.
- `health-failed` — نصب انجام شده اما بررسی سلامت ناموفق بوده؛ چند لحظه بعد آدرس Worker را مستقیم باز کنید و در صورت نیاز Install را دوباره بزنید (نصب تکراری، منبع تکراری نمی‌سازد).
- اگر `workers.dev` روی شبکهٔ شما محدود است، برای بازکردن صفحهٔ نصب‌کننده و پنل از یک شبکهٔ جایگزین کمک بگیرید؛ اتصال کلاینت VPN شما معمولاً مسیر دیگری دارد و تحت‌تأثیر همین محدودیت صفحه نیست.

## نصب با اسکریپت (جایگزین برای ترمینال‌دوست‌ها)

اگر ترمینال را ترجیح می‌دهید، اسکریپت خودش همه‌کار را می‌کند: بررسی توکن، ساخت KV، آپلود Worker امضاشده، ست‌کردن رمز، فعال‌سازی workers.dev و چاپ کانفیگ‌ها. (اگر در ایران هستید و دانلود اسکریپت خطا داد، از روش بدون ترمینال بالا استفاده کنید.)

**ویندوز (PowerShell):**

```powershell
irm https://cdn.jsdelivr.net/gh/tehrannetwork021/FreePanel-VPN@main/install.ps1 | iex
```

اگر jsDelivr باز نشد از لینک مستقیم گیت‌هاب استفاده کن:

```powershell
irm https://raw.githubusercontent.com/tehrannetwork021/FreePanel-VPN/main/install.ps1 | iex
```

**لینوکس / مک / WSL / Git Bash:**

```bash
curl -fsSL https://cdn.jsdelivr.net/gh/tehrannetwork021/FreePanel-VPN@main/install.sh -o install.sh && bash install.sh
```

**مراحل:**

1. اسکریپت لینک ساخت توکن (پیش‌تنظیم با سه دسترسی لازم) را نشان می‌دهد؛ باز کن و **Create Token** بزن.
2. توکن را کپی و در اسکریپت Paste کن و Enter بزن.
3. اگر چند حساب داشته باشی، شمارهٔ حساب را انتخاب کن؛ نام Worker و رمز مدیریت را وارد کن (یا Enter بزن تا رمز تصادفی ساخته شود).
4. در پایان: آدرس پنل، رمز مدیریت، لینک‌های VLESS-WS / Trojan-WS / XHTTP و آدرس Subscription چاپ می‌شود — همان‌ها را در کلاینت وارد کن.

پرچم‌های اختیاری: `--name` برای نام Worker، `--password` برای رمز، `--account` برای انتخاب حساب در اجرای غیرتعاملی.

## بعد از نصب چه می‌بینم؟

در نسخه `v0.2.0` سه مسیر اتصال فعال هستند: `VLESS over WebSocket`، `Trojan over WebSocket` و `VLESS XHTTP stream-one`. پنل بعد از احراز رمز مدیریت، لینک مستقیم، QR و Subscription (فرمت‌های base64، لینک، singbox و mihomo) را نمایش می‌دهد. مسیر `/api/status` فقط وضعیت عمودی بدون افشای Secret برمی‌گرداند.

## مسیر جایگزین برای توسعه‌دهندگان: Deploy to Cloudflare

اگر ترجیح می‌دهید بدون نصب‌کننده و توکن، مستقیم قالب Worker را نصب کنید، دکمهٔ **Developer Install (Deploy to Cloudflare)** در README قالب `deploy/worker` را با خود Cloudflare دیپلوی می‌کند:
[https://deploy.workers.cloudflare.com/?url=https://github.com/tehrannetwork021/FreePanel-VPN/tree/main/deploy/worker](https://deploy.workers.cloudflare.com/?url=https://github.com/tehrannetwork021/FreePanel-VPN/tree/main/deploy/worker)

1. روی دکمه بزنید و وارد حساب Cloudflare شوید.
2. برای Secret با نام `ADMIN_PASSWORD` یک رمز قوی تعیین کنید و نگه دارید.
3. Deploy را تأیید کنید؛ Cloudflare فضای KV را می‌سازد و با نام `C` متصل می‌کند.
4. آدرس `*.workers.dev` را باز کنید و همان `ADMIN_PASSWORD` را وارد کنید.

این مسیر «توسعه‌دهنده/پیشرفته» محسوب می‌شود؛ مسیر پیشنهادی کاربر عادی همان نصب با توکن در بالای همین صفحه است.

## به‌روزرسانی

هر Release در GitHub با شماره نسخه جدا منتشر می‌شود. قبل از Update، Release Notes را بخوانید. اجرای دوبارهٔ نصب با توکن، Worker را به نسخهٔ جدید به‌روز می‌کند و KV تنظیمات شما را دست‌نخورده نگه می‌دارد (idempotent). در نسخه‌های بعدی Safe Upgrade و rollback کامل اضافه می‌شود.

## حذف

برای حذف، از Cloudflare Dashboard به Workers & Pages بروید و Worker ساخته‌شده را حذف کنید. KV ساخته‌شده مستقل است؛ اگر دیگر به تنظیمات آن نیاز ندارید، KV Namespace مربوط را نیز حذف کنید. توکن نصب را هم از صفحهٔ API Tokens کلادفلر حذف کنید.

## امنیت

- Token یا Secret را در Issue عمومی نفرستید.
- Token فقط برای درخواست HTTPS نصب روی Installer Worker استفاده می‌شود و هیچ‌جا ذخیره نمی‌شود؛ ترافیک VPN از Installer عبور نمی‌کند.
- فقط Scoped Token بسازید؛ Global API Key هرگز ندهید.
- دسترسی‌های پیشنهادی فقط همین سه مورد است: Workers Scripts Edit، Workers KV Storage Edit، Account Settings Read.
- فایل [SECURITY.md](../SECURITY.md) مرجع گزارش امنیتی پروژه است.
