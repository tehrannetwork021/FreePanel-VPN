# شروع سریع — فارسی

## وضعیت فعلی

نسخه فعلی برای توسعه و تست Foundation است. UI نصب یک‌کلیکی آماده است، اما backend واقعی `/api/install` که منابع Cloudflare را می‌سازد در Milestone بعدی تکمیل می‌شود.

## اجرای Installer

```bash
git clone https://github.com/tehrannetwork021/FreePanel-VPN.git
cd FreePanel-VPN
corepack enable
corepack prepare pnpm@10.15.1 --activate
pnpm install --frozen-lockfile
pnpm --filter @tehrannetwork/installer dev
```

مرورگر را روی `http://127.0.0.1:4174` باز کنید.

در Installer روی «دریافت Cloudflare API Token» بزنید. لینک رسمی Cloudflare با دسترسی‌های Workers Scripts، Workers KV و Workers Routes از قبل پر می‌شود. Token را بسازید، Copy کنید و داخل Installer Paste کنید.

Token در LocalStorage، SessionStorage یا Cookie ذخیره نمی‌شود و بعد از تحویل به سرویس نصب محلی از حافظه UI پاک می‌شود.

## اجرای Dashboard

```bash
pnpm --filter @tehrannetwork/panel dev
```

Dashboard روی `http://127.0.0.1:4173` اجرا می‌شود و از داخل UI می‌توانید بین فارسی RTL و English LTR جابه‌جا شوید.
