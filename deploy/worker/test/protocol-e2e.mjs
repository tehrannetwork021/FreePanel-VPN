import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';

let PORT = 0;
let BASE = '';
async function freePort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}
const ADMIN_PASSWORD = 'task10-local-admin-password-2026';
const LEGACY_UPGRADE = process.env.LEGACY_UPGRADE === '1';
const LEGACY_FIXTURE_URL = new URL('./fixtures/legacy-protocol-config.json', import.meta.url);
const TARGET_HOST = 'example.com';
const TARGET_PORT = 80;
const HTTP_REQUEST = `GET / HTTP/1.1\r\nHost: ${TARGET_HOST}\r\nConnection: close\r\n\r\n`;
const encoder = new TextEncoder();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function concat(...parts) {
  const size = parts.reduce((n, part) => n + part.length, 0);
  const out = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}
function uuidBytes(uuid) {
  const hex = uuid.replaceAll('-', '');
  return Uint8Array.from(hex.match(/../g).map((x) => Number.parseInt(x, 16)));
}
function vlessPacket(uuid, host = TARGET_HOST, payload = HTTP_REQUEST) {
  const h = encoder.encode(host);
  return concat(
    new Uint8Array([0]),
    uuidBytes(uuid),
    new Uint8Array([0]),
    new Uint8Array([1, TARGET_PORT >> 8, TARGET_PORT & 0xff, 2, h.length]),
    h,
    encoder.encode(payload),
  );
}
function trojanPacket(password, host = TARGET_HOST, payload = HTTP_REQUEST) {
  const hash = createHash('sha224').update(password).digest('hex');
  const h = encoder.encode(host);
  return concat(
    encoder.encode(hash),
    new Uint8Array([13, 10, 1, 3, h.length]),
    h,
    new Uint8Array([TARGET_PORT >> 8, TARGET_PORT & 0xff, 13, 10]),
    encoder.encode(payload),
  );
}
function isHttpResponse(data) {
  return new TextDecoder().decode(data).includes('HTTP/1.1 200');
}
async function waitForWorker() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`${BASE}/health`);
      if (res.ok) return;
    } catch {
      // Worker may still be starting.
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('worker did not become ready');
}

async function readLegacyFixture() {
  return JSON.parse(await readFile(LEGACY_FIXTURE_URL, 'utf8'));
}

function runLocalKv(args, state) {
  const result = spawnSync(
    process.execPath,
    [
      './node_modules/wrangler/bin/wrangler.js',
      'kv',
      'key',
      ...args,
      '--binding',
      'C',
      '--local',
      '--persist-to',
      state,
    ],
    {
      cwd: new URL('..', import.meta.url),
      encoding: 'utf8',
      env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
    },
  );
  if (result.status !== 0) {
    throw new Error(`local kv command failed: ${(result.stderr || result.stdout).slice(-1000)}`);
  }
  return result.stdout.trim();
}

async function seedLegacyFixture(state) {
  runLocalKv(['put', 'protocol:config:v1', '--path', fileURLToPath(LEGACY_FIXTURE_URL)], state);
}

function readLegacyKv(state) {
  return runLocalKv(['get', 'protocol:config:v1', '--text'], state);
}

async function assertLegacyUpgrade(state) {
  const fixture = await readLegacyFixture();
  const healthResponse = await fetch(`${BASE}/health`);
  const health = await healthResponse.json();
  assert(healthResponse.ok && health.schemaVersion === 1, 'legacy upgrade did not reach schema 1');

  const sub = await fetch(`${BASE}${fixture.subscription.path}/${fixture.subscription.token}`);
  assert(sub.status === 200, `legacy subscription failed: ${sub.status}`);

  const vless = await wsRoundTrip(fixture.vless.path, vlessPacket(fixture.vless.uuid));
  assert(isHttpResponse(vless.slice(2)), 'legacy VLESS-WS did not connect');
  const trojan = await wsRoundTrip(fixture.trojan.path, trojanPacket(fixture.trojan.password));
  assert(isHttpResponse(trojan), 'legacy Trojan-WS did not connect');
  const xhttp = await fetch(`${BASE}${fixture.xhttp.path}`, {
    method: 'POST',
    body: vlessPacket(fixture.vless.uuid),
    duplex: 'half',
  });
  assert(xhttp.ok, `legacy XHTTP failed: ${xhttp.status}`);
  const xhttpBytes = new Uint8Array(await xhttp.arrayBuffer());
  assert(isHttpResponse(xhttpBytes.slice(2)), 'legacy XHTTP did not return target bytes');
  const current = JSON.parse(readLegacyKv(state));
  assert(
    JSON.stringify(current) === JSON.stringify(fixture),
    'legacy KV config changed during D1 upgrade',
  );
  console.log('PASS legacy-upgrade protocols');
}

async function setup() {
  const res = await fetch(`${BASE}/api/setup`, {
    method: 'POST',
    headers: { authorization: `Bearer ${ADMIN_PASSWORD}` },
  });
  if (!res.ok) throw new Error(`setup failed: ${res.status} ${await res.text()}`);
  const body = await res.json();
  assert(body.ok && body.links?.length === 3, 'setup did not return three protocol links');
  return body;
}

async function wsRoundTrip(path, firstPacket, expectHttp = true) {
  return await new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${PORT}${path}`);
    const chunks = [];
    const timer = setTimeout(() => {
      ws.terminate();
      reject(new Error(`timeout ${path}`));
    }, 12000);
    ws.binaryType = 'arraybuffer';
    ws.on('open', () => ws.send(firstPacket));
    ws.on('message', (data) => {
      chunks.push(new Uint8Array(data));
      const merged = concat(...chunks);
      if (!expectHttp || isHttpResponse(path.includes('vless') ? merged.slice(2) : merged)) {
        clearTimeout(timer);
        ws.close();
        resolve(merged);
      }
    });
    ws.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    ws.on('close', () => {
      if (!expectHttp) {
        clearTimeout(timer);
        resolve(concat(...chunks));
      }
    });
  });
}
async function wsMustReject(path, packet) {
  return await new Promise((resolve) => {
    const ws = new WebSocket(`ws://127.0.0.1:${PORT}${path}`);
    let leaked = false;
    const timer = setTimeout(() => {
      ws.terminate();
      resolve(!leaked);
    }, 2500);
    ws.on('open', () => ws.send(packet));
    ws.on('message', (data) => {
      if (isHttpResponse(new Uint8Array(data))) leaked = true;
    });
    ws.on('close', () => {
      clearTimeout(timer);
      resolve(!leaked);
    });
    ws.on('error', () => {
      clearTimeout(timer);
      resolve(!leaked);
    });
  });
}

async function main() {
  const state = await mkdtemp(join(tmpdir(), 'tn-worker-e2e-'));
  PORT = await freePort();
  BASE = `http://127.0.0.1:${PORT}`;
  if (LEGACY_UPGRADE) await seedLegacyFixture(state);
  const child = spawn(
    process.execPath,
    [
      './node_modules/wrangler/bin/wrangler.js',
      'dev',
      '--local',
      '--ip',
      '127.0.0.1',
      '--port',
      String(PORT),
      '--persist-to',
      state,
      '--var',
      `ADMIN_PASSWORD:${ADMIN_PASSWORD}`,
    ],
    { cwd: new URL('..', import.meta.url), stdio: ['ignore', 'pipe', 'pipe'], detached: true },
  );
  let logs = '';
  child.stdout.on('data', (d) => {
    logs += d;
  });
  child.stderr.on('data', (d) => {
    logs += d;
  });
  try {
    await waitForWorker();
    if (LEGACY_UPGRADE) {
      await assertLegacyUpgrade(state);
      return;
    }
    const owner = await setup();
    const vlessWs = new URL(
      owner.links.find((x) => x.startsWith('vless://') && x.includes('type=ws')),
    );
    const trojanWs = new URL(owner.links.find((x) => x.startsWith('trojan://')));
    const xhttp = new URL(owner.links.find((x) => x.includes('type=xhttp')));

    const vlessResult = await wsRoundTrip(
      vlessWs.searchParams.get('path'),
      vlessPacket(vlessWs.username),
    );
    assert(isHttpResponse(vlessResult.slice(2)), 'VLESS-WS did not return target HTTP bytes');
    console.log('PASS VLESS-WS');
    const trojanResult = await wsRoundTrip(
      trojanWs.searchParams.get('path'),
      trojanPacket(decodeURIComponent(trojanWs.username)),
    );
    assert(isHttpResponse(trojanResult), 'Trojan-WS did not return target HTTP bytes');
    console.log('PASS Trojan-WS');

    const xhttpResponse = await fetch(`${BASE}${xhttp.searchParams.get('path')}`, {
      method: 'POST',
      body: vlessPacket(xhttp.username),
      duplex: 'half',
    });
    assert(xhttpResponse.ok, `XHTTP failed: ${xhttpResponse.status}`);
    const xhttpBytes = new Uint8Array(await xhttpResponse.arrayBuffer());
    assert(isHttpResponse(xhttpBytes.slice(2)), 'XHTTP did not return target HTTP bytes');
    console.log('PASS VLESS-XHTTP stream-one');

    const wrongUuid = '11111111-2222-4333-8444-555555555555';
    assert(
      await wsMustReject(vlessWs.searchParams.get('path'), vlessPacket(wrongUuid)),
      'bad VLESS auth leaked target bytes',
    );
    assert(
      await wsMustReject(
        trojanWs.searchParams.get('path'),
        trojanPacket('definitely-wrong-password'),
      ),
      'bad Trojan auth leaked target bytes',
    );
    console.log('PASS negative-auth');
  } catch (error) {
    console.error(logs.slice(-5000));
    throw error;
  } finally {
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {
      // Process may already have exited cleanly.
    }
    await new Promise((r) => setTimeout(r, 500));
    await rm(state, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error?.stack ?? error);
  process.exitCode = 1;
});
