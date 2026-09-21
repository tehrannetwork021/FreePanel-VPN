# Quick Start — English

## Recommended path: one Cloudflare token

1. Open the public installer: https://tehran-network-installer.honored-feather.workers.dev
2. Click **Generate Cloudflare Key** and create a scoped API token with Workers Scripts: Edit, Workers KV Storage: Edit, D1: Write, and Account Settings: Read.
3. Paste the token once into the installer and click **Install**.
4. The installer automatically selects the first accessible Cloudflare account, deploys `tehran-network-edge`, creates/reuses KV + D1, generates an 18-character admin password, enables `workers.dev`, and verifies health plus a real admin login.
5. Save the returned `/admin` URL and generated password.

No VPS, external server, GitHub account, Wrangler/CLI, account picker, Worker-name field, or user-created admin password is required. The panel itself runs entirely in your Cloudflare account. The token is used only during the HTTPS install request and is not persisted by the installer.

Full guide: [INSTALL_EN.md](INSTALL_EN.md)

## Release v0.3.1 candidate status

The single-token Cloudflare-only flow and local release gates are implemented. The final real-Cloudflare field install remains the gate before `v0.3.1` is called stable.

## Local development (developers only)

```bash
git clone https://github.com/tehrannetwork021/FreePanel-VPN.git
cd FreePanel-VPN
corepack enable
corepack prepare pnpm@10.15.1 --activate
pnpm install --frozen-lockfile
pnpm --filter @tehrannetwork/installer dev
```
