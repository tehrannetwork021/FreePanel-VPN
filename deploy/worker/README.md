# Tehran Network Edge Panel — Cloudflare Deploy Template

This directory is intentionally self-contained so Cloudflare's **Deploy to Cloudflare** flow can treat it as the root of a new repository.

## Deploy

Use the public project's button:

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/tehrannetwork021/FreePanel-VPN/tree/main/deploy/worker)

Cloudflare provisions the required KV and D1 bindings from `wrangler.jsonc`. During deployment, set a strong `ADMIN_PASSWORD`; it is handled as a Worker secret and is not stored in this repository.

After deployment, open the generated `*.workers.dev` URL and sign in at `/admin`.

No VPS, custom domain, local Wrangler, or pasted Cloudflare API token is required for the normal install path.
