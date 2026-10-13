# Release readiness / آمادگی انتشار

**Stable release: BLOCKED.** This checkpoint is P0 recovery, not completion of the full product mission.

## Evidence required before promotion

- [x] Previously verified root format/lint/typecheck/build gate; latest root unit run: 50 files / 258 tests. Both installer Runtime configurations pass with exact asset bytes and navigated UI parity. The latest checker correction has separate focused lint/format verification; its new CI result must be recorded when available.
- [x] Current standalone Worker typecheck and unit tests.
- [x] Current real local protocol and legacy-upgrade smoke, with exit 0.
- [x] Current real Xray lifecycle and browser E2E final verdicts.
- [x] Source commit `8ca2bca` CI run 38425139626 passed quality, browser and protocol jobs.
- [x] Owner authorized GitHub App access for FreePanel-VPN only; production Builds remain disabled.
- [ ] Owner authorizes final production publication after field evidence is ready.
- [ ] Independent staging installer is deployed and public version/SHA/UI parity is verified.
- [ ] Real clean Cloudflare account installs with one token, produces `/admin`, and accepts the displayed password.
- [ ] User creation/private subscription and all three protocols pass on Cloudflare with Xray.
- [ ] Existing-install upgrade preserves KV/D1 users, seed, credentials and subscriptions.
- [ ] Free CPU, subrequest and D1/KV usage metrics are measured; bounded pressure/failure tests pass.
- [ ] Remaining advertised features and bilingual docs match the tested feature matrix.
- [ ] Release version, checksums, notes, changelog, tag and artifacts agree.

## Current production evidence

`https://tehran-network-installer.honored-feather.workers.dev` is reachable but stale. Health is HTTP 404 and UI fingerprint differs from current source. Do not treat a successful repository build as evidence of deployment.

## Decision

Publish recovery work through a reviewed feature PR. Do not delete/reset live data or switch production URLs. Use a separate staging Worker. P1–P5 features remain planned until P0 field gates pass, as required by the mission.
