/**
 * @fileoverview DEPRECATED - This file is deprecated and will be removed in v2.0.
 * 
 * MIGRATION GUIDE:
 * 
 * OLD (deprecated):
 *   import { execFacade } from './execution/exec.facade';
 *   await execFacade.startRun({ input: '...', modelId: '...' });
 * 
 * NEW (recommended):
 *   import { api } from '@allternit/platform';
 *   const session = await api.createSession(modelId);
 *   await api.sendMessage(session.id, input);
 *   const events = api.connectEventStream(session.id);
 * 
 * See: MIGRATION_PLAN.md for complete migration guide.
 * @deprecated Use api-client.ts instead
 */

import { execEvents } from './exec.events';
import { RunRequest } from './exec.types';

// Deprecation warning (silenced for production)
// console.warn('[DEPRECATED] exec.facade.ts is deprecated. Use api-client.ts instead.');

type BrainType = "cli" | "api" | "local";

type BrainRequirement =
  | { kind: "binary"; name: string }
  | { kind: "env_var"; name: string }
  | { kind: "dependency"; name: string; package_manager: string };

type BrainConfig = {
  id: string;
  name: string;
  brain_type: BrainType;
  model?: string | null;
  endpoint?: string | null;
  api_key_env?: string | null;
  command?: string | null;
  args?: string[] | null;
  env?: Record<string, string> | null;
  cwd?: string | null;
  requirements: BrainRequirement[];
  sandbox?: {
    workspace_only: boolean;
    network_enabled: boolean;
    tool_allowlist?: string[] | null;
  } | null;
};

type BrainEvent =
  | { type: "session.created"; payload: { session_id: string } }
  | { type: "session.status"; payload: { status: string } }
  | { type: "chat.delta"; payload: { text: string } }
  | { type: "chat.message.completed"; payload: { text: string } }
  | { type: "terminal.delta"; payload: { data: string; stream: string } }
  | { type: "tool.call"; payload: { tool_id: string; call_id: string; args: string } }
  | { type: "tool.result"; payload: { tool_id: string; call_id: string; result: string } }
  | { type: "artifact.created"; payload: { id: string; kind: string; content: string } }
  | { type: "error"; payload: { message: string } }
  | { type: string; payload: any };

const DEFAULT_KERNEL_URL = "http://127.0.0.1:3004";

function kernelUrl() {
  return (window as any).__A2R_KERNEL_URL__ || DEFAULT_KERNEL_URL;
}

function buildBrainConfig(modelId: string): BrainConfig {
  switch (modelId) {
    case "claude-code":
      return {
        id: "claude-code",
        name: "Claude Code CLI",
        brain_type: "cli",
        model: "claude-3-5-sonnet",
        api_key_env: "ANTHROPIC_API_KEY",
        command: "claude",
        args: ["--output-format", "stream-json"],
        requirements: [{ kind: "binary", name: "claude" }],
      };
    case "codex":
    default:
      return {
        id: "codex",
        name: "Codex CLI",
        brain_type: "cli",
        model: "codex",
        api_key_env: "OPENAI_API_KEY",
        command: "codex",
        args: [],
        requirements: [{ kind: "binary", name: "codex" }],
      };
  }
}

class ExecutionFacade {
  async startRun(request: RunRequest): Promise<string> {
    const runId = 'run-' + Date.now();
    execEvents.emit('onRunStart', { runId });

    const modelId = (request as any).modelId || 'codex';
    const config = buildBrainConfig(modelId);
    const sessionRes = await fetch(`${kernelUrl()}/v1/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ config, profile_id: modelId }),
    });

    if (!sessionRes.ok) {
      const errorText = await sessionRes.text();
      execEvents.emit('onRunComplete', {
        runId,
        status: 'failed',
        output: errorText || `Failed to create brain session (${sessionRes.status})`,
      });
      return runId;
    }

    const session = await sessionRes.json();
    const sessionId: string = session.id || runId;

    let completed = false;
    const completeRun = (output: string, status: "completed" | "failed" = "completed") => {
      if (completed) return;
      completed = true;
      execEvents.emit("onRunComplete", { runId: sessionId, status, output });
    };

    const eventSource = new EventSource(`${kernelUrl()}/v1/sessions/${sessionId}/events`);
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as BrainEvent;
        switch (data.type) {
          case "chat.delta":
            execEvents.emit("onLog", {
              runId: sessionId,
              level: "INFO",
              message: data.payload.text,
              timestamp: Date.now(),
            });
            break;
          case "terminal.delta":
            execEvents.emit("onLog", {
              runId: sessionId,
              level: data.payload.stream === "stderr" ? "ERROR" : "INFO",
              message: data.payload.data,
              timestamp: Date.now(),
            });
            break;
          case "tool.call": {
            let parsedArgs: any = {};
            if (data.payload.args) {
              try {
                parsedArgs = JSON.parse(data.payload.args);
              } catch {
                parsedArgs = { raw: data.payload.args };
              }
            }
            execEvents.emit("onToolCall", {
              id: data.payload.call_id,
              runId: sessionId,
              toolName: data.payload.tool_id,
              args: parsedArgs,
              status: "running",
            });
            break;
          }
          case "tool.result":
            execEvents.emit("onToolCall", {
              id: data.payload.call_id,
              runId: sessionId,
              toolName: data.payload.tool_id,
              args: {},
              status: "complete",
              result: data.payload.result,
            });
            break;
          case "artifact.created":
            import("../../views/cowork/ArtifactStore").then(({ useArtifactStore }) => {
              useArtifactStore.getState().createArtifact(
                data.payload.kind,
                `artifact-${data.payload.id}`,
                data.payload.content
              );
            });
            break;
          case "chat.message.completed":
            completeRun(data.payload.text || "Done");
            break;
          case "error":
            completeRun(data.payload.message || "Kernel error", "failed");
            break;
          case "session.status":
            if (data.payload.status === "exited" || data.payload.status === "terminated") {
              completeRun("Session ended");
            }
            break;
          default:
            break;
        }
      } catch (err) {
        execEvents.emit("onLog", {
          runId: sessionId,
          level: "ERROR",
          message: "Failed to parse brain event",
          timestamp: Date.now(),
        });
      }
    };

    eventSource.onerror = () => {
      if (!completed) {
        completeRun("Event stream closed", "failed");
      }
    };

    await fetch(`${kernelUrl()}/v1/sessions/${sessionId}/input`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request.input + "\n"),
    });

    return sessionId;
  }
}

export const execFacade = new ExecutionFacade();
