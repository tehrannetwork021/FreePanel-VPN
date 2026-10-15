# Release readiness / آمادگی انتشار

**Stable release: BLOCKED.** This checkpoint is P0 recovery, not completion of the full product mission.

## Evidence required before promotion

- [x] Fresh root format/lint/typecheck/build gate: 50 files / 264 tests on October 15. Both installer Runtime configurations pass with exact asset bytes and navigated UI parity. Packaging regressions first failed, then both focused suites passed 13 tests.
- [x] Current standalone Worker typecheck and unit tests.
- [x] Current real local protocol and legacy-upgrade smoke, with exit 0.
- [x] Current real Xray lifecycle and browser E2E final verdicts.
- [x] Preceding source commit `4c303ed` CI run 38439950483 passed quality, browser and protocol jobs.
- [x] Packaging source `989b9a2` passed [CI 38748804379](https://github.com/tehrannetwork021/FreePanel-VPN/actions/runs/38748804379): quality, protocol-e2e and browser-e2e all completed successfully.
- [x] Owner authorized GitHub App access for FreePanel-VPN only; production Builds remain disabled.
- [ ] Owner authorizes final production publication after field evidence is ready.
- [x] Independent staging installer `freepanel-installer-recovery-20261015` is deployed and public version/SHA/UI parity passed twice plus real browser navigation/reload on October 15. This is smoke evidence, not a long-term stability guarantee.
- [ ] Real clean Cloudflare account installs with one token, produces `/admin`, and accepts the displayed password.
- [ ] User creation/private subscription and all three protocols pass on Cloudflare with Xray.
- [ ] Existing-install upgrade preserves KV/D1 users, seed, credentials and subscriptions.
- [ ] Free CPU, subrequest and D1/KV usage metrics are measured; bounded pressure/failure tests pass.
- [ ] Remaining advertised features and bilingual docs match the tested feature matrix.
- [ ] Release version, checksums, notes, changelog, tag and artifacts agree.

## Current production evidence

`https://tehran-network-installer.honored-feather.workers.dev` is reachable but stale. Health is HTTP 404 and UI fingerprint differs from current source. Do not treat a successful repository build as evidence of deployment.

The separately authorized personal staging Worker was republished through the official multipart API at 19:24:08 UTC as version `ba3766a6-7514-4082-853d-ca9e674d211d`, with the exact tested module digest, date `2026-09-19`, no bindings and a registered `fetch` handler. API readback confirms the metadata and source. The exact public verifier still fails; browser GET health returned 1101 at 19:26:13 UTC. Native Tail received zero frames. The previous Hello World rollback also failed publicly. These facts do not establish a root cause. See [runtime evidence](docs/CLOUDFLARE_STAGING_INCIDENT.md); stable and clean-account gates remain unchecked.

## Decision

October 15 recovery: [evidence](docs/CLOUDFLARE_1101_RECOVERY.md) records the peer fix, fresh Worker, exact artifact checks and successful public smoke. The old production URL remains stale. Actual one-token installation and remaining field gates are required before production promotion and stable release.

Publish recovery work through a reviewed feature PR. Do not delete/reset live data or switch production URLs. Use a separate staging Worker. P1–P5 features remain planned until P0 field gates pass, as required by the mission.
