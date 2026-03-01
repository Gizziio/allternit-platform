####Reorganize webvm and use this spec for vm sandbox we are not using webvm anymore

 WEBVM_BOOT_AND_BRIDGE_CONTRACT.md
**A2rchitech on WebVM (userland-wasm) — Boot + Stdio-RPC Bridge Spec**
_version 1.0 — implementation handoff_

## 0) Goal
Run **a2rchitech OS** inside a **WebVM userland-WASM** Linux guest, while rendering the **Shell UI** outside the VM in the same browser page. The UI communicates with **Runner (Gizzi)** inside WebVM via a **stdio-RPC bridge**.

This enables:
- Cross-platform OS deployment (browser as host)
- A custom distro payload shipped as a WebVM disk image
- Deterministic execution with Runner as sole authority

---

## 1) Architecture
**Browser**
- Shell UI (capsule canvas)
- Bridge (JS stdio-RPC client)

**WebVM**
- Linux userland (userland-wasm)
- Auto-started Runner (Gizzi)
- NDJSON over stdio

No TCP networking required for MVP.

---

## 2) Filesystem Payload
```
/opt/a2rchitech/
  bin/runner
  registry/registry.json
  policy/policy.json
  init/boot.sh

/var/gizzi/
  journal/
  capsules/
  evidence/
  artifacts/
```

`/var/gizzi` must be persistently mounted (OPFS/IndexedDB).

---

## 3) Boot Contract
On VM startup:
1. Create `/var/gizzi/*`
2. Launch Runner in stdio mode
3. Emit readiness token once

### boot.sh
```sh
#!/bin/sh
set -eu
mkdir -p /var/gizzi/journal /var/gizzi/capsules /var/gizzi/evidence /var/gizzi/artifacts
exec /opt/a2rchitech/bin/runner \
  --transport stdio \
  --state-dir /var/gizzi \
  --registry /opt/a2rchitech/registry/registry.json \
  --policy /opt/a2rchitech/policy/policy.json
```

### Readiness Token
Runner must print exactly:
```
RUNNER_READY {"protocol":"stdio-rpc-v1","runner_version":"x.y.z"}
```

---

## 4) Bridge Contract
Transport: NDJSON over stdio.

### Request
```json
{"id":"1","method":"intent.dispatch","params":{...}}
```

### Response
```json
{"id":"1","result":{...}}
```

### Error
```json
{"id":"1","error":{"code":"ERR","message":"..."}}
```

---

## 5) Required Methods
- runner.ping
- intent.dispatch
- capsule.get
- journal.tail
- skill.invoke (next phase)

---

## 6) UI Rules
- UI only talks to Runner via Bridge
- UI never executes tools
- Journal hidden by default (debug overlay only)

---

## 7) WebVM Integration
- Boot custom disk image
- Auto-run boot.sh
- Expose stdio streams to browser JS

---

## 8) MVP Acceptance
- VM boots, Runner ready
- search / note intents spawn capsules
- Tab switching works
- State persists across refresh

---

## 9) Constraints
- Runner is sole executor
- NDJSON only
- No TCP ports
- All side effects journaled
