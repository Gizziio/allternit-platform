/**
 * WebAssembly Python Sandbox using Pyodide
 * Near-instant startup (~100ms) but limited library support
 */

import { createModuleLogger } from "@/lib/logger";

const log = createModuleLogger("wasm-sandbox");

// Pyodide singleton
let pyodideInstance: any = null;
let pyodideLoading: Promise<any> | null = null;

export interface WasmSandboxResult {
  success: boolean;
  output: string;
  error?: string;
  chart?: string;
}

/**
 * Load Pyodide (only once)
 */
async function loadPyodide(): Promise<any> {
  if (pyodideInstance) return pyodideInstance;
  if (pyodideLoading) return pyodideLoading;
  
  pyodideLoading = (async () => {
    log.info("Loading Pyodide...");
    const startTime = Date.now();
    
    // Dynamic import to avoid loading on startup
    const { loadPyodide } = await import("pyodide");
    const pyodide = await loadPyodide({
      indexURL: "https://cdn.jsdelivr.net/pyodide/v0.25.0/full/",
      stdout: (text: string) => console.log(text),
      stderr: (text: string) => console.error(text),
    });
    
    // Pre-load common packages
    await pyodide.loadPackage(["micropip"]);
    
    pyodideInstance = pyodide;
    log.info(`Pyodide loaded in ${Date.now() - startTime}ms`);
    
    return pyodide;
  })();
  
  return pyodideLoading;
}

/**
 * Execute Python in WebAssembly
 * Startup: ~100ms (after first load)
 */
export async function executeInWasmSandbox({
  code,
  packages = [],
}: {
  code: string;
  packages?: string[];
}): Promise<WasmSandboxResult> {
  try {
    const pyodide = await loadPyodide();
    
    // Load requested packages
    if (packages.length > 0) {
      const availablePackages = packages.filter(p => 
        // Packages that work in Pyodide
        ["numpy", "pandas", "matplotlib", "scipy", "scikit-learn"].includes(p)
      );
      
      if (availablePackages.length > 0) {
        await pyodide.loadPackage(availablePackages);
      }
    }
    
    // Capture output
    let output = "";
    const originalStdout = pyodide.setStdout({ batched: (text: string) => {
      output += text + "\n";
    }});
    
    // Execute code
    const result = await pyodide.runPythonAsync(code);
    
    // Restore stdout
    pyodide.setStdout(originalStdout);
    
    // Get matplotlib figure if exists
    let chart: string | undefined;
    try {
      const plt = pyodide.pyimport("matplotlib.pyplot");
      const fig = plt.gcf();
      if (fig.get_axes().length > 0) {
        const buf = pyodide.runPython(`
import io
import base64
buf = io.BytesIO()
plt.savefig(buf, format='png', bbox_inches='tight')
base64.b64encode(buf.getvalue()).decode('utf-8')
`);
        chart = buf;
        plt.close();
      }
    } catch {
      // No chart generated
    }
    
    return {
      success: true,
      output: output.trim() || String(result),
      chart,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.error({ error: errorMessage }, "WASM execution failed");
    
    return {
      success: false,
      output: "",
      error: errorMessage,
    };
  }
}

/**
 * Check if WASM sandbox is available
 */
export function isWasmAvailable(): boolean {
  // WASM works in all modern browsers and Node.js
  return typeof WebAssembly !== "undefined";
}

/**
 * Install pyodide package
 */
export async function installWasmPackage(packageName: string): Promise<boolean> {
  try {
    const pyodide = await loadPyodide();
    await pyodide.loadPackage(packageName);
    return true;
  } catch (error) {
    log.error({ package: packageName, error }, "Failed to install package");
    return false;
  }
}
