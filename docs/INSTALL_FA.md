# آموزش نصب و استفاده — فارسی

## نصب یک‌کلیکی پیشنهادی

این روش برای کاربر عادی پیشنهاد می‌شود و **نیازی به VPS، Wrangler یا واردکردن API Token در سایت Tehran Network ندارد**.

1. در README روی دکمه **Deploy to Cloudflare** بزنید.
2. وارد حساب Cloudflare خود شوید.
3. صفحه رسمی Cloudflare، قالب `deploy/worker` را از GitHub می‌خواند.
4. برای Secret با نام `ADMIN_PASSWORD` یک رمز قوی حداقل 16 کاراکتری وارد کنید و آن را نگه دارید.
5. Deploy را بزنید؛ Cloudflare فضای KV را خودکار می‌سازد و با نام `C` به Worker متصل می‌کند.
6. بعد از پایان Build، لینک `*.workers.dev` را باز کنید.
7. همان `ADMIN_PASSWORD` را وارد کنید؛ پنل برای شما UUID، رمز Trojan و Subscription Token مستقل می‌سازد.
8. یکی از کانفیگ‌های VLESS-WS، Trojan-WS یا VLESS-XHTTP را Copy/QR کنید یا لینک Subscription را داخل کلاینت وارد کنید.

> این مسیر توسط خود Cloudflare انجام می‌شود؛ هیچ Cloudflare API Token به سرور Tehran Network ارسال نمی‌شود.

## بعد از نصب چه می‌بینم؟

در Release `v0.1.0` سه مسیر اتصال واقعی فعال هستند: `VLESS over WebSocket`، `Trojan over WebSocket` و `VLESS XHTTP stream-one`. پنل بعد از احراز رمز مدیریت، لینک مستقیم، QR و Subscription را نمایش می‌دهد. مسیر `/api/status` فقط وضعیت عمومی را بدون افشای Secret برمی‌گرداند.

## مسیر پیشرفته با Cloudflare API Token

صفحه Installer پروژه یک دکمه مستقیم برای بازکردن Token Builder رسمی Cloudflare دارد. توکن پیشنهادی فقط برای Workers/KV/Routes ساخته می‌شود و در UI پروژه در حافظه موقت نگه داشته می‌شود.

در نسخه `v0.1.0`، Backend واقعی `/api/install` برای این مسیر هنوز در حال توسعه است؛ بنابراین **برای نصب واقعی فعلاً از Deploy to Cloudflare استفاده کنید**. این موضوع عمداً شفاف نوشته شده تا کاربر تصور نکند یک دکمه نمایشی واقعاً Worker ساخته است.

## به‌روزرسانی

هر Release در GitHub با شماره نسخه جدا منتشر می‌شود. قبل از Update، Release Notes را بخوانید. در نسخه‌های بعدی Safe Upgrade و rollback اضافه می‌شود.

## حذف

برای حذف نسخه فعلی، از Cloudflare Dashboard به Workers & Pages بروید و Worker ساخته‌شده را حذف کنید. KV ساخته‌شده مستقل است؛ اگر دیگر به تنظیمات آن نیاز ندارید، KV Namespace مربوط را نیز حذف کنید.

## امنیت

- Token یا Secret را در Issue عمومی نفرستید.
- برای مسیر یک‌کلیکی، Cloudflare خودش Deploy را انجام می‌دهد.
- اگر از مسیر Token استفاده می‌کنید، فقط Scoped Token بسازید؛ Global API Key ندهید.
- فایل [SECURITY.md](../SECURITY.md) مرجع گزارش امنیتی پروژه است.
