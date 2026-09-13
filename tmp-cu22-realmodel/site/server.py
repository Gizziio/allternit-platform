#!/usr/bin/env python3
"""cu22 campaign — local multi-page test site with server-side state.

Serves the five task-shape pages and records every submission in
state.json so the campaign harness has ground truth independent of
which Chrome instance (adapter vs batch sidecar) performed the actions.

Pages:
  /index.html          — landing with links to all task starts
  /form.html           — task 1: form fill (name, email, submit)
  /nav.html            — task 2: multi-click navigation (nav2, nav3, finish)
  /select.html         — task 3: select + submit
  /extract.html        — task 4: extract code, then type it and submit
  /branch.html         — task 5: conditional branch (?weather=rain|sun)

Every terminal action POSTs to /submit and lands on /done.html.
Submissions append {task, fields, ts} to state.json next to this file.
"""

import json
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).parent
STATE = ROOT / "state.json"


def page(title: str, body: str) -> bytes:
    return f"""<!doctype html>
<html><head><title>{title}</title>
<style>body{{font-family:-apple-system,sans-serif;max-width:640px;margin:40px auto;color:#111}}
button,select,input{{font-size:16px;padding:8px;margin:4px 0}}
code{{background:#eee;padding:2px 6px}}</style></head>
<body><h1>{title}</h1>{body}</body></html>""".encode()


PAGES = {}


def build_pages():
    PAGES["/index.html"] = page("Campaign Home", """
<p>Allternit cu22 batch-validation test site.</p>
<ul>
<li><a href="/form.html">Task 1 — form fill</a></li>
<li><a href="/nav.html">Task 2 — multi-click navigation</a></li>
<li><a href="/select.html">Task 3 — select + submit</a></li>
<li><a href="/extract.html">Task 4 — extract then act</a></li>
<li><a href="/branch.html?weather=rain">Task 5 — conditional branch (rain)</a></li>
<li><a href="/branch.html?weather=sun">Task 5 — conditional branch (sun)</a></li>
</ul>""")
    PAGES["/form.html"] = page("Task 1 — Registration Form", """
<form id="regform" onsubmit="event.preventDefault();fetch('/submit?task=form',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:document.querySelector('#name').value,email:document.querySelector('#email').value})}).then(()=>location='/done.html')">
<input id="name" placeholder="Full name" />
<input id="email" placeholder="Email address" />
<button id="submit" type="submit">Register</button>
</form>""")
    PAGES["/nav.html"] = page("Task 2 — Step 1 of 3", """
<p>You are on step 1.</p><a id="next" href="/nav2.html">Go to step 2</a>""")
    PAGES["/nav2.html"] = page("Task 2 — Step 2 of 3", """
<p>You are on step 2.</p><a id="next" href="/nav3.html">Go to step 3</a>""")
    PAGES["/nav3.html"] = page("Task 2 — Step 3 of 3", """
<p>You are on the final step.</p>
<button id="finish" onclick="fetch('/submit?task=nav',{method:'POST'}).then(()=>location='/done.html')">Finish navigation</button>""")
    PAGES["/select.html"] = page("Task 3 — Plan Picker", """
<form id="planform" onsubmit="event.preventDefault();fetch('/submit?task=select',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({plan:document.querySelector('#plan').value})}).then(()=>location='/done.html')">
<select id="plan">
<option value="">Choose a plan…</option>
<option value="basic">basic</option>
<option value="pro">pro</option>
<option value="enterprise">enterprise</option>
</select>
<button id="submit" type="submit">Subscribe</button>
</form>""")
    PAGES["/extract.html"] = page("Task 4 — Verification Code", """
<p>Your one-time code is <code id="code">AUTH-7391</code>.</p>
<p>Type it into the box and press Enter to verify.</p>
<form id="verifyform" onsubmit="event.preventDefault();fetch('/submit?task=extract',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code:document.querySelector('#entry').value})}).then(()=>location='/done.html')">
<input id="entry" placeholder="code" />
<button id="enter" type="submit">Verify</button>
</form>""")
    PAGES["/done.html"] = page("Done", "<p>Task recorded. Thank you.</p>")


def branch_page(weather: str) -> bytes:
    if weather == "rain":
        body = """<p id="status">weather: rainy</p>
<button id="umbrella" onclick="fetch('/submit?task=branch',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({choice:'umbrella'})}).then(()=>location='/done.html')">Take umbrella</button>
<button id="sunglasses" onclick="fetch('/submit?task=branch',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({choice:'sunglasses'})}).then(()=>location='/done.html')">Take sunglasses</button>"""
    else:
        body = """<p id="status">weather: sunny</p>
<button id="sunglasses" onclick="fetch('/submit?task=branch',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({choice:'sunglasses'})}).then(()=>location='/done.html')">Take sunglasses</button>
<button id="umbrella" onclick="fetch('/submit?task=branch',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({choice:'umbrella'})}).then(()=>location='/done.html')">Take umbrella</button>"""
    return page("Task 5 — Weather Branch", body)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _send(self, body: bytes, ctype="text/html"):
        self.send_response(200)
        self.send_header("content-type", ctype)
        self.send_header("content-length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        url = urlparse(self.path)
        if url.path == "/state.json":
            body = STATE.read_text() if STATE.exists() else "[]"
            return self._send(body.encode(), "application/json")
        if url.path == "/":
            url = url._replace(path="/index.html")
        if url.path == "/branch.html":
            weather = parse_qs(url.query).get("weather", ["rain"])[0]
            return self._send(branch_page(weather))
        body = PAGES.get(url.path)
        if body is None:
            return self._send(page("404", f"<p>no such page: {url.path}</p>"))
        self._send(body)

    def do_POST(self):
        url = urlparse(self.path)
        if not url.path.startswith("/submit"):
            return self._send(b"{}", "application/json")
        length = int(self.headers.get("content-length") or 0)
        try:
            fields = json.loads(self.rfile.read(length) or b"{}")
        except Exception:
            fields = {}
        task = parse_qs(url.query).get("task", ["unknown"])[0]
        entry = {"task": task, "fields": fields, "ts": time.time()}
        state = json.loads(STATE.read_text()) if STATE.exists() else []
        state.append(entry)
        STATE.write_text(json.dumps(state, indent=2))
        self._send(json.dumps({"recorded": entry}), "application/json")


def reset_state():
    STATE.write_text("[]")


if __name__ == "__main__":
    build_pages()
    port = int(__import__("os").environ.get("CU22_SITE_PORT", "18080"))
    reset_state()
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
