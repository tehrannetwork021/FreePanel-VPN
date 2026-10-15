import assert from 'node:assert/strict';
import console from 'node:console';
import { realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { build } from 'esbuild';

// Resolve through Wrangler's real pnpm location, without adding a duplicate runtime.
const require = createRequire(
  realpathSync(resolve('apps/installer-worker/node_modules/wrangler/package.json')),
);
const { Miniflare } = require('miniflare');
const { Response, Headers, URL } = globalThis;
const bundle = await build({
  stdin: {
    contents: `import {verifyApiToken,listAccounts} from './apps/installer-worker/src/cloudflare.ts';
import {defaultProvisionDeps} from './apps/installer-worker/src/provision.ts';
export default {async fetch(request) {
  try {
    const path=new URL(request.url).pathname;
    if(path==='/verify') await verifyApiToken('runtime-test-token');
    if(path==='/accounts') await listAccounts('runtime-test-token');
    if(path==='/health' && !(await defaultProvisionDeps.fetchHealth('https://panel.example')).ok) throw Error('health-failed');
    if(path==='/login' && !(await defaultProvisionDeps.verifyAdminLogin('https://panel.example','runtime-test-password'))) throw Error('login-failed');
    return Response.json({ok:true});
  } catch {return Response.json({ok:false},{status:502});}
}};`,
    resolveDir: resolve('.'),
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  platform: 'browser',
  write: false,
});
let redirect = false;
let calls = [];
const runtime = new Miniflare({
  telemetry: { enabled: false },
  workers: [
    {
      config: {
        name: 'installer-api-runtime',
        type: 'worker',
        compatibilityDate: '2026-09-19',
        manifest: {
          mainModule: 'index.js',
          modules: { 'index.js': { type: 'esm', contents: bundle.outputFiles[0].text } },
        },
      },
      dev: {
        outboundService: {
          type: 'fetcher',
          handler(request) {
            calls.push(request.url);
            const path = new URL(request.url).pathname;
            const body = path.endsWith('/verify')
              ? { success: true, result: { status: 'active' } }
              : path.endsWith('/accounts')
                ? { success: true, result: [] }
                : path.endsWith('/health')
                  ? { ok: true, version: '0.3.1', schemaVersion: 1, d1: true }
                  : { ok: true, expiresAt: Date.now() + 60_000 };
            const headers = new Headers({ 'content-type': 'application/json' });
            headers.append(
              'set-cookie',
              'tn_session=test-session; Secure; HttpOnly; SameSite=Strict; Path=/',
            );
            headers.append('set-cookie', 'tn_csrf=test-csrf; Secure; SameSite=Strict; Path=/');
            if (redirect) headers.set('location', 'https://unexpected.example/credential-sink');
            return new Response(JSON.stringify(body), { status: redirect ? 302 : 200, headers });
          },
        },
      },
    },
  ],
});
try {
  for (const path of ['/verify', '/accounts', '/health', '/login']) {
    calls = [];
    assert.equal(
      (await runtime.dispatchFetch(`http://runtime.test${path}`)).status,
      200,
      `${path}: real workerd rejected request`,
    );
    assert.equal(calls.length, 1, `${path}: upstream was never reached`);
  }
  redirect = true;
  for (const path of ['/verify', '/accounts', '/health', '/login']) {
    calls = [];
    assert.equal(
      (await runtime.dispatchFetch(`http://runtime.test${path}`)).status,
      502,
      `${path}: redirect was accepted`,
    );
    assert.equal(calls.length, 1, `${path}: redirect target was fetched`);
    assert(!calls.some((url) => url.includes('unexpected.example')));
  }
  console.log(
    'PASS real workerd: token, accounts, health and login reach upstream; redirects rejected without forwarding credentials',
  );
} finally {
  await runtime.dispose();
}
