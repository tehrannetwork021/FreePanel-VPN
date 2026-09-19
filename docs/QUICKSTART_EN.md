# Quick Start — English

## Current status

The current build is a Foundation/development preview. The one-click installer UI is ready, while the real `/api/install` backend that provisions Cloudflare resources is the next milestone.

## Run the installer

```bash
git clone https://github.com/tehrannetwork021/FreePanel-VPN.git
cd FreePanel-VPN
corepack enable
corepack prepare pnpm@10.15.1 --activate
pnpm install --frozen-lockfile
pnpm --filter @tehrannetwork/installer dev
```

Open `http://127.0.0.1:4174`.

Click **Get Cloudflare API Token**. The official Cloudflare token builder opens with Workers Scripts, Workers KV, and Workers Routes permissions pre-filled. Create the token, copy it, return to the installer, and paste it.

The token is never stored in LocalStorage, SessionStorage, or cookies. It is cleared from the UI's in-memory vault after handoff to the local installer service.

## Run the dashboard

```bash
pnpm --filter @tehrannetwork/panel dev
```

The dashboard runs at `http://127.0.0.1:4173` and switches between Persian RTL and English LTR in the UI.
