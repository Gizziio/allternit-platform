/**
 * Allternit Computer Use — MCP Adapter
 *
 * Wraps the ACU MCP SSE server (port ACU_MCP_PORT, default 8765).
 * Provides the same function surface as http.js but routes through MCP.
 *
 * For Claude Desktop / MCP-native integrations prefer this adapter.
 * For direct REST use prefer http.js.
 */

"use strict";

const MCP_BASE = `http://localhost:${process.env.ACU_MCP_PORT || "8765"}`;
const GW_BASE  = process.env.ACU_GATEWAY_URL || "http://localhost:8760";
const API_KEY  = process.env.ACU_API_KEY || "";

function _headers() {
  const h = { "Content-Type": "application/json" };
  if (API_KEY) h["Authorization"] = `Bearer ${API_KEY}`;
  return h;
}

/**
 * Call an MCP tool via the SSE server's tool-call endpoint.
 * Falls back to the gateway HTTP API if MCP is unavailable.
 */
async function _mcpCall(toolName, args) {
  try {
    const res = await fetch(`${MCP_BASE}/tools/call`, {
      method: "POST",
      headers: _headers(),
      body: JSON.stringify({ name: toolName, arguments: args }),
    });
    if (res.ok) return res.json();
  } catch (_) {
    // MCP server unreachable — fall through to gateway fallback
  }
  // Gateway fallback: delegate to http adapter
  const http = require("./http");
  if (typeof http[toolName] === "function") return http[toolName](args);
  throw new Error(`MCP tool ${toolName} unavailable and no gateway fallback`);
}

// ---------------------------------------------------------------------------
// Tool wrappers — same API surface as http.js
// ---------------------------------------------------------------------------

async function cu_screenshot(args = {}) {
  return _mcpCall("screenshot", args);
}

async function cu_navigate(args = {}) {
  return _mcpCall("navigate", args);
}

async function cu_click(args = {}) {
  return _mcpCall("click", args);
}

async function cu_type(args = {}) {
  return _mcpCall("type", args);
}

async function cu_scroll(args = {}) {
  return _mcpCall("scroll", args);
}

async function cu_key(args = {}) {
  return _mcpCall("key", args);
}

async function cu_extract(args = {}) {
  // MCP read_screen maps to /v1/extract via the gateway;
  // prefer http adapter which calls /v1/extract directly.
  const http = require("./http");
  return http.cu_extract(args);
}

async function cu_execute_task(args = {}) {
  return _mcpCall("execute_task", args);
}

async function cu_record(args = {}) {
  const action = args.action || "start";
  if (action === "start") return _mcpCall("record_start", args);
  return _mcpCall("record_stop", args);
}

async function cu_replay(args = {}) {
  // No MCP replay tool — always delegate to gateway
  const http = require("./http");
  return http.cu_replay(args);
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
