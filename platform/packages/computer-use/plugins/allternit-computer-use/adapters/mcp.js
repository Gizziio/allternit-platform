/**
 * Allternit Computer Use — MCP Adapter
 *
 * Bridges the plugin's function surface to the MCP protocol.
 * Each plugin function is exposed as an MCP tool with JSON Schema parameters.
 * Connects to the ACU gateway at config.gateway_url (default: http://localhost:8760).
 */

"use strict";

const DEFAULT_GATEWAY = "http://localhost:8760";

/**
 * Register all computer-use tools with an MCP server instance.
 * @param {object} server - MCP server instance (allternit-mcp-sdk or compatible)
 * @param {object} config - Plugin config (gateway_url, etc.)
 */
function register(server, config = {}) {
  const gatewayUrl = config.gateway_url || DEFAULT_GATEWAY;
  const defaultMaxSteps = config.max_steps ?? 20;
  const defaultApprovalPolicy = config.approval_policy ?? "on-risk";
  const defaultRecordGif = config.record_by_default ?? true;

  // ── automate ──────────────────────────────────────────────────────────────
  server.registerTool({
    name: "cu_automate",
    description:
      "Run a natural-language task through the computer-use planning loop with vision grounding.",
    inputSchema: {
      type: "object",
      properties: {
        task:            { type: "string",  description: "What to accomplish" },
        session_id:      { type: "string",  description: "Browser/desktop session ID" },
        scope:           { type: "string",  enum: ["browser","desktop","hybrid","auto"], default: "browser" },
        max_steps:       { type: "number",  default: defaultMaxSteps },
        approval_policy: { type: "string",  enum: ["never","on-risk","always"], default: defaultApprovalPolicy },
        record_gif:      { type: "boolean", default: defaultRecordGif },
      },
      required: ["task"],
    },
    handler: async ({ task, session_id, scope, max_steps, approval_policy, record_gif }) => {
      const body = {
        mode: "intent",
        task,
        session_id: session_id || undefined,
        target_scope: scope || "browser",
        options: {
          max_steps: max_steps ?? defaultMaxSteps,
          approval_policy: approval_policy ?? defaultApprovalPolicy,
          record_gif: record_gif ?? defaultRecordGif,
        },
      };
      const res = await _post(`${gatewayUrl}/v1/computer-use/execute`, body);
      return res;
    },
  });

  // ── screenshot ────────────────────────────────────────────────────────────
  server.registerTool({
    name: "cu_screenshot",
    description: "Capture the current browser or desktop screen state.",
    inputSchema: {
      type: "object",
      properties: {
        session_id: { type: "string" },
        annotate:   { type: "boolean", default: false },
      },
      required: ["session_id"],
    },
    handler: async ({ session_id, annotate }) => {
      const res = await _post(`${gatewayUrl}/v1/screenshot`, { session_id, annotate: annotate ?? false });
      return res;
    },
  });

  // ── extract ───────────────────────────────────────────────────────────────
  server.registerTool({
    name: "cu_extract",
    description: "Extract structured data from the current page.",
    inputSchema: {
      type: "object",
      properties: {
        session_id: { type: "string" },
        what:       { type: "string",  description: "What to extract" },
        strategy:   { type: "string",  enum: ["text","accessibility","selector","vision"], default: "accessibility" },
        format:     { type: "string",  enum: ["json","csv","markdown","raw"], default: "json" },
      },
      required: ["session_id", "what"],
    },
    handler: async ({ session_id, what, strategy, format }) => {
      const res = await _post(`${gatewayUrl}/v1/inspect`, {
        session_id,
        target: what,
        parameters: { strategy: strategy ?? "accessibility", format: format ?? "json" },
      });
      return res;
    },
  });

  // ── record ────────────────────────────────────────────────────────────────
  server.registerTool({
    name: "cu_record",
    description: "Start or stop a workflow recording session.",
    inputSchema: {
      type: "object",
      properties: {
        action:       { type: "string", enum: ["start","stop"] },
        session_id:   { type: "string" },
        recording_id: { type: "string" },
        name:         { type: "string" },
      },
      required: ["action", "session_id"],
    },
    handler: async ({ action, session_id, recording_id, name }) => {
      const body = { action, session_id, recording_id, name };
      const res = await _post(`${gatewayUrl}/v1/computer-use/record`, body);
      return res;
    },
  });

  // ── replay ────────────────────────────────────────────────────────────────
  server.registerTool({
    name: "cu_replay",
    description: "Replay a recorded workflow or export it as a GIF.",
    inputSchema: {
      type: "object",
      properties: {
        recording_id: { type: "string" },
        export_gif:   { type: "boolean", default: false },
        speed:        { type: "number",  default: 1.0 },
      },
      required: ["recording_id"],
    },
    handler: async ({ recording_id, export_gif, speed }) => {
      const res = await _post(`${gatewayUrl}/v1/computer-use/replay`, {
        recording_id,
        export_gif: export_gif ?? false,
        speed: speed ?? 1.0,
      });
      return res;
    },
  });
}

// ─── internal fetch helper ───────────────────────────────────────────────────

async function _post(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`ACU gateway error ${response.status}: ${text}`);
  }
  return response.json();
}

module.exports = { register };
