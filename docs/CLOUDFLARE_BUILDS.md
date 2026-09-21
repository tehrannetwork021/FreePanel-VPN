# Public installer delivery — Cloudflare Workers Builds

This is a maintainer-only publishing path. It is not part of the normal user installation flow.

The public installer is deployed directly from this GitHub repository by Cloudflare Workers Builds. No VPS, SSH host, GitHub Actions deploy secret, local Wrangler login, or external paid service is required.

One-time Cloudflare setup for the existing Worker `tehran-network-installer`:

1. Open **Workers & Pages → tehran-network-installer → Settings → Builds → Connect**.
2. Connect the GitHub repository `tehrannetwork021/FreePanel-VPN`.
3. Production branch: `main`.
4. Root directory: `/` (repository root).
5. Deploy command: `pnpm deploy:public-installer`.
6. Use the Cloudflare-managed build token (default). Save the build settings.

After this one-time connection, every production build can be triggered from GitHub/Cloudflare without a VPS. The normal user flow remains:

**Open installer → Generate Cloudflare API Token → Paste once → Install → receive `/admin` URL + generated password.**

The user's token is used only for that installation request and is not part of the maintainer publishing configuration.
