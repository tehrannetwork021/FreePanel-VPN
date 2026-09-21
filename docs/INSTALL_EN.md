# Installation and Usage — English

## No-terminal install

The official path is **GitHub → Deploy to Cloudflare**: no VPS, no required custom domain, no local Wrangler, no SSH/PowerShell, and no pasted Cloudflare API token.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/tehrannetwork021/FreePanel-VPN/tree/main/deploy/worker)

### Step 1 — Deploy to Cloudflare

Click the button above. Cloudflare reads the isolated `deploy/worker` template directly from GitHub. If needed, sign in to GitHub and Cloudflare and choose the destination Cloudflare account.

### Step 2 — Install settings

You can accept the default Worker, KV and D1 names. The only security value you must provide is `ADMIN_PASSWORD`; use a strong unique password.

Cloudflare collects this value as a Worker secret during its deploy flow. It is not committed to GitHub.

### Step 3 — Deploy

Cloudflare automatically:

- clones/builds the GitHub template;
- publishes the Worker on `workers.dev`;
- provisions the KV binding named `C`;
- provisions the D1 binding named `DB`;
- injects `ADMIN_PASSWORD` as a Worker secret.

The D1 schema is created/verified idempotently on the Worker's first run.

### Step 4 — Open the panel

After deployment, open `https://<worker>.<subdomain>.workers.dev`. Use `/admin` for management and sign in with the same `ADMIN_PASSWORD` you supplied during deployment.

## What you do not need

- a VPS or intermediary server;
- a paid custom domain;
- a pasted API token or Global API Key;
- local Wrangler;
- SSH, PowerShell, or a terminal;
- any paid third-party deployment tool.

## Inside `/admin`

After login you can create users, pause/resume access, set expiry and quota, manage VLESS-WS/Trojan-WS/VLESS-XHTTP, obtain private subscriptions and QR payloads, rotate credentials, and inspect usage/audit data.

## Quota and usage

Upload/download is checkpointed to D1 in coarse batches: by default every `4 MiB`, after `60 seconds`, or when a connection closes. This reduces D1 writes on the free plan and is not exact per-packet billing.

## Where data lives

- D1: users, quota/expiry, usage, audit, login events, sessions, and installation state.
- KV: low-write configuration and bounded state.
- The admin password enters Cloudflare as a secret; the authentication hash lives in D1.

## Upgrades

The Deploy to Cloudflare flow creates a repository you can continue developing, and Workers Builds can automatically deploy production-branch pushes. Change the admin password from inside the panel so existing sessions are invalidated correctly.

## Current release-candidate limitations

- Full Backup/Restore is still in development.
- Speed limiting is not implemented yet.
- VLESS-XHTTP still needs a real Cloudflare field retest.

## Uninstalling

Delete the Worker and its KV/D1 resources from the Cloudflare dashboard. Until Backup/Restore is complete, assume deleted state is unrecoverable without an independent export.

## Security

Never publish the admin password, subscription URL, protocol UUID/password, session cookie, or sensitive D1/KV data in a public issue or screenshot. See [SECURITY.md](../SECURITY.md).
