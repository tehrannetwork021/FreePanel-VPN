# مشخصات طراحی Tehran Network Edge Panel

**وضعیت:** تاییدشده در 2026-09-19

## هدف

پنل دو زبانه فارسی/انگلیسی، بدون VPS شخصی، با نصب خودکار روی Cloudflare Workers. کاربر فقط Scoped API Token می‌دهد و Installer باید Worker، KV، Binding و Secretهای مستقل را بسازد.

## اصول اصلی

- برند نهایی فقط Tehran Network است.
- فارسی RTL واقعی و انگلیسی LTR واقعی.
- UI اختصاصی Prismatic Network Console؛ نه قالب generic.
- Cloudflare Token فقط در RAM و هرگز در storage/log/KV/repo ذخیره نشود.
- Admin credential، subscription token و protocol secret از هم مستقل باشند.
- کد TypeScript ماژولار و تست‌پذیر باشد.
- از پروژه‌های CFnew، Re_edgetunnel، CFNext، yx-tools و edgetunnel فقط به‌عنوان مرجع رفتار/معماری استفاده شود؛ کد با License نامشخص کپی نشود.

## V1

Installer، Dashboard، VLESS، Trojan، XHTTP، Smart Endpoints، Routing/Outbound، Subscription، DNS/ECH، Network Lab، Logs، Backup/Restore، Security، Upgrade.

## معماری

Installer محلی → Cloudflare API → Worker + KV → Tehran Network Panel.

## معیار موفقیت

کاربر جدید باید بدون دانش KV/Binding/Wrangler بتواند با Token محدود، نصب را انجام دهد و در پایان Panel URL، Subscription URL، QR و Recovery data بگیرد.
