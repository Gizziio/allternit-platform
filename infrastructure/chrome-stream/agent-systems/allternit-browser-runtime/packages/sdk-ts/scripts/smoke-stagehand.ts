/**
 * Allternit Browser Runtime — P0 smoke test.
 *
 * Launches local Chrome via the vendored runtime (side-loaded "Allternit
 * Browser Runtime" extension), serves a static test page from localhost,
 * then prints PASS/FAIL for:
 *   1. init          — extension handshake (protocol version + binding)
 *   2. act           — click the increment button (model-driven)
 *   3. observe       — model-driven observation of interactive elements
 *   4. extract       — model-driven structured extraction
 *   5. batch         — experimentalBatch with 3 sequential actions
 *   6. provider stub — createStagehandProvider() over the stdio sidecar
 *
 * Model modes:
 *   --mock-model     canned structured outputs (default when no key in env)
 *   (no flag)        uses OPENAI_API_KEY or ANTHROPIC_API_KEY from env if present
 *
 * Usage (from packages/sdk-ts, after `pnpm run build` at the workspace root):
 *   pnpm exec tsx scripts/smoke-stagehand.ts [--mock-model]
 */

import { createServer } from "node:http";
import { z } from "zod/v4";
import { Stagehand, localBrowser } from "../src/index.js";
import { createStagehandProvider } from "../../../../allternit-browser/src/protocol/remote-provider.js";

const MOCK = process.argv.includes("--mock-model") ||
  (!process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY);
const MODEL_MODE = MOCK
  ? "mock (canned structured outputs)"
  : process.env.OPENAI_API_KEY
    ? "openai/gpt-4.1-mini (direct provider key)"
    : "anthropic/claude-sonnet-4-5 (direct provider key)";

const TEST_PAGE = `<!doctype html>
<html><head><title>ABR Smoke Page</title></head>
<body>
  <h1 id="headline">Allternit Browser Runtime Smoke Page</h1>
  <button id="increment" type="button" onclick="document.querySelector('#counter').textContent = String(Number(document.querySelector('#counter').textContent) + 1)">Increment counter</button>
  <button id="toggle" type="button" onclick="const f = document.querySelector('#flag'); f.textContent = f.textContent === 'off' ? 'on' : 'off';">Toggle flag</button>
  <p id="counter">0</p>
  <p id="flag">off</p>
</body></html>`;

let passed = 0;
let failed = 0;
function report(step: string, ok: boolean, detail = ""): void {
  const tag = ok ? "PASS" : "FAIL";
  if (ok) passed++; else failed++;
  console.log(`[${tag}] ${step}${detail ? ` — ${detail}` : ""}`);
}

// ---------------------------------------------------------------------------
// Static test page server (localhost only; no public internet).
// ---------------------------------------------------------------------------
const server = createServer((req, res) => {
  res.writeHead(200, { "content-type": "text/html" });
  res.end(TEST_PAGE);
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const testUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}/`;

// ---------------------------------------------------------------------------
// Model: client-LLM callback (bounces to this host process) — either canned
// mock outputs or a direct provider call from env keys.
// ---------------------------------------------------------------------------



interface TreeElement {
  elementId: string;
  role: string;
  name: string;
}

/** Parse `[<id>] <role>: <name>` lines out of the accessibility tree in the prompt. */
function parseTree(prompt: string): TreeElement[] {
  const elements: TreeElement[] = [];
  const re = /^\s*\[(\d+-\d+)\]\s*([a-zA-Z ]+?)(?::\s*([^\n]+?))?\s*$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(prompt)) !== null) {
    elements.push({ elementId: m[1], role: m[2].trim(), name: (m[3] ?? "").trim() });
  }
  return elements;
}

function instructionFrom(prompt: string): string {
  const m = /instruction:\s*([^\n]+)/.exec(prompt);
  return m?.[1]?.toLowerCase() ?? "";
}

function pickElement(prompt: string, prefer: RegExp): TreeElement | undefined {
  const elements = parseTree(prompt);
  return (
    elements.find((e) => prefer.test(e.name)) ??
    elements.find((e) => e.role === "button") ??
    elements[0]
  );
}

const FAKE_USAGE = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };

async function realGenerate(params: any): Promise<any> {
  const modelName = process.env.OPENAI_API_KEY ? "openai/gpt-4.1-mini" : "anthropic/claude-sonnet-4-5";
  const apiKey = process.env.OPENAI_API_KEY ?? process.env.ANTHROPIC_API_KEY ?? "";
  const { createAiSdkLanguageModel, generateWithAiSdk } = await import(
    "../../../extension/llm/aiSdkClient.js"
  );
  return await generateWithAiSdk(
    createAiSdkLanguageModel({ modelName, apiKey } as any, params),
    params,
  );
}

/** Canned structured outputs for Act / Observation / Extraction / Metadata calls. */
async function mockGenerate(params: any): Promise<any> {
  const prompt = (params.messages ?? [])
    .map((m: any) => (typeof m.content === "string" ? m.content : (m.content?.text ?? "")))
    .join("\n");
  const name: string = params.responseFormat?.name ?? "";
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
      : /increment|count|click/i;
    const el = pickElement(prompt, prefer);
    if (!el) throw new Error("mock model: no element found in tree");
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
      .slice(0, 5)
      .map((e) => ({
        elementId: e.elementId,
        description: `mock observation of ${e.name || e.role}`,
        method: "click",
        arguments: [],
      }));
    return { ...base, outputFormat: "json_schema", structuredContent: { elements } };
  }

  if (name === "Extraction") {
    return {
      ...base,
      outputFormat: "json_schema",
      structuredContent: { headline: "Allternit Browser Runtime Smoke Page", counter: 0 },
    };
  }

  if (name === "Metadata") {
    return { ...base, outputFormat: "json_schema", structuredContent: { progress: "done", completed: true } };
  }

  // Fallback: echo an empty structured object matching the requested schema shape.
  return { ...base, outputFormat: "json_schema", structuredContent: {} };
}

const model = MOCK ? { generate: mockGenerate } : { generate: realGenerate };

// ---------------------------------------------------------------------------
// Smoke steps.
// ---------------------------------------------------------------------------
let browser: Awaited<ReturnType<typeof localBrowser.launch>> | undefined;
let stagehand: Stagehand | undefined;

try {
  console.log(`smoke: model mode = ${MODEL_MODE}`);
  console.log(`smoke: test page = ${testUrl}`);

  // 1. launch + init (this is where the sdk↔extension handshake happens)
  browser = await localBrowser.launch({ headless: true });
  stagehand = await Stagehand.create({ browser, model });
  report("init (local Chrome launched, extension handshake complete)", stagehand.initialized);

  const page = await stagehand.browser.context.newPage();
  await page.goto(testUrl);
  await page.waitForLoadState("load");

  // 2. act: click the increment button (model picks the element from the a11y tree)
  const actResult = await stagehand.act("click the Increment counter button");
  const counterAfterAct = await page.evaluate(() => document.querySelector("#counter")?.textContent);
  report(
    "act (click 'Increment counter')",
    actResult.data.success === true && counterAfterAct === "1",
    `success=${actResult.data.success} message=${actResult.data.message} counter=${counterAfterAct}`,
  );

  // 3. observe
  const observeResult = await stagehand.observe("find the buttons on the page");
  const observed = observeResult.data ?? [];
  report(
    "observe (buttons on page)",
    observed.length > 0 && observed.some((a) => /increment/i.test(a.description)),
    `${observed.length} action(s) suggested: ${observed.map((a) => a.description).join("; ")}`,
  );

  // 4. extract
  const extractResult = await stagehand.extract(
    "get the page headline and counter value",
    z.object({ headline: z.string(), counter: z.number() }),
  );
  const data = extractResult.data as { headline?: string; counter?: unknown };
  report(
    "extract (headline + counter)",
    typeof data.headline === "string" && data.headline.includes("Smoke Page") && typeof data.counter === "number",
    JSON.stringify(data),
  );

  // 5. experimentalBatch: 3 sequential model-driven actions
  const batchResult = await stagehand.experimentalBatch(
    async (batch) => {
      const r1 = await batch.act("click the Increment counter button");
      const r2 = await batch.act("click the Increment counter button");
      const r3 = await batch.act("click the Toggle flag button");
      return { steps: [r1.data.success, r2.data.success, r3.data.success] };
    },
    undefined,
    { timeout: 60_000 },
  );
  const counterAfterBatch = await page.evaluate(() => document.querySelector("#counter")?.textContent);
  const flagAfterBatch = await page.evaluate(() => document.querySelector("#flag")?.textContent);
  report(
    "experimentalBatch (3 sequential actions)",
    batchResult.steps.every(Boolean) && counterAfterBatch === "3" && flagAfterBatch === "on",
    `steps=${JSON.stringify(batchResult.steps)} counter=${counterAfterBatch} flag=${flagAfterBatch}`,
  );

  // 6. provider stub over the stdio sidecar (P0 wiring of createStagehandProvider)
  const provider = createStagehandProvider({ baseUrl: 'sidecar://local', headless: true });
  const events = await provider.execute({
    schemaVersion: "1.0",
    actionId: "smoke-1",
    runId: "smoke-run",
    sessionId: "smoke-session",
    kind: "navigate",
    reason: "provider stub smoke",
    input: { url: testUrl },
  });
  const clickEvents = await provider.execute({
    schemaVersion: "1.0",
    actionId: "smoke-2",
    runId: "smoke-run",
    sessionId: "smoke-session",
    kind: "click",
    reason: "provider stub smoke click",
    targetDescription: "Increment counter",
    input: {},
  });
  const observation = await provider.observe("smoke-session");
  const providerOk =
    events.length > 0 &&
    clickEvents.length > 0 &&
    observation.url.startsWith("http://127.0.0.1");
  report(
    "provider stub (createStagehandProvider over sidecar: navigate + click + observe)",
    providerOk,
    `events=${events.length + clickEvents.length} observation.url=${observation.url}`,
  );
  await provider.close("smoke-session");
} catch (error) {
  failed++;
  console.log(`[FAIL] unexpected error — ${error instanceof Error ? error.message : String(error)}`);
  if (error instanceof Error && error.stack) console.log(error.stack);
} finally {
  try { await stagehand?.close(); } catch {}
  try { await browser?.close(); } catch {}
  server.close();
}

console.log(`\nsmoke: ${passed} passed, ${failed} failed (model mode: ${MODEL_MODE})`);
process.exit(failed === 0 ? 0 : 1);
