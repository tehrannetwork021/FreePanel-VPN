# Cloudflare staging evidence — 2026-10-13

The public staging installer is not accepted as stable. This report distinguishes observed facts from the still-unknown cause of HTTP 500 / Cloudflare 1101.

## Verified source and deployment

- Repository candidate: `4c303edf63893121db4427defa48d1c9de1c4a7a`.
- GitHub CI: [38439950483](https://github.com/tehrannetwork021/FreePanel-VPN/actions/runs/38439950483), quality, protocol-e2e and browser-e2e all succeeded.
- Fresh local root checks passed 50 files / 263 tests, format, lint, workspace typechecks and build. Both installer Runtime configurations passed.
- Target: `tehran-network-installer-staging-e2e` only. Public URL: `https://tehran-network-installer-staging-e2e.golamirreza19954312.workers.dev`.
- Current active version read through the API: `ba3766a6-7514-4082-853d-ca9e674d211d`, 100% traffic, deployed 2026-10-13 19:24:08 UTC. Deployment ID: `53a15969-f705-45bb-a553-39cb11bddb80`.
- Raw downloaded `worker.mjs`: 741,307 bytes, SHA-256 `ca4ab26b0a52b416c2283869f4461e88253f49e83dd842052042c4050c5c6fe6`. It exactly matches the tested publishing bundle.
- The temporary handler wrapper was removed before this version was deployed.
- The canonical multipart upload reports a registered `fetch` handler and startup time of 2 ms. Earlier version resources also reported `fetch` for the previous installer and original Hello World version `ef14aca5-e16b-4f5e-8337-ba10a6ac7c75`.
- Current API settings: no bindings; compatibility date `2026-09-19`, no flags; workers.dev enabled, preview URLs disabled; invocation logs enabled with sampling rate 1.

## Reproduction and controls

1. The exact public installer verifier still rejects this target with `installer-health-http-failed`.
2. At 17:53:57 UTC, dashboard rollback assigned 100% traffic to the original Hello World version. Public GET `/api/health` still returned 500 / 1101 at 17:55:16 UTC; Ray `a4a036de7c0c7e8e-ATL`.
3. The Quick Edit HTTP tool returned 200 with installer health JSON at 18:00:10 UTC, and the temporary wrapper's handler-start / handler-response-200 messages. This confirms that wrapper code executed in the private preview. The editor's selected read-only source version was different from the preview response, so this is not presented as a Hello World preview result.
4. Restored the ordinary tested installer as version `4f40a662` at 18:03:24 UTC. Its source was verified before upload and again by API download.
5. Disabled and re-enabled only this staging workers.dev route. Public GET still returned 500 / 1101 at 18:10:36 UTC; Ray `a4a04d52bdd56c9d-ATL`.
6. An existing account Worker answered a HEAD-only control with HTTP 405 / JSON. No existing Worker code or KV/D1 data was changed by that control.
7. The owner approved an expiring personal-account Scripts Read + Tail Read token and explicitly allowed the agent to create it and run the diagnostic helper. The value was transferred through the clipboard into memory, cleared from the clipboard, and passed only through the child process environment. It was not printed or saved in a file.
8. A native Tail session using Wrangler's `trace-v1` initialization collected zero frames and zero parse errors for the failed public health request. The second helper finished with exit 0, deleted its own temporary Tail session and terminated its local WebSocket. The public response title was “Worker threw exception”, error code 1101, Ray `a4a06e391b8ced7f-ATL`.

No actual runtime exception has been obtained. These observations do not establish a specific Cloudflare backend cause, account ban, quota failure or JavaScript defect.

## Canonical publication and unresolved failure

The dashboard had inherited compatibility date `2026-10-13`; the frozen staging config tested locally uses `2026-09-19`. The dashboard picker did not offer that exact day. No different date was substituted.

The owner explicitly approved changing the same expiring temporary token to Scripts Edit + Tail Read. The saved token row is named FreePanel Staging Recovery Temporary and still expires October 14. Its permission applies to scripts in this one account; the publisher's endpoint is hard-coded to the isolated staging Worker. The token remained only in memory and a child process environment.

The fixed-target publisher completed with exit 0. It validated the exact bundle digest, declared `main_module: worker.mjs`, used the tested date, empty flags and bindings, and retained the route/preview policy. A subsequent API download confirmed the source digest and all settings above. The newly created native Tail session collected zero frames, zero events and zero parse errors; its cleanup succeeded and the child exited 0.

Public GET `/api/health` still returned HTTP 500 / 1101, Ray `a4a0ba490fe6b82c-ATL`. The exact public verifier failed with `installer-health-http-failed`. Browser navigation independently showed 1101 at 19:26:13 UTC, Ray `a4a0bc17c81be886`. There is still no captured runtime exception. Exact publishing metadata has now been verified and did not resolve the observed failure. Further application changes have no established diagnosis to justify them.

The ordinary tested installer remains deployed on staging. No production promotion, existing VPN Worker modification, KV/D1 mutation, merge or release occurred. A factual Cloudflare support draft is prepared separately; it has not been sent.

## Primary references

- [Cloudflare error and exception semantics](https://developers.cloudflare.com/workers/observability/errors/)
- [Cloudflare rollback semantics](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/)
- [Download Worker Script API](https://developers.cloudflare.com/api/resources/workers/subresources/scripts/methods/get/)

The API download endpoint is GET on the script itself. An initial helper incorrectly requested `/content` and received HTTP 405; that failure was preserved and corrected before the successful exact-code comparison. No competitor code was copied or executed. No production promotion, merge or release occurred.
