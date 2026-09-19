# Quick Start — English

## Recommended path

1. Click **Deploy to Cloudflare** in the README or open the graphical installer page.
2. Sign in to Cloudflare.
3. Approve deployment.
4. Cloudflare automatically creates the Worker and KV and binds the namespace as `C`.
5. Open the generated `*.workers.dev` URL after the build completes.

Full guide: [INSTALL_EN.md](INSTALL_EN.md)

## Release v0.1.0 status

This release provides real Worker + KV provisioning and a deployed status page. VLESS, Trojan, and XHTTP cores are still under development and are not marked ready in this release.

## Local development

```bash
git clone https://github.com/tehrannetwork021/FreePanel-VPN.git
cd FreePanel-VPN
corepack enable
corepack prepare pnpm@10.15.1 --activate
pnpm install --frozen-lockfile
pnpm --filter @tehrannetwork/installer dev
```
