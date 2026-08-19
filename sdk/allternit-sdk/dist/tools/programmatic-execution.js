/**
 * Programmatic Tool Execution
 *
 * Enables code running inside the sandboxed executor to invoke
 * registered Allternit tools via a structured bridge protocol.
 *
 * Protocol: sandboxed code emits `__ALLTERNIT_TOOL_CALL__<json>\n` on stdout.
 * The bridge intercepts those lines, executes the tool via the registry,
 * and returns the result via a sidecar JSON file that the sandboxed code
 * can read.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
const TOOL_CALL_PREFIX = '__ALLTERNIT_TOOL_CALL__';
const TOOL_RESULT_PREFIX = '__ALLTERNIT_TOOL_RESULT__';
/**
 * Executes a single bridge tool call against the registry.
 */
async function executeBridgeToolCall(registry, call) {
    const tool = registry.getTool(call.name);
    if (!tool) {
        return { id: call.id, name: call.name, error: `Tool "${call.name}" not found` };
    }
    if (!tool.execute) {
        return { id: call.id, name: call.name, error: `Tool "${call.name}" has no execute handler` };
    }
    try {
        if (tool.preExecute) {
            const gate = await tool.preExecute(call.arguments, {});
            if (!gate.proceed) {
                return { id: call.id, name: call.name, error: gate.reason ?? 'Blocked by preExecute' };
            }
        }
        const result = await tool.execute(call.arguments, {});
        return { id: call.id, name: call.name, result };
    }
    catch (err) {
        return { id: call.id, name: call.name, error: err instanceof Error ? err.message : String(err) };
    }
}
/**
 * Parses bridge tool calls from stdout lines and returns the cleaned output
 * plus the extracted calls.
 */
export function parseBridgeOutput(stdout) {
    const calls = [];
    const cleanLines = [];
    for (const line of stdout.split('\n')) {
        if (line.startsWith(TOOL_CALL_PREFIX)) {
            try {
                const json = line.slice(TOOL_CALL_PREFIX.length);
                const parsed = JSON.parse(json);
                if (parsed.name) {
                    calls.push(parsed);
                    continue;
                }
            }
            catch {
                // Malformed bridge line — pass through as normal output
            }
        }
        cleanLines.push(line);
    }
    return { cleanedStdout: cleanLines.join('\n'), calls };
}
/**
 * Generates the helper code injected into the sandbox so user code can
 * invoke tools via `allternit_tool(name, args)`.
 */
export function bridgeHelperCode(language, bridgeDir) {
    if (language.startsWith('python')) {
        return `
import json, os, uuid, sys
def allternit_tool(name, args=None):
    call_id = str(uuid.uuid4())
    payload = json.dumps({"id": call_id, "name": name, "arguments": args or {}})
    print(f"${TOOL_CALL_PREFIX}" + payload, flush=True)
    result_path = os.path.join(${JSON.stringify(bridgeDir)}, call_id + ".json")
    import time
    for _ in range(300):
        if os.path.exists(result_path):
            with open(result_path) as f:
                data = json.load(f)
            if "error" in data and data["error"]:
                raise RuntimeError(data["error"])
            return data.get("result")
        time.sleep(0.1)
    raise TimeoutError("Tool call timed out waiting for bridge response")
`.trim();
    }
    if (language === 'node' || language === 'javascript') {
        return `
const { readFileSync, existsSync } = require("fs");
const { join } = require("path");
const { randomUUID } = require("crypto");
function allternit_tool(name, args = {}) {
  const id = randomUUID();
  const payload = JSON.stringify({ id, name, arguments: args });
  process.stdout.write("${TOOL_CALL_PREFIX}" + payload + "\\n");
  const resultPath = join(${JSON.stringify(bridgeDir)}, id + ".json");
  for (let i = 0; i < 300; i++) {
    if (existsSync(resultPath)) {
      const data = JSON.parse(readFileSync(resultPath, "utf8"));
      if (data.error) throw new Error(data.error);
      return data.result;
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
  }
  throw new Error("Tool call timed out waiting for bridge response");
}
`.trim();
    }
    return '';
}
/**
 * Creates a programmatic execution wrapper around a code execution runner.
 *
 * The wrapper injects a bridge helper into the sandbox, intercepts tool call
 * requests from stdout, executes them via the registry, and writes results
 * back so the sandboxed code can continue.
 */
export class ProgrammaticToolExecutor {
    registry;
    maxToolCalls;
    toolCallTimeoutSeconds;
    constructor(options) {
        this.registry = options.registry;
        this.maxToolCalls = options.maxToolCalls ?? 20;
        this.toolCallTimeoutSeconds = options.toolCallTimeoutSeconds ?? 30;
    }
    /**
     * Returns the list of tool descriptors available in the sandbox,
     * suitable for embedding in generated code or documentation.
     */
    toolManifest() {
        return this.registry.getActiveTools().map((tool) => ({
            name: tool.name,
            description: tool.description,
            parameters: tool.input_schema,
        }));
    }
    /**
     * Wraps a base runner with programmatic tool execution support.
     * Injects bridge helper code, processes bridge calls in a loop,
     * and returns the final result.
     */
    wrapRunner(baseRunner) {
        return {
            execute: async (request) => {
                return this.executeWithBridge(baseRunner, request);
            },
        };
    }
    async executeWithBridge(baseRunner, request) {
        const bridgeDir = join(tmpdir(), `allternit-bridge-${randomUUID()}`);
        await mkdir(bridgeDir, { recursive: true });
        const helper = bridgeHelperCode(request.language, bridgeDir);
        const injectedCode = helper ? `${helper}\n\n${request.code}` : request.code;
        const modifiedRequest = {
            ...request,
            code: injectedCode,
        };
        const result = await baseRunner.execute(modifiedRequest);
        const { cleanedStdout, calls } = parseBridgeOutput(result.stdout);
        if (calls.length === 0) {
            return { ...result, stdout: cleanedStdout };
        }
        if (calls.length > this.maxToolCalls) {
            return {
                ...result,
                stdout: cleanedStdout,
                stderr: `${result.stderr}\nBridge limit exceeded: ${calls.length} tool calls (max ${this.maxToolCalls})`,
                exit_code: 1,
                success: false,
            };
        }
        // Execute each tool call and write results to the bridge dir
        const toolResults = [];
        for (const call of calls) {
            const toolResult = await executeBridgeToolCall(this.registry, call);
            toolResults.push(toolResult);
            await writeFile(join(bridgeDir, `${call.id}.json`), JSON.stringify(toolResult), 'utf8');
        }
        // Re-run the code so the bridge helper can pick up results
        const rerunResult = await baseRunner.execute(modifiedRequest);
        const { cleanedStdout: finalStdout, calls: secondCalls } = parseBridgeOutput(rerunResult.stdout);
        // If the code made more bridge calls in the second run, include a warning
        const extraWarnings = [];
        if (secondCalls.length > 0) {
            extraWarnings.push(`Note: ${secondCalls.length} additional bridge calls after first resolution`);
        }
        return {
            stdout: finalStdout,
            stderr: [result.stderr, rerunResult.stderr, ...extraWarnings].filter(Boolean).join('\n'),
            exit_code: rerunResult.exit_code,
            success: rerunResult.success,
            artifacts: rerunResult.artifacts ?? result.artifacts,
        };
    }
}
