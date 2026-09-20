# آموزش نصب و استفاده — فارسی

## نصب با اسکریپت — توکن را Paste کن، تمام

سریع‌ترین روش اگر دسترسی به PowerShell (ویندوز) یا ترمینال (لینوکس/مک/WSL) داری. اسکریپت خودش همه‌کار را می‌کند: بررسی توکن، ساخت KV، آپلود Worker امضاشده، ست‌کردن رمز مدیریت، فعال‌سازی workers.dev و چاپ کانفیگ‌ها. توکن فقط در حافظهٔ همان اجرا می‌ماند.

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

## نصب رایگان با توکن Cloudflare (مسیر پیشنهادی)

این مسیر رسمی نصب است و **نیازی به VPS، دامنه، اتصال GitHub، Wrangler یا ترمینال ندارد** و روی پلن رایگان Cloudflare انجام می‌شود. کل کار دو مرحله است: اول نصب‌کننده، بعد ساخت توکن.

### مرحله ۱ — نصب خود نصب‌کننده (یک بار)

1. در README روی دکمه **Deploy Installer** بزنید یا مستقیم این لینک را باز کنید:
   [https://deploy.workers.cloudflare.com/?url=https://github.com/tehrannetwork021/FreePanel-VPN/tree/main/apps/installer-worker](https://deploy.workers.cloudflare.com/?url=https://github.com/tehrannetwork021/FreePanel-VPN/tree/main/apps/installer-worker)
2. وارد حساب رایگان Cloudflare خود شوید و Deploy را تأیید کنید.
3. Cloudflare خودش Worker نصب‌کننده را می‌سازد و یک آدرس شبیه `https://tehran-network-installer.<نام-حساب>.workers.dev` می‌دهد؛ این آدرس را باز کنید و نگه دارید.

> نصب‌کننده فقط یک صفحه محلی روی اکانت خودتان است؛ توکن شما هرگز به سرور Tehran Network ارسال یا ذخیره نمی‌شود.

### مرحله ۲ — ساخت کلید Cloudflare و نصب پنل

1. در صفحه نصب‌کننده روی **ساخت کلید Cloudflare** بزنید؛ لینک رسمی Cloudflare با دسترسی‌های ازپیش‌تعیین‌شده باز می‌شود: `Workers Scripts: Edit`، `Workers KV Storage: Edit` و `Account Settings: Read` برای همه حساب‌ها.
2. روی **Create Token** بزنید. Cloudflare مقدار توکن را **فقط یک بار** نمایش می‌دهد؛ آن را کپی کنید.
3. توکن را در نصب‌کننده Paste کنید و Verify بزنید؛ حساب‌های شما شناسایی می‌شوند.
4. حساب موردنظر را انتخاب کنید، برای Worker یک نام (پیش‌فرض: `tehran-network-edge`) و یک رمز مدیریت برای پنل تعیین کنید.
5. Install را بزنید؛ نصب‌کننده به‌صورت خودکار KV را می‌سازد، Worker را با نسخه امضاشده آپلود می‌کند، رمز مدیریت را ست می‌کند و `workers.dev` را فعال می‌کند.
6. در پایان، آدرس `https://<نام-worker>.<نام-حساب>.workers.dev` به شما داده می‌شود؛ بازش کنید، همان رمز مدیریت را وارد کنید و کانفیگ‌ها را بردارید.

پس از هر تلاش نصب (موفق یا ناموفق)، توکن از حافظهٔ مرورگر پاک می‌شود و در localStorage، sessionStorage، KV یا لاگ‌ها ذخیره نمی‌شود. اگر خواستید توکن را عقب‌تر حذف کنید، در صفحهٔ نتیجه لینک «حذف کلید نصب» به صفحهٔ رسمی API Tokens کلادفلر داده شده است.

### معنی خطاهای رایج

- `token-invalid` — توکن اشتباه، منقضی یا غیرفعال است؛ توکن تازه بسازید.
- `insufficient-scope` — یکی از سه دسترسی بالا در توکن نیست؛ توکن را با همان لینک پیش‌پرشده دوباره بسازید.
- `health-failed` — نصب انجام شده اما بررسی سلامت ناموفق بوده؛ چند لحظه بعد آدرس Worker را مستقیم باز کنید و در صورت نیاز Install را دوباره بزنید (نصب تکراری، منبع تکراری نمی‌سازد).
- اگر `workers.dev` روی شبکهٔ شما محدود است، برای بازکردن صفحهٔ نصب‌کننده و پنل از یک شبکهٔ جایگزین کمک بگیرید؛ اتصال کلاینت VPN شما معمولاً مسیر دیگری دارد و تحت‌تأثیر همین محدودیت صفحه نیست.

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

برای حذف، از Cloudflare Dashboard به Workers & Pages بروید و Worker ساخته‌شده (و در صورت نیاز نصب‌کننده) را حذف کنید. KV ساخته‌شده مستقل است؛ اگر دیگر به تنظیمات آن نیاز ندارید، KV Namespace مربوط را نیز حذف کنید. توکن نصب را هم از صفحهٔ API Tokens کلادفلر حذف کنید.

## امنیت

- Token یا Secret را در Issue عمومی نفرستید.
- توکن شما فقط در حافظهٔ موقت مرورگر و برای همین درخواست استفاده می‌شود؛ سروری از Tehran Network در کار نیست.
- فقط Scoped Token بسازید؛ Global API Key هرگز ندهید.
- دسترسی‌های پیشنهادی فقط همین سه مورد است: Workers Scripts Edit، Workers KV Storage Edit، Account Settings Read.
- فایل [SECURITY.md](../SECURITY.md) مرجع گزارش امنیتی پروژه است.
