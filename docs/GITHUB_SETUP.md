# GitHub Repository Launch Checklist

این فایل تنظیماتی را نگه می‌دارد که داخل Git قابل Commit نیستند و باید در تنظیمات Repository اعمال شوند.

## Description پیشنهادی

`Bilingual Persian/English serverless edge panel for Cloudflare Workers — local-first one-click setup, no VPS, modern RTL/LTR UI.`

## Topics پیشنهادی

`cloudflare-workers`, `serverless`, `cloudflare`, `vless`, `trojan`, `xhttp`, `vpn-panel`, `proxy`, `persian`, `rtl`, `typescript`, `react`, `edge-computing`, `open-source`

> تا وقتی هسته VLESS/Trojan/XHTTP Release نشده، README باید آن‌ها را Roadmap/In development نشان دهد؛ Topic صرفاً حوزه پروژه را مشخص می‌کند.

## Social Preview

فایل آماده: `assets/readme/social-preview.png` با اندازه 1280×640.

Repository Settings → General → Social preview → Upload an image

## About section

- Website: در زمان داشتن Demo عمومی اضافه شود.
- Releases: بعد از اولین نسخه قابل نصب فعال تبلیغ شود.
- Packages: فقط در صورت انتشار Installer به npm.

## Launch sequence

1. Push شاخه توسعه و باز کردن PR.
2. سبز شدن CI و E2E.
3. Merge به `main`.
4. تنظیم Description، Topics و Social Preview بالا.
5. ساخت Release فقط وقتی `/api/install` واقعاً Cloudflare را provision کند.
