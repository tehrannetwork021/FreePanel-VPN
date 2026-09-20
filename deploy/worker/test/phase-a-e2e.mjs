import { Buffer } from 'node:buffer';
import { access, chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import net from 'node:net';

const ADMIN_PASSWORD = 'phase-a-e2e-admin-password-2026';
const INSTALL_GENERATION = 'phase-a-e2e-generation-1';
const XRAY_VERSION = '26.3.27';
const XRAY_CACHE_DIR = join(homedir(), '.cache', 'tn-xray', `v${XRAY_VERSION}`);
const XRAY_BIN = process.env.XRAY_BIN || join(XRAY_CACHE_DIR, 'xray');
const XRAY_ARCHIVE_SHA256 = '23cd9af937744d97776ee35ecad4972cf4b2109d1e0fe6be9930467608f7c8ae';
const TARGET_HOST = 'example.com';
const TARGET_PORT = 80;
const HTTP_REQUEST = `GET / HTTP/1.1\r\nHost: ${TARGET_HOST}\r\nConnection: close\r\n\r\n`;
let workerPort = 0;
let base = '';
let xraySequence = 0;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function runProcess(command, args) {
  const child = spawn(command, args, { stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = '';
  child.stderr.on('data', (chunk) => {
    stderr = `${stderr}${chunk}`.slice(-2000);
  });
  const code = await new Promise((resolve) => child.once('exit', resolve));
  if (code !== 0) throw new Error(`${command} failed (${code}): ${stderr.trim()}`);
}
async function ensureXray() {
  try {
    await access(XRAY_BIN);
    return;
  } catch {
    /* provision below */
  }
  if (process.env.XRAY_BIN) throw new Error(`XRAY_BIN is not executable: ${XRAY_BIN}`);
  if (process.platform !== 'linux' || process.arch !== 'x64') {
    throw new Error('Set XRAY_BIN to a compatible Xray-core binary on non-linux-x64 hosts');
  }
  await mkdir(XRAY_CACHE_DIR, { recursive: true });
  const archivePath = join(XRAY_CACHE_DIR, 'Xray-linux-64.zip');
  const url = `https://github.com/XTLS/Xray-core/releases/download/v${XRAY_VERSION}/Xray-linux-64.zip`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Xray download failed: HTTP ${response.status}`);
  const archive = Buffer.from(await response.arrayBuffer());
  const digest = createHash('sha256').update(archive).digest('hex');
  if (digest !== XRAY_ARCHIVE_SHA256) throw new Error('Xray archive checksum mismatch');
  await writeFile(archivePath, archive);
  await runProcess('unzip', ['-oq', archivePath, 'xray', '-d', XRAY_CACHE_DIR]);
  await chmod(XRAY_BIN, 0o755);
  await access(XRAY_BIN);
}
async function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

async function waitForWorker() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`${base}/health`);
      if (response.ok) return;
    } catch {
      // Wrangler may still be booting.
    }
    await sleep(250);
  }
  throw new Error('worker did not become ready');
}

function cookiesFrom(response) {
  const lines =
    typeof response.headers.getSetCookie === 'function'
      ? response.headers.getSetCookie()
      : [response.headers.get('set-cookie') ?? ''];
  const values = new Map();
  for (const line of lines) {
    const match = /^([^=;,]+)=([^;,]*)/.exec(line);
    if (match) values.set(match[1], match[2]);
  }
  return values;
}

async function setupOwner() {
  const response = await fetch(`${base}/api/setup`, {
    method: 'POST',
    headers: { authorization: `Bearer ${ADMIN_PASSWORD}` },
  });
  assert(response.ok, `owner setup failed: ${response.status}`);
  const body = await response.json();
  assert(body.ok && body.links?.length === 3, 'owner setup protocol links missing');
  return body;
}

async function loginAdmin() {
  const response = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ password: ADMIN_PASSWORD }),
  });
  assert(response.ok, `admin login failed: ${response.status}`);
  const cookies = cookiesFrom(response);
  const session = cookies.get('tn_session');
  const csrf = cookies.get('tn_csrf');
  assert(session && csrf, 'admin auth cookies missing');
  return { cookie: `tn_session=${session}; tn_csrf=${csrf}`, csrf };
}

async function adminJson(auth, path, options = {}) {
  const method = options.method ?? 'GET';
  const headers = { cookie: auth.cookie, ...(options.headers ?? {}) };
  if (method !== 'GET') headers['x-csrf-token'] = auth.csrf;
  if (options.body !== undefined) headers['content-type'] = 'application/json';
  const response = await fetch(`${base}${path}`, {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  let body = null;
  try {
    body = await response.json();
  } catch {
    /* caller checks status */
  }
  return { response, body };
}

function parseOwnerLinks(owner) {
  return {
    vless: new URL(
      owner.links.find((value) => value.startsWith('vless://') && value.includes('type=ws')),
    ),
    trojan: new URL(owner.links.find((value) => value.startsWith('trojan://'))),
    xhttp: new URL(owner.links.find((value) => value.includes('type=xhttp'))),
  };
}

function vlessOutbound(uuid, path, network) {
  const settings = {
    vnext: [
      {
        address: '127.0.0.1',
        port: workerPort,
        users: [{ id: uuid, encryption: 'none' }],
      },
    ],
  };
  const streamSettings = { network, security: 'none' };
  if (network === 'ws') {
    streamSettings.wsSettings = { path, headers: { Host: '127.0.0.1' } };
  } else {
    streamSettings.xhttpSettings = {
      path,
      mode: 'stream-one',
      extra: { noGRPCHeader: true },
    };
  }
  return { protocol: 'vless', settings, streamSettings };
}

function trojanOutbound(password, path) {
  return {
    protocol: 'trojan',
    settings: { servers: [{ address: '127.0.0.1', port: workerPort, password }] },
    streamSettings: {
      network: 'ws',
      security: 'none',
      wsSettings: { path, headers: { Host: '127.0.0.1' } },
    },
  };
}

function xrayConfig(inboundPort, outbound) {
  return {
    log: { loglevel: 'warning' },
    inbounds: [
      {
        listen: '127.0.0.1',
        port: inboundPort,
        protocol: 'dokodemo-door',
        settings: { address: TARGET_HOST, port: TARGET_PORT, network: 'tcp' },
      },
    ],
    outbounds: [outbound],
  };
}

async function waitForTcp(port, child) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (child.exitCode !== null) return false;
    const ready = await new Promise((resolve) => {
      const socket = net.connect(port, '127.0.0.1');
      socket.once('connect', () => {
        socket.destroy();
        resolve(true);
      });
      socket.once('error', () => resolve(false));
      socket.setTimeout(150, () => {
        socket.destroy();
        resolve(false);
      });
    });
    if (ready) return true;
    await sleep(100);
  }
  return false;
}

async function httpThroughPort(port) {
  return new Promise((resolve) => {
    const socket = net.connect(port, '127.0.0.1');
    let text = '';
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(value);
    };
    const timer = setTimeout(() => finish(false), 9000);
    socket.on('connect', () => socket.write(HTTP_REQUEST));
    socket.on('data', (chunk) => {
      text += chunk.toString('utf8');
      if (text.includes('HTTP/1.1 200')) {
        clearTimeout(timer);
        finish(true);
      }
    });
    socket.on('error', () => {
      clearTimeout(timer);
      finish(false);
    });
    socket.on('close', () => {
      clearTimeout(timer);
      finish(text.includes('HTTP/1.1 200'));
    });
  });
}

async function xrayConnect(state, label, outbound) {
  const inboundPort = await freePort();
  const configPath = join(state, `xray-${(xraySequence += 1)}-${label}.json`);
  await writeFile(configPath, `${JSON.stringify(xrayConfig(inboundPort, outbound), null, 2)}\n`);
  const child = spawn(XRAY_BIN, ['run', '-c', configPath], {
    stdio: ['ignore', 'ignore', 'ignore'],
  });
  try {
    if (!(await waitForTcp(inboundPort, child))) return false;
    return await httpThroughPort(inboundPort);
  } finally {
    if (child.exitCode === null) child.kill('SIGTERM');
    await Promise.race([new Promise((resolve) => child.once('exit', resolve)), sleep(800)]);
    if (child.exitCode === null) child.kill('SIGKILL');
  }
}

function channelOutbounds(access, paths) {
  return {
    vless: vlessOutbound(access.vless.uuid, paths.vless, 'ws'),
    trojan: trojanOutbound(access.trojan.password, paths.trojan),
    xhttp: vlessOutbound(access.vless.uuid, paths.xhttp, 'xhttp'),
  };
}

async function assertAllChannels(state, access, paths, expected) {
  const outbounds = channelOutbounds(access, paths);
  for (const [channel, outbound] of Object.entries(outbounds)) {
    const connected = await xrayConnect(state, channel, outbound);
    assert(connected === expected, `${channel} expected ${expected ? 'connect' : 'deny'}`);
  }
}

async function userRecord(auth, id) {
  const { response, body } = await adminJson(auth, `/api/users/${id}`);
  assert(response.ok && body?.user, `user read failed: ${response.status}`);
  return body.user;
}

async function patchUser(auth, user, patch) {
  const { response, body } = await adminJson(auth, `/api/users/${user.id}`, {
    method: 'PATCH',
    body: { version: user.version, ...patch },
  });
  assert(response.ok && body?.user, `user patch failed: ${response.status}`);
  return body.user;
}

async function accessRecord(auth, id) {
  const { response, body } = await adminJson(auth, `/api/users/${id}/access`);
  assert(response.ok && body?.access, `user access failed: ${response.status}`);
  return body.access;
}

async function waitForUsage(auth, id, minimumBytes = 1) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const { response, body } = await adminJson(auth, `/api/users/${id}/usage?days=1`);
    assert(response.ok, `usage read failed: ${response.status}`);
    const total = (body.usage ?? []).reduce((sum, row) => sum + Number(row.totalBytes || 0), 0);
    if (total >= minimumBytes) return total;
    await sleep(150);
  }
  throw new Error(`usage did not reach ${minimumBytes}`);
}

async function subscriptionStatus(url) {
  const response = await fetch(`${url}?format=links`);
  if (response.ok) await response.text();
  return response.status;
}

async function runFlow(state) {
  const owner = await setupOwner();
  const ownerLinks = parseOwnerLinks(owner);
  const paths = {
    vless: ownerLinks.vless.searchParams.get('path'),
    trojan: ownerLinks.trojan.searchParams.get('path'),
    xhttp: ownerLinks.xhttp.searchParams.get('path'),
  };
  assert(paths.vless && paths.trojan && paths.xhttp, 'protocol paths missing');
  const auth = await loginAdmin();

  const created = await adminJson(auth, '/api/users', {
    method: 'POST',
    body: {
      name: 'e2e-user',
      enabled: true,
      quotaBytes: 64 * 1024 * 1024,
      dailyQuotaBytes: null,
      expiresAt: Date.now() + 86_400_000,
      allowVless: true,
      allowTrojan: true,
      allowXhttp: true,
      notes: 'phase-a-local-e2e',
    },
  });
  assert(created.response.status === 201 && created.body?.user, 'user create failed');
  let user = created.body.user;
  const userId = user.id;
  console.log(`PASS user-created id=${userId}`);

  let userAccess = await accessRecord(auth, userId);
  const privateSub = await fetch(`${userAccess.subscriptionUrl}?format=links`);
  assert(privateSub.status === 200, 'private subscription did not return 200');
  const privateLinks = await privateSub.text();
  assert(
    privateLinks.includes(userAccess.vless.uuid),
    'private subscription has wrong VLESS identity',
  );
  assert(
    privateLinks.split('\n').filter(Boolean).length === 3,
    'private subscription missing channels',
  );

  await assertAllChannels(state, userAccess, paths, true);
  const initialUsage = await waitForUsage(auth, userId, 1);
  console.log(`PASS initial-tunnels usage=${initialUsage}`);

  user = await userRecord(auth, userId);
  user = await patchUser(auth, user, { enabled: false });
  assert(
    (await subscriptionStatus(userAccess.subscriptionUrl)) === 404,
    'paused subscription remained valid',
  );
  await assertAllChannels(state, userAccess, paths, false);
  console.log('PASS pause-denial channels=3');

  await patchUser(auth, user, { enabled: true });
  assert(
    (await subscriptionStatus(userAccess.subscriptionUrl)) === 200,
    'resumed subscription did not recover',
  );
  await assertAllChannels(state, userAccess, paths, true);
  console.log('PASS resume channels=3');

  user = await userRecord(auth, userId);
  const quotaTarget = user.totalUsedBytes + 1;
  user = await patchUser(auth, user, { quotaBytes: quotaTarget });
  const beforeExhaust = user.totalUsedBytes;
  const quotaProbe = channelOutbounds(userAccess, paths).vless;
  assert(
    await xrayConnect(state, 'quota-probe', quotaProbe),
    'quota probe should start below quota',
  );
  await waitForUsage(auth, userId, beforeExhaust + 1);
  user = await userRecord(auth, userId);
  assert(user.totalUsedBytes >= quotaTarget, 'quota checkpoint did not exhaust total quota');
  assert(
    (await subscriptionStatus(userAccess.subscriptionUrl)) === 404,
    'exhausted subscription remained valid',
  );
  await assertAllChannels(state, userAccess, paths, false);
  console.log(`PASS quota-denial used=${user.totalUsedBytes}`);

  await patchUser(auth, user, { quotaBytes: user.totalUsedBytes + 64 * 1024 * 1024 });
  assert(
    (await subscriptionStatus(userAccess.subscriptionUrl)) === 200,
    'quota increase did not restore access',
  );
  assert(
    await xrayConnect(state, 'quota-restored', channelOutbounds(userAccess, paths).vless),
    'quota increase did not restore VLESS',
  );
  console.log('PASS quota-restore');

  const oldSubscriptionUrl = userAccess.subscriptionUrl;
  const rotatedSub = await adminJson(auth, `/api/users/${userId}/rotate-subscription`, {
    method: 'POST',
  });
  assert(rotatedSub.response.ok, 'subscription rotation failed');
  userAccess = await accessRecord(auth, userId);
  assert(userAccess.subscriptionUrl !== oldSubscriptionUrl, 'subscription URL did not rotate');
  assert(
    (await subscriptionStatus(oldSubscriptionUrl)) === 404,
    'old subscription URL remained valid',
  );
  assert(
    (await subscriptionStatus(userAccess.subscriptionUrl)) === 200,
    'new subscription URL failed',
  );
  console.log('PASS subscription-rotation');

  const oldAccess = userAccess;
  const rotatedCredentials = await adminJson(auth, `/api/users/${userId}/rotate-credentials`, {
    method: 'POST',
    body: { protocol: 'all' },
  });
  assert(rotatedCredentials.response.ok, 'credential rotation failed');
  userAccess = await accessRecord(auth, userId);
  assert(userAccess.vless.uuid !== oldAccess.vless.uuid, 'VLESS credential did not rotate');
  assert(
    userAccess.trojan.password !== oldAccess.trojan.password,
    'Trojan credential did not rotate',
  );
  await assertAllChannels(state, oldAccess, paths, false);
  await assertAllChannels(state, userAccess, paths, true);
  console.log('PASS credential-rotation channels=3');

  const ownerAccess = {
    vless: { uuid: ownerLinks.vless.username },
    trojan: { password: decodeURIComponent(ownerLinks.trojan.username) },
  };
  const ownerSubscriptionPath = new URL(owner.subscriptionUrl).pathname;
  assert(
    (await subscriptionStatus(`${base}${ownerSubscriptionPath}`)) === 200,
    'legacy owner subscription failed',
  );
  await assertAllChannels(state, ownerAccess, paths, true);
  console.log('PASS legacy-owner-compat channels=3');
  console.log(`PASS phase-a-e2e id=${userId} channels=3`);
}

async function main() {
  await ensureXray();
  const state = await mkdtemp(join(tmpdir(), 'tn-phase-a-e2e-'));
  workerPort = await freePort();
  base = `http://127.0.0.1:${workerPort}`;
  const worker = spawn(
    process.execPath,
    [
      './node_modules/wrangler/bin/wrangler.js',
      'dev',
      '--local',
      '--ip',
      '127.0.0.1',
      '--port',
      String(workerPort),
      '--persist-to',
      state,
      '--var',
      `ADMIN_PASSWORD:${ADMIN_PASSWORD}`,
      '--var',
      `INSTALL_GENERATION:${INSTALL_GENERATION}`,
    ],
    { cwd: new URL('..', import.meta.url), stdio: ['ignore', 'pipe', 'pipe'], detached: true },
  );
  let logs = '';
  worker.stdout.on('data', (chunk) => {
    logs = `${logs}${chunk}`.slice(-6000);
  });
  worker.stderr.on('data', (chunk) => {
    logs = `${logs}${chunk}`.slice(-6000);
  });

  try {
    await waitForWorker();
    await runFlow(state);
  } catch (error) {
    const safeLogs = logs
      .replaceAll(ADMIN_PASSWORD, '[redacted-admin]')
      .replace(/\/sub\/[A-Za-z0-9_-]{12,}/g, '/sub/[redacted-subscription]')
      .replace(/[A-Fa-f0-9]{56}/g, '[redacted-sha224]');
    console.error(safeLogs);
    throw error;
  } finally {
    try {
      process.kill(-worker.pid, 'SIGTERM');
    } catch {
      /* already stopped */
    }
    await sleep(500);
    await rm(state, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error?.stack ?? error);
  process.exitCode = 1;
});
