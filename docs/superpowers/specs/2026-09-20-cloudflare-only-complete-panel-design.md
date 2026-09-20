# Tehran Network — Cloudflare-Only Complete Panel Design

**Date:** 2026-09-20
**Status:** Approved by owner — 2026-09-20
**Repository:** `tehrannetwork021/FreePanel-VPN`

## 1. Product goal

Build a genuinely complete open-source proxy control panel that runs on the **Cloudflare Free plan** for normal users and requires **no VPS, Docker, paid domain, server daemon, terminal, Wrangler, GitHub connection, or external subscription converter** in the normal install path.

Locked normal-user flow:

`GitHub README -> public Tehran Network installer -> Generate Cloudflare API Token -> Paste -> automatic account/provisioning -> panel URL + admin password + subscription links`

The API token is request-scoped in memory only. It must never be persisted in KV, D1, logs, cookies, browser storage, repository files, or analytics.

## 2. Non-negotiable constraints

- `workers.dev` must be sufficient; custom domain is optional.
- No VPS/Docker/Ubuntu/SSH/CLI/Node/Wrangler/Git required for normal users.
- Nothing is advertised as working before repeatable tests and, where Cloudflare behavior matters, a real field test.
- No fake protocol switches; unsupported Free-Worker transports are omitted or clearly labeled.
- Native VLESS/Trojan UDP inbound must not be claimed on Workers.
- WARP/Fragment/ECH/DNS/routing features must be explicit about whether they run in the Worker or are generated client-side config.
- `AGENTS.md` is the truth ledger; only verified work is checked.
- Persian/English, RTL/LTR, mobile/desktop are first-class.
- Third-party projects are behavior/architecture references unless license compatibility is verified.

## 3. Current baseline

The repository already has a public no-terminal installer, VLESS-WS, Trojan-WS, VLESS-XHTTP stream-one, `cloudflare:sockets` TCP forwarding, admin auth, protected subscriptions, QR output, Workerd/Xray E2E tests, field-confirmed VLESS-WS, XHTTP diagnostics/fixes pending final field confirmation, and the installer password fix in `main`.

This phase extends that baseline; it must not replace working protocol code with an incompatible rewrite.

## 4. Reference projects reviewed

- **CFnew** `byJoey/cfnew`: VLESS/Trojan/XHTTP, custom paths, KV GUI, latency testing, preferred IP/domain management, native client outputs, UA selection, ECH/DNS, filters, outbound proxy ideas.
- **BPB Worker Panel** `bia-pain-bache/BPB-Worker-Panel`: WARP, Fragment, private DoH, routing presets, clean IP/domain, ProxyIP, chain proxies, Xray/Sing-box/Clash-Mihomo outputs, node aggregation, and explicit Worker UDP limitations.
- **CFNext** `PAICNI/CFNext`: modular GUI, node caps, polling/rotation, IPv4/IPv6/ISP/region filters, preferred endpoint pools, aggregation, fallback and Free-plan CPU awareness.
- **Nahan** `itsyebekhe/nahan`: D1 control plane, multi-user, quota/expiry/pause, usage, kill switch, audit logs, backup/restore, hidden routes/decoy, Telegram, linked panels.
- **Nova Proxy** `IRNova/Nova-Proxy`: UX reference for private user links, quota/expiry/daily limits, browser clean-IP scanner, multi-user workflow, mixed protocol and resistance presets. Current protected releases are PolyForm Noncommercial, so no source copying into this MIT project.
- **Re_edgetunnel** `tianrking/Re_edgetunnel`: native subscriptions, WS/XHTTP/gRPC distinctions, preferred IP import, sessions, backup/restore, decoy root, SOCKS5/HTTP/HTTPS upstream concepts.
- **edcloudwasm** `1345695/edcloudwasm`: parser isolation, forwarding performance, WASM feasibility and subscription preprocessing. WASM is optional until benchmarks justify it.
- **SubLink Worker** `deathline94/SubLink-Worker`: PBKDF2 auth, CSRF, session invalidation, private subscription paths, parsing/merging, rollback/write-skipping patterns.

## 5. Chosen architecture — D1 + KV hybrid

### D1: authoritative structured state

`users`, `user_credentials`, `subscription_tokens`, `usage_daily`, `usage_events_compacted`, `sessions`, `audit_log`, `login_events`, `clean_endpoints`, `endpoint_test_history`, `schema_migrations`.

D1 never stores the Cloudflare installer API token.

### KV: low-write config/cache layer

Use KV for global protocol config, routing/DNS/ECH settings, endpoint-source definitions, feature flags, version markers, cached compiled subscription templates, short-lived diagnostics, and cache invalidation versions.

Do **not** use KV for packet-level accounting or other high-churn state.

### Isolate memory

Use short-lived in-isolate caches for parsed config, compiled templates and recent D1 results. Never depend on isolate memory for durable correctness.

## 6. Cloudflare Free-plan budgets used by this design

Official limits checked on 2026-09-20:

- Workers Free: 100,000 requests/day; 10 ms CPU/request.
- KV Free: 100,000 reads/day; 1,000 writes/day; 1 GB storage.
- D1 Free: 5 million rows read/day; 100,000 rows written/day; 10 DBs/account; 500 MB/DB; 5 GB total storage.

Design rules:

- no D1/KV write per forwarded packet or WebSocket message;
- usage writes are coarse deltas/buckets;
- subscriptions have bounded node counts and parser limits;
- config transformations are cached by config/user version;
- dashboard budget indicators are our own estimates and are labeled as estimates, not Cloudflare billing truth.

## 7. Multi-user subsystem

Each user has internal ID, display name, enabled/paused state, created time, optional expiry, total quota, optional daily quota, usage summary, protocol permissions, endpoint/profile preferences, optional speed-policy metadata, notes, last subscription access and last tunnel activity.

Required actions: create, edit, delete, enable, pause, extend expiry, add quota, reset usage, rotate subscription token, rotate protocol credential, copy subscription URL, show QR, duplicate profile.

### Private user links and credentials

Every user gets an independent high-entropy subscription token. Usernames, numeric IDs and UUIDs are never used as predictable subscription secrets. Rotating the subscription token invalidates the old link at the control-plane layer.

Admin credential, subscription token, VLESS UUID, Trojan secret and any future Shadowsocks secret are distinct values. Rotating one must not silently rotate the others.

## 8. Usage accounting and quota enforcement

Count bytes at the authenticated Worker stream layer. Keep per-connection counters in memory and flush compact usage deltas to D1 on connection close and at coarse thresholds for long-lived connections. Use atomic SQL upsert/increment into daily buckets; compact/delete old detail according to retention settings.

At connection/subscription start deny disabled, expired or over-quota users. Long-lived sessions use periodic coarse quota checkpoints rather than packet-level DB checks.

The UI must describe this as **edge quota enforcement with periodic checkpoints**, not carrier-grade real-time billing.

### Speed limiting

Do not ship a fake Mbps slider. Strict Worker-side shaping remains experimental until Free-plan CPU/runtime benchmarks prove it practical. Stable V1 may expose only validated client-config hints where supported.

## 9. Protocol/transport matrix

Stable baseline:

- VLESS over WebSocket
- Trojan over WebSocket
- VLESS XHTTP stream-one

Planned after baseline field stability:

- Shadowsocks SIP003 AEAD over WebSocket, clean-room implementation with real client E2E.

Optional/experimental:

- gRPC only where the actual Cloudflare deployment supports it; never required on `workers.dev`.

Not claimed on normal Free Workers: native QUIC inbound, Hysteria2 server, TUIC server, native WireGuard server, native VLESS/Trojan UDP forwarding.

## 10. Outbound / ProxyIP / chain subsystem

Introduce and test modes independently: direct TCP, ProxyIP/fallback where Worker architecture permits, SOCKS5 upstream, HTTP CONNECT and HTTPS CONNECT.

Each mode needs enable/disable, health, timeout, fallback policy, validation, redacted errors and a leak-safe `proxy-only` mode where relevant. Sensitive upstream credentials belong in Cloudflare Secrets unless a proven encryption-at-rest design exists.

## 11. Clean IP / preferred endpoint subsystem

Sources: manual IP/domain input, bundled curated list, operator-provided external URL, optional community registry and browser scanner results.

Metadata: endpoint, port, label, IPv4/IPv6, region, ISP/operator tag, latest latency, latest success/failure, last-tested time, source and confirmation score.

Browser scanner requirements:

- bounded concurrent latency checks from the user's browser;
- sort/filter by latency, IPv4/IPv6, ISP and region;
- multi-select and one-click apply;
- browser-observed latency clearly distinguished from Worker egress quality;
- no claim that an anycast IP has one globally fixed location/latency.

## 12. Optional Community Clean-IP Registry

This is a **separate optional Tehran Network Cloudflare Worker + D1 service**, never required by a user's panel.

Opt-in submissions may store endpoint, port, coarse endpoint metadata, first/last-seen times, daily success/failure confirmations and trend score.

It must not store contributor Cloudflare token, panel secret, VPN credential, subscription token, account identity, source IP or raw browser fingerprint.

Initial abuse resistance: per-endpoint write throttles, bounded payloads, deduplication, minimum confirmation thresholds, decay/expiry and server-side validation. If stronger protection requires identity tracking, defer that feature instead of silently collecting personal data.

The local panel remains fully functional if this registry is off or unavailable.

## 13. Native subscription engine

Normal outputs are generated inside the deployed Worker; no mandatory public sub-converter.

Required phased outputs: raw share links, Base64, Xray-compatible feed, Sing-box JSON, Clash/Mihomo YAML, and a client landing page with QR/copy/deep-link controls. Later, after test coverage: Surge, Loon, Quantumult X, Stash and other common formats.

Features: UA auto-detection, explicit `?format=` override, per-user protocol selection, endpoint rotation, deterministic naming templates, node caps, optional merge/import of user-provided subscriptions, strict parser limits and SSRF defense.

## 14. WARP, Fragment, DNS, ECH and routing

**WARP:** a validated client-profile/integration module; never presented as proof that the customer Worker is a native WireGuard server.

**Fragment:** generate settings only for client/core formats where output has been validated.

**DNS/private DoH:** configurable DoH upstream, safe defaults, no UDP-DNS dependency, and leak-prevention templates where the target client supports them.

**ECH:** operator-selectable ECH domain/DoH; emit only in compatible formats and mark stable only after syntax tests plus a real compatible client test.

**Routing presets:** declarative client-config rules such as block QUIC, bypass LAN/private ranges, ad/malware/phishing blocking and country/direct/proxy profiles. The UI must show exactly what each preset changes.

## 15. Security model

- PBKDF2-HMAC-SHA-256 with random per-password salt; final iteration count is chosen by Free-Worker CPU benchmark.
- `HttpOnly`, `Secure`, `SameSite` session cookies; server stores only hashed session identifiers.
- password rotation invalidates all sessions.
- CSRF protection on cookie-authenticated state changes.
- bearer auth for API-token endpoints; no ambient-cookie dependence.
- strict escaping, CSP, `nosniff`, clickjacking protection, Referrer-Policy and Permissions-Policy.
- optional hidden admin path and decoy root as defense-in-depth, never as authentication.
- diagnostics/audit logs redact API tokens, passwords, full subscription tokens, protocol credentials and upstream passwords.
- optional Telegram alerts for new admin logins/security events; Telegram is never required.

## 16. Backup / restore / upgrades

Backup is a versioned JSON package containing operator config and user records, excluding the installer token and excluding secrets by default. Restore validates schema version, size, types, duplicates and unsupported future versions.

Upgrades use versioned D1 migrations, compatibility checks, artifact hash/version verification and rollback markers. No automatic destructive migration.

## 17. UI/UX redesign

The current basic settings view becomes a control plane with desktop sidebar plus mobile navigation:

- Overview
- Users
- Subscriptions
- Endpoints / Clean IP
- Proxy / Chain
- Protocols
- DNS / ECH
- Routing
- Network Lab
- Usage
- Logs & Security
- Backup / Restore
- System / Update

Overview cards: enabled/recent users, today usage, quota consumed, expiry warnings, endpoint health, protocol status, Worker/KV/D1 budget estimates, version/update status.

Design system: Tehran Network branding, dark/light, Persian/English, RTL/LTR, responsive tables/cards, drawers/modals, toasts, skeletons, empty/error states and explicit stable/experimental badges. Routine UX must not use blocking `alert()` dialogs.

## 18. Installer expansion

The public installer eventually creates/binds one customer Worker, one KV namespace, one D1 database, required secrets, initial admin password, initial protocol credentials and schema bootstrap/migrations.

The user manually creates none of those resources. Permissions stay least-privilege. D1 permissions are added to the token template only when the D1 build is ready for end-to-end installation. Installation retries should reuse matching resources rather than blindly duplicating them.

## 19. Migration from current installs

Existing VLESS/Trojan/XHTTP deployments must keep working.

Migration flow: detect legacy schema -> provision/bind D1 -> create new schema -> copy supported config -> create owner/control records where needed -> preserve current protocol credentials -> enable D1 control plane by feature flag -> retain rollback marker.

A fixture representing current `main` must be part of migration tests.

## 20. Testing gates

**Unit:** validation, auth, tokens, quota math, D1 repositories, serializers, endpoint parsers, migration, security headers, redaction.

**Integration:** Workerd/Miniflare with KV+D1; user CRUD, sessions, quota/expiry, subscription access, negative auth, backup/restore and migrations.

**Protocol E2E:** real Xray-core for VLESS/Trojan/XHTTP; Mihomo for Clash output; Sing-box for Sing-box output; actual destination fetch through local Workerd and then remote Worker.

**Browser E2E:** desktop/mobile, Persian RTL/English LTR, create/edit/pause user, scanner, copy/QR, login/logout/session expiry and backup/restore UX.

**Real Cloudflare field gate:** public-installer deploy on `workers.dev`, real subscription import, protocol connectivity, Free-plan CPU/request observation, result recorded in `AGENTS.md`.

## 21. Delivery phases

### Phase A — Control-plane foundation

D1 installer provisioning, migrations, user CRUD, secure sessions, quota/expiry model, private user tokens, audit log and redesigned dashboard shell.

### Phase B — Native subscription engine

Per-user node generation, Base64/Xray, Sing-box, Clash/Mihomo, UA detection, QR/deep links, caps/caching.

### Phase C — Endpoint / Clean-IP platform

Manual library, URL import, browser scanner, latency sorting, IPv4/IPv6/ISP/region filters, apply/rotation/fallback, optional community-registry client.

### Phase D — Outbound / routing

ProxyIP, SOCKS5, HTTP CONNECT, HTTPS CONNECT, DNS/ECH, routing presets and leak-safe fallback modes.

### Phase E — Advanced client features

WARP profiles, Fragment output, external-subscription merge, extra client formats, Shadowsocks WS after clean-room protocol tests.

### Phase F — Hardening / release

Route/auth/session/CSRF/XSS/SSRF/secrets review, Free-plan load/budget tests, migration/rollback tests, complete FA/EN docs and final clean-account installer field test.

## 22. Definition of done

This phase is complete only when a new user can install without terminal/domain/VPS, open the graphical panel, create multiple users, assign quota/expiry, pause/resume them, receive private subscriptions and QR codes, import tested Xray/Sing-box/Clash outputs, manage preferred endpoints, view useful usage/audit data, back up/restore, update safely, and use the stable proxy protocols on a real `workers.dev` deployment.

Nothing is stable merely because a switch exists in the UI.

## 23. Primary sources reviewed

- https://github.com/byJoey/cfnew
- https://github.com/bia-pain-bache/BPB-Worker-Panel
- https://github.com/PAICNI/CFNext
- https://github.com/itsyebekhe/nahan
- https://github.com/IRNova/Nova-Proxy
- https://github.com/tianrking/Re_edgetunnel
- https://github.com/1345695/edcloudwasm
- https://github.com/deathline94/SubLink-Worker
- https://developers.cloudflare.com/workers/platform/limits/
- https://developers.cloudflare.com/kv/platform/limits/
- https://developers.cloudflare.com/d1/platform/limits/
- https://developers.cloudflare.com/d1/platform/pricing/
