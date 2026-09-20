#!/usr/bin/env python3
"""Mock Cloudflare API + panel endpoints for testing install.sh end-to-end.

Listens on 127.0.0.1:<port> and answers the exact subset of endpoints the
easy installer uses. GET /_debug dumps the captured upload for assertions.
"""
import base64
import json
import re
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ACC1 = "a" * 31 + "1"  # 32 hex chars
ACC2 = "b" * 31 + "2"
KV_ID = "c" * 31 + "3"
SUBDOMAIN = "test-sub"
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8899

state = {
    "kv_created": False,
    "last_upload": None,
    "subdomain_created": False,
}


def envelope(result, success=True, total_pages=1):
    return json.dumps({
        "success": success,
        "result": result,
        "errors": [] if success else [{"code": 10000, "message": "mock-error"}],
        "messages": [],
        "result_info": {"page": 1, "total_pages": total_pages},
    }, separators=(",", ":"))


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def _json(self, body, status=200):
        raw = body.encode() if isinstance(body, str) else (
            body if isinstance(body, bytes) else json.dumps(body).encode()
        )
        self.send_response(status)
        self.send_header("content-type", "application/json")
        self.send_header("content-length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def _auth(self):
        return (self.headers.get("authorization") or "").startswith("Bearer ")

    def do_OPTIONS(self):
        self._json(envelope(None))

    def do_GET(self):
        path = self.path.split("?")[0]
        if path == "/client/v4/user/tokens/verify":
            if not self._auth():
                return self._json(envelope(None, success=False), 401)
            return self._json(envelope({"id": "t", "status": "active"}))
        if path == "/client/v4/accounts":
            return self._json(envelope([
                {"id": ACC1, "name": "Tehran Network Main"},
                {"id": ACC2, "name": "Test Account Two"},
            ]))
        if re.fullmatch(r"/client/v4/accounts/[0-9a-f]{32}/workers/subdomain", path):
            if state["subdomain_created"]:
                return self._json(envelope({"subdomain": SUBDOMAIN}))
            self.send_response(404)
            self.send_header("content-length", "0")
            self.end_headers()
            return
        if re.fullmatch(r"/client/v4/accounts/[0-9a-f]{32}/storage/kv/namespaces", path):
            result = [{"id": KV_ID, "title": "tehran-network-edge-config"}] if state["kv_created"] else []
            return self._json(envelope(result))
        if path == "/health":
            return self._json({"ok": True, "version": "0.3.0"})
        if path == "/_debug":
            return self._json(state)
        return self._json(envelope(None, success=False), 404)

    def do_POST(self):
        path = self.path.split("?")[0]
        length = int(self.headers.get("content-length") or 0)
        body = self.rfile.read(length).decode("utf-8", "replace")
        if re.fullmatch(r"/client/v4/accounts/[0-9a-f]{32}/storage/kv/namespaces", path):
            state["kv_created"] = True
            return self._json(envelope({"id": KV_ID, "title": json.loads(body)["title"]}))
        if re.fullmatch(r"/client/v4/accounts/[0-9a-f]{32}/workers/scripts/[^/]+/subdomain", path):
            return self._json(envelope({"enabled": True}))
        if path == "/api/setup":
            if self.headers.get("authorization") != "Bearer test-admin-password-1234":
                return self._json({"ok": False, "error": "unauthorized"}, 401)
            host = "tehran-network-edge." + SUBDOMAIN + ".workers.dev"
            return self._json(json.dumps({
                "ok": True,
                "links": {
                    "vlessWs": "vless://11111111-2222-3333-4444-555555555555@" + host + ":443?path=%2Fvless&type=ws&security=tls#VLESS-WS",
                    "trojanWs": "trojan://trojanpass@" + host + ":443?path=%2Ftrojan&type=ws&security=tls#Trojan-WS",
                    "vlessXhttp": "vless://11111111-2222-3333-4444-555555555555@" + host + ":443?path=%2Fxhttp&security=tls&extra=%7B%22noGRPCHeader%22%3Atrue%7D#XHTTP",
                },
                "subscriptionUrl": "https://" + host + "/sub/" + "d" * 48,
            }, separators=(",", ":")))
        return self._json(envelope(None, success=False), 404)

    def do_PUT(self):
        path = self.path.split("?")[0]
        length = int(self.headers.get("content-length") or 0)
        body = self.rfile.read(length)
        if re.fullmatch(r"/client/v4/accounts/[0-9a-f]{32}/workers/subdomain", path):
            state["subdomain_created"] = True
            return self._json(envelope({"subdomain": SUBDOMAIN}))
        if re.fullmatch(r"/client/v4/accounts/[0-9a-f]{32}/workers/scripts/[^/]+", path):
            ctype = self.headers.get("content-type") or ""
            metadata = None
            worker_bytes = b""
            if "multipart/form-data" in ctype and "boundary=" in ctype:
                boundary = ctype.split("boundary=")[1].split(";")[0].strip().strip('"').encode()
                for part in body.split(b"--" + boundary):
                    if b"name=\"metadata\"" in part:
                        payload = part.split(b"\r\n\r\n", 1)
                        if len(payload) == 2:
                            metadata = json.loads(payload[1].rsplit(b"\r\n", 1)[0])
                    if b"name=\"worker.mjs\"" in part:
                        payload = part.split(b"\r\n\r\n", 1)
                        if len(payload) == 2:
                            worker_bytes = payload[1].rsplit(b"\r\n", 1)[0]
            state["last_upload"] = {
                "metadata": metadata,
                "worker_sha256_first16": base64.b16encode(
                    __import__("hashlib").sha256(worker_bytes).digest()
                ).decode()[:16].lower(),
                "worker_bytes": len(worker_bytes),
            }
            return self._json(envelope({"id": "tehran-network-edge", "created_on": "now"}))
        return self._json(envelope(None, success=False), 404)


if __name__ == "__main__":
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print(f"mock-cloudflare-api listening on http://127.0.0.1:{PORT}", flush=True)
    server.serve_forever()
