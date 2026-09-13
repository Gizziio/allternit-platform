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
 *   --mock-model     canned structured outputs (default when no gateway key)
 *   (no flag)        allternit gateway (ALLTERNIT_GATEWAY_KEY + optional
 *                    ALLTERNIT_GATEWAY_URL / ALLTERNIT_BROWSER_RUNTIME_MODEL)
 *
 * Usage (from packages/sdk-ts, after `pnpm run build` at the workspace root):
 *   pnpm exec tsx scripts/smoke-stagehand.ts [--mock-model]
 */

import { createServer } from "node:http";
import { z } from "zod/v4";
import { Stagehand, localBrowser } from "../src/index.js";
import { createStagehandProvider } from "../../../../allternit-browser/src/protocol/remote-provider.js";

const MOCK = process.argv.includes("--mock-model") || !process.env.ALLTERNIT_GATEWAY_KEY;
const MODEL_MODE = MOCK
  ? "mock (canned structured outputs)"
  : `allternit gateway (${process.env.ALLTERNIT_BROWSER_RUNTIME_MODEL ?? "claude-sonnet-5"})`;

const TEST_PAGE = `<!doctype html>
<html><head><title>ABR Smoke Page</title></head>
<body>
  <h1 id="headline">Allternit Browser Runtime Smoke Page</h1>
  <button id="increment" type="button" onclick="document.querySelector('#counter').textContent = String(Number(document.querySelector('#counter').textContent) + 1)">Increment counter</button>
  <button id="toggle" type="button" onclick="const f = document.querySelector('#flag'); f.textContent = f.textContent === 'off' ? 'on' : 'off';">Toggle flag</button>
  <p id="counter">0</p>
  <p id="flag">off</p>
  <button id="alertbtn" type="button" onclick="alert('smoke dialog')">Trigger alert</button>
  <input id="file" type="file" onchange="document.querySelector('#fname').textContent = this.files[0]?.name ?? ''" />
  <p id="fname"></p>
</body></html>`;

let passed = 0;
let failed = 0;
function report(step: string, ok: boolean, detail = ""): void {
  const tag = ok ? "PASS" : "FAIL";
  if (ok) passed++; else failed++;
  console.log(`[${tag}] ${step}${detail ? ` — ${detail}` : ""}`);
}

// ---------------------------------------------------------------------------
// Static test page server (localhost only; no public internet). The
// /smoke-download route answers with Content-Disposition: attachment so a
// plain navigate triggers a real download into the sandbox downloads dir.
// ---------------------------------------------------------------------------
const DOWNLOAD_BODY = "smoke-download-body";
const server = createServer((req, res) => {
  if (req.url === "/smoke-download") {
    res.writeHead(200, {
      "content-type": "text/plain",
      "content-disposition": 'attachment; filename="smoke-download.txt"',
    });
    res.end(DOWNLOAD_BODY);
    return;
  }
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

/** Text content out of the protocol's message-content shapes. */
function textOfContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map((block: any) => block?.text ?? "").join("\n");
  }
  return (content as any)?.text ?? "";
}

/**
 * Gateway-backed client-LLM callback (P1): all inference goes through the
 * allternit gateway's OpenAI-compatible surface, never to a provider key
 * directly and never to Browserbase. Fail-closed on unreachable gateway or
 * non-JSON structured output.
 */
async function gatewayGenerate(params: any): Promise<any> {
  const baseUrl = (process.env.ALLTERNIT_GATEWAY_URL ?? "http://127.0.0.1:8013").replace(/\/+$/, "");
  const apiKey = process.env.ALLTERNIT_GATEWAY_KEY ?? "";
  const model = process.env.ALLTERNIT_BROWSER_RUNTIME_MODEL ?? "claude-sonnet-5";
  if (!apiKey) throw new Error("ALLTERNIT_GATEWAY_KEY is required for gateway model mode");
  const messages = (params.messages ?? []).map((m: any) => ({
    role: m.role,
    content: textOfContent(m.content),
  }));
  const wantsJson = params.responseFormat?.type === "json_schema";
  const body: Record<string, unknown> = { model, messages };
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
  let resp: Response;
  try {
    resp = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
    });
  } catch (error) {
    throw new Error(`allternit gateway unreachable: ${error instanceof Error ? error.message : String(error)}`);
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
    let structuredContent: unknown;
    try {
      structuredContent = JSON.parse(content);
    } catch {
      throw new Error("allternit gateway returned non-JSON content for a structured call");
    }
    return { ...base, outputFormat: "json_schema", structuredContent };
  }
  return { ...base, outputFormat: "text" };
}

async function realGenerate(params: any): Promise<any> {
  return gatewayGenerate(params);
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
  const { mkdtempSync, writeFileSync, existsSync, readFileSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { createHash } = await import("node:crypto");
  const sandboxDir = mkdtempSync(join(tmpdir(), "abr-smoke-"));
  const provider = createStagehandProvider({ baseUrl: 'sidecar://local', headless: true, sandboxDir });
  const intent = (kind: string, input: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
    schemaVersion: "1.0" as const,
    actionId: `smoke-${kind}`,
    runId: "smoke-run",
    sessionId: "smoke-session",
    kind: kind as any,
    reason: `provider stub smoke ${kind}`,
    input,
    ...extra,
  });
  const events = await provider.execute(intent("navigate", { url: testUrl }));
  const clickEvents = await provider.execute(intent("click", {}, { targetDescription: "Increment counter" }));
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

  // 7. screenshot intent: SHA-256 hash of the PNG recorded at capture time
  const shotEvents = await provider.execute(intent("screenshot", {}));
  const shotPayload = (shotEvents[0]?.payload ?? {}) as { pngBase64?: string; sha256?: string | null };
  const shotHashOk =
    typeof shotPayload.pngBase64 === "string" &&
    typeof shotPayload.sha256 === "string" &&
    shotPayload.sha256 === createHash("sha256").update(Buffer.from(shotPayload.pngBase64, "base64")).digest("hex");
  report(
    "provider screenshot (sha256 at capture time)",
    shotHashOk,
    `sha256=${shotPayload.sha256?.slice(0, 12)}…`,
  );

  // 8. tab intents: open a second tab, focus it, observe, close it
  const openEvents = await provider.execute(intent("tab.open", { url: testUrl }));
  const openedTab = (openEvents[0]?.payload ?? {}) as { pageId?: string };
  const focusEvents = await provider.execute(
    intent("tab.focus", { pageId: openedTab.pageId }),
  );
  const tabObservation = await provider.observe("smoke-session");
  const closeEvents = await provider.execute(
    intent("tab.close", { pageId: openedTab.pageId }),
  );
  report(
    "provider tabs (open + focus + observe + close)",
    Boolean(openedTab.pageId) &&
      focusEvents[0]?.payload?.state !== "failed" &&
      tabObservation.url.startsWith("http://127.0.0.1") &&
      closeEvents[0]?.payload?.state !== "failed",
    `tab=${openedTab.pageId?.slice(0, 8)}… url=${tabObservation.url}`,
  );

  // 9. dialog intents: navigate to a page that alerts shortly after load,
  //    then accept the dialog (a modal during navigation would deadlock the
  //    sequential request flow, so the alert is deferred past the load event).
  await provider.execute(intent("navigate", { url: 'data:text/html,<body>dialog page<script>setTimeout(() => alert("smoke dialog"), 300)</script></body>' }));
  const dialogEvents = await provider.execute(
    intent("dialog.accept", {}, { targetDescription: "accept the smoke alert" }),
  );
  const dialogPayload = (dialogEvents[0]?.payload ?? {}) as { handled?: boolean; dialogType?: string };
  await provider.execute(intent("navigate", { url: testUrl }));
  report(
    "provider dialog.accept (host-side CDP over the page target)",
    dialogPayload.handled === true && dialogPayload.dialogType === "alert",
    JSON.stringify(dialogPayload),
  );

  // 10. file.upload intent: sandbox-contained path upload + escape refusal
  const uploadFile = join(sandboxDir, "smoke-upload.txt");
  writeFileSync(uploadFile, "smoke upload payload");
  const uploadEvents = await provider.execute(
    intent("file.upload", { selector: "#file", files: [{ path: "smoke-upload.txt" }] }),
  );
  const escapeEvents = await provider.execute(
    intent("file.upload", { selector: "#file", files: [{ path: "../../etc/passwd" }] }),
  );
  const uploadPayload = (uploadEvents[0]?.payload ?? {}) as { uploaded?: number };
  const escapePayload = (escapeEvents[0]?.payload ?? {}) as { state?: string; error?: string };
  report(
    "provider file.upload (sandbox-contained) + escape refusal",
    uploadPayload.uploaded === 1 && escapePayload.state === "failed",
    `uploaded=${uploadPayload.uploaded} escape=${escapePayload.error ?? escapePayload.state}`,
  );

  // 11. download intent: attachment navigate lands in the sandbox downloads
  //    dir; the download intent lists it, and the bytes are on disk.
  await provider.execute(intent("navigate", { url: `${testUrl}smoke-download` }));
  await new Promise((resolve) => setTimeout(resolve, 500));
  const downloadEvents = await provider.execute(intent("download", {}));
  const downloadPayload = (downloadEvents[0]?.payload ?? {}) as {
    downloads?: Array<{ name: string; size: number }>;
  };
  const downloaded = downloadPayload.downloads?.find((d) => d.name === "smoke-download.txt");
  const onDisk = downloaded
    ? readFileSync(join(sandboxDir, "downloads", "smoke-download.txt"), "utf8")
    : null;
  report(
    "provider download (attachment lands in run sandbox, intent lists it)",
    downloaded?.size === DOWNLOAD_BODY.length && onDisk === DOWNLOAD_BODY,
    `downloads=${JSON.stringify(downloadPayload.downloads ?? [])}`,
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
