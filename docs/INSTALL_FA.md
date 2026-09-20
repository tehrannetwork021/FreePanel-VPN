# آموزش نصب و استفاده — فارسی

## نصب بدون ترمینال (مسیر رسمی Phase A)

این مسیر برای کاربر عادی است: **بدون VPS، دامنه پولی، GitHub connection، Wrangler، PowerShell یا ترمینال**.

### گام ۱ — Installer عمومی را باز کنید

https://tehran-network-installer.honored-feather.workers.dev

Installer فقط کنترل‌پلین نصب است؛ ترافیک VPN شما از آن عبور نمی‌کند و پنل نهایی بعد از نصب مستقل است.

### گام ۲ — ساخت کلید Cloudflare

روی **ساخت کلید Cloudflare / Generate Cloudflare Key** بزنید و توکن Scoped بسازید. دسترسی‌های لازم:

- `Workers Scripts: Edit`
- `Workers KV Storage: Edit`
- `D1 Write`
- `Account Settings: Read`

از Global API Key استفاده نکنید. Token را Cloudflare فقط یک‌بار نمایش می‌دهد؛ آن را Copy کنید و به Installer برگردید.

### گام ۳ — Verify و Install

1. Token را Paste و Verify کنید.
2. اگر چند Account دارید، حساب موردنظر را انتخاب کنید.
3. نام Worker را تعیین کنید؛ برای Upgrade همان نام قبلی را نگه دارید.
4. رمز مدیریت خودکار تولید می‌شود و قابل تغییر است؛ رمز قوی و یکتا را نگه دارید.
5. **Install** را بزنید.
6. Installer، KV + D1 + Worker + Secret + `workers.dev` را داخل حساب خودتان ایجاد یا reuse می‌کند.
7. نتیجه شامل **Worker URL، آدرس `/admin` و رمز مدیریت** است.

## Token و حریم خصوصی

Token فقط در درخواست HTTPS نصب استفاده می‌شود و نباید در KV، D1، Cookie، localStorage، sessionStorage، analytics یا log persist شود. بعد از موفقیت یا خطا، Installer آن را از state مرورگر پاک می‌کند. پنل نصب‌شده به Token نصب وابسته نیست و می‌توانید بعداً آن را revoke کنید.

## داخل پنل `/admin`

پس از ورود با رمز مدیریت می‌توانید:

- کاربر بسازید، ویرایش، Pause/Resume یا حذف کنید.
- تاریخ انقضا، سهمیه کل و سهمیه روزانه UTC تعیین کنید.
- VLESS-WS، Trojan-WS و VLESS-XHTTP stream-one را برای هر کاربر فعال/غیرفعال کنید.
- لینک Subscription خصوصی، QR و credentialهای همان کاربر را بگیرید.
- Subscription token یا credentialهای VLESS/Trojan را rotate کنید.
- Usage روزانه/تجمیعی، Audit و Login events را ببینید.

Subscription URL یک **Credential** است؛ آن را عمومی نکنید. Token قدیمی بعد از rotation فوراً 404 می‌شود و credential قدیمی بعد از rotation دیگر اجازه اتصال ندارد.

## سهمیه و Usage چگونه اعمال می‌شود؟

مصرف upload/download برای کاربران D1 در checkpointهای درشت ثبت می‌شود: به‌طور پیش‌فرض هر `4 MiB`، هر `60 ثانیه` یا هنگام بسته‌شدن اتصال. این طراحی writeهای D1 را برای پلن رایگان محدود می‌کند.

این سیستم billing دقیق per-packet نیست. در اتصال‌های هم‌زمان، مصرف ممکن است تا حدود اندازه checkpoint × تعداد connectionها از quota عبور کند و سپس اتصال/شروع بعدی رد شود. `NULL` یعنی بدون سهمیه؛ `0` یعنی از ابتدا exhausted.

**Speed limiting هنوز در Phase A پیاده‌سازی نشده است.**

## محل نگه‌داری داده‌ها

- **D1 منبع اصلی control plane است:** installation state، credential index/version، users، quota/expiry، usage، audit، login events و admin sessions.
- **KV برای state کم‌نوشتن است:** تنظیمات global پروتکل/owner و diagnostics/cacheهای محدود.
- Secretهای خام هر کاربر در D1 ذخیره نمی‌شوند؛ از installation seed پایدار و version هر secret مشتق می‌شوند و فقط lookup hash/version نگه‌داری می‌شود.

## Upgrade / Reinstall با همان Worker name

Installer نام‌های `${workerName}-config` برای KV و `${workerName}-control` برای D1 را reuse می‌کند. نصب دوباره:

- protocol config و owner credentialهای legacy در KV را بازنویسی نمی‌کند؛
- installation seed و secret-version کاربران را در D1 حفظ می‌کند، پس لینک‌ها و credentialهای موجود کاربران ثابت می‌مانند؛
- یک `INSTALL_GENERATION` تازه می‌فرستد تا رمز ادمین یک‌بار با رمز جدیدی که Installer نشان می‌دهد sync شود؛
- sessionهای ادمین قبلی را نامعتبر می‌کند.

بنابراین بعد از reinstall باید با **رمز جدید نمایش‌داده‌شده در نتیجه Installer** وارد `/admin` شوید، درحالی‌که access کاربران قبلی نباید تغییر کند.

## محدودیت‌های فعلی Release Candidate 0.3.0

- Backup/Restore کامل هنوز آماده نیست؛ حذف دستی D1/KV می‌تواند داده‌های control plane یا config را از بین ببرد.
- Speed limiting وجود ندارد؛ فقط quota/expiry و checkpoint accounting اعمال می‌شوند.
- Field gate واقعی Cloudflare برای v0.3.0 هنوز pending است؛ این نسخه تا تکمیل آن stable اعلام نمی‌شود.

## حذف

برای حذف کامل، Worker، KV namespace مربوط، D1 database مربوط و در صورت عدم نیاز API Token نصب را از Cloudflare Dashboard حذف کنید. قبل از حذف D1/KV فرض کنید داده قابل بازیابی نیست مگر خودتان export مستقل داشته باشید.

## امنیت

Token، Subscription URL، UUID/Password پروتکل، session cookie یا اطلاعات D1/KV را در Issue یا Screenshot عمومی قرار ندهید. جزئیات بیشتر: [SECURITY.md](../SECURITY.md).
