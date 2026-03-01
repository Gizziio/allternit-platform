import { tool } from "ai";
import z from "zod";
import type { CostAccumulator } from "@/lib/credits/cost-accumulator";
import { createModuleLogger } from "@/lib/logger";
import { toolsDefinitions } from "./tools-definitions";
import { 
  executeSmart, 
  getSandboxStatus, 
  warmupSandboxes,
  getSandboxCapabilities 
} from "@/lib/sandbox/smart-sandbox";

const log = createModuleLogger("code-execution");

// Warm up on startup
warmupSandboxes().catch(err => log.warn({ err }, "Failed to warm up sandboxes"));

export const codeExecution = ({
  costAccumulator,
}: {
  costAccumulator?: CostAccumulator;
}) =>
  tool({
    description: `Execute code in a secure sandbox environment.

Automatically selects the best execution method based on your code:
- ⚡ WebAssembly (WASM) - Instant startup for simple Python with numpy/pandas
- 🐳 Docker Pool - Fast startup for complex Python with any pip package
- 🖥️ WebVM - Full Linux VM for multi-language or system-level tasks

SUPPORTED LANGUAGES:
- Python (default) - All sandboxes
- JavaScript/Node.js - WebVM only
- Bash/Shell - WebVM only  
- Rust - WebVM only

INSTALLING PACKAGES:
- Python: Add '!pip install package_name' at the top
- WebVM: Use 'apt-get install' for system packages

SECURITY:
- All sandboxes are isolated with no network access
- Resource limits: 512MB RAM, 1 CPU core, 30s timeout
- Docker: Containerized with auto-cleanup
- WebVM: Browser-based VM with Linux environment

OUTPUT:
- Print values with 'print()' 
- Assign to 'result' or 'results' to auto-print
- Charts are auto-captured from matplotlib`,
    inputSchema: z.object({
      title: z.string().describe("The title of the code snippet."),
      code: z.string().describe("The code to execute."),
      language: z
        .enum(["python", "javascript", "bash", "rust"])
        .optional()
        .describe("Programming language (default: python)"),
    }),
    execute: async ({ 
      code, 
      title, 
      language = "python" 
    }: { 
      code: string; 
      title: string; 
      language?: "python" | "javascript" | "bash" | "rust";
    }) => {
      const requestId = `ci-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      
      log.info({ requestId, title, language }, "Starting code execution");

      // Check sandbox availability
      const status = await getSandboxStatus();
      const anyAvailable = status.wasm.available || status.docker.available || status.webvm.available;
      
      if (!anyAvailable) {
        const capabilities = getSandboxCapabilities();
        return {
          message: `No sandbox available.\n\nTo enable code execution:\n1. Docker (for Python): https://docs.docker.com/get-docker/\n2. WebVM Service (for multi-language): Start the webvm-service\n3. WebAssembly (for simple Python): Use a modern browser\n\nSandbox Capabilities:\n- WASM: ${capabilities.wasm.languages.join(", ")}\n- Docker: ${capabilities.docker.languages.join(", ")}\n- WebVM: ${capabilities.webvm.languages.join(", ")}`,
          chart: "",
        };
      }

      try {
        const result = await executeSmart({
          code,
          requestId,
          language,
          preferredMethod: "auto",
        });

        // Track cost
        costAccumulator?.addAPICost(
          "codeExecution",
          toolsDefinitions.codeExecution.cost
        );

        if (!result.success) {
          log.warn({ 
            requestId, 
            error: result.error, 
            method: result.method 
          }, "Code execution failed");
          
          return {
            message: `Execution failed (${result.method}, ${result.duration}ms): ${result.error || "Unknown error"}`,
            chart: result.chart || "",
          };
        }

        log.info({ 
          requestId, 
          method: result.method, 
          duration: result.duration 
        }, "Code execution successful");
        
        // Method emoji
        const methodEmoji = {
          wasm: "⚡ WASM",
          docker: "🐳 Docker",
          webvm: "🖥️ WebVM",
          none: "❌ None",
        }[result.method];
        
        return {
          message: `${methodEmoji} (${result.duration}ms):\n\n${result.output}`,
          chart: result.chart || "",
        };
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        log.error({ err, requestId }, "Code execution error");
        return {
          message: `Sandbox execution failed: ${errorMessage}`,
          chart: "",
        };
      }
    },
  });

/**
 * Get sandbox status for UI display
 */
export async function getCodeExecutionStatus(): Promise<{
  available: boolean;
  methods: { name: string; available: boolean }[];
}> {
  const status = await getSandboxStatus();
  
  return {
    available: status.wasm.available || status.docker.available || status.webvm.available,
    methods: [
      { name: "WebAssembly (WASM)", available: status.wasm.available },
      { name: "Docker Pool", available: status.docker.available },
      { name: "WebVM (Full Linux)", available: status.webvm.available },
    ],
  };
}
