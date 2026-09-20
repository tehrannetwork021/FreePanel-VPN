# Installation and Usage — English

## No-terminal install (official Phase A path)

This is the regular-user path: **no VPS, no custom domain, no GitHub connection, no Wrangler, no PowerShell, and no terminal**.

### Step 1 — Open the public installer

https://tehran-network-installer.honored-feather.workers.dev

The installer is setup control-plane only. VPN traffic never traverses it, and the installed panel is independent after provisioning.

### Step 2 — Generate Cloudflare Key

Click **Generate Cloudflare Key** and create a scoped token with only these permissions:

- `Workers Scripts: Edit`
- `Workers KV Storage: Edit`
- `D1 Write`
- `Account Settings: Read`

Do not use the Global API Key. Cloudflare displays the token once; copy it and return to the installer.

### Step 3 — Verify and install

1. Paste and verify the token.
2. Select the target account if you have more than one.
3. Choose the Worker name; keep the same name when upgrading an existing install.
4. The installer generates an admin password automatically; keep a strong unique value.
5. Click **Install**.
6. The installer creates or reuses KV + D1, uploads the Worker, sets secrets and enables `workers.dev` inside your account.
7. The result shows the **Worker URL, `/admin` URL, and admin password**.

## Token privacy

The token is used only for the HTTPS installation request and must not be persisted to KV, D1, cookies, localStorage, sessionStorage, analytics, or logs. The installer clears it from browser state after success or failure. The deployed panel does not depend on the setup token, so you may revoke it afterwards.

## Inside `/admin`

After logging in with the admin password you can:

- create, edit, pause/resume, and delete users;
- set expiry, total quota, and UTC daily quota;
- enable/disable VLESS-WS, Trojan-WS, and VLESS-XHTTP stream-one per user;
- obtain each user's private subscription URL, QR payload, and credentials;
- rotate the subscription token or VLESS/Trojan credentials;
- inspect daily/aggregate usage, audit entries, and login events.

A subscription URL is a **credential**. Do not publish it. The old URL returns the same generic 404 immediately after rotation, and old protocol credentials stop authorizing after credential rotation.

## How quota and usage enforcement works

Per-user upload/download is checkpointed to D1 in coarse batches: by default at `4 MiB`, after `60 seconds`, or when a connection closes. This keeps D1 writes bounded for the free plan.

This is not exact per-packet billing. With concurrent connections, bounded overshoot can be roughly checkpoint size × concurrent connections before the next checkpoint/start is denied. `NULL` means unlimited quota; numeric `0` means exhausted immediately.

**Speed limiting is not implemented in Phase A.**

## Where data lives

- **D1 is authoritative for control-plane state:** installation state, credential indexes/versions, users, quota/expiry, usage, audit, login events, and admin sessions.
- **KV is for low-write state:** global protocol/legacy-owner configuration plus bounded diagnostics/cache state.
- Raw per-user secrets are not stored in D1. They are derived from the persistent installation seed plus per-secret versions; only versions and lookup hashes are persisted.

## Upgrade / reinstall with the same Worker name

The installer reuses `${workerName}-config` for KV and `${workerName}-control` for D1. Reinstalling the same Worker name:

- does not rewrite the legacy protocol config or owner credentials in KV;
- preserves the D1 installation seed and per-user secret versions, so existing user links/credentials stay stable;
- sends a fresh `INSTALL_GENERATION`, intentionally syncing the admin password once to the new password shown by the installer;
- invalidates older admin sessions.

After reinstall, use the **new password shown on the installer result screen** for `/admin`; existing user access should remain unchanged.

## Current v0.3.0 release-candidate limitations

- Full Backup/Restore is not implemented yet. Deleting D1/KV manually can destroy control-plane/config state.
- Speed limiting is not implemented; only quota/expiry and checkpoint-based usage enforcement are present.
- The real Cloudflare field gate for v0.3.0 is still pending, so the release is not described as stable yet.

## Uninstalling

For a complete uninstall, delete the Worker, its KV namespace, its D1 database, and the setup API token if you no longer need it. Until Backup/Restore lands, assume deleted D1/KV state is unrecoverable unless you created an independent export.

## Security

Never paste the Cloudflare token, subscription URL, protocol UUID/password, session cookie, or D1/KV secret material into a public issue or screenshot. See [SECURITY.md](../SECURITY.md).
