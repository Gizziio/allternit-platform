/**
 * Allternit Computer Use — HTTP Gateway Adapter
 *
 * Calls the ACU Gateway REST API directly.
 * Base URL from ACU_GATEWAY_URL env var (default http://localhost:8760).
 */

"use strict";

const BASE_URL = process.env.ACU_GATEWAY_URL || "http://localhost:8760";
const API_KEY  = process.env.ACU_API_KEY || "";

function _headers() {
  const h = { "Content-Type": "application/json" };
  if (API_KEY) h["Authorization"] = `Bearer ${API_KEY}`;
  return h;
}

async function _post(path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: _headers(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`ACU gateway ${path} → HTTP ${res.status}: ${text}`);
  }
  return res.json();
}

async function _get(path, params = {}) {
  const qs = new URLSearchParams(params).toString();
  const url = qs ? `${BASE_URL}${path}?${qs}` : `${BASE_URL}${path}`;
  const res = await fetch(url, { headers: _headers() });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`ACU gateway ${path} → HTTP ${res.status}: ${text}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Core actions
// ---------------------------------------------------------------------------

async function cu_screenshot({ session_id, full_page = false } = {}) {
  return _post("/v1/execute", {
    action: "screenshot",
    session_id,
    run_id: crypto.randomUUID(),
    parameters: { full_page },
  });
}

async function cu_navigate({ session_id, url, wait_until = "domcontentloaded" } = {}) {
  return _post("/v1/execute", {
    action: "goto",
    session_id,
    run_id: crypto.randomUUID(),
    target: url,
    parameters: { wait_until },
  });
}

async function cu_click({ session_id, x, y, selector } = {}) {
  const params = {};
  if (x != null && y != null) { params.x = x; params.y = y; }
  return _post("/v1/execute", {
    action: "click",
    session_id,
    run_id: crypto.randomUUID(),
    target: selector || "",
    parameters: params,
  });
}

async function cu_type({ session_id, text, selector } = {}) {
  const action = selector ? "fill" : "type";
  return _post("/v1/execute", {
    action,
    session_id,
    run_id: crypto.randomUUID(),
    target: selector || "",
    parameters: { text },
  });
}

async function cu_scroll({ session_id, direction = "down", amount = 3 } = {}) {
  return _post("/v1/execute", {
    action: "scroll",
    session_id,
    run_id: crypto.randomUUID(),
    parameters: { direction, amount },
  });
}

async function cu_key({ session_id, keys } = {}) {
  return _post("/v1/execute", {
    action: "key",
    session_id,
    run_id: crypto.randomUUID(),
    parameters: { keys },
  });
}

async function cu_extract({ session_id, format = "text", selector } = {}) {
  return _post("/v1/extract", {
    session_id,
    format,
    selector: selector || null,
  });
}

async function cu_execute_task({ session_id, task, mode = "intent", scope = "browser", max_steps = 20, approval_policy = "on-risk", record_gif = true } = {}) {
  return _post("/v1/computer-use/execute", {
    session_id,
    run_id: crypto.randomUUID(),
    task,
    mode,
    target_scope: scope,
    options: { max_steps, approval_policy, record_gif },
  });
}

async function cu_record({ session_id, action = "start", recording_id, name, record_gif = true } = {}) {
  return _post("/v1/computer-use/record", {
    session_id,
    action,
    recording_id: recording_id || null,
    name: name || null,
    record_gif,
  });
}

async function cu_replay({ recording_id, export_gif = false } = {}) {
  return _post("/v1/computer-use/replay", { recording_id, export_gif });
}

module.exports = {
  cu_screenshot,
  cu_navigate,
  cu_click,
  cu_type,
  cu_scroll,
  cu_key,
  cu_extract,
  cu_execute_task,
  cu_record,
  cu_replay,
};
