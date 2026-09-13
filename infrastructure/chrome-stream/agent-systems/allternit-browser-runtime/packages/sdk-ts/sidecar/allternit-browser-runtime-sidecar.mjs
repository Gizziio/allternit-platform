#!/usr/bin/env node
/**
 * Allternit Browser Runtime — stdio sidecar.
 *
 * Hosts the vendored @allternit/browser-runtime in a child process so Node-18
 * consumers (e.g. @allternit/browser) can drive it without importing the
 * Node-≥22 runtime toolchain. Speaks newline-delimited JSON on stdin/stdout:
 *
 *   host → sidecar:  { "id": number, "method": string, "params": object }
 *   sidecar → host:  { "id": number, "ok": true, "result": object }
 *                 |  { "id": number, "ok": false, "error": string }
 *
 * Methods: init, navigate, act, observe, extract, batch, actBatch,
 * tabOpen, tabList, tabSwitch, tabClose, dialog, upload, downloads,
 * screenshot, pageInfo, close.
 *
 * `batch` takes free-text instructions (model-driven per step). `actBatch`
 * takes structured whitelisted steps ({selector, method, arguments}) and
 * executes them deterministically with no model call — this is the transport
 * behind the Rust batch grant gate (POST /api/aci/batch). Tabs ride the
 * vendored SDK's BrowserContext (context.pages/newPage/setActivePage +
 * page.close); dialogs are handled host-side over raw CDP (the extension
 * protocol has no dialog surface — we deliberately did NOT invent one);
 * uploads go through locator.setInputFiles with path containment inside the
 * run-scoped sandbox dir; downloads land in the launch-configured
 * downloadsPath (Browser.setDownloadBehavior), never an arbitrary path.
 * Screenshots return a SHA-256 of the captured PNG.
 *
 * Requires `pnpm run build` to have produced ../dist/index.mjs (with the
 * bundled extension at dist/extension/). Requires Node ≥ 22.18.
 */

import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { Stagehand, localBrowser } from "../dist/index.mjs";

const require = createRequire(import.meta.url);
const { z } = require("zod/v4");

// ---------------------------------------------------------------------------
// Allternit-gateway model mode (params.model.mode === "gateway", the P1
// default for real inference). The extension bounces LLM requests here over
// JSON-RPC; we forward them to the allternit gateway's OpenAI-compatible
// surface (POST {baseUrl}/v1/chat/completions, Bearer ak-... virtual key).
// Fail-closed: unreachable gateway, missing key, or non-JSON structured
// output is an error — never a silent fallback to direct provider keys, and
// never Browserbase. Model default honors the Brain's model-routing policy
// (browser act/observe/extract = routine execution → A://C backend).
// ---------------------------------------------------------------------------

const GATEWAY_DEFAULT_MODEL = "claude-sonnet-5";

function textOfContent(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map((block) => block?.text ?? "").join("\n");
  }
  return content?.text ?? "";
}

function gatewayGenerate({ baseUrl, apiKey, model }) {
  if (!apiKey) {
    throw new Error(
      "gateway model mode requires an API key: set ALLTERNIT_GATEWAY_KEY or pass model.apiKey",
    );
  }
  const endpoint = `${baseUrl.replace(/\/+$/, "")}/v1/chat/completions`;
  return async function generate(params) {
    const messages = (params.messages ?? []).map((m) => ({
      role: m.role,
      content: textOfContent(m.content),
    }));
    const body = { model, messages };
    const wantsJson = params.responseFormat?.type === "json_schema";
    if (wantsJson) {
      body.response_format = {
        type: "json_schema",
        json_schema: {
          name: params.responseFormat.name ?? "structured",
          schema: params.responseFormat.schema ?? { type: "object" },
          strict: false,
        },
      };
    }
    let resp;
    try {
      resp = await fetch(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });
    } catch (error) {
      throw new Error(`allternit gateway unreachable: ${error?.message ?? error}`);
    }
    if (!resp.ok) {
      throw new Error(`allternit gateway returned ${resp.status}: ${await resp.text()}`);
    }
    const data = await resp.json();
    const choice = data.choices?.[0];
    const content = textOfContent(choice?.message?.content ?? "");
    const usage = data.usage ?? {};
    const base = {
      role: "assistant",
      content: { type: "text", text: content },
      stopReason: choice?.finish_reason ?? "stop",
      usage: {
        inputTokens: usage.prompt_tokens ?? 0,
        outputTokens: usage.completion_tokens ?? 0,
        totalTokens: usage.total_tokens ?? 0,
      },
    };
    if (wantsJson) {
      let structuredContent;
      try {
        structuredContent = JSON.parse(content);
      } catch {
        throw new Error("allternit gateway returned non-JSON content for a structured call");
      }
      return { ...base, outputFormat: "json_schema", structuredContent };
    }
    return { ...base, outputFormat: "text" };
  };
}

function resolveGatewayConfig(modelConfig) {
  return {
    baseUrl:
      modelConfig.baseUrl ??
      process.env.ALLTERNIT_GATEWAY_URL ??
      "http://127.0.0.1:8013",
    apiKey: modelConfig.apiKey ?? process.env.ALLTERNIT_GATEWAY_KEY ?? "",
    model:
      modelConfig.model ??
      process.env.ALLTERNIT_BROWSER_RUNTIME_MODEL ??
      GATEWAY_DEFAULT_MODEL,
  };
}

// ---------------------------------------------------------------------------
// Canned mock model (used when params.model.mode === "mock", the smoke
// default). Same contract as the SDK client-LLM callback: the extension
// bounces LLM requests here over JSON-RPC and we answer with structured
// content.
// ---------------------------------------------------------------------------

function parseTree(prompt) {
  const elements = [];
  const re = /^\s*\[(\d+-\d+)\]\s*([a-zA-Z ]+?)(?::\s*([^\n]+?))?\s*$/gm;
  let m;
  while ((m = re.exec(prompt)) !== null) {
    elements.push({ elementId: m[1], role: m[2].trim(), name: (m[3] ?? "").trim() });
  }
  return elements;
}

function instructionFrom(prompt) {
  const m = /instruction:\s*([^\n]+)/.exec(prompt);
  return m?.[1]?.toLowerCase() ?? "";
}

function pickElement(prompt, prefer) {
  const elements = parseTree(prompt);
  return (
    elements.find((e) => prefer.test(e.name)) ??
    elements.find((e) => e.role === "button") ??
    elements[0]
  );
}

const FAKE_USAGE = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };
const MOCK_CALLS = { total: 0, byName: {} };

async function mockGenerate(params) {
  MOCK_CALLS.total += 1;
  const prompt = (params.messages ?? [])
    .map((m) => (typeof m.content === "string" ? m.content : (m.content?.text ?? "")))
    .join("\n");
  const name = params.responseFormat?.name ?? "";
  MOCK_CALLS.byName[name] = (MOCK_CALLS.byName[name] ?? 0) + 1;
  const instruction = instructionFrom(prompt);
  const base = {
    role: "assistant",
    content: { type: "text", text: "mock" },
    stopReason: "stop",
    usage: FAKE_USAGE,
  };

  if (name === "Act") {
    const prefer = /toggle|flag/.test(instruction)
      ? /toggle|flag/i
      : /increment|count|click|submit|confirm|yes/i;
    const el = pickElement(prompt, prefer);
    if (!el) throw new Error("mock model: no element found in accessibility tree");
    return {
      ...base,
      outputFormat: "json_schema",
      structuredContent: {
        action: {
          elementId: el.elementId,
          description: `mock click on ${el.name || el.role}`,
          method: "click",
          arguments: [],
        },
        twoStep: false,
      },
    };
  }

  if (name === "Observation") {
    const elements = parseTree(prompt)
      .filter((e) => e.role === "button" || e.role === "link" || e.role === "textbox")
      .slice(0, 8)
      .map((e) => ({
        elementId: e.elementId,
        description: `observed ${e.role} "${e.name}"`,
        method: "click",
        arguments: [],
      }));
    return { ...base, outputFormat: "json_schema", structuredContent: { elements } };
  }

  if (name === "Extraction") {
    // Generic canned object; callers assert shape, not values.
    return {
      ...base,
      outputFormat: "json_schema",
      structuredContent: { headline: "Allternit Browser Runtime Smoke Page", counter: 0 },
    };
  }

  if (name === "Metadata") {
    return {
      ...base,
      outputFormat: "json_schema",
      structuredContent: { progress: "done", completed: true },
    };
  }

  return { ...base, outputFormat: "json_schema", structuredContent: {} };
}

// ---------------------------------------------------------------------------
// Sidecar state and method handlers.
// ---------------------------------------------------------------------------

let stagehand;
let page;
let model;
let nextRequestId = 1;
// P1: captured at init so host-side CDP (dialog handling) and the downloads
// listing know where the browser lives and where files may land. Both are
// run-scoped: `sandboxDir` constrains path-based uploads, `downloadsPath`
// is where Chrome is told (Browser.setDownloadBehavior) to place downloads.
let cdpUrl;
let downloadsPath;
let sandboxDir;

function pickFreePort() {
  return new Promise((resolve, reject) => {
    const server = require("node:net").createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
}

/** Resolve a caller-supplied path inside the run sandbox, or refuse it. */
function resolveInSandbox(rawPath) {
  if (!sandboxDir) {
    throw new Error("sandboxDir is not configured; path-based file access is disabled");
  }
  const path = require("node:path");
  const resolved = path.resolve(
    path.isAbsolute(rawPath) ? rawPath : path.join(sandboxDir, rawPath),
  );
  const root = path.resolve(sandboxDir);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error(`path escapes the run sandbox: ${rawPath}`);
  }
  return resolved;
}

async function ensurePage() {
  if (!page) {
    page = await stagehand.browser.context.newPage();
  }
  return page;
}

// ---------------------------------------------------------------------------
// Host-side raw CDP for dialogs. The vendored extension protocol has no
// dialog surface (PageEventName is ["console"] upstream) — rather than
// invent an extension action it cannot execute, the sidecar handles
// javascript dialogs over the page target's CDP websocket directly, matched
// by pageId (the extension's pageId IS the CDP targetId).
// ---------------------------------------------------------------------------

let cdpMessageId = 1;

function cdpSend(ws, method, params = {}) {
  const id = cdpMessageId++;
  return new Promise((resolve, reject) => {
    const onMessage = (event) => {
      let msg;
      try {
        msg = JSON.parse(typeof event.data === "string" ? event.data : "");
      } catch {
        return;
      }
      if (msg.id !== id) return;
      ws.removeEventListener("message", onMessage);
      if (msg.error) reject(new Error(`${method}: ${msg.error.message ?? JSON.stringify(msg.error)}`));
      else resolve(msg.result);
    };
    ws.addEventListener("message", onMessage);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

function cdpWaitForEvent(ws, method, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.removeEventListener("message", onMessage);
      reject(new Error(`timed out after ${timeoutMs}ms waiting for ${method}`));
    }, timeoutMs);
    const onMessage = (event) => {
      let msg;
      try {
        msg = JSON.parse(typeof event.data === "string" ? event.data : "");
      } catch {
        return;
      }
      if (msg.method !== method) return;
      clearTimeout(timer);
      ws.removeEventListener("message", onMessage);
      resolve(msg);
    };
    ws.addEventListener("message", onMessage);
  });
}

async function openPageCdp(pageId) {
  const response = await fetch(`${cdpUrl}/json/list`);
  if (!response.ok) throw new Error(`CDP /json/list returned ${response.status}`);
  const targets = await response.json();
  const target = targets.find((t) => t.id === pageId && t.type === "page");
  if (!target) throw new Error(`no CDP page target for pageId ${pageId}`);
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = () => reject(new Error("failed to open page CDP websocket"));
  });
  return ws;
}

const handlers = {
  async init(params) {
    const modelConfig = params.model ?? { mode: "mock" };
    if (modelConfig.mode === "gateway") {
      model = { generate: gatewayGenerate(resolveGatewayConfig(modelConfig)) };
    } else if (modelConfig.mode === "mock" || modelConfig.mode === undefined) {
      model = { generate: mockGenerate };
    } else {
      throw new Error(
        `unknown model mode: ${modelConfig.mode} (expected "mock" or "gateway")`,
      );
    }
    // A fixed port lets the sidecar own the CDP URL for host-side dialog
    // handling (openPageCdp). downloadsPath/sandboxDir are run-scoped dirs
    // supplied by the host; downloads are pinned there via
    // Browser.setDownloadBehavior at launch and path-based uploads are
    // containment-checked against the sandbox root.
    const port = params.port ?? (await pickFreePort());
    downloadsPath = params.downloadsPath ?? null;
    sandboxDir = params.sandboxDir ?? downloadsPath;
    if (downloadsPath) {
      await (await import("node:fs/promises")).mkdir(downloadsPath, { recursive: true });
    }
    if (sandboxDir) {
      await (await import("node:fs/promises")).mkdir(sandboxDir, { recursive: true });
    }
    const browser = await localBrowser.launch({
      headless: params.headless ?? true,
      port,
      ...(params.executablePath ? { executablePath: params.executablePath } : {}),
      ...(downloadsPath ? { acceptDownloads: true, downloadsPath } : {}),
    });
    cdpUrl = `http://127.0.0.1:${port}`;
    stagehand = await Stagehand.create({ browser, model });
    return { initialized: stagehand.initialized, cdpUrl };
  },

  async navigate(params) {
    const p = await ensurePage();
    await p.goto(params.url);
    await p.waitForLoadState("load");
    return { url: params.url };
  },

  async act(params) {
    const result = await stagehand.act(params.instruction, { page });
    // ActResult is wrapped: { data: { success, message, actions }, metadata }
    return {
      success: result.data?.success,
      message: result.data?.message,
      actions: result.data?.actions,
    };
  },

  async observe(params) {
    const result = await stagehand.observe(params.instruction, { page });
    // ObserveResult is wrapped: { data: Action[], metadata }
    return { actions: result.data ?? [] };
  },

  async extract(params) {
    const schema = z.fromJSONSchema(params.schema ?? {
      type: "object",
      properties: { headline: { type: "string" }, counter: { type: "number" } },
      required: ["headline", "counter"],
    });
    const result = await stagehand.extract(params.instruction, schema, { page });
    return { data: result.data };
  },

  async batch(params) {
    const instructions = params.instructions;
    // The batch callback is stringified and executed inside the extension;
    // bake the instruction list into the callback source.
    const callback = new Function(
      "batch",
      `return (async () => {
        const results = [];
        for (const instruction of ${JSON.stringify(instructions)}) {
          results.push(await batch.act(instruction));
        }
        return results.map((r) => ({ success: r.data?.success, message: r.data?.message }));
      })()`,
    );
    const results = await stagehand.experimentalBatch(callback, undefined, {
      timeout: params.timeoutMs ?? 60_000,
    });
    return { steps: results };
  },

  async actBatch(params) {
    // Deterministic structured-step batch behind the grant gate (spec
    // stagehand-batch-fork P1): each step is a whitelisted Action
    // ({selector, method, arguments}) executed via the extension's act
    // handler with NO model call. Halts at the first failed step; reports
    // one entry per executed step (the tail is absent by design).
    const steps = params.steps ?? [];
    const callback = new Function(
      "batch",
      `return (async () => {
        const steps = ${JSON.stringify(steps)};
        const results = [];
        for (let index = 0; index < steps.length; index++) {
          const step = steps[index];
          try {
            const r = await batch.act({
              selector: step.selector,
              description: step.description ?? (step.method + " " + step.selector),
              method: step.method,
              arguments: step.arguments ?? [],
            });
            const success = r.data?.success === true;
            results.push({ index, success, message: r.data?.message ?? null });
            if (!success) break;
          } catch (error) {
            results.push({ index, success: false, message: String(error?.message ?? error) });
            break;
          }
        }
        return results;
      })()`,
    );
    const results = await stagehand.experimentalBatch(callback, undefined, {
      timeout: params.timeoutMs ?? 60_000,
    });
    return { steps: results };
  },

  async screenshot() {
    const p = await ensurePage();
    const bytes = await p.screenshot({ type: "png" });
    // SHA-256 at capture time: the hash travels with the artifact so receipt
    // metadata can bind the exact pixels observed.
    return {
      pngBase64: Buffer.from(bytes).toString("base64"),
      sha256: createHash("sha256").update(bytes).digest("hex"),
    };
  },

  // ── Tabs (vendored SDK BrowserContext surface; pageId == CDP targetId) ──

  async tabOpen(params) {
    const context = stagehand.browser.context;
    const newPage = await context.newPage(params.url);
    if (!page) page = newPage;
    return { pageId: newPage.pageId, url: params.url ?? null };
  },

  async tabList() {
    const pages = await stagehand.browser.context.pages();
    const tabs = await Promise.all(
      pages.map(async (pg) => ({ pageId: pg.pageId, url: await pg.url() })),
    );
    return { tabs, active: page?.pageId ?? null };
  },

  async tabSwitch(params) {
    const pages = await stagehand.browser.context.pages();
    const target = pages.find((pg) => pg.pageId === params.pageId);
    if (!target) throw new Error(`no such tab: ${params.pageId}`);
    await stagehand.browser.context.setActivePage(target);
    page = target;
    return { active: params.pageId };
  },

  async tabClose(params) {
    const pages = await stagehand.browser.context.pages();
    const target = pages.find((pg) => pg.pageId === params.pageId);
    if (!target) throw new Error(`no such tab: ${params.pageId}`);
    await target.close();
    if (page?.pageId === params.pageId) page = undefined;
    return { closed: params.pageId };
  },

  // ── Dialogs (host-side raw CDP; the extension protocol has no dialog op) ──

  async dialog(params) {
    const p = await ensurePage();
    const ws = await openPageCdp(p.pageId);
    try {
      await cdpSend(ws, "Page.enable");
      const timeoutMs = params.timeoutMs ?? 5_000;
      const opening = await cdpWaitForEvent(
        ws,
        "Page.javascriptDialogOpening",
        timeoutMs,
      );
      await cdpSend(ws, "Page.handleJavaScriptDialog", {
        accept: params.accept !== false,
        ...(params.promptText !== undefined
          ? { promptText: String(params.promptText) }
          : {}),
      });
      return {
        handled: true,
        dialogType: opening.params?.type ?? null,
        message: opening.params?.message ?? null,
      };
    } finally {
      try { ws.close(); } catch {}
    }
  },

  // ── Files: uploads contained to the sandbox dir; downloads land in the
  //    launch-configured downloadsPath (never an arbitrary path) ───────────

  async upload(params) {
    const p = await ensurePage();
    const files = params.files ?? [];
    if (!Array.isArray(files) || files.length === 0) {
      throw new Error("upload requires a non-empty files array");
    }
    const input = files.map((file) => {
      if (typeof file === "string" || typeof file.path === "string") {
        const rawPath = typeof file === "string" ? file : file.path;
        return resolveInSandbox(rawPath);
      }
      if (typeof file.base64 === "string") {
        return {
          name: file.name ?? "upload.bin",
          mimeType: file.mimeType ?? "application/octet-stream",
          buffer: Buffer.from(file.base64, "base64"),
        };
      }
      throw new Error("file entries need a path or base64 payload");
    });
    await p
      .locator(params.selector)
      .setInputFiles(input.length === 1 ? input[0] : input);
    return { uploaded: files.length, selector: params.selector };
  },

  async downloads() {
    if (!downloadsPath) return { downloads: [] };
    const fs = await import("node:fs/promises");
    const path = require("node:path");
    const entries = await fs.readdir(downloadsPath, { withFileTypes: true });
    const downloads = [];
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const stat = await fs.stat(path.join(downloadsPath, entry.name));
      downloads.push({ name: entry.name, size: stat.size });
    }
    return { downloads };
  },

  async pageInfo() {
    const p = await ensurePage();
    return { url: await p.url(), title: await p.title() };
  },

  async close() {
    try { await stagehand?.close(); } catch {}
    stagehand = undefined;
    page = undefined;
    cdpUrl = undefined;
    downloadsPath = undefined;
    sandboxDir = undefined;
    return { closed: true };
  },

  async mockStats() {
    return MOCK_CALLS;
  },
};

// ---------------------------------------------------------------------------
// NDJSON stdio loop.
// ---------------------------------------------------------------------------

const rl = require("node:readline").createInterface({ input: process.stdin });

rl.on("line", async (line) => {
  let request;
  try {
    request = JSON.parse(line);
  } catch {
    return;
  }
  const { id, method, params } = request;
  const handler = handlers[method];
  if (!handler) {
    process.stdout.write(JSON.stringify({ id, ok: false, error: `unknown method: ${method}` }) + "\n");
    return;
  }
  try {
    const result = await handler(params ?? {});
    process.stdout.write(JSON.stringify({ id, ok: true, result }) + "\n");
  } catch (error) {
    process.stdout.write(
      JSON.stringify({ id, ok: false, error: error instanceof Error ? error.message : String(error) }) + "\n",
    );
  }
});

process.on("SIGTERM", async () => {
  try { await handlers.close(); } catch {}
  process.exit(0);
});
