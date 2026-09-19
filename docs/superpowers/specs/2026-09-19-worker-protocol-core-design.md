# مشخصات طراحی هسته سه‌موتوره Tehran Network

**وضعیت:** طراحی تأییدشده در گفتگو؛ آماده برای بازبینی نهایی مالک

## هدف

این Milestone باید نسخه‌ی فعلی Tehran Network را از یک Worker bootstrap به یک سرویس واقعاً قابل استفاده تبدیل کند که پس از Deploy روی Cloudflare، کاربر بتواند کانفیگ اتصال واقعی دریافت کند.

سه مسیر اتصال اصلی V1 این Milestone:

- VLESS over WebSocket + TLS
- Trojan over WebSocket + TLS
- VLESS XHTTP over HTTPS

معیار موفقیت فقط نمایش UI یا تولید لینک نیست؛ handshake، احراز هویت، TCP forwarding و خروجی subscription باید با تست واقعی سبز باشند.

## مرجع رفتاری

برای رفتار و سازگاری از CFnew، Re_edgetunnel و edgetunnel استفاده می‌کنیم، اما implementation خودمان clean-room و ماژولار باقی می‌ماند. هیچ کد دارای مجوز نامشخص مستقیماً کپی نمی‌شود.

Cloudflare ورودی WebSocket/HTTP و خروجی TCP از `cloudflare:sockets` را پشتیبانی می‌کند. اتصال outbound به IPهای Cloudflare، localhost و private ranges مجاز نیست؛ این محدودیت باید در خطا و routing لحاظ شود.

## معماری داخلی

کد Worker به چهار مرز مستقل تقسیم می‌شود:

1. `protocols/` برای parser و handshake هر پروتکل.
2. `transport/` برای WebSocket، XHTTP و stream bridging.
3. `network/` برای TCP connect، validation مقصد، timeout و retry محدود.
4. `subscription/` برای تولید خروجی کلاینت‌ها بدون وابستگی به منطق tunnel.

Routeهای عمومی پیشنهادی:

- `/vless` فقط Upgrade WebSocket و VLESS frame.
- `/trojan` فقط Upgrade WebSocket و Trojan handshake.
- `/xhttp` فقط POST/stream مربوط به VLESS XHTTP.
- `/sub/{token}` خروجی subscription؛ token مستقل از UUID و رمز Trojan است.
- `/health` فقط وضعیت runtime بدون افشای Secret.

Panel route و API مدیریت از tunnel routeها جدا می‌مانند تا هیچ credential مدیریتی داخل handshake پروتکل‌ها استفاده نشود.

## تنظیمات و Secretها

KV binding اصلی همچنان `C` است. تنظیمات قابل تغییر در KV ذخیره می‌شوند، ولی Secretهای حساس باید به‌صورت hash یا Cloudflare Secret نگهداری شوند هرجا امکان‌پذیر است.

حداقل مدل تنظیمات:

- `vless.enabled`, `vless.uuid`, `vless.path`
- `trojan.enabled`, `trojan.passwordHash`, `trojan.path`
- `xhttp.enabled`, `xhttp.path`
- `subscription.secret`, `subscription.enabledFormats`
- `network.connectTimeoutMs`, `network.retryCount`
- `network.proxyIp` فقط در صورت نیاز و با validation صریح

UUID، Trojan credential و Subscription secret سه مقدار مستقل هستند.

## VLESS over WebSocket

Worker باید درخواست Upgrade معتبر را قبول کند، اولین binary payload را به‌عنوان VLESS request header parse کند، UUID را در زمان ثابت مقایسه کند، command/address/port را validate کند و فقط command TCP را در این Milestone بپذیرد.

بعد از handshake موفق، Worker با `connect()` به مقصد TCP وصل می‌شود و stream دوطرفه WebSocket ↔ TCP برقرار می‌کند. Early data فقط وقتی پذیرفته می‌شود که محدود و معتبر باشد؛ payload نامعتبر باید connection را بدون نشت جزئیات credential ببندد.

## Trojan over WebSocket

Trojan route باید handshake استاندارد Trojan را از stream WebSocket parse کند، credential را با مقدار ذخیره‌شده اعتبارسنجی کند و مقصد TCP را استخراج کند. فقط CONNECT/TCP در این Milestone پشتیبانی می‌شود.

رمز خام Trojan نباید در log نوشته شود. خطای auth برای client عمومی و یکسان است تا valid/invalid credential قابل تشخیص جانبی نباشد.

## VLESS XHTTP

XHTTP روی route مستقل HTTPS کار می‌کند و payloadهای POST را به sessionهای streaming تبدیل می‌کند. برای این Milestone فقط mode `stream-one` پیاده می‌شود و باید با کلاینت‌های مرجع Xray/Karing مورد استفاده پروژه سازگار باشد؛ modeهای دیگر وارد V1 نمی‌شوند.

هر session باید id محدود، timeout مشخص و سقف buffer داشته باشد. هیچ session state دائمی خارج از عمر موردنیاز tunnel ذخیره نمی‌شود.

## TCP Forwarding و Routing

همه پروتکل‌ها باید از یک `TcpConnector` مشترک استفاده کنند تا policyها یکسان بمانند:

- رد کردن localhost، private ranges و مقصدهای غیرمجاز.
- رد کردن loop به hostname/Worker خود پروژه.
- timeout اتصال و close تمیز هر دو سمت.
- retry محدود فقط برای خطاهای connect و نه auth/protocol errors.
- عدم استفاده از endpointهای شخص ثالث hard-coded.

اگر direct socket برای یک مقصد Cloudflare مجاز نباشد، سیستم باید خطای قابل‌فهم بدهد؛ fallback خارجی پیش‌فرض یا دامنه متعلق به توسعه‌دهنده در کد قرار نمی‌گیرد.

## Subscription و Client Output

در همین Milestone باید URL واقعی برای VLESS-WS، Trojan-WS و VLESS-XHTTP تولید شود. خروجی‌های اولیه:

- Universal/base64 برای v2rayNG و کلاینت‌های مشابه.
- Sing-box JSON.
- Mihomo/Clash Meta YAML برای ترکیب‌های قابل توصیف.
- لینک‌های import برای Karing و Shadowrocket در صورت پشتیبانی schema آن کلاینت.

Subscription generator باید بر اساس User-Agent فقط format را انتخاب کند؛ Secret یا UUID از روی User-Agent ساخته نمی‌شود. خروجی نامعتبر برای کلاینتی که XHTTP را نمی‌فهمد نباید تولید شود.

## Panel UX این Milestone

بخش Protocols باید برای هر موتور این موارد را نشان دهد:

- وضعیت روشن/خاموش.
- path فعلی.
- Copy config.
- QR برای configهای قابل encode.
- تست health route.
- هشدار واضح اگر deployment هنوز Worker protocol core قدیمی دارد.

صفحه Subscription باید لینک اصلی، فرمت‌های پشتیبانی‌شده و دکمه import کلاینت‌ها را نشان دهد. هیچ دکمه‌ای تا وقتی backend واقعی آن format را تولید نمی‌کند نمایش داده نمی‌شود.

## امنیت

- هیچ Secret داخل log، error body یا analytics ثبت نشود.
- comparison credential تا حد ممکن constant-time باشد.
- input length قبل از allocation بزرگ محدود شود.
- WebSocket frame و XHTTP body سقف اندازه داشته باشند.
- destination validation قبل از `connect()` انجام شود.
- Worker نباید open proxy عمومی باشد؛ handshake معتبر قبل از outbound connect الزامی است.
- routeهای `/sub` با Subscription secret محافظت می‌شوند.
- هیچ API یا دامنه شخص ثالث به‌عنوان fallback مخفی در سورس hard-code نمی‌شود.

## تست و معیار پذیرش

Unit tests باید parserهای VLESS و Trojan، destination validation، subscription serialization و config validation را پوشش دهند.

Integration tests باید حداقل این مسیرها را با socket test server کنترل‌شده اجرا کنند:

1. VLESS-WS با credential صحیح → اتصال TCP و echo موفق.
2. VLESS-WS با UUID غلط → بدون outbound connect رد شود.
3. Trojan-WS با password صحیح → echo موفق.
4. Trojan-WS با password غلط → بدون outbound connect رد شود.
5. XHTTP با session معتبر → payload رفت‌وبرگشت کند.
6. مقصد private/loop/Cloudflare-disallowed → قبل از connect رد شود.
7. Subscription تولیدشده توسط parser تستی هر format دوباره parse شود.

Browser E2E باید روشن/خاموش کردن protocol، Copy link و QR را بدون horizontal overflow در فارسی و انگلیسی پوشش دهد.

Release فقط وقتی مجاز است که `pnpm check`، Playwright و protocol integration suite همگی صفر failure داشته باشند و Worker با Wrangler current `--dry-run` build شود.

## Deploy و First Run

Deploy to Cloudflare همچنان مسیر نصب اصلی است. KV `C` به‌صورت automatic provisioning ساخته می‌شود. در اولین اجرای Worker اگر config protocol وجود نداشته باشد، یک setup state ایجاد می‌شود و Secretهای پیش‌فرض امن با CSPRNG ساخته می‌شوند؛ Secret خام فقط همان بار برای owner قابل نمایش است.

هیچ UUID یا password مشترک hard-coded در repository وجود ندارد.

## خارج از Scope این Milestone

- Shadowsocks؛ بعد از سه موتور اصلی بررسی می‌شود.
- UDP عمومی، Hysteria2، TUIC، WireGuard و Reality.
- Multi-user، quota و expiry؛ این‌ها Milestone مدیریت کاربران جداگانه هستند و نباید فعال‌شدن اتصال واقعی را عقب بیندازند.
- SOCKS5/HTTP outbound و Smart Endpoint پیشرفته؛ بعد از direct TCP core.
- وابستگی اجباری به VPS یا سرویس مرکزی Tehran Network.

## منابع فنی مرجع

- Cloudflare TCP sockets: https://developers.cloudflare.com/workers/runtime-apis/tcp-sockets/
- Cloudflare WebSockets: https://developers.cloudflare.com/workers/runtime-apis/websockets/
- Deploy to Cloudflare: https://developers.cloudflare.com/workers/platform/deploy-buttons/
- Wrangler automatic provisioning: https://developers.cloudflare.com/workers/wrangler/configuration/
- CFnew feature reference: https://github.com/byJoey/cfnew
- Re_edgetunnel behavior reference: https://github.com/tianrking/Re_edgetunnel
- Modular edgetunnel reference: https://github.com/andrewfullstack/edgetunnel

## تصمیم نهایی این Spec

برای رسیدن سریع به نسخه قابل استفاده، اول `VLESS-WS + Trojan-WS + VLESS-XHTTP + direct TCP + subscriptions` کامل می‌شود. هیچ قابلیت جانبی اجازه ندارد Release هسته را با implementation نیمه‌کاره شلوغ کند.
