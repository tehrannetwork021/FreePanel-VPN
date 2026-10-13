# Public installer delivery — Cloudflare Workers Builds

This is a maintainer-only publishing path. It is not part of the normal user installation flow.

The public installer is deployed directly from this GitHub repository by Cloudflare Workers Builds. No VPS, SSH host, GitHub Actions deploy secret, local Wrangler login, or external paid service is required.

One-time Cloudflare setup for the existing Worker `tehran-network-installer`:

1. Open **Workers & Pages → tehran-network-installer → Settings → Builds → Connect**.
2. Connect the GitHub repository `tehrannetwork021/FreePanel-VPN`.
3. Production branch: `main`.
4. Root directory: `/` (repository root).
5. Build command: `pnpm check && pnpm --dir deploy/worker check`. Deploy command: `pnpm deploy:public-installer` (includes the same gates and rebuilds the panel/edge artifact). Root remains the repository root so frozen installation includes the Worker workspace.
6. Use the Cloudflare-managed build token (default). Save the build settings.

After this one-time connection, every production build can be triggered from GitHub/Cloudflare without a VPS. The normal user flow remains:

**Open installer → Generate Cloudflare API Token → Paste once → Install → receive `/admin` URL + generated password.**

The user's token is used only for that installation request and is not part of the maintainer publishing configuration.

## Verify before promotion

Use a separate staging Worker and an explicit `--name` override before changing production. The selected branch must be reviewed and CI green. Connecting a GitHub App requires the owner's approval; select only `tehrannetwork021/FreePanel-VPN`, not all repositories.

After deployment, run maintainer-only `pnpm verify:public-installer` (or provide the staging HTTPS origin). It requires the exact edge version/SHA-256/schema and byte-identical current JS/CSS assets. A root HTTP 200 alone is insufficient. Then complete the real clean-account install, admin login, user and Xray protocol field checks. The verifier sends no credentials and does not create resources.

Changing Builds settings or merging a connected production branch can trigger deployment. Obtain explicit owner production approval before that step; do not reset KV/D1 or change the public URL.
