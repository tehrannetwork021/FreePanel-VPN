# آموزش نصب و استفاده — فارسی

## نصب بدون ترمینال

مسیر رسمی پروژه **GitHub → Deploy to Cloudflare** است: بدون VPS، بدون دامنه اجباری، بدون Wrangler محلی، بدون SSH/PowerShell و بدون API Token دستی.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/tehrannetwork021/FreePanel-VPN/tree/main/deploy/worker)

### گام ۱ — Deploy to Cloudflare

دکمه بالا را بزنید. Cloudflare template مستقل `deploy/worker` را مستقیماً از GitHub می‌خواند. اگر لازم باشد از شما می‌خواهد وارد GitHub و Cloudflare شوید و Account مقصد را انتخاب کنید.

### گام ۲ — تنظیمات نصب

نام‌های پیش‌فرض Worker، KV و D1 را می‌توانید بدون تغییر قبول کنید. تنها مقدار امنیتی لازم `ADMIN_PASSWORD` است؛ یک رمز قوی و یکتا انتخاب کنید.

این رمز توسط صفحه Deploy خود Cloudflare به‌عنوان Secret دریافت می‌شود و داخل GitHub commit نمی‌شود.

### گام ۳ — Deploy

Cloudflare خودش:

- repository/template را clone و build می‌کند؛
- Worker را روی `workers.dev` منتشر می‌کند؛
- KV binding با نام `C` را provision می‌کند؛
- D1 binding با نام `DB` را provision می‌کند؛
- `ADMIN_PASSWORD` را به‌صورت Secret به Worker می‌دهد.

Schema D1 در اولین اجرای Worker به‌صورت idempotent ساخته/بررسی می‌شود.

### گام ۴ — ورود به پنل

بعد از Deploy، آدرس `https://<worker>.<subdomain>.workers.dev` را باز کنید. برای مدیریت وارد `/admin` شوید و همان `ADMIN_PASSWORD` را وارد کنید.

## چیزی که لازم ندارید

- VPS یا سرور واسط
- دامنه پولی
- API Token دستی یا Global API Key
- Wrangler روی کامپیوتر کاربر
- SSH، PowerShell یا ترمینال
- سرویس پولی جانبی

## داخل پنل `/admin`

پس از ورود می‌توانید کاربر بسازید، Pause/Resume کنید، expiry و quota تعیین کنید، VLESS-WS/Trojan-WS/VLESS-XHTTP را مدیریت کنید، Subscription و QR بگیرید، credentialها را rotate کنید و usage/audit را ببینید.

## سهمیه و Usage

مصرف upload/download در checkpointهای درشت به D1 نوشته می‌شود: پیش‌فرض هر `4 MiB`، هر `60 ثانیه` یا هنگام بسته‌شدن اتصال. این مدل برای کاهش write روی پلن رایگان طراحی شده و billing دقیق per-packet نیست.

## داده‌ها کجا هستند؟

- D1: users، quota/expiry، usage، audit، login events، sessions و installation state.
- KV: تنظیمات کم‌نوشتن و stateهای محدود.
- Password ادمین به‌صورت Secret در Cloudflare وارد می‌شود؛ hash احراز هویت در D1 نگه‌داری می‌شود.

## Upgrade

Cloudflare Deploy Button یک repository قابل توسعه برای شما می‌سازد و Workers Builds می‌تواند pushهای branch تولید را خودکار deploy کند. برای تغییر رمز Admin از خود پنل استفاده کنید تا sessionهای قبلی باطل شوند.

## محدودیت‌های فعلی Release Candidate

- Backup/Restore کامل هنوز در حال توسعه است.
- Speed limiting هنوز پیاده‌سازی نشده است.
- VLESS-XHTTP هنوز به field retest واقعی Cloudflare نیاز دارد.

## حذف

برای حذف کامل، Worker و KV/D1 ساخته‌شده را از Cloudflare Dashboard حذف کنید. قبل از حذف D1/KV فرض کنید داده بدون export مستقل قابل بازیابی نیست.

## امنیت

رمز Admin، Subscription URL، UUID/Password پروتکل، session cookie یا اطلاعات D1/KV را در Issue یا Screenshot عمومی قرار ندهید. جزئیات بیشتر: [SECURITY.md](../SECURITY.md).
