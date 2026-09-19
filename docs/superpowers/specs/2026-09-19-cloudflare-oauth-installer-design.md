# Cloudflare OAuth Installer Design

## Goal
Replace the Git-based Deploy to Cloudflare flow as the primary install path with a user-facing installer that requires no GitHub account, no Git clone, no Wrangler, no manual KV creation, and no Cloudflare API token copy/paste.

The installed Tehran Network Edge Panel must still run entirely in the end user's Cloudflare account. The installer is only a setup-time service and is not in the traffic path after installation.

## User experience
1. User opens the public Tehran Network installer.
2. User clicks **Install with Cloudflare**.
3. Cloudflare shows its OAuth consent screen and account picker.
4. User returns to the installer, chooses the target account if needed, chooses a Worker name, and sets `ADMIN_PASSWORD`.
5. Installer creates the KV namespace, uploads the Worker, binds KV as `C`, stores `ADMIN_PASSWORD` as a Worker secret, and enables `workers.dev`.
6. Installer verifies `/health` on the new Worker and shows the final `https://<name>.<subdomain>.workers.dev` URL.
7. Installer revokes the temporary OAuth authorization/session and clears all installation state.

GitHub is not part of this flow.

## Architecture
The existing `apps/installer` becomes the public installation UI. A small Cloudflare Worker backs it and handles the OAuth callback plus Cloudflare API calls.

The installer Worker is an installation-time control plane only. It never proxies VPN traffic, stores customer VPN credentials, or remains necessary after deployment.

The installed panel remains the existing self-contained `deploy/worker` implementation with VLESS-WS, Trojan-WS, and VLESS XHTTP stream-one.

## OAuth model
Register one Cloudflare self-managed OAuth client for the Tehran Network installer and promote it to public visibility after Cloudflare domain verification.

Use Authorization Code flow. The installer backend keeps the OAuth client secret as a Worker secret. The browser never receives the client secret.

Request only the minimum scopes needed to:
- read/select the user's Cloudflare account,
- create/update a Worker,
- create/use a Workers KV namespace,
- configure Worker settings required for `workers.dev` and bindings.

Scope identifiers must be resolved from Cloudflare's current OAuth scope catalog during operator setup rather than guessed from legacy API-token permission names.

## Session and credential handling
OAuth access/refresh tokens must not be written to project databases, logs, analytics, localStorage, sessionStorage, or source control.

After the OAuth callback, the installer stores only an encrypted, short-lived session cookie containing the minimum authorization state required to finish installation. The cookie is `HttpOnly`, `Secure`, `SameSite=Lax`, authenticated with AES-GCM, and expires after at most 10 minutes.

`ADMIN_PASSWORD` is accepted only on the final install form and is sent directly to Cloudflare as a Worker secret. It must not be logged or retained by the installer.

After success or terminal failure, the installer clears the cookie. On successful installation it also calls Cloudflare's OAuth revoke endpoint when supported for the issued token.

## Provisioning sequence
The backend performs these steps in order:
1. Validate OAuth state and exchange the authorization code.
2. Resolve accounts visible to the authorization.
3. Validate Worker name and admin password locally.
4. Create or reuse a dedicated KV namespace named from the Worker, for example `<worker>-config`.
5. Upload the Worker script and metadata with KV binding `C`.
6. Upload `ADMIN_PASSWORD` as a secret binding, never as plaintext `vars`.
7. Enable/configure the Worker on `workers.dev` as required by the current Workers API.
8. Poll the installed `/health` endpoint with a bounded timeout.
9. Return the final URL and setup instructions.
10. Clear/revoke install authorization state.

Provisioning must be idempotent enough that retrying after a partial failure does not create unbounded duplicate KV namespaces or leave an unusable Worker without a clear recovery message.

## Worker artifact delivery
The installer must deploy a versioned Worker artifact generated from `deploy/worker`, not fetch arbitrary code from a user-provided URL.

The repository build produces an immutable install artifact plus a version/hash manifest. The installer backend embeds or fetches only an allowlisted release artifact from the project's own release origin. The artifact hash is verified before upload.

This prevents the installer from becoming a generic arbitrary-code deployment service.

## Error handling
Errors are grouped into user-actionable stages: OAuth authorization, account permission, KV provisioning, Worker upload, secret configuration, and health verification.

The UI must show a short Persian/English explanation and a retry action without exposing raw Cloudflare tokens, response bodies containing secrets, or stack traces.

If authorization lacks a required scope, the installer sends the user back through consent with the documented required scope set instead of asking for a manual API token.

## Existing token installer
The current API-token UI is retained as an **Advanced / fallback** path during migration, not the primary CTA.

Its security rules remain unchanged: token exists only in volatile memory during the request, is never persisted, and is cleared immediately after the installation attempt.

Once the public OAuth client is verified and production-tested, README and public installer copy lead with OAuth. The token path stays available for administrators whose Cloudflare account blocks public OAuth applications.

## Deploy to Cloudflare button
The existing Git-based Deploy to Cloudflare button becomes **Developer install** only.

Because Cloudflare documents incomplete monorepo support and the current test built from repository root instead of the isolated Worker directory, the fallback button must point to an isolated root-level template. Use an orphan/template branch or dedicated template repository containing only the Worker package at repository root.

The primary installer must never require this fallback.

## Files and components
Expected implementation areas:
- `apps/installer/src/*`: OAuth-first wizard UI and state handling.
- `apps/installer-worker/*` or an equivalent isolated Worker package: OAuth callback, encrypted session cookie, Cloudflare provisioning API client, artifact verification.
- `deploy/worker/*`: source of the immutable install artifact; no protocol behavior change required for this installer milestone.
- `packages/shared/*`: installer contracts/status types if shared by UI and backend.
- `docs/INSTALL_FA.md`, `docs/INSTALL_EN.md`, `README.md`: OAuth-first instructions and advanced fallback.
- deployment/operator docs: one-time OAuth client registration, domain verification, and installer Worker secrets.

## Tests
Required automated coverage:
- PKCE/state or authorization-code state validation as applicable to the selected server-side OAuth flow.
- encrypted session cookie round trip, expiry, tamper rejection, and clear-on-finish.
- no token/password persistence or logging.
- account selection and permission failure paths.
- KV create/reuse behavior.
- Worker upload metadata contains KV binding `C` and secret is never serialized into source/config output.
- partial-failure retry behavior.
- health-check success/failure.
- Persian RTL and English LTR installer flows.
- existing 85+ project tests and browser E2E remain green.

A mocked Cloudflare API contract suite is mandatory. A real-account smoke test is also required before changing the README primary installation link.

## Operator prerequisites
The project owner performs these steps once:
1. Deploy the public installer Worker/UI on a domain controlled by the project owner.
2. Create a Cloudflare OAuth client for that domain.
3. Configure Authorization Code flow, redirect URI, required scopes, and allowed origin.
4. Verify the client domain using Cloudflare's DNS TXT challenge.
5. Promote the OAuth client to public visibility.
6. Store OAuth client credentials and cookie-encryption key as installer Worker secrets.

These are operator setup steps only. End users do not perform them.

## Success criteria
A first-time user with a Cloudflare account but no GitHub account can install the panel without leaving the guided flow except for Cloudflare's own OAuth consent page.

No end-user Git repository is created. No API token is copied or pasted in the primary flow. No VPS is required. After installation, disabling the Tehran Network installer must not interrupt the user's deployed VPN panel.
