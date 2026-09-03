import json, subprocess, uuid, hashlib, urllib.request, urllib.error

API = "http://localhost:8082"
PSQL = ["sudo", "-u", "postgres", "psql", "-d", "allternit", "-AtXc"]
failures = []

def psql(sql):
    out = subprocess.run(PSQL + [sql], capture_output=True, text=True)
    if out.returncode != 0:
        raise RuntimeError(out.stderr)
    return out.stdout.strip()

def seed(permissions):
    uid = f"scope_{uuid.uuid4().hex[:8]}"
    tok = f"scope-{uuid.uuid4()}"
    psql(f"INSERT INTO users (id,email,status) VALUES ('{uid}','{uid}@s.local','active') ON CONFLICT DO NOTHING")
    psql(f"INSERT INTO api_tokens (id,token_hash,name,user_id,permissions) VALUES "
         f"('tok-{uid}','{hashlib.md5(tok.encode()).hexdigest()}','scope','{uid}','{json.dumps(permissions)}')")
    return uid, tok

def call(method, path, tok, body=None):
    cmd = ["curl", "-s", "-o", "/dev/null", "-w", "%{http_code}", "-X", method, f"{API}{path}",
           "-H", f"Authorization: Bearer {tok}", "-H", "Content-Type: application/json"]
    if body: cmd += ["-d", json.dumps(body)]
    return int(subprocess.run(cmd, capture_output=True, text=True).stdout)

def check(name, got, want):
    ok = got == want
    print(("PASS" if ok else "FAIL"), name, f"({got}, want {want})")
    if not ok: failures.append(name)

# inference-only token: chat ok, compute/billing/account 403
uid, tok = seed(["inference"])
check("inference token: hosted-runtimes 403", call("GET", "/api/v1/hosted-runtimes", tok), 403)
check("inference token: billing/credits 403", call("GET", "/api/v1/billing/credits", tok), 403)
check("inference token: api-keys 403", call("GET", "/api/v1/api-keys", tok), 403)
check("inference token: chat 200", call("POST", "/v1/chat/completions", tok,
    {"model": "qwen3.6-27b-groq", "messages": [{"role": "user", "content": "hi"}], "max_tokens": 4}), 200)
psql(f"DELETE FROM users WHERE id='{uid}'")

# compute token: compute 200, chat 403
uid, tok = seed(["compute"])
check("compute token: hosted-runtimes 200", call("GET", "/api/v1/hosted-runtimes", tok), 200)
check("compute token: chat 403", call("POST", "/v1/chat/completions", tok,
    {"model": "qwen3.6-27b-groq", "messages": [{"role": "user", "content": "hi"}], "max_tokens": 4}), 403)
psql(f"DELETE FROM users WHERE id='{uid}'")

# legacy wildcard token: everything 200
uid, tok = seed(["*"])
check("wildcard token: hosted-runtimes 200", call("GET", "/api/v1/hosted-runtimes", tok), 200)
check("wildcard token: billing 200", call("GET", "/api/v1/billing/credits", tok), 200)
psql(f"DELETE FROM users WHERE id='{uid}'")

print()
print("SCOPE CHECK FAILED" if failures else "SCOPE CHECK PASSED")
raise SystemExit(1 if failures else 0)
