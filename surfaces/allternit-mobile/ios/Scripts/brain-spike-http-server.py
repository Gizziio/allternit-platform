#!/usr/bin/env python3
"""D3 spike — local smart-HTTP git server with Basic auth (dev harness only).

The dev API's D2 git endpoints (127.0.0.1:8013) don't exist yet, so the
spike proves the HTTP+Basic path against this instead: a stdlib-only wrapper
around `git http-backend` that demands Basic credentials
(`allternit` / `allternit_git_…` token) before proxying.

TLS-less HTTP+Basic — what it proves: libgit2's HTTP transport, the
credential callback, clone/commit/push over smart-HTTP. What it does NOT
prove: TLS/certificate verification (see the httpsPublicClone leg for the
TLS signal).

Usage:
    ./brain-spike-http-server.py <project-root> [port]

Seed the project root first:
    git init --bare <project-root>/brain.git
    git -C <project-root>/brain.git config http.receivepack true
"""

import base64
import os
import subprocess
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PROJECT_ROOT = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else "/tmp/brain-spike-http")
PORT = int(sys.argv[2]) if len(sys.argv) > 2 else 8088
USERNAME = "allternit"
TOKEN = os.environ.get("BRAIN_SPIKE_TOKEN", "allternit_git_spike_token_123")


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def _authorized(self):
        auth = self.headers.get("Authorization", "")
        if not auth.startswith("Basic "):
            return False
        try:
            decoded = base64.b64decode(auth[6:]).decode()
        except Exception:
            return False
        user, _, password = decoded.partition(":")
        return user == USERNAME and password == TOKEN

    def _unauthorized(self):
        # Empty body + close: libgit2's bundled http-parser does not drain a
        # 401 body before reusing the connection for the authenticated retry,
        # so leftover bytes corrupt the next response ("invalid constant
        # string"). Keep the challenge minimal and drop the connection.
        self.send_response(401)
        self.send_header("WWW-Authenticate", 'Basic realm="brain"')
        self.send_header("Content-Length", "0")
        self.send_header("Connection", "close")
        self.end_headers()
        self.close_connection = True

    def _read_body(self):
        """Full request body — Content-Length or chunked (libgit2's send-pack
        POSTs come in chunked once they exceed its buffer)."""
        if "chunked" in (self.headers.get("Transfer-Encoding") or "").lower():
            chunks = []
            while True:
                size_line = self.rfile.readline().strip()
                size = int(size_line.split(b";")[0], 16)
                if size == 0:
                    # trailing headers / final CRLF
                    while True:
                        line = self.rfile.readline()
                        if line in (b"\r\n", b"\n", b""):
                            break
                    break
                chunks.append(self.rfile.read(size))
                self.rfile.read(2)  # CRLF after each chunk
            return b"".join(chunks)
        length = int(self.headers.get("Content-Length") or 0)
        return self.rfile.read(length) if length else None

    def _cgi(self):
        payload = self._read_body()
        env = dict(os.environ)
        env.update({
            "GIT_PROJECT_ROOT": PROJECT_ROOT,
            "GIT_HTTP_EXPORT_ALL": "1",
            "PATH_INFO": self.path.split("?", 1)[0],
            "REQUEST_METHOD": self.command,
            "QUERY_STRING": self.path.split("?", 1)[1] if "?" in self.path else "",
            "CONTENT_TYPE": self.headers.get("Content-Type", ""),
            "REMOTE_USER": USERNAME,
        })
        proc = subprocess.run(["git", "http-backend"], input=payload,
                              capture_output=True, env=env)
        raw = proc.stdout
        header_blob, sep, body = raw.partition(b"\r\n\r\n")
        if not sep:
            header_blob, _, body = raw.partition(b"\n\n")
        status = 200
        headers = {}
        for line in header_blob.replace(b"\r\n", b"\n").split(b"\n"):
            if not line.strip():
                continue
            key, _, value = line.partition(b":")
            key = key.decode().strip()
            value = value.decode().strip()
            if key.lower() == "status":
                status = int(value.split()[0])
            elif key.lower() != "content-length":
                headers[key] = value
        self.send_response(status)
        for key, value in headers.items():
            self.send_header(key, value)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Connection", "close")
        self.end_headers()
        self.wfile.write(body)
        self.close_connection = True

    def do_GET(self):
        if not self._authorized():
            return self._unauthorized()
        self._cgi()

    def do_POST(self):
        if not self._authorized():
            return self._unauthorized()
        self._cgi()

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    print(f"brain-spike git http server — root={PROJECT_ROOT} port={PORT} "
          f"(user={USERNAME}, token={'set' if TOKEN else 'unset'})", flush=True)
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
