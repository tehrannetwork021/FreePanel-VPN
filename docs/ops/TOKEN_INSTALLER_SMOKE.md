# Public Token Installer Smoke — 2026-09-20

Public installer candidate:
`https://tehran-network-installer.honored-feather.workers.dev`

Source baseline: `2c1957338637287ba17a060bb6d9bf2d842716ba` (`main` when deployed).

## Automated/public checks

- PASS — installer Worker deployed successfully on Cloudflare temporary preview account.
- PASS — `GET /` returns the Tehran Network installer UI.
- PASS — `POST /api/token/verify` with an invalid synthetic token returns HTTP 401 and safe body `token-invalid`.
- PASS — no token/password values were recorded in this smoke log.
- PENDING — owner claims the preview account so the public `workers.dev` URL becomes persistent.
- PENDING — clean-user real scoped token: Verify → account discovery → Install → final panel URL.
- PENDING — final panel `/health`, VLESS-WS field connection, Trojan-WS and XHTTP field retest.

## Publication rule

Do not move the direct public-installer README change to `main` until the preview account is claimed and a real-token install succeeds. The end-user path after publication must be only:

GitHub README → public installer → Generate Cloudflare Key → Create/Copy → Paste → Install.
