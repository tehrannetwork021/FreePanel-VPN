# Security Policy / سیاست امنیتی

## English

Never report secrets in public issues. Do not include Cloudflare API tokens, VLESS UUIDs, Trojan passwords, subscription tokens, session cookies, recovery secrets, or upstream proxy credentials.

Security fixes target the latest released major version and `main`.

Before sharing diagnostics, use redacted exports only. Raw browser storage, request headers, and Cloudflare credentials must never be attached to an issue.

## فارسی

هیچ Secret یا Credential را در Issue عمومی ارسال نکنید؛ شامل Cloudflare API Token، UUID، رمز Trojan، Subscription Token، Session Cookie، Recovery Secret یا اطلاعات Proxy خروجی.

رفع اشکالات امنیتی روی آخرین نسخه اصلی و شاخه `main` انجام می‌شود.

برای گزارش مشکل فقط خروجی Redacted ارسال شود. Browser Storage خام، Header درخواست و Credentialهای Cloudflare نباید در Issue یا Screenshot قرار بگیرند.
