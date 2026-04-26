/**
 * Allternit Computer Use — HTTP Adapter
 *
 * Typed fetch client wrapping the ACU gateway REST API.
 * Used by platform surfaces (Next.js API routes, CLI, etc.) to invoke
 * computer-use operations without MCP overhead.
 *
 * All methods return { ok: boolean, data?: object, error?: string }.
 */

"use strict";

const DEFAULT_GATEWAY = "http://localhost:8760";

class ComputerUseHttpAdapter {
  /**
   * @param {object} config
   * @param {string} [config.gateway_url]
   * @param {number} [config.timeout_ms]
   */
  constructor(config = {}) {
    this.gatewayUrl = (config.gateway_url || DEFAULT_GATEWAY).replace(/\/$/, "");
    this.timeoutMs = config.timeout_ms ?? 120_000;
  }

  // ── Planning loop ──────────────────────────────────────────────────────────

  /**
   * Execute a task through the planning loop.
   * @param {object} params
   * @param {string} params.task
   * @param {string} [params.session_id]
   * @param {string} [params.scope]         browser | desktop | hybrid | auto
   * @param {number} [params.max_steps]
   * @param {string} [params.approval_policy]
   * @param {boolean} [params.record_gif]
   * @param {string}  [params.run_id]
   * @returns {Promise<{ok: boolean, data?: object, error?: string}>}
   */
  async execute(params) {
    return this._post("/v1/computer-use/execute", {
      mode: "intent",
      task: params.task,
      session_id: params.session_id,
      run_id: params.run_id,
      target_scope: params.scope ?? "browser",
      options: {
        max_steps:       params.max_steps ?? 20,
        approval_policy: params.approval_policy ?? "on-risk",
        record_gif:      params.record_gif ?? true,
      },
    });
  }

  /**
   * Execute with SSE streaming. Returns a ReadableStream of parsed event objects.
   */
  async executeStream(params) {
    const body = {
      mode: "intent",
      task: params.task,
      session_id: params.session_id,
      run_id: params.run_id,
      target_scope: params.scope ?? "browser",
      options: {
        max_steps:       params.max_steps ?? 20,
        approval_policy: params.approval_policy ?? "on-risk",
        record_gif:      params.record_gif ?? true,
      },
    };
    const url = `${this.gatewayUrl}/v1/computer-use/execute?stream=true`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(this.timeoutMs),
    });
    if (!response.ok) throw new Error(`execute failed: ${response.status}`);
    return response.body; // caller reads as SSE stream
  }

  // ── Run management ─────────────────────────────────────────────────────────

  async getRun(runId) {
    return this._get(`/v1/computer-use/runs/${runId}`);
  }

  async approveRun(runId, decision = "approve", comment = "") {
    return this._post(`/v1/computer-use/runs/${runId}/approve`, { decision, comment });
  }

  async cancelRun(runId) {
    return this._post(`/v1/computer-use/runs/${runId}/cancel`, {});
  }

  // ── Sessions ───────────────────────────────────────────────────────────────

  async listSessions() {
    return this._get("/v1/computer-use/sessions");
  }

  async createSession() {
    return this._post("/v1/computer-use/sessions", {});
  }

  async deleteSession(sessionId) {
    return this._delete(`/v1/computer-use/sessions/${sessionId}`);
  }

  // ── Browser actions ────────────────────────────────────────────────────────

  async navigate(sessionId, url) {
    return this._post("/v1/navigate", { session_id: sessionId, url });
  }

  async screenshot(sessionId, annotate = false) {
    return this._post("/v1/screenshot", { session_id: sessionId, annotate });
  }

  async click(sessionId, target, x, y) {
    return this._post("/v1/click", { session_id: sessionId, target, x, y });
  }

  async type(sessionId, target, text) {
    return this._post("/v1/type", { session_id: sessionId, target, text });
  }

  async scroll(sessionId, target, direction = "down", amount = 3) {
    return this._post("/v1/scroll", { session_id: sessionId, target, direction, amount });
  }

  async inspect(sessionId, target, strategy = "accessibility") {
    return this._post("/v1/inspect", { session_id: sessionId, target, parameters: { strategy } });
  }

  // ── Adapters ───────────────────────────────────────────────────────────────

  async listAdapters() {
    return this._get("/v1/computer-use/adapters");
  }

  // ── Health ─────────────────────────────────────────────────────────────────

  async health() {
    return this._get("/v1/computer-use/health");
  }

  // ─── internal helpers ──────────────────────────────────────────────────────

  async _get(path) {
    try {
      const res = await fetch(`${this.gatewayUrl}${path}`, {
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      const data = await res.json().catch(() => ({}));
      return res.ok ? { ok: true, data } : { ok: false, error: data?.detail ?? `HTTP ${res.status}` };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  async _post(path, body) {
    try {
      const res = await fetch(`${this.gatewayUrl}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      const data = await res.json().catch(() => ({}));
      return res.ok ? { ok: true, data } : { ok: false, error: data?.detail ?? `HTTP ${res.status}` };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  async _delete(path) {
    try {
      const res = await fetch(`${this.gatewayUrl}${path}`, {
        method: "DELETE",
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      const data = await res.json().catch(() => ({}));
      return res.ok ? { ok: true, data } : { ok: false, error: data?.detail ?? `HTTP ${res.status}` };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }
}

module.exports = { ComputerUseHttpAdapter };
