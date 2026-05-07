import { execEvents } from "./exec.events";
import type { ToolCall } from "./exec.types";

const DEFAULT_RUNTIME_URL = "http://localhost:8001";
const sessionsByRun = new Map<string, string>();

function runtimeUrl() {
  return (window as any).__ALLTERNIT_BROWSER_RUNTIME_URL__ || DEFAULT_RUNTIME_URL;
}

async function postJson(path: string, body?: any) {
  const res = await fetch(`${runtimeUrl()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : "{}",
  });
  if (!res.ok) throw new Error(`Browser runtime ${path} failed: ${res.status}`);
  return res.json();
}

async function ensureSession(runId: string, payload: any = {}) {
  if (payload.sessionId) {
    sessionsByRun.set(runId, payload.sessionId);
    return payload.sessionId as string;
  }
  if (sessionsByRun.has(runId)) return sessionsByRun.get(runId)!;
  const response = await postJson("/session", payload);
  const sessionId = response.sessionId as string;
  sessionsByRun.set(runId, sessionId);
  window.dispatchEvent(
    new CustomEvent("allternit:browser:spawn", {
      detail: { url: payload.url || "about:blank", title: payload.url || "Browser", sessionId },
    })
  );
  return sessionId;
}

async function handleBrowserTool(call: ToolCall) {
  const tool = call.toolName.replace(/^browser\./, "").toLowerCase();
  const args = call.args || {};

  if (tool === "open" || tool === "navigate") {
    const sessionId = await ensureSession(call.runId, { url: args.url, width: args.width, height: args.height });
    if (tool === "navigate") {
      await postJson(`/session/${sessionId}/navigate`, { url: args.url, waitUntil: args.waitUntil });
    }
    return;
  }

  const sessionId = await ensureSession(call.runId, { sessionId: args.sessionId });

  switch (tool) {
    case "click":
      await postJson(`/session/${sessionId}/click`, { selector: args.selector, button: args.button });
      break;
    case "type":
      await postJson(`/session/${sessionId}/type`, { text: args.text, selector: args.selector });
      break;
    case "scroll":
      await postJson(`/session/${sessionId}/scroll`, { deltaX: args.deltaX, deltaY: args.deltaY });
      break;
    case "back":
      await postJson(`/session/${sessionId}/back`);
      break;
    case "forward":
      await postJson(`/session/${sessionId}/forward`);
      break;
    case "reload":
      await postJson(`/session/${sessionId}/reload`);
      break;
    default:
      break;
  }
}

export function initBrowserSurfaceBridge() {
  const unsub = execEvents.on("onToolCall", (call) => {
    if (!call.toolName.startsWith("browser")) return;
    handleBrowserTool(call).catch((err) => {
      execEvents.emit("onLog", {
        runId: call.runId,
        level: "ERROR",
        message: `Browser tool mapping failed: ${err.message}`,
        timestamp: Date.now(),
      });
    });
  });

  return () => {
    unsub();
    sessionsByRun.clear();
  };
}
