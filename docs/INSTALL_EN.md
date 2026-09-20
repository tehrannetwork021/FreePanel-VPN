# Installation and Usage — English

## No-terminal install (recommended — just a link and a paste)

This is the official install path. It requires **no VPS, no custom domain, no GitHub connection, no Wrangler, no PowerShell and no terminal**, and it runs entirely on the Cloudflare Free plan. You open one link, create one token, paste it into the installer page and click Install.

### Step 1 — Deploy the installer (once)

1. Click **Deploy Installer** in the README or open this link directly:
   [https://deploy.workers.cloudflare.com/?url=https://github.com/tehrannetwork021/FreePanel-VPN/tree/main/apps/installer-worker](https://deploy.workers.cloudflare.com/?url=https://github.com/tehrannetwork021/FreePanel-VPN/tree/main/apps/installer-worker)
2. Sign in to your free Cloudflare account and approve the deployment; Cloudflare builds the installer for you (1–2 minutes).
3. Cloudflare shows a URL like `https://tehran-network-installer.<account-subdomain>.workers.dev`; click it to open the installer page.

> The installer is a local page inside your own account; your token is never sent to or stored by any Tehran Network server.

### Step 2 — Generate the key and install the panel

1. In the installer, click **Generate Cloudflare Key**. Cloudflare's official token page opens with the required scopes preselected: `Workers Scripts: Edit`, `Workers KV Storage: Edit` and `Account Settings: Read`, scoped to all accounts.
2. Click **Create Token**. Cloudflare shows the token secret **only once**; copy it.
3. Return to the installer, paste the token and verify; your accounts are discovered.
4. Choose the account and adjust the Worker name if you like; **a strong admin password is already auto-generated** — keep it or replace it.
5. Click Install. The installer automatically creates the KV namespace, uploads the signed immutable Worker artifact, sets the admin secret and enables `workers.dev`.
6. Done! You receive `https://<worker-name>.<account-subdomain>.workers.dev` together with **your admin password** (with a copy button). Open the panel, enter that password and collect your configs.

After every install attempt (success or failure) the token is cleared from browser memory and is never written to localStorage, sessionStorage, KV or logs. The result screen links to Cloudflare's official API Tokens page under "Delete installation key" if you want to revoke the token afterwards.

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

Open Cloudflare Dashboard → Workers & Pages and delete the deployed Worker (and the installer if you no longer need it). KV is a separate resource; delete the related namespace as well if you no longer need the stored configuration. Also delete the installation token from Cloudflare's API Tokens page.

## Security

- Never paste tokens or secrets into public issues.
- Your token is used only in volatile browser memory for the duration of the request; no Tehran Network server is involved.
- Use scoped API tokens, never the Global API Key.
- Keep the token scopes to exactly the three required: Workers Scripts Edit, Workers KV Storage Edit, Account Settings Read.
- See [SECURITY.md](../SECURITY.md) for vulnerability reporting.
