import type { Env } from './config/model';
import { loadProtocolConfig, publicProtocolStatus } from './config/store';
import { createXhttpDiagnostics, type XhttpDiagnostics } from './observability/xhttpDiagnostics';
import {
  handleAdminApiSetup,
  handleSetupForm,
  javascriptResponse,
  publicPanelResponse,
} from './panel';
import { handleSubscriptionRoute } from './routes/subscription';
import { handleWebSocketRoute } from './routes/ws';
import { handleXhttpRoute } from './routes/xhttp';

const VERSION = '0.1.0';

type FetchContext = {
  waitUntil(promise: Promise<void>): void;
};

const diagnosticsByKv = new WeakMap<object, XhttpDiagnostics>();

function diagnosticsFor(env: Env): XhttpDiagnostics {
  const existing = diagnosticsByKv.get(env.C as unknown as object);
  if (existing) return existing;
  const created = createXhttpDiagnostics(env.C);
  diagnosticsByKv.set(env.C as unknown as object, created);
  return created;
}

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  });

const methodNotAllowed = () => json({ ok: false, error: 'method-not-allowed' }, 405);
export default {
  async fetch(request: Request, env: Env, ctx?: FetchContext): Promise<Response> {
    const url = new URL(request.url);
    let protocolConfig;
    try {
      protocolConfig = await loadProtocolConfig(env);
    } catch {
      return json({ ok: false, error: 'invalid-server-config' }, 500);
    }

    const wsResponse = await handleWebSocketRoute(request, protocolConfig);
    if (wsResponse) return wsResponse;
    const diagnostics = diagnosticsFor(env);
    const xhttpResponse = await handleXhttpRoute(request, protocolConfig, {
      onAttempt: (status) => {
        diagnostics.record(status);
        const flush = diagnostics.flushIfNeeded();
        if (ctx?.waitUntil) ctx.waitUntil(flush);
      },
    });
    if (xhttpResponse) return xhttpResponse;
    const subscriptionResponse = await handleSubscriptionRoute(request, protocolConfig);
    if (subscriptionResponse) return subscriptionResponse;

    if (url.pathname === '/panel.js') {
      return request.method === 'GET' ? javascriptResponse() : methodNotAllowed();
    }
    if (url.pathname === '/setup') {
      return request.method === 'POST' ? handleSetupForm(request, env) : methodNotAllowed();
    }
    if (url.pathname === '/api/setup') {
      return request.method === 'POST' ? handleAdminApiSetup(request, env) : methodNotAllowed();
    }
    if (url.pathname === '/health') {
      return request.method === 'GET' ? json({ ok: true, version: VERSION }) : methodNotAllowed();
    }
    if (url.pathname === '/api/status') {
      if (request.method !== 'GET') return methodNotAllowed();
      return json({
        ok: true,
        version: VERSION,
        kv: true,
        protocols: protocolConfig ? publicProtocolStatus(protocolConfig) : 'setup-required',
        xhttpDiag: await diagnostics.snapshot(),
      });
    }
    if (url.pathname === '/') {
      return request.method === 'GET' ? publicPanelResponse(protocolConfig) : methodNotAllowed();
    }
    return json({ ok: false, error: 'not-found' }, 404);
  },
};
