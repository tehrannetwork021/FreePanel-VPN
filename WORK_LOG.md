# Work log / گزارش کار

## 2026-10-13 — Recovery baseline and P0

1. Cloned repository without modifying existing deployed resources. Recorded baseline `a4050d0c80e7ab1506fcaeccec9c9af509201c1a`; created `feat/p0-release-recovery-20261013`.
2. Read repository ledger, prior approved architecture/installation requirements, installer orchestration, D1 auth/accounting, protocol transports, subscription formats and build/test contracts. Preserved existing implementation.
3. Compared all remote branches. Bootstrap-only divergence changes a staging name; no newer feature implementation needs merging.
4. Checked GitHub releases, issues, PRs and CI through connector/public APIs. Inspected live public installer with credential-free HTTP requests.
5. Reproduced installer/build/destination defects with failing tests, then corrected them. Recorded full failure diagnostics before acting.
6. Found release tests concurrently overwriting shared artifacts. Moved test-generated artifacts into independent temporary directories and verified deterministic output without mutation of shipped files.
7. A single focused read-only transport reviewer reproduced backpressure, late-connect and large-chunk quota defects. Independently reproduced them in regression tests before fixing source.
8. Forwarding uses 64 KiB slices; WebSocket pending input is limited to 1 MiB. XHTTP consumes remote output through `pull()` instead of eagerly draining it.
9. Initial host pnpm 11 differed from project pin 10.15.1 and blocked native dependency scripts. Reinstalled with pnpm 10.15.1; only esbuild/workerd dependency builds are allowed. No Codex authentication/provider configuration changed.
10. Standalone Worker was missing from root workspace. Added it with a frozen importer; repaired Windows-only test invocation/process cleanup failures instead of skipping tests.
11. Downloaded official Xray-core 26.3.27 Windows archive and verified SHA-256 against its GitHub release digest. No private production credentials were used in local protocol tests.
12. Owner logged into Cloudflare and GitHub through the browser. Prepared GitHub App access for FreePanel-VPN only; did not authorize all repositories or deploy over the live installer.

13. Final local gate passed: 50 files/256 unit tests, all workspace typechecks, build and installer dry-run; Worker check passed 171 tests; protocol/legacy/Xray lifecycle passed; browser nine passed with three pre-existing project exclusions. Production advisory audit reported no known vulnerabilities; secret-pattern scan found no matches in 223 files.
14. Credential-free deployment verifier correctly failed against stale production. Production is still blocked despite green local tests.

Current test evidence and outstanding gates are recorded separately. No real user KV/D1 data, Worker, domain, or security setting has been removed or reset.
