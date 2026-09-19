# شروع سریع — فارسی

## روش پیشنهادی

1. از README روی **Deploy to Cloudflare** بزنید یا صفحه نصب گرافیکی را باز کنید.
2. وارد Cloudflare شوید.
3. Deploy را تأیید کنید.
4. Cloudflare به‌صورت خودکار Worker و KV را می‌سازد و Binding `C` را متصل می‌کند.
5. بعد از Build، آدرس `*.workers.dev` را باز کنید.

راهنمای کامل: [INSTALL_FA.md](INSTALL_FA.md)

## وضعیت Release v0.1.0

این نسخه زیرساخت نصب واقعی Worker + KV و صفحه وضعیت را ارائه می‌کند. هسته‌های VLESS، Trojan و XHTTP هنوز در حال توسعه‌اند و در این نسخه Ready اعلام نشده‌اند.

## توسعه محلی

```bash
git clone https://github.com/tehrannetwork021/FreePanel-VPN.git
cd FreePanel-VPN
corepack enable
corepack prepare pnpm@10.15.1 --activate
pnpm install --frozen-lockfile
pnpm --filter @tehrannetwork/installer dev
```
