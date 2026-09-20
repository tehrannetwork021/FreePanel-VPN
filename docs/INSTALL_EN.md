# Installation and Usage — English

## No-terminal install (recommended — one link + one paste)

This is the normal-user path: **no VPS, no custom domain, no GitHub connection, no installer deployment, no Wrangler, no PowerShell and no terminal**.

### Step 1 — Open the ready public installer

[https://tehran-network-installer.honored-feather.workers.dev](https://tehran-network-installer.honored-feather.workers.dev)

This public Worker is setup control-plane only. VPN traffic never traverses it, and the installed panel is independent after provisioning.

### Step 2 — Generate the Cloudflare key and install

1. Click **Generate Cloudflare Key**. Cloudflare opens with `Workers Scripts: Edit`, `Workers KV Storage: Edit` and `Account Settings: Read`.
2. Click **Create Token** and copy the value Cloudflare shows once.
3. Return to the installer, paste the token and verify it.
4. Pick an account. Worker name and admin password are editable; a password is generated automatically and any non-empty value is accepted.
5. Click **Install**. The installer creates KV, Worker, secret and workers.dev automatically, then verifies `/health`.
6. Copy the panel URL and admin password, open the panel and collect configs/QR/subscription.

### Token privacy

The token is sent over HTTPS to the installer Worker because Cloudflare's API does not allow this provisioning flow directly from a browser via CORS. It is used only in the current request/volatile memory and is never written to KV, a database, cookies, localStorage, sessionStorage, analytics or logs. It is cleared after success or failure. The installed panel does not depend on it, so you may revoke it afterwards.

### Common errors explained

- `token-invalid` — the token is wrong, expired or disabled; create a fresh one.
- `insufficient-scope` — one of the three scopes above is missing; rebuild the token with the prefilled link.
- `health-failed` — provisioning finished but the health check did not pass yet; wait a few seconds, open the Worker URL directly and rerun Install if needed (retries are idempotent and never create duplicates).
- If `workers.dev` is restricted on your network, use an alternative network to open the installer and panel pages; your VPN client connection normally takes a different path and is not affected by that page restriction.

## Script install (alternative for terminal users)

If you prefer a terminal, the script does everything itself: verifies the token, provisions KV, uploads the signed Worker, sets the admin secret, enables workers.dev and prints the configs. (If the script download fails — common behind Iranian filters — use the no-terminal path above.)

**Windows (PowerShell):**

```powershell
irm https://cdn.jsdelivr.net/gh/tehrannetwork021/FreePanel-VPN@main/install.ps1 | iex
```

If jsDelivr is unreachable, use the direct GitHub link:

```powershell
irm https://raw.githubusercontent.com/tehrannetwork021/FreePanel-VPN/main/install.ps1 | iex
```

**Linux / macOS / WSL / Git Bash:**

```bash
curl -fsSL https://cdn.jsdelivr.net/gh/tehrannetwork021/FreePanel-VPN@main/install.sh -o install.sh && bash install.sh
```

**Steps:**

1. The script prints the token creation link (pre-configured with the three required scopes); open it and click **Create Token**.
2. Copy the token and paste it into the script.
3. If you have several accounts, pick one; enter a Worker name and an admin password (or press Enter for a random one).
4. At the end the script prints the panel URL, the admin password, the VLESS-WS / Trojan-WS / XHTTP links and the Subscription URL — add them to your client.

Optional flags: `--name`, `--password`, `--account` for non-interactive runs.

## What do I get after deployment?

Release `v0.2.0` provides working `VLESS over WebSocket`, `Trojan over WebSocket` and `VLESS XHTTP stream-one` routes. After owner authentication the panel exposes direct configs, QR codes and a protected subscription (base64, links, singbox and mihomo formats). `/api/status` remains redacted and public-safe.

## Developer alternative: Deploy to Cloudflare

If you prefer to install the Worker template directly without the installer and token flow, the **Developer Install (Deploy to Cloudflare)** button in the README deploys the isolated `deploy/worker` template through Cloudflare itself:
[https://deploy.workers.cloudflare.com/?url=https://github.com/tehrannetwork021/FreePanel-VPN/tree/main/deploy/worker](https://deploy.workers.cloudflare.com/?url=https://github.com/tehrannetwork021/FreePanel-VPN/tree/main/deploy/worker)

1. Click the button and sign in to Cloudflare.
2. Set a strong secret named `ADMIN_PASSWORD` and keep it.
3. Approve the deployment; Cloudflare provisions KV and binds it as `C`.
4. Open the generated `*.workers.dev` URL and enter the same `ADMIN_PASSWORD`.

This is the developer/advanced path; the recommended path for regular users is the token installer at the top of this page.

## Updating

Every public update is published as a separate GitHub Release with its own version number. Read the release notes before updating. Re-running the token installer upgrades the Worker to the latest immutable artifact while keeping your KV configuration intact (idempotent). Safe Upgrade and full rollback arrive in later releases.

## Uninstalling

Open Cloudflare Dashboard → Workers & Pages and delete the deployed Worker. KV is a separate resource; delete the related namespace as well if you no longer need the stored configuration. Also delete the installation token from Cloudflare's API Tokens page.

## Security

- Never paste tokens or secrets into public issues.
- The token is used only for the HTTPS install request on the installer Worker and is never persisted; VPN traffic never traverses the installer.
- Use scoped API tokens, never the Global API Key.
- Keep the token scopes to exactly the three required: Workers Scripts Edit, Workers KV Storage Edit, Account Settings Read.
- See [SECURITY.md](../SECURITY.md) for vulnerability reporting.
