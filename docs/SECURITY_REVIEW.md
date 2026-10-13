# Security recovery review / بررسی امنیتی بازیابی

Scope: P0 installer, release artifact pipeline, destination validation and tunnel lifecycle at the 2026-10-13 recovery checkpoint. This is a focused review; a full Phase 13 audit, dependency advisory scan and final owner-validated threat model remain pending.

| ID      | Severity and impact                                                                   | Evidence                                                  | Recovery / residual risk                                                                                                                                                                    |
| ------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SEC-001 | High: maintainer deploy could publish a stale embedded Worker                         | `package.json`, `scripts/workers-builds-contract.test.ts` | Deploy now invokes the full gate, rebuilding panel/edge artifact; independent HTTP verifier checks exact public health/UI asset checksums. Production still needs promotion.                |
| SEC-002 | Medium: HTTP 200 could falsely signal valid admin login                               | `apps/installer-worker/src/provision.ts`                  | Require JSON success, future expiry and both Secure/SameSite cookies with HttpOnly session; reject redirects; five-second timeout.                                                          |
| SEC-003 | Medium: large body or JSON null could produce memory pressure/unhandled errors        | `apps/installer-worker/src/router.ts`                     | Stream-read cap 16 KiB, cancel on excess, object-shape validation, sanitized 4xx responses before Cloudflare calls.                                                                         |
| SEC-004 | Medium: alternate numeric/local IPv6 forms bypassed application destination filtering | `deploy/worker/src/network/destination.ts`                | Canonical URL host validation; private/mapped addresses rejected. DNS rebinding/private resolution is additionally restricted by Cloudflare socket runtime; no private VPC binding is used. |
| SEC-005 | High availability risk: XHTTP eagerly drained TCP into an unread response             | `deploy/worker/src/transport/xhttp.ts`                    | Pull-based response backpressure and cleanup. Real isolate/load behavior remains unmeasured.                                                                                                |
| SEC-006 | Medium: client close during awaited auth/connect could orphan a TCP socket            | `deploy/worker/src/transport/websocket.ts`                | Recheck stopped state after asynchronous boundaries; close a late socket before payload writes. Pending input capped at 1 MiB.                                                              |
| SEC-007 | Medium: quota bound was false with large chunks                                       | Both transport modules and `usageMeter.ts`                | Forward in 64 KiB slices, checkpoint between slices; conservative allowance and D1-failure assumptions documented in `LIMITATIONS.md`.                                                      |

## Existing controls inspected

- Mandatory D1 admin authority with PBKDF2, hashed session tokens, expiry, CSRF, credential-version invalidation and login throttle: `db/auth.ts`, `security/session.ts`, `routes/auth.ts`, `db/audit.ts`.
- HMAC-derived per-user secrets with separate purposes/versioned lookup hashes, private subscription 404/no-store rejection and indexed tunnel access checks: `derivedSecrets.ts`, `tunnelAuth.ts`, `routes/subscription.ts`.
- Bound and validated SQL inputs: user/quota mutations use prepared statements and optimistic versions; usage increments are in a D1 batch: `db/users.ts`, `db/usage.ts`, `routes/adminApi.ts`.
- Token processing is per install request; no repository/KV/D1/browser storage sink is used in installer source. Hosted installer operators and their supply chain remain inside the trust boundary; users can revoke the token after installation.
- Release tests use secret sentinels, but sentinel tests alone are not a comprehensive real-secret/dependency scan.

## Remaining review areas

Public installer abuse/rate limits, slow-body/handshake timeouts, Free CPU for PBKDF2, large aggregate WebSocket output buffers, final usage-write failure diagnostics, migration/bootstrap concurrency, supply-chain action pinning, backup confidentiality and future import/chain SSRF. Do not claim these have passed field testing.

No submitted private GitHub/Cloudflare token appears in this report or the implementation. A token shared in chat should be rotated through its provider. No native Codex authentication/provider routing was changed.
