/**
 * Docker-based Python Sandbox for Code Execution
 * Provides isolated, secure code execution using Docker containers
 */

import Docker from "dockerode";
import { createModuleLogger } from "@/lib/logger";

const log = createModuleLogger("docker-sandbox");

// Docker client
const docker = new Docker();

// Sandbox configuration
const SANDBOX_CONFIG = {
  image: "python:3.11-slim",
  memory: 512 * 1024 * 1024, // 512MB
  memorySwap: 512 * 1024 * 1024, // No swap
  cpuQuota: 100000, // 1 CPU core
  timeout: 30 * 1000, // 30 seconds
  networkDisabled: true, // No network access for security
};

export interface SandboxResult {
  success: boolean;
  output: string;
  error?: string;
  chart?: string; // base64 encoded chart image
}

export interface SandboxOptions {
  code: string;
  packages?: string[];
  requestId: string;
}

/**
 * Ensure the Python Docker image is available
 */
async function ensureImage(): Promise<void> {
  try {
    await docker.getImage(SANDBOX_CONFIG.image).inspect();
    log.debug("Docker image already exists");
  } catch {
    log.info(`Pulling Docker image: ${SANDBOX_CONFIG.image}`);
    const stream = await docker.pull(SANDBOX_CONFIG.image);
    
    return new Promise((resolve, reject) => {
      docker.modem.followProgress(stream, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

/**
 * Create a wrapper script that captures output and handles charts
 */
function createWrapperScript(code: string, packages: string[]): string {
  const packageInstall = packages.length > 0 
    ? `subprocess.check_call([sys.executable, "-m", "pip", "install", "--quiet", ${packages.map(p => `"${p}"`).join(", ")}])`
    : "";

  return `
import sys
import json
import traceback
import base64
import io
import os
import subprocess

# Suppress matplotlib display backend
os.environ['MPLBACKEND'] = 'Agg'

${packageInstall}

# Capture stdout
old_stdout = sys.stdout
sys.stdout = buffer = io.StringIO()

result = None
error = None

# Install matplotlib if charting might be needed
try:
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    HAS_MATPLOTLIB = True
except ImportError:
    HAS_MATPLOTLIB = False

try:
    # Execute user code
    exec_code = ${JSON.stringify(code)}
    exec(exec_code)
    
    # Check if 'result' variable was set
    if 'result' in locals():
        result = locals()['result']
    elif 'results' in locals():
        result = locals()['results']
        
except Exception as e:
    error = {
        "type": type(e).__name__,
        "message": str(e),
        "traceback": traceback.format_exc()
    }

# Get output
output = buffer.getvalue()
sys.stdout = old_stdout

# Save chart if matplotlib was used and a figure exists
chart_base64 = None
if HAS_MATPLOTLIB:
    try:
        fig = plt.gcf()
        if fig.get_axes():  # Check if there's actually a plot
            chart_buffer = io.BytesIO()
            fig.savefig(chart_buffer, format='png', bbox_inches='tight')
            chart_buffer.seek(0)
            chart_base64 = base64.b64encode(chart_buffer.read()).decode('utf-8')
            plt.close(fig)
    except Exception:
        pass

# Output result as JSON
print("\\n___SANDBOX_RESULT___")
print(json.dumps({
    "output": output,
    "result": result,
    "error": error,
    "chart": chart_base64
}))
`;
}

/**
 * Execute Python code in a Docker sandbox
 */
export async function executeInSandbox({
  code,
  packages = [],
  requestId,
}: SandboxOptions): Promise<SandboxResult> {
  await ensureImage();
  
  const wrapperCode = createWrapperScript(code, packages);
  let container: Docker.Container | null = null;
  
  try {
    log.info({ requestId }, "Creating sandbox container");
    
    // Create container
    container = await docker.createContainer({
      Image: SANDBOX_CONFIG.image,
      Cmd: ["python", "-c", wrapperCode],
      HostConfig: {
        Memory: SANDBOX_CONFIG.memory,
        MemorySwap: SANDBOX_CONFIG.memorySwap,
        CpuQuota: SANDBOX_CONFIG.cpuQuota,
        NetworkMode: "none", // No network access
        AutoRemove: false, // We'll remove manually to ensure cleanup
      },
      AttachStdout: true,
      AttachStderr: true,
    });
    
    log.debug({ requestId, containerId: container.id }, "Starting container");
    
    // Start container with timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Execution timeout after ${SANDBOX_CONFIG.timeout}ms`));
      }, SANDBOX_CONFIG.timeout);
    });
    
    const executionPromise = (async () => {
      if (!container) throw new Error('Container not initialized');
      await container.start();
      
      // Wait for container to finish
      const stream = await container.logs({
        follow: true,
        stdout: true,
        stderr: true,
      });
      
      let output = "";
      stream.on("data", (chunk: Buffer) => {
        // Docker multiplexes stdout/stderr with 8-byte headers
        // Skip the header and extract the payload
        if (chunk.length > 8) {
          const header = chunk.slice(0, 8);
          const payload = chunk.slice(8);
          output += payload.toString("utf-8");
        } else {
          output += chunk.toString("utf-8");
        }
      });
      
      await container.wait();
      return output;
    })();
    
    const output = await Promise.race([executionPromise, timeoutPromise]);
    
    // Parse the result
    const resultMatch = output.match(/___SANDBOX_RESULT___\n(.+)$/s);
    if (!resultMatch) {
      return {
        success: false,
        output: output.slice(0, 2000), // Limit output size
        error: "Failed to parse sandbox result",
      };
    }
    
    const result = JSON.parse(resultMatch[1]) as {
      output: string;
      result: unknown;
      error: { type: string; message: string; traceback: string } | null;
      chart: string | null;
    };
    
    if (result.error) {
      return {
        success: false,
        output: result.output,
        error: `${result.error.type}: ${result.error.message}`,
      };
    }
    
    // Build output message
    let message = result.output;
    if (result.result !== null && result.result !== undefined) {
      message += `\\nResult: ${JSON.stringify(result.result, null, 2)}`;
    }
    
    return {
      success: true,
      output: message.trim(),
      chart: result.chart || undefined,
    };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    log.error({ requestId, error: errorMessage }, "Sandbox execution failed");
    
    return {
      success: false,
      output: "",
      error: errorMessage,
    };
  } finally {
    // Cleanup
    if (container) {
      try {
        await container.stop({ t: 1 }).catch(() => {});
        await container.remove({ force: true }).catch(() => {});
        log.debug({ requestId }, "Container cleaned up");
      } catch (cleanupError) {
        log.warn({ requestId, cleanupError }, "Failed to cleanup container");
      }
    }
  }
}

/**
 * Check if Docker is available
 */
export async function isDockerAvailable(): Promise<boolean> {
  try {
    await docker.ping();
    return true;
  } catch {
    return false;
  }
}
