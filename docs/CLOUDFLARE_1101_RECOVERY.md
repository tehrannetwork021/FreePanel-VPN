# Cloudflare 1101 recovery — 2026-10-15

## Result and limits

The owner-approved fresh staging installer is reachable:

https://freepanel-installer-recovery-20261015.golamirreza19954312.workers.dev

The exact public verifier passed twice, at approximately 10:32 and 10:34 UTC. It checks health version/SHA, native HTTPS navigation, and exact JS/CSS bytes. Real browser navigation and reload also displayed the Persian installer. A public POST with an empty token returned HTTP 401 and JSON `{ok:false,stage:"token",code:"token-invalid"}`. No real Cloudflare token was submitted and no end-user KV/D1/receiver installation occurred.

This is a recovery smoke result, not long-term stability or a full stable release. The original production URL and the previously failing staging Worker were not replaced. Clean-account installation, field protocols, upgrade preservation, Free CPU measurements and final production authorization remain open.

## Relevant peer fixes

- [BPB issue #940](https://github.com/bia-pain-bache/BPB-Worker-Panel/issues/940) contains reports that new deployments failed while old ones worked, and that obfuscation alone did not fix every deployment. The maintainer closed it with [build revision 4cb9c9e6cd8d60f102b25cf348ad024525646327](https://github.com/bia-pain-bache/BPB-Worker-Panel/commit/4cb9c9e6cd8d60f102b25cf348ad024525646327). Its actual patch changes HTML payloads to Base64 with UTF-8 recovery and revises minification. It also adds random junk and hourly builds; those parts are not used here. Later user reports describe needing a new Worker. These are peer observations, not confirmation of Cloudflare's internal cause in this account.
- [CFNext's pinned changelog](https://github.com/PAICNI/CFNext/blob/d90942a4f57c5e9620d70b77f007fb932942baf6/README.md) describes deployment content changes for 1101 and offers encoded/obfuscated builds. Its optional simulated 1101 page is unrelated to recovery verification and is not adopted.
- [Netra's binding warning](https://github.com/netrair/netra-panel/blob/9f2c7824fee248005bb0bb60b3da63914fd21b8c/README.md) concerns an absent `kv` binding. FreePanel's installer health does not read KV/D1; the binding-free configuration already passes local workerd.
- [Nahan's bounded fetch helper](https://github.com/itsyebekhe/nahan/blob/67c9a038da4b0812bc4c8b630a6144967d102880/_worker.js) addresses pending network operations. Our health handler performs no such fetch; the separate provisioning deadline fix remains in place.
- [Cloudflare's error documentation](https://developers.cloudflare.com/workers/observability/errors/) explains exceptions and unresolved promises as 1101 causes. A missing Tail event is not itself proof of an account flag or a specific provider enforcement mechanism.

No peer implementation was copied or executed. The packaging change uses standard Base64 and UTF-8 operations over this repository's own artifact.

## Evidence and change

1. The original staging's exact public verifier still failed on October 15. A temporary Preview comparison also failed for both its active installer version and its original Hello World version. Preview was returned to disabled afterwards.
2. The owner approved the bounded packaging design and the fresh Worker name `freepanel-installer-recovery-20261015`. The new official Hello World template returned HTTP 200, body `Hello World!`, Ray `a4af4bdf5fd0fcbc-ATL`, before application publication.
3. Previously, a JavaScript string in the installer bundle contained the entire readable edge Worker source. The generator now stores that payload as Base64 data. A lazy accessor decodes UTF-8 only when installation reads the artifact. It caches immutable source text only, with no request, promise, credential or I/O object retained.
4. SHA verification returns the same source string that is uploaded. Raw `dist/edge-worker.js`, its manifest SHA, deployed VPN behavior, version and end-user one-token flow remain unchanged. There is no random build noise, dynamic code evaluation, token storage or new dependency.
5. Two targeted tests failed before the change, then all 13 targeted tests passed. The artifact contract verifies decoded UTF-8 byte equality against the raw deployable file and its SHA; the runtime-side test verifies lazy single decoding and the digest. An initial full typecheck identified missing Node test typings and an incomplete TextDecoder options object; these were corrected. Fresh root format/lint/all typechecks/build and 50 files / 264 tests passed. Both real installer workerd configurations passed.
6. Binding-free upload bundle: 872,533 bytes, SHA-256 `33b9d7eb0162798e0569d6f1cf02ea916f526b1880c02c8b82fb50d7b42fb12c`, gzip 274.04 KiB. Editor copy-back, normalized from CRLF to LF, matched that digest before deployment. Dashboard active version prefix: `f106d69a`. New Worker compatibility date: `2026-10-15`; no connected bindings. The local runtime configurations retain tested date `2026-09-19`; public success is separate evidence for the new deployment's date, not a claim that local metadata is identical.
7. Public health returns edge version `0.3.1`, unchanged edge SHA `acbd3946eb12397187bd5ea69584c3ec3b6f0b4e6b9bbadbf17e5c76fcf086dc`; both installer assets match the current build.

Packaging and the Worker resource both changed in this recovery. The successful combined result does not establish which factor alone caused the earlier failure, nor prove that encoding alone repairs an already failing resource. No runtime exception stack or provider confirmation has been obtained.

No support case or Community message was sent, as requested by the owner. Existing production/VPN Workers, KV/D1 data, GitHub App scope and release state were preserved. No new API credential was created.
