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
 * Methods: init, navigate, act, observe, extract, batch, pageInfo, close.
 *
 * Requires `pnpm run build` to have produced ../dist/index.mjs (with the
 * bundled extension at dist/extension/). Requires Node ≥ 22.18.
 */

import { createRequire } from "node:module";
import { Stagehand, localBrowser } from "../dist/index.mjs";

const require = createRequire(import.meta.url);
const { z } = require("zod/v4");

// ---------------------------------------------------------------------------
// Canned mock model (used when params.model.mode === "mock", the P0 default).
// Same contract as the SDK client-LLM callback: the extension bounces LLM
// requests here over JSON-RPC and we answer with structured content.
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

async function ensurePage() {
  if (!page) {
    page = await stagehand.browser.context.newPage();
  }
  return page;
}

const handlers = {
  async init(params) {
    const modelConfig = params.model ?? { mode: "mock" };
    model =
      modelConfig.mode === "provider"
        ? { modelName: modelConfig.modelName, apiKey: modelConfig.apiKey }
        : { generate: mockGenerate };
    const browser = await localBrowser.launch({
      headless: params.headless ?? true,
      ...(params.executablePath ? { executablePath: params.executablePath } : {}),
    });
    stagehand = await Stagehand.create({ browser, model });
    return { initialized: stagehand.initialized };
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

  async screenshot() {
    const p = await ensurePage();
    const bytes = await p.screenshot({ type: "png" });
    return { pngBase64: Buffer.from(bytes).toString("base64") };
  },

  async pageInfo() {
    const p = await ensurePage();
    return { url: await p.url(), title: await p.title() };
  },

  async close() {
    try { await stagehand?.close(); } catch {}
    stagehand = undefined;
    page = undefined;
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
