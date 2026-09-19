# Worker Three-Protocol Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the Deploy-to-Cloudflare Worker from a bootstrap page into a usable VLESS-WS, Trojan-WS and VLESS-XHTTP (`stream-one`) service with real TCP forwarding and subscriptions.

**Architecture:** Keep the isolated `deploy/worker` template self-contained. Pure protocol parsers and config/subscription modules stay runtime-agnostic; Cloudflare-specific WebSocket and `cloudflare:sockets` adapters sit at the edge. A required `ADMIN_PASSWORD` Worker secret protects first-time credential generation and owner-only config display; tunnel authentication is separate from admin authentication.

**Tech Stack:** TypeScript 5.9, Cloudflare Workers/workerd, Wrangler 4.135, KV binding `C`, WebSocketPair, `cloudflare:sockets`, Vitest at repository root, Wrangler local-dev integration tests.

**Spec:** `docs/superpowers/specs/2026-09-19-worker-protocol-core-design.md`

## Global Constraints

- V1 protocols are exactly VLESS over WebSocket, Trojan over WebSocket, and VLESS XHTTP `stream-one`.
- TCP only; UDP/Mux/Hysteria/TUIC/WireGuard/Reality are out of scope.
- No hard-coded shared UUID/password/subscription secret or third-party fallback endpoint.
- `ADMIN_PASSWORD`, VLESS UUID, Trojan password and subscription token are distinct values.
- Outbound sockets are created only after successful protocol authentication and destination validation.
- Private/loopback/self destinations are rejected before `connect()`; Cloudflare platform rejections are surfaced without fallback.
- No credential is logged or returned in unauthenticated errors.
- Deploy-to-Cloudflare remains the primary installation path and `deploy/worker` must remain fully isolated.
- Release is blocked until root quality gates, protocol integration tests and Wrangler dry-run are green.

## Review Focus

1. Fragmented VLESS/Trojan handshake bytes must wait for more data rather than reject a valid client.
2. Wrong UUID/Trojan hash must never invoke the TCP connector.
3. Domain-length, IPv6 and oversized-header inputs must not allocate unbounded memory or read out of bounds.
4. WebSocket close/error and TCP EOF must close the opposite side without hanging writers/readers.
5. XHTTP `stream-one` must accept both canonical configured path and the trailing-slash form used by Xray clients while rejecting session-style extra path segments.

---

### Task 1: Finish the deploy template security contract

**Files:**

- Create: `deploy/worker/.dev.vars.example`
- Create: `deploy/worker/tsconfig.json`
- Modify: `deploy/worker/package.json`
- Modify: `deploy/worker/wrangler.jsonc`
- Test: `scripts/release-install-contract.test.ts`

**Interfaces:**

- Produces `Env.ADMIN_PASSWORD: string` as a required Worker secret and an independently type-checkable deploy template.
- Later tasks consume the secret only for owner/admin routes, never tunnel authentication.

- [ ] Extend the existing release contract test to require `.dev.vars.example` with `ADMIN_PASSWORD`, `secrets.required` in Wrangler, and worker scripts `typecheck`, `test`, `check`.
- [ ] Run the focused contract test and verify RED because those declarations do not exist.
- [ ] Add `ADMIN_PASSWORD` secret declaration, binding description, TypeScript config and worker-local test/typecheck scripts with Wrangler pinned at 4.135.0.
- [ ] Run the focused test, `npm audit --audit-level=high`, worker typecheck and `wrangler deploy --dry-run`; expect all green and zero high/critical vulnerabilities.
- [ ] Commit as `build: harden Cloudflare worker template`.

### Task 2: Shared byte, UUID and destination primitives

**Files:**

- Create: `deploy/worker/src/core/types.ts`
- Create: `deploy/worker/src/core/bytes.ts`
- Create: `deploy/worker/src/core/uuid.ts`
- Create: `deploy/worker/src/network/destination.ts`
- Test: `deploy/worker/src/core/primitives.test.ts`
- Test: `deploy/worker/src/network/destination.test.ts`

**Interfaces:**

- Produces `Destination`, `ParseResult<T>`, `toBytes`, `constantTimeEqual`, `uuidToBytes`, `formatIpv6`, `validateDestination(destination, selfHost)`.
- Protocol parsers consume these exact helpers.

- [ ] Write tests for UUID byte conversion, constant-time equality result semantics, IPv4/domain/IPv6 destination rendering, and rejection of localhost/RFC1918/link-local/ULA/self-host/invalid ports.
- [ ] Run focused tests and verify RED due to missing modules.
- [ ] Implement the minimal pure helpers with bounded input sizes and no runtime-specific imports.
- [ ] Re-run focused tests and the full root test suite; expect green.
- [ ] Commit as `feat: add protocol core primitives`.

### Task 3: VLESS request parser

**Files:**

- Create: `deploy/worker/src/protocols/vless.ts`
- Test: `deploy/worker/src/protocols/vless.test.ts`

**Interfaces:**

- Produces `parseVlessRequest(input, expectedUuid)` returning `need-more`, `error`, or `{ destination, payload, responseHeader }`.
- The parser accepts VLESS version 0, command TCP (`0x01`), address types IPv4=1, Domain=2, IPv6=3, and caps header parsing at 512 bytes.

- [ ] Write table tests for IPv4/domain/IPv6 requests, addons length, payload preservation, fragmented headers, wrong UUID, UDP/Mux rejection, invalid domain length and oversized header.
- [ ] Run focused tests and verify RED.
- [ ] Implement the minimal parser using the shared primitives and constant-time UUID comparison.
- [ ] Re-run focused tests and full root tests; expect green.
- [ ] Commit as `feat: parse authenticated VLESS TCP requests`.

### Task 4: Trojan SHA-224 and request parser

**Files:**

- Create: `deploy/worker/src/core/sha224.ts`
- Create: `deploy/worker/src/protocols/trojan.ts`
- Test: `deploy/worker/src/core/sha224.test.ts`
- Test: `deploy/worker/src/protocols/trojan.test.ts`

**Interfaces:**

- Produces `sha224Hex(text)` and `parseTrojanRequest(input, expectedHash)`.
- Trojan input is 56 ASCII hex SHA-224 bytes + CRLF + CONNECT/SOCKS-like destination + CRLF + payload; UDP is rejected.

- [ ] Write SHA-224 known-vector tests and Trojan parser tests for domain/IPv4/IPv6, fragmented request, wrong hash, missing CRLF, UDP and oversized header.
- [ ] Run focused tests and verify RED.
- [ ] Implement SHA-224 without Node-only APIs and implement the bounded Trojan parser.
- [ ] Re-run focused tests and full root tests; expect green.
- [ ] Commit as `feat: parse authenticated Trojan TCP requests`.

### Task 5: KV configuration and protected owner setup

**Files:**

- Create: `deploy/worker/src/config/model.ts`
- Create: `deploy/worker/src/config/store.ts`
- Create: `deploy/worker/src/config/admin.ts`
- Test: `deploy/worker/src/config/config.test.ts`

**Interfaces:**

- Produces `loadProtocolConfig(env)`, `ensureProtocolConfig(env)`, `verifyAdminPassword(candidate, env.ADMIN_PASSWORD)` and `publicProtocolStatus(config)`.
- Stored config contains independent random VLESS UUID, Trojan password + SHA-224 hash, random subscription token, default paths `/vless`, `/trojan`, `/xhttp`, enabled flags and schema version.

- [ ] Write tests with an in-memory KV for first setup, idempotent reload, distinct secrets, default paths, disabled secret leakage in public status, and wrong admin password.
- [ ] Run focused tests and verify RED.
- [ ] Implement CSPRNG credential generation and KV serialization. Do not create protocol config from unauthenticated tunnel/status routes.
- [ ] Re-run focused tests and full root tests; expect green.
- [ ] Commit as `feat: add protected protocol configuration`.

### Task 6: Cloudflare TCP and WebSocket tunnel adapter

**Files:**

- Create: `deploy/worker/src/network/tcp.ts`
- Create: `deploy/worker/src/transport/websocket.ts`
- Test: `deploy/worker/src/transport/websocket.test.ts`

**Interfaces:**

- Produces `openTcp(destination, selfHost)` and `createWebSocketTunnel({ parseFirstPacket, connectTcp, responseHeader })`.
- The tunnel adapter injects `connectTcp` for tests; production uses `cloudflare:sockets.connect` only after parser auth succeeds.

- [ ] Write fake-WebSocket/fake-socket tests proving successful first-packet payload forwarding, subsequent frame forwarding, downstream response framing, auth failure with zero connector calls, and bilateral close behavior.
- [ ] Run focused tests and verify RED.
- [ ] Implement Cloudflare socket adapter plus runtime-agnostic tunnel state machine with serialized writes and bounded first packet.
- [ ] Re-run focused tests, full root tests and Wrangler dry-run; expect green.
- [ ] Commit as `feat: bridge authenticated WebSockets to TCP`.

### Task 7: VLESS-WS and Trojan-WS routes

**Files:**

- Create: `deploy/worker/src/routes/ws.ts`
- Modify: `deploy/worker/src/index.ts`
- Test: `deploy/worker/src/routes/ws.test.ts`

**Interfaces:**

- `/vless` and `/trojan` (from config paths) require WebSocket Upgrade, load existing config, select corresponding parser, and return 101 only through the WebSocket tunnel adapter.
- Disabled/unconfigured protocols return 404/503 without outbound connection attempts.

- [ ] Write route tests for enabled/disabled/unconfigured/wrong-method/wrong-path behavior and parser selection.
- [ ] Run focused tests and verify RED.
- [ ] Implement route dispatch and minimal WebSocket handlers using Tasks 3–6.
- [ ] Re-run focused tests, root suite and worker dry-run; expect green.
- [ ] Commit as `feat: enable VLESS and Trojan WebSocket routes`.

### Task 8: XHTTP stream-one route

**Files:**

- Create: `deploy/worker/src/transport/xhttp.ts`
- Create: `deploy/worker/src/routes/xhttp.ts`
- Test: `deploy/worker/src/transport/xhttp.test.ts`
- Test: `deploy/worker/src/routes/xhttp.test.ts`

**Interfaces:**

- `POST /xhttp` and `POST /xhttp/` consume one streaming VLESS request body and return one streaming VLESS response body.
- Uses the same VLESS parser and TCP connector as WS; no session ID route or packet-up mode is accepted.

- [ ] Write tests for fragmented streaming header, request-body payload forwarding, VLESS response prefix, trailing-slash compatibility, non-POST rejection, extra path rejection, bad UUID with zero connect calls and body-size bounds.
- [ ] Run focused tests and verify RED.
- [ ] Implement stream-one by reading only enough body for the VLESS header, starting the outbound TCP socket, pumping remaining request bytes upstream and socket bytes downstream with no-store/SSE-compatible headers.
- [ ] Re-run focused tests, root suite and worker dry-run; expect green.
- [ ] Commit as `feat: enable VLESS XHTTP stream-one`.

### Task 9: Subscription outputs and owner panel

**Files:**

- Create: `deploy/worker/src/subscription/links.ts`
- Create: `deploy/worker/src/subscription/formats.ts`
- Create: `deploy/worker/src/panel.ts`
- Modify: `deploy/worker/src/index.ts`
- Test: `deploy/worker/src/subscription/subscription.test.ts`
- Test: `deploy/worker/src/panel.test.ts`

**Interfaces:**

- `/sub/{token}` supports `format=base64|links|singbox|mihomo`; token is compared in constant time.
- Owner `POST /setup` accepts `application/x-www-form-urlencoded` `adminPassword`, authenticates against Worker secret, creates/loads config, and renders copyable VLESS-WS/Trojan-WS/VLESS-XHTTP + subscription URLs.
- Public `/` never exposes credentials.

- [ ] Write tests that parse generated URLs, decode base64, JSON-parse sing-box, structurally inspect Mihomo YAML, reject bad subscription tokens, and verify public panel HTML contains no UUID/password/token.
- [ ] Run focused tests and verify RED.
- [ ] Implement link/format generators; include XHTTP only in universal/direct links while Sing-box/Mihomo contain only transports they can safely describe.
- [ ] Implement locked colorful owner panel and server-side setup form without client-side credential storage.
- [ ] Re-run focused tests, root suite and worker dry-run; expect green.
- [ ] Commit as `feat: add usable subscriptions and owner setup`.

### Task 10: Workerd end-to-end protocol verification

**Files:**

- Create: `deploy/worker/test/protocol-e2e.mjs`
- Modify: `deploy/worker/package.json`
- Test runtime: Wrangler local workerd + public TCP HTTP target.

**Interfaces:**

- `npm run test:protocol` starts `wrangler dev` with a temporary local secret/KV state, performs authenticated setup, then sends VLESS-WS, Trojan-WS and XHTTP requests through the Worker to an external TCP HTTP endpoint and verifies downstream HTTP bytes.

- [ ] Write the integration script first and run it; verify RED before all routing is complete or if any protocol path is incompatible.
- [ ] Add only the minimum runtime/test hooks required to make the three paths pass; no mock connector is used in this task.
- [ ] Verify wrong VLESS UUID and wrong Trojan hash are rejected and cannot return target bytes.
- [ ] Run `npm run test:protocol`; expect VLESS-WS PASS, Trojan-WS PASS, XHTTP stream-one PASS, negative-auth PASS.
- [ ] Commit as `test: verify three protocols in workerd`.

### Task 11: Documentation, ledger and release gate

**Files:**

- Modify: `AGENTS.md`
- Modify: `README.md`
- Modify: `docs/INSTALL_FA.md`
- Modify: `docs/INSTALL_EN.md`
- Modify: `CHANGELOG.md`
- Modify: `deploy/worker/src/index.ts` version constant if needed

**Interfaces:**

- Documentation must describe the exact Deploy-to-Cloudflare flow: click deploy, set `ADMIN_PASSWORD`, deploy, open Worker, enter the same admin password, copy subscription/config and connect.

- [ ] Update docs and AGENTS only after protocol tests are green; mark VLESS/Trojan/XHTTP/subscription complete and remove bootstrap-only warnings.
- [ ] Run `pnpm check` and `pnpm test:e2e` from repo root; expect zero failures.
- [ ] Run `npm audit --audit-level=high`, `npm run typecheck`, `npm run test:protocol`, and `npx wrangler deploy --dry-run` from `deploy/worker`; expect zero failures/high vulnerabilities.
- [ ] Run secret scan and `git diff --check`; expect no credentials or whitespace errors.
- [ ] Commit as `release: make Tehran Network Worker usable`.
- [ ] Only after all gates are green: push the tested branch/main as explicitly authorized earlier, then publish the GitHub release; do not publish a release from a red tree.
