# وضعیت پروژه / Project status

Checkpoint: 2026-10-13. Recovery baseline: `a4050d0c80e7ab1506fcaeccec9c9af509201c1a`.
Branch: `feat/p0-release-recovery-20261013`. Release candidate version remains `0.3.1`; stable acceptance is **not met**.

## مسیر کاربر / User journey

حساب خالی Cloudflare → Installer عمومی → ساخت Scoped Token → کپی و ورود یک‌باره → نصب خودکار → آدرس `/admin` و رمز تولیدشده. حساب GitHub، VPS، ترمینال و دامنهٔ پولی برای کاربر نهایی لازم نیست.

An empty Cloudflare account is sufficient for the intended user flow. GitHub integration belongs only to the maintainer's public-installer publishing pipeline.

## وضعیت بازیابی

- Main still matches the supplied baseline. The latest main CI run [35560644775](https://github.com/tehrannetwork021/FreePanel-VPN/actions/runs/35560644775) succeeded.
- Initial GitHub inspection found no open issues or pull requests. Recovery is now tracked in draft [PR #1](https://github.com/tehrannetwork021/FreePanel-VPN/pull/1), source commit `8a316e9bf8f059c8f1adcef8cc3313990a25cfd9`. Its [CI run 38413500188](https://github.com/tehrannetwork021/FreePanel-VPN/actions/runs/38413500188) passed quality, browser E2E and protocol E2E. Public releases remain `v0.3.0` and `v0.3.0-rc.1`; there is no `v0.3.1` release yet.
- All other development branches are behind main. Two bootstrap branches diverge only by a staging Worker name; do not merge older source over current main.
- Live installer root returned HTTP 200 with `index-fun4E7D7.js`; `/api/health` returned HTTP 404 / `not-found`. Current source UI asset is `index-B13sSiPC.js`.
- Owner browser access confirmed the existing installer in the Honored Feather account. With explicit owner approval, Cloudflare's GitHub App was authorized for FreePanel-VPN only and the Worker connected to this repository/main. **Disable builds is on**, so connection did not publish over production. Separate staging uploaded successfully but external health/UI return Cloudflare 1101; deployment verification remains RED and runtime/asset routing diagnostics are in progress.
- Source `ac5f7fc` passed all three jobs in [CI run 38431048995](https://github.com/tehrannetwork021/FreePanel-VPN/actions/runs/38431048995). The owner approved a separate personal-account `tehran-network-installer-staging-e2e`; Hello World worked and the installer briefly passed exact public verification, but subsequent navigation again returned HTTP 500 / 1101. Public stability is unproven. No personal VPN Worker, KV or D1 was changed. [Pinned source comparisons](docs/COMPETITOR_GAP_ANALYSIS.md#targeted-runtime-source-review--2026-10-13) now cover fifteen runtime/tool repositories and two installer references. A temporary GET-only trace on staging returned no handler marker on failed requests; the owner is preparing fixed-target read-only API/Tail diagnostics. No cause is asserted yet.

## P0 recovery work

- Release publishing now runs quality checks and rebuilds the embedded panel/edge artifact before uploading.
- Public health includes edge version, SHA-256 and expected schema version.
- Login verification requires successful JSON and both secure session/CSRF cookies; redirects are rejected and health/login fetches have a five-second timeout.
- Invalid JSON shapes and oversized streamed installer inputs fail before Cloudflare calls.
- Automatic account choice is stable: lexicographically smallest accessible account ID. Scope the token to the intended account for certainty.
- Destination validation canonicalizes numeric addresses and blocks mapped/expanded local IPs and malformed host syntax. Cloudflare's socket restrictions remain the DNS-resolution boundary.
- WebSocket termination races, queued input limits, XHTTP downstream backpressure and bounded forwarding slices have regression coverage.
- Worker is included in the pnpm workspace and frozen root lockfile. Protocol, legacy upgrade and real Xray lifecycle checks are added to CI.
- Windows E2E process-tree cleanup and legacy-upgrade invocation are repaired. LF checkout rules preserve migration/artifact digests.
- Cloudflare API operations now have a 30-second deadline covering headers and response bodies, reject redirects and clean up timers. API outages return a sanitized 502 rather than blaming the token. Fresh local root check passed 263 tests and both installer Runtime configurations passed. These changes do not diagnose the public GET failure.

## Remaining acceptance gates

See [TEST_RESULTS.md](TEST_RESULTS.md), [FEATURE_MATRIX.md](FEATURE_MATRIX.md), and [RELEASE_READINESS.md](RELEASE_READINESS.md).
Real Cloudflare clean-account installation, production promotion, field connectivity, Free CPU measurements and broader P1–P5 functionality remain pending. Local tests must not be promoted to production evidence.
