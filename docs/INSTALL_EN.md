# Installation and Usage — English

## One-click installation

This is the recommended path for regular users. It requires **no VPS, Wrangler, or API token submission to a Tehran Network server**.

1. Click **Deploy to Cloudflare** in the README.
2. Sign in to your Cloudflare account.
3. Cloudflare reads the isolated `deploy/worker` template from GitHub.
4. Set a strong secret named `ADMIN_PASSWORD` with at least 16 characters and keep it.
5. Start deployment; Cloudflare automatically provisions KV and binds it as `C`.
6. Open the generated `*.workers.dev` URL.
7. Enter the same `ADMIN_PASSWORD`; the Worker creates independent VLESS UUID, Trojan password and subscription token values.
8. Copy/scan VLESS-WS, Trojan-WS or VLESS-XHTTP, or add the subscription URL to a compatible client.

> This flow is handled by Cloudflare itself. No Cloudflare API Token is sent to a Tehran Network server.

## What do I get after deployment?

Release `v0.1.0` provides working `VLESS over WebSocket`, `Trojan over WebSocket` and `VLESS XHTTP stream-one` routes. After owner authentication the panel exposes direct configs, QR codes and a protected subscription URL. `/api/status` remains redacted and public-safe.

## Advanced Cloudflare API Token path

The project installer already links directly to Cloudflare's official token builder. The intended token is scoped to Workers/KV/Routes and the UI keeps it only in volatile memory.

In `v0.1.0`, the real `/api/install` backend for this advanced path is still under development, so **use Deploy to Cloudflare for a real installation today**. The project intentionally labels this limitation rather than pretending a UI-only button has provisioned resources.

## Updating

Every public update is published as a separate GitHub Release with its own version number. Read the release notes before updating. Safe Upgrade and rollback are planned for later releases.

## Uninstalling

Open Cloudflare Dashboard → Workers & Pages and delete the deployed Worker. KV is a separate resource; delete the related namespace as well if you no longer need the stored configuration.

## Security

- Never paste tokens or secrets into public issues.
- The recommended one-click flow is executed by Cloudflare.
- For token-based workflows, use scoped API tokens, not the Global API Key.
- See [SECURITY.md](../SECURITY.md) for vulnerability reporting.
