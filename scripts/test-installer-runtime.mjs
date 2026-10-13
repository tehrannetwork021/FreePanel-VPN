import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { request } from 'node:http';
import net from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import process from 'node:process';
import console from 'node:console';
import { URL } from 'node:url';
import { stopTestProcess } from '../deploy/worker/test/stop-process.mjs';

const { Response, setTimeout } = globalThis;
const worker = resolve(import.meta.dirname, '../apps/installer-worker');
const config = process.argv.includes('--staging') ? 'wrangler.staging.jsonc' : 'wrangler.jsonc';
const state = await mkdtemp(join(tmpdir(), 'tehran-installer-runtime-'));
const port = await new Promise((resolvePort, reject) => {
  const server = net.createServer();
  server.once('error', reject);
  server.listen(0, '127.0.0.1', () => {
    const port = server.address().port;
    server.close((error) => (error ? reject(error) : resolvePort(port)));
  });
});
const base = `http://127.0.0.1:${port}`;
const child = spawn(
  process.execPath,
  [
    './node_modules/wrangler/bin/wrangler.js',
    'dev',
    '--local',
    '--config',
    config,
    '--port',
    String(port),
    '--persist-to',
    state,
  ],
  {
    cwd: worker,
    env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
    windowsHide: true,
    detached: process.platform !== 'win32',
    stdio: ['ignore', 'pipe', 'pipe'],
  },
);
let output = '';
child.stdout.on('data', (data) => (output += data));
child.stderr.on('data', (data) => (output += data));
// Native HTTP preserves Sec-Fetch-Mode; Node fetch overwrites it with "cors".
const get = (path, options = {}) =>
  new Promise((resolveResponse, reject) => {
    const { body, ...init } = options;
    const req = request(new URL(path, base), init, (res) => {
      const chunks = [];
      res.on('data', (data) => chunks.push(data));
      res.once('error', reject);
      res.once('end', () =>
        resolveResponse(
          new Response(Buffer.concat(chunks), {
            status: res.statusCode,
            headers: res.headers,
          }),
        ),
      );
    });
    req.setTimeout(2000, () => req.destroy(new Error('runtime request timed out')));
    req.once('error', reject);
    req.end(body);
  });
try {
  let ready = false;
  for (let attempt = 0; attempt < 80; attempt++) {
    try {
      if ((await get('/')).ok) {
        ready = true;
        break;
      }
    } catch {
      // Local workerd is starting; no external account or token is used.
    }
    if (child.exitCode !== null) break;
    await new Promise((done) => setTimeout(done, 250));
  }
  assert(ready, 'installer runtime did not become ready');
  const manifest = JSON.parse(
    await readFile(
      resolve(worker, '../../dist/installer-artifacts/edge-worker-manifest.json'),
      'utf8',
    ),
  );
  const navigation = { headers: { 'sec-fetch-mode': 'navigate', accept: 'text/html' } };
  for (const options of [{}, navigation]) {
    const response = await get('/api/health', options);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /^application\/json/);
    assert.deepEqual(await response.json(), {
      ok: true,
      edgeVersion: manifest.version,
      edgeSha256: manifest.sha256,
      schemaVersion: 1,
    });
  }
  assert.equal((await get('/api/unknown', navigation)).status, 404);
  assert.equal((await get('/api/health', { method: 'POST' })).status, 405);
  assert.equal(
    (
      await get('/api/install', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: 'null',
      })
    ).status,
    400,
  );
  const ui = await get('/');
  assert.match(await ui.text(), /Tehran Network/);
  console.log(`PASS installer runtime (${config}): health JSON, navigation, API errors and UI`);
} catch (error) {
  console.error(output);
  throw error;
} finally {
  await stopTestProcess(child);
  await rm(state, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
}
