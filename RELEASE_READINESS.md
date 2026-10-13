# Release readiness / آمادگی انتشار

**Stable release: BLOCKED.** This checkpoint is P0 recovery, not completion of the full product mission.

## Evidence required before promotion

- [x] Final root format/lint/typecheck/build/unit gate: 50 files / 256 tests.
- [x] Current standalone Worker typecheck and unit tests.
- [x] Current real local protocol and legacy-upgrade smoke, with exit 0.
- [x] Current real Xray lifecycle and browser E2E final verdicts.
- [ ] Current branch CI passes, including protocol job.
- [ ] Owner authorizes limited GitHub App access and final production publication.
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
