# Security Policy / سیاست امنیتی

## English

### Reporting

Never report secrets in public issues. Do not include Cloudflare API tokens, admin passwords, VLESS UUIDs, Trojan passwords, private subscription URLs/tokens, session cookies, CSRF values, installation seeds, D1 exports, or upstream proxy credentials.

Before sharing diagnostics, redact request headers and browser/network captures. The public `/api/status` path is intentionally limited; raw database or KV dumps are not safe diagnostic attachments.

### Installation token boundary

The scoped Cloudflare token is sent over HTTPS to the public installer only for verify/provision requests. The product is designed not to persist that token in KV, D1, cookies, browser storage, analytics, or application logs. Revoke the setup token after installation if you do not need it again.

Use the documented scoped permissions only: Workers Scripts Edit, Workers KV Storage Edit, D1 Write, and Account Settings Read. Never provide a Global API Key.

### Admin authentication

The deployed Worker synchronizes the installer-provided admin password into D1 for the current `INSTALL_GENERATION`. The credential is protected with PBKDF2-HMAC-SHA-256; plaintext admin passwords are not stored in D1.

Admin sessions use random tokens with only hashes persisted in D1, a 12-hour absolute lifetime, `HttpOnly; Secure; SameSite=Strict` session cookies, and a separate CSRF token/hash check for state-changing requests. Changing or reinstall-syncing the admin password invalidates older sessions through password-version checks.

### Per-user access secrets

A persistent 32-byte installation seed lives inside D1 installation state and must never be returned by an API or copied into logs. Per-user subscription tokens, VLESS UUIDs, and Trojan passwords are deterministically derived from that seed with purpose/version separation.

D1 stores secret versions and lookup hashes rather than the raw per-user credentials. Rotating a subscription token or protocol credential advances its version and invalidates the previous value. Reinstalling the same Worker name preserves the installation seed and user secret versions unless the data store itself is deleted.

A private subscription URL is equivalent to a password: anyone who has it can retrieve that user's current connection material while the user is allowed. Treat QR codes containing the subscription URL the same way.

### Data and redaction rules

D1 is authoritative for users, quota/expiry, usage, audit/login state, sessions, and credential indexes. KV contains low-write protocol/configuration and bounded diagnostics/cache state. Audit details are allow-listed/redacted and must never include admin/session/CSRF material, installation seed, subscription tokens, or protocol credentials.

Login telemetry records success state plus limited Cloudflare metadata and a hashed user-agent; raw source IPs and candidate passwords are not stored. Login throttling uses a keyed hash of the source address rather than persisting the raw address.

### Current limitations

Phase A does not provide full Backup/Restore or speed limiting. Quota accounting is checkpoint-based rather than per-packet. Operators should not delete D1/KV unless they accept loss of the corresponding control-plane/configuration state.

Security fixes target the actively maintained release branch and `main`. The v0.3.0 release candidate remains field-gate pending until the documented real Cloudflare checklist is completed.

## فارسی

### گزارش مشکل

Secret یا Credential را در Issue عمومی نفرستید؛ شامل Cloudflare API Token، رمز ادمین، UUID، رمز Trojan، Subscription URL/Token خصوصی، Session Cookie، CSRF، Installation Seed، خروجی D1 یا اطلاعات Proxy خروجی.

### مرزهای احراز هویت و Secret

توکن Scoped کلادفلر فقط برای Verify/Install از طریق HTTPS به Installer می‌رود و نباید در KV، D1، Cookie، Browser Storage، Analytics یا Log persist شود. فقط چهار دسترسی مستندشده را بدهید و Global API Key استفاده نکنید.

رمز مدیریت برای `INSTALL_GENERATION` جاری در D1 با PBKDF2-HMAC-SHA-256 نگه‌داری می‌شود؛ plaintext ذخیره نمی‌شود. Session ادمین token تصادفی دارد و فقط hash آن در D1 می‌ماند؛ Cookie با `HttpOnly; Secure; SameSite=Strict` تنظیم می‌شود و درخواست‌های تغییردهنده علاوه بر Session به CSRF معتبر نیاز دارند. تغییر رمز یا reinstall با generation تازه sessionهای قدیمی را باطل می‌کند.

Installation Seed پایدار ۳۲ بایتی فقط در D1 است و نباید از API برگردد. Subscription token، VLESS UUID و Trojan password هر کاربر از seed + purpose + version مشتق می‌شوند؛ D1 فقط version و lookup hash را نگه می‌دارد. Rotation مقدار قبلی را نامعتبر می‌کند.

**Subscription URL و QR آن Credential هستند**؛ آن‌ها را مانند رمز عبور محافظت کنید.

### داده و Redaction

D1 مرجع کاربران، quota/expiry، usage، audit/login، session و credential index است. KV برای global protocol/config و diagnostics/cache کم‌نوشتن استفاده می‌شود. Audit فقط فیلدهای allow-list شده و redacted را ثبت می‌کند و نباید admin password، session/CSRF، installation seed، subscription token یا credential پروتکل را شامل شود.

Login telemetry رمز واردشده یا IP خام را ذخیره نمی‌کند. Throttle ورود از keyed hash آدرس منبع استفاده می‌کند.

### محدودیت فعلی

در Phase A هنوز Backup/Restore کامل و speed limiting وجود ندارد و quota به‌صورت checkpoint اعمال می‌شود. حذف D1/KV را معادل ریسک از دست رفتن state در نظر بگیرید. `v0.3.0` تا پایان field gate واقعی Cloudflare یک Release Candidate است.
