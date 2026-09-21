# شروع سریع — فارسی

## مسیر پیشنهادی: فقط یک توکن Cloudflare

1. نصب‌کننده عمومی را باز کنید: https://tehran-network-installer.honored-feather.workers.dev
2. روی **ساخت کلید Cloudflare** بزنید و یک API Token محدود با دسترسی‌های Workers Scripts: Edit، Workers KV Storage: Edit، D1: Write و Account Settings: Read بسازید.
3. توکن را فقط یک بار داخل نصب‌کننده Paste کنید و **Install** را بزنید.
4. نصب‌کننده اولین اکانت Cloudflare قابل‌دسترسی را خودش انتخاب می‌کند، Worker ثابت `tehran-network-edge` را Deploy می‌کند، KV + D1 را می‌سازد/Reuse می‌کند، رمز مدیریت 18 کاراکتری می‌سازد، `workers.dev` را فعال می‌کند و Health و Login واقعی Admin را تست می‌کند.
5. در پایان آدرس `/admin` و رمز تولیدشده را ذخیره کنید.

هیچ VPS، سرور خارجی، اکانت GitHub، Wrangler/CLI، انتخاب Account، انتخاب نام Worker یا ساخت دستی رمز Admin لازم نیست. خود پنل کاملاً داخل اکانت Cloudflare شما اجرا می‌شود. توکن فقط هنگام درخواست HTTPS نصب استفاده می‌شود و توسط نصب‌کننده ذخیره نمی‌شود.

راهنمای کامل: [INSTALL_FA.md](INSTALL_FA.md)

## وضعیت کاندید v0.3.1

فلو Cloudflare-only با یک توکن و gateهای محلی Release پیاده‌سازی شده‌اند. یک نصب واقعی روی Cloudflare هنوز گیت نهایی قبل از Stable نامیدن `v0.3.1` است.

## توسعه محلی (فقط توسعه‌دهندگان)

```bash
git clone https://github.com/tehrannetwork021/FreePanel-VPN.git
cd FreePanel-VPN
corepack enable
corepack prepare pnpm@10.15.1 --activate
pnpm install --frozen-lockfile
pnpm --filter @tehrannetwork/installer dev
```
