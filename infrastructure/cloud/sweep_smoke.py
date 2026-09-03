import json, subprocess, time, urllib.request, hashlib, uuid

uid = f"sweep_{uuid.uuid4().hex[:8]}"
psql = lambda sql: subprocess.run(["sudo","-u","postgres","psql","-d","allternit","-AtXc",sql],capture_output=True,text=True)
psql(f"INSERT INTO users (id,email,status) VALUES ('{uid}','{uid}@s.local','active') ON CONFLICT DO NOTHING")
tok = f"sweep-{uuid.uuid4()}"
psql(f"INSERT INTO api_tokens (id,token_hash,name,user_id) VALUES ('tok-{uid}','{hashlib.md5(tok.encode()).hexdigest()}','sweep','{uid}')")

def get(path):
    req = urllib.request.Request(f"http://localhost:8082{path}", headers={"Authorization":f"Bearer {tok}"})
    try:
        r = urllib.request.urlopen(req)
        return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:120]

print("=== sweep smoke: compute endpoints with Bearer api token ===")
failed = False
for p in ["/api/v1/hosted-runtimes", "/api/v1/gizzi-instances", "/api/v1/api-keys",
          "/api/v1/provider-tokens", "/api/v1/billing/credits"]:
    code, body = get(p)
    ok = code == 200
    failed = failed or not ok
    print(("PASS" if ok else "FAIL"), p, code, "" if ok else body)

psql(f"DELETE FROM users WHERE id='{uid}'")
raise SystemExit(1 if failed else 0)
