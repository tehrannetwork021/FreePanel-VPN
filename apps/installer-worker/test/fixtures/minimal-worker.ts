// Routing diagnostic only. Deploy with the staging config; this is not an installer.
export default {
  fetch(request: Request): Response {
    const url = new URL(request.url);
    console.info('[installer-routing-probe]');
    if (request.method === 'GET' && url.pathname === '/api/health') {
      return Response.json({ ok: true, diagnostic: 'routing-only' });
    }
    return Response.json({ ok: false, code: 'diagnostic-only' }, { status: 503 });
  },
};
