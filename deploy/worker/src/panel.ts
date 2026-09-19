import { renderSVG } from 'uqr';
import { verifyAdminPassword } from './config/admin';
import type { Env, ProtocolConfig } from './config/model';
import { ensureProtocolConfig } from './config/store';
import {
  buildNamedProtocolLinks,
  buildProtocolLinks,
  buildSubscriptionUrl,
} from './subscription/links';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function page(body: string, title = 'Tehran Network Edge Panel'): string {
  return `<!doctype html><html lang="fa" dir="rtl"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark"><title>${escapeHtml(title)}</title>
<link rel="icon" href="data:,"><link rel="preload" href="/panel.js" as="script">
<style>
:root{font-family:Inter,system-ui,Tahoma,sans-serif;color:#eef2ff;background:#050816}*{box-sizing:border-box}
body{margin:0;min-height:100vh;background:radial-gradient(circle at 10% 10%,#7c3aed55,transparent 35%),radial-gradient(circle at 90% 10%,#06b6d455,transparent 30%),#050816}
main{max-width:1160px;margin:auto;padding:30px 18px 70px}.top{display:flex;justify-content:space-between;gap:12px;align-items:center}.brand{font-weight:900;letter-spacing:.04em}.pill{border:1px solid #22c55e66;background:#22c55e18;color:#86efac;padding:8px 13px;border-radius:999px}
.hero{margin-top:34px;padding:clamp(22px,5vw,46px);border:1px solid #ffffff1f;border-radius:30px;background:#0b1026dd;box-shadow:0 35px 100px #0009}h1{font-size:clamp(32px,6vw,68px);margin:0;background:linear-gradient(90deg,#67e8f9,#a78bfa,#f472b6);-webkit-background-clip:text;color:transparent}p{line-height:1.9;color:#cbd5e1}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:15px}.card{padding:20px;border-radius:20px;background:#111936;border:1px solid #ffffff18;overflow:hidden}.card b{display:block;margin-bottom:9px}.field{display:flex;gap:9px;margin-top:12px}.field input{min-width:0;flex:1;background:#050816;border:1px solid #ffffff24;color:#dbeafe;border-radius:12px;padding:12px;direction:ltr}.field button,.primary{cursor:pointer;border:0;border-radius:12px;padding:12px 16px;font-weight:800;background:linear-gradient(90deg,#22d3ee,#8b5cf6);color:#fff}.login{display:grid;grid-template-columns:1fr auto;gap:10px;max-width:680px}.login input{background:#070b1c;border:1px solid #ffffff28;border-radius:14px;padding:14px;color:#fff}.qr{background:#fff;padding:10px;border-radius:16px;margin-top:13px;max-width:180px;direction:ltr}.qr svg{display:block;width:100%;height:auto}.notice{padding:15px;border-radius:14px;background:#f59e0b18;border:1px solid #f59e0b55;color:#fde68a}.error{background:#ef44441c;border-color:#ef444466;color:#fecaca}.muted{font-size:13px;color:#94a3b8;direction:ltr;text-align:left}@media(max-width:800px){.grid{grid-template-columns:1fr}.login{grid-template-columns:1fr}.top{align-items:flex-start;flex-direction:column}}
</style><script src="/panel.js" defer></script></head><body><main>${body}</main></body></html>`;
}
function top(status: string) {
  return `<div class="top"><div class="brand">TEHRAN NETWORK · EDGE PANEL</div><span class="pill">● ${escapeHtml(status)}</span></div>`;
}

export function renderPublicPanel(config: ProtocolConfig | null, error = ''): string {
  const state = config ? 'Protocols Ready' : 'Setup Required';
  const message = config
    ? 'هسته اتصال فعال است. برای مشاهده کانفیگ‌ها و لینک اشتراک، رمز مدیریت ADMIN_PASSWORD را وارد کنید.'
    : 'نصب Cloudflare انجام شده. برای ساخت امن UUID، رمز Trojan و Subscription Token، همان ADMIN_PASSWORD زمان Deploy را وارد کنید.';
  return page(`${top(state)}<section class="hero">
<div class="muted">Cloudflare Worker · No VPS</div><h1>Tehran Network</h1>
<p>${message}</p>${error ? `<div class="notice error">${escapeHtml(error)}</div>` : ''}
<form class="login" method="post" action="/setup" autocomplete="off">
<input name="adminPassword" type="password" minlength="16" required autocomplete="current-password" placeholder="ADMIN_PASSWORD">
<button class="primary" type="submit">باز کردن پنل / Open Panel</button></form>
<div class="grid" style="margin-top:24px">
<div class="card"><b>VLESS · WebSocket</b><span>${config?.vless.enabled ? 'فعال / Active' : 'پس از Setup فعال می‌شود'}</span></div>
<div class="card"><b>Trojan · WebSocket</b><span>${config?.trojan.enabled ? 'فعال / Active' : 'پس از Setup فعال می‌شود'}</span></div>
<div class="card"><b>VLESS · XHTTP</b><span>${config?.xhttp.enabled ? 'stream-one Active' : 'پس از Setup فعال می‌شود'}</span></div>
</div></section>`);
}

function configCard(title: string, link: string, id: string): string {
  const safe = escapeHtml(link);
  const qr = renderSVG(link, { ecc: 'M', border: 2 });
  return `<div class="card"><b>${escapeHtml(title)}</b><div class="field">
<input id="${id}" readonly value="${safe}"><button type="button" data-copy-target="${id}">Copy</button></div>
<div class="qr">${qr}</div></div>`;
}
export function renderOwnerPanel(config: ProtocolConfig, host: string): string {
  const links = buildNamedProtocolLinks(config, host);
  const subscriptionUrl = buildSubscriptionUrl(config, host);
  const cards = [
    links.vlessWs ? configCard('VLESS · WebSocket · TLS', links.vlessWs, 'vless-ws') : '',
    links.trojanWs ? configCard('Trojan · WebSocket · TLS', links.trojanWs, 'trojan-ws') : '',
    links.vlessXhttp
      ? configCard('VLESS · XHTTP · stream-one', links.vlessXhttp, 'vless-xhttp')
      : '',
  ].join('');
  return page(`${top('Ready to Connect')}<section class="hero">
<div class="muted">Owner view · credentials are never shown on the public page</div>
<h1>اتصال آماده است.</h1><p>یکی از کانفیگ‌ها را Copy یا QR را Scan کنید. برای کلاینت‌های سازگار می‌توانید لینک Subscription را وارد کنید.</p>
<div class="grid">${cards}</div>
<div class="card" style="margin-top:15px"><b>Subscription · Universal</b><div class="field">
<input id="subscription-url" readonly value="${escapeHtml(subscriptionUrl)}"><button type="button" data-copy-target="subscription-url">Copy</button></div>
<div class="qr">${renderSVG(subscriptionUrl, { ecc: 'M', border: 2 })}</div>
<p class="muted">Formats: base64 · links · singbox · mihomo</p></div>
<div class="notice" style="margin-top:15px">رمز مدیریت، UUID، رمز Trojan و Subscription Token مستقل هستند. این صفحه فقط بعد از احراز ADMIN_PASSWORD نمایش داده می‌شود.</div>
</section>`);
}

function htmlResponse(html: string, status = 200): Response {
  return new Response(html, {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
      'content-security-policy':
        "default-src 'none'; style-src 'unsafe-inline'; script-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
      'referrer-policy': 'no-referrer',
      'x-content-type-options': 'nosniff',
    },
  });
}
export async function handleSetupForm(request: Request, env: Env): Promise<Response> {
  let candidate: string;
  try {
    const form = await request.formData();
    candidate = String(form.get('adminPassword') ?? '');
  } catch {
    return htmlResponse(renderPublicPanel(null, 'فرم نامعتبر است / Invalid form'), 400);
  }
  if (!(await verifyAdminPassword(candidate, env.ADMIN_PASSWORD))) {
    return htmlResponse(
      renderPublicPanel(null, 'رمز مدیریت صحیح نیست / Invalid admin password'),
      401,
    );
  }
  const config = await ensureProtocolConfig(env);
  return htmlResponse(renderOwnerPanel(config, new URL(request.url).hostname));
}

function bearer(request: Request): string {
  const value = request.headers.get('authorization') ?? '';
  return value.startsWith('Bearer ') ? value.slice(7) : '';
}

export async function handleAdminApiSetup(request: Request, env: Env): Promise<Response> {
  if (!(await verifyAdminPassword(bearer(request), env.ADMIN_PASSWORD))) {
    return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    });
  }
  const config = await ensureProtocolConfig(env);
  const host = new URL(request.url).hostname;
  return new Response(
    JSON.stringify({
      ok: true,
      links: buildProtocolLinks(config, host),
      subscriptionUrl: buildSubscriptionUrl(config, host),
      protocols: {
        vless: { enabled: config.vless.enabled, path: config.vless.path },
        trojan: { enabled: config.trojan.enabled, path: config.trojan.path },
        xhttp: { enabled: config.xhttp.enabled, path: config.xhttp.path, mode: config.xhttp.mode },
      },
    }),
    { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } },
  );
}
export function panelScript(): string {
  return `document.addEventListener('click',async(e)=>{const b=e.target.closest('[data-copy-target]');if(!b)return;const el=document.getElementById(b.dataset.copyTarget);if(!el)return;try{await navigator.clipboard.writeText(el.value);const old=b.textContent;b.textContent='Copied';setTimeout(()=>b.textContent=old,1200)}catch{el.select();document.execCommand('copy')}});`;
}

export function javascriptResponse(): Response {
  return new Response(panelScript(), {
    headers: {
      'content-type': 'text/javascript; charset=utf-8',
      'cache-control': 'public, max-age=3600',
      'x-content-type-options': 'nosniff',
    },
  });
}
export function publicPanelResponse(config: ProtocolConfig | null): Response {
  return htmlResponse(renderPublicPanel(config));
}
