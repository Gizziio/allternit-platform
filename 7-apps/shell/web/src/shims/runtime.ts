/**
 * @deprecated This file is deprecated and will be removed in v2.0.
 * 
 * MIGRATION GUIDE:
 * 
 * OLD (deprecated):
 *   import { RuntimeClient } from './shims/runtime';
 *   const client = new RuntimeClient(url);
 *   await client.runAgent(input, onEvent, modelId);
 * 
 * NEW (recommended):
 *   import { api } from '@a2r/platform';
 *   const session = await api.createSession(modelId);
 *   await api.sendMessage(session.id, input);
 *   const events = api.connectEventStream(session.id);
 *   events.onmessage = (e) => { ... };
 * 
 * This shim now delegates to the api-client for backward compatibility.
 * Please migrate to the api-client directly.
 */

import { api } from '@a2r/platform';

// Deprecation warning - silenced for production
let deprecationWarningShown = false;
function showDeprecationWarning() {
  // Silenced to reduce console noise
  // if (!deprecationWarningShown && typeof console !== 'undefined') {
  //   console.warn(
  //     '[DEPRECATED] runtime.ts is deprecated. ' +
  //     'Please migrate to api-client. See MIGRATION_PLAN.md for details.'
  //   );
  //   deprecationWarningShown = true;
  // }
}

export type RuntimeEvent = {
  t: string;
  runId: string;
  tool?: string;
  input?: any;
  output?: any;
  text?: string;
  result?: string;
  status?: "ok" | "error";
  error?: string;
  kind?: string;
  content?: string;
  title?: string;
};

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

// Map from api-client event types to RuntimeEvent types
function mapEventType(apiType: string): string {
  const mapping: Record<string, string> = {
    'session.created': 'run.started',
    'message.delta': 'model.output',
    'tool.call': 'tool.started',
    'tool.result': 'tool.output',
    'artifact.created': 'artifact.created',
    'message.completed': 'run.finished',
    'error': 'run.finished',
    'session.status': 'run.finished',
  };
  return mapping[apiType] || apiType;
}

/**
 * @deprecated Use api-client instead
 */
export class RuntimeClient {
  private _url: string;

  constructor(url: string) {
    showDeprecationWarning();
    this._url = url;
    console.warn(`[DEPRECATED] RuntimeClient constructed with URL: ${url}. This is ignored - using api-client instead.`);
  }

  async runAgent(
    input: string,
    onEvent: (ev: RuntimeEvent) => void,
    modelId?: string
  ): Promise<void> {
    showDeprecationWarning();
    
    const runId = `run-${Date.now()}`;
    onEvent({ t: "run.started", runId });

    try {
      // Use the new API client
      const session = await api.createSession(modelId || 'codex');
      const sessionId = session.id;
      
      let completed = false;

      const completeRun = (status: "ok" | "error", result?: string, error?: string) => {
        if (completed) return;
        completed = true;
        onEvent({ t: "run.finished", runId: sessionId, status, result, error });
      };

      // Connect to event stream
      const eventSource = api.connectEventStream(sessionId);
      
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          switch (data.type) {
            case 'message.delta':
              onEvent({ 
                t: "model.output", 
                runId: sessionId, 
                text: data.data?.content || data.data?.text || '' 
              });
              break;
              
            case 'terminal.delta':
              onEvent({ 
                t: "model.output", 
                runId: sessionId, 
                text: data.data?.data || '' 
              });
              break;
              
            case 'tool.call': {
              const parsedArgs = data.data?.arguments || data.data?.args || {};
              onEvent({ 
                t: "tool.started", 
                runId: sessionId, 
                tool: data.data?.tool || data.data?.tool_id, 
                input: parsedArgs 
              });
              break;
            }
            
            case 'tool.result':
              onEvent({ 
                t: "tool.output", 
                runId: sessionId, 
                tool: data.data?.tool || data.data?.tool_id, 
                output: data.data?.result || data.data?.output 
              });
              break;
              
            case 'artifact.created':
              onEvent({
                t: "artifact.created",
                runId: sessionId,
                kind: data.data?.kind,
                content: data.data?.content,
                title: data.data?.title || `artifact-${data.data?.id}`,
              });
              break;
              
            case 'message.completed':
              completeRun("ok", data.data?.content || data.data?.text || "Done");
              eventSource.close();
              break;
              
            case 'error':
              completeRun("error", undefined, data.data?.message || "Session error");
              eventSource.close();
              break;
              
            case 'session.status':
              if (data.data?.status === "exited" || data.data?.status === "terminated") {
                completeRun("ok", "Session ended");
                eventSource.close();
              }
              break;
              
            default:
              break;
          }
        } catch (err) {
          console.error('[RuntimeClient] Failed to parse event:', err);
          onEvent({ t: "model.output", runId: sessionId, text: "Failed to parse brain event" });
        }
      };

      eventSource.onerror = () => {
        if (!completed) {
          completeRun("error", undefined, "Event stream closed");
        }
        eventSource.close();
      };

      // Send the input
      await api.sendMessage(sessionId, input);
      
    } catch (error: any) {
      console.error('[RuntimeClient] Error:', error);
      onEvent({
        t: "run.finished",
        runId,
        status: "error",
        error: error?.message || "Runtime bridge failed",
      });
    }
  }
}

/**
 * @deprecated Use api-client instead
 */
export class RuntimeBridge {
  public readonly kernel: any;
  public readonly config: any;

  constructor(config: any) {
    showDeprecationWarning();
    this.config = config;
    this.kernel = config?.kernel;
  }

  get version() {
    return "0.0.0-browser-deprecated";
  }
}

/**
 * @deprecated Use api-client instead
 */
export function createRuntimeBridge(config: any) {
  showDeprecationWarning();
  return new RuntimeBridge(config);
}

// Re-export api for convenience
export { api };

// Only show deprecation warning in development to reduce console noise
if (process.env.NODE_ENV === 'development') {
  console.warn('[DEPRECATED] runtime.ts loaded. Please migrate to api-client.');
}
