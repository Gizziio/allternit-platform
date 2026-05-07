/**
 * Smart Sandbox - Automatically chooses best execution method
 * 
 * Hierarchy (fastest to most capable):
 * 1. WASM (Pyodide) - Instant, limited packages
 * 2. Docker Pool - Fast, all Python packages
 * 3. WebVM - Full Linux, multi-language
 * 4. Cold Docker - Fallback
 */

import { createModuleLogger } from "@/lib/logger";
import { executeInWasmSandbox, isWasmAvailable } from "./wasm-sandbox";
import { executeInSandbox as executeInDockerSandbox, isDockerAvailable } from "./docker-sandbox";
import { sandboxPool } from "./sandbox-pool";
import { 
  executeInWebVM, 
  createWebVMSession, 
  stopWebVMSession, 
  isWebVMAvailable,
  type WebVMSession 
} from "./webvm-connector";

const log = createModuleLogger("smart-sandbox");

export interface SmartSandboxOptions {
  code: string;
  requestId: string;
  language?: "python" | "javascript" | "bash" | "rust";
  packages?: string[];
  preferredMethod?: "wasm" | "docker" | "webvm" | "auto";
}

export interface SmartSandboxResult {
  success: boolean;
  output: string;
  error?: string;
  chart?: string;
  method: "wasm" | "docker" | "webvm" | "none";
  duration: number;
}

// Packages that work well in WASM
const WASM_COMPATIBLE_PACKAGES = new Set([
  // Data science
  "numpy", "pandas", "matplotlib", "scipy", "scikit-learn",
  // Standard library (always available)
  "os", "sys", "pathlib", "json", "re", "math", "random", 
  "datetime", "collections", "itertools", "functools", 
  "statistics", "typing", "inspect", "textwrap", "string",
  "hashlib", "base64", "uuid", "time", "copy", "pickle",
  // Common utilities
  "pytest", "unittest", "mock",
]);

// Python standard library - these always work in WASM
const PYTHON_STDLIB = new Set([
  "abc", "argparse", "array", "ast", "asyncio", "base64", 
  "bisect", "builtins", "bz2", "calendar", "cgi", "cgitb",
  "chunk", "cmath", "cmd", "code", "codecs", "codeop",
  "collections", "colorsys", "compileall", "concurrent", 
  "configparser", "contextlib", "contextvars", "copy", "copyreg",
  "crypt", "csv", "ctypes", "curses", "dataclasses", "datetime",
  "dbm", "decimal", "difflib", "dis", "distutils", "doctest",
  "email", "encodings", "enum", "errno", "faulthandler", "fcntl",
  "filecmp", "fileinput", "fnmatch", "fractions", "ftplib", 
  "functools", "gc", "getopt", "getpass", "gettext", "glob",
  "graphlib", "grp", "gzip", "hashlib", "heapq", "hmac", "html",
  "http", "idlelib", "imaplib", "imghdr", "imp", "importlib",
  "inspect", "io", "ipaddress", "itertools", "json", "keyword",
  "lib2to3", "linecache", "locale", "logging", "lzma", "mailbox",
  "mailcap", "marshal", "math", "mimetypes", "mmap", "modulefinder",
  "multiprocessing", "netrc", "nis", "nntplib", "numbers", "operator",
  "optparse", "os", "ossaudiodev", "pathlib", "pdb", "pickle", 
  "pickletools", "pipes", "pkgutil", "platform", "plistlib", "poplib",
  "posix", "posixpath", "pprint", "profile", "pstats", "pty", "pwd",
  "py_compile", "pyclbr", "pydoc", "queue", "quopri", "random", "re",
  "readline", "reprlib", "resource", "rlcompleter", "runpy", "sched",
  "secrets", "select", "selectors", "shelve", "shlex", "shutil", "signal",
  "site", "smtpd", "smtplib", "sndhdr", "socket", "socketserver", "spwd",
  "sqlite3", "ssl", "stat", "statistics", "string", "stringprep", 
  "struct", "subprocess", "sunau", "symtable", "sys", "sysconfig", 
  "syslog", "tabnanny", "tarfile", "telnetlib", "tempfile", "termios",
  "test", "textwrap", "threading", "time", "timeit", "tkinter", "token",
  "tokenize", "trace", "traceback", "tracemalloc", "tty", "turtle", 
  "turtledemo", "types", "typing", "unicodedata", "unittest", "urllib",
  "uu", "uuid", "venv", "warnings", "wave", "weakref", "webbrowser",
  "winreg", "winsound", "wsgiref", "xdrlib", "xml", "xmlrpc", "zipapp",
  "zipfile", "zipimport", "zlib"
]);

// Patterns that require Docker
const DOCKER_REQUIRED_PATTERNS = [
  /!pip\s+install/,           // Package installation
  /open\s*\(\s*['"`]https?:/, // HTTP requests
  /requests\./,               // HTTP library
  /urllib/,                   // HTTP library
  /subprocess/,               // Shell commands
  /os\.system/,              // Shell commands
  /socket\./,                 // Network
  /sqlite3/,                  // Database
];

// Patterns that require WebVM (full Linux)
// These patterns check for actual shell commands, not comments
const WEBVM_REQUIRED_PATTERNS = [
  /^apt-get\s/m,              // apt-get at start of line
  /^yum\s+install/m,          // yum at start of line
  /^docker\s/m,               // docker at start of line
  /^sudo\s/m,                 // sudo at start of line
  /^systemctl\s/m,            // systemctl at start of line
  /^make\s/m,                 // make at start of line
  /^gcc\s/m,                  // gcc at start of line
  /^clang\s/m,                // clang at start of line
  /;\s*apt-get\s/,            // apt-get after semicolon (command chaining)
  /&&\s*apt-get\s/,           // apt-get after &&
  /\|\s*apt-get\s/,           // apt-get after pipe
];

// Docker-only packages (large ML libraries)
const DOCKER_ONLY_PACKAGES = new Set([
  "tensorflow", "torch", "torchvision", "torchaudio", "jax", "jaxlib",
  "transformers", "datasets", "accelerate", "diffusers", "stable-baselines3",
  "gym", "opencv-python", "pillow-simd", "pytorch-lightning", "wandb",
  "tensorboard", "mlflow", "dagster", "apache-airflow", "great-expectations",
  "selenium", "playwright", "puppeteer", "requests-html",
  "flask", "django", "fastapi", "tornado", "bottle", "pyramid",
  "psycopg2", "pymongo", "redis", "kafka-python", "pika",
]);

/**
 * Extract Python imports from code
 * Handles: import X, from X import Y, import X.Y
 */
function extractImportsFromCode(code: string): string[] {
  const imports: string[] = [];
  
  // Match 'import X' or 'import X.Y' - captures top-level module
  const importRegex = /^\s*import\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm;
  let match;
  while ((match = importRegex.exec(code)) !== null) {
    imports.push(match[1].toLowerCase());
  }
  
  // Match 'from X import Y' - captures top-level module
  const fromImportRegex = /^\s*from\s+([a-zA-Z_][a-zA-Z0-9_]*)\.?/gm;
  while ((match = fromImportRegex.exec(code)) !== null) {
    imports.push(match[1].toLowerCase());
  }
  
  // Match __import__('X')
  const dunderImportRegex = /__import__\s*\(\s*['"`]([a-zA-Z_][a-zA-Z0-9_]*)['"`]/g;
  while ((match = dunderImportRegex.exec(code)) !== null) {
    imports.push(match[1].toLowerCase());
  }
  
  return [...new Set(imports)]; // Remove duplicates
}

/**
 * Check if a package requires Docker (not available in WASM)
 */
function requiresDockerPackage(pkg: string): boolean {
  const normalized = pkg.toLowerCase();
  
  // Standard library always works in WASM
  if (PYTHON_STDLIB.has(normalized)) {
    return false;
  }
  
  // Docker-only packages
  if (DOCKER_ONLY_PACKAGES.has(normalized)) {
    return true;
  }
  
  // Check whitelist
  return !WASM_COMPATIBLE_PACKAGES.has(normalized);
}

/**
 * Analyze code to determine best execution method
 * Returns the most appropriate sandbox tier
 */
function determineExecutionMethod(
  code: string, 
  language?: string,
  packages?: string[]
): "wasm" | "docker" | "webvm" {
  // Non-Python languages need WebVM
  if (language && language !== "python") {
    log.debug(`WebVM required: language is ${language}`);
    return "webvm";
  }
  
  // Check for WebVM-required patterns (system commands)
  for (const pattern of WEBVM_REQUIRED_PATTERNS) {
    if (pattern.test(code)) {
      log.debug("WebVM required: found system-level pattern");
      return "webvm";
    }
  }
  
  // Check for Docker-required patterns (network/subprocess)
  for (const pattern of DOCKER_REQUIRED_PATTERNS) {
    if (pattern.test(code)) {
      log.debug("Docker required: found restricted pattern");
      return "docker";
    }
  }
  
  // Combine explicit packages with extracted imports
  const extractedImports = extractImportsFromCode(code);
  const allPackages = new Set([
    ...(packages || []),
    ...extractedImports,
  ]);
  
  // Check if any package requires Docker
  for (const pkg of allPackages) {
    if (requiresDockerPackage(pkg)) {
      log.debug(`Docker required: package "${pkg}" not available in WASM`);
      return "docker";
    }
  }
  
  // Check for large data files or complex operations
  const dockerIndicators = [
    code.length > 10000,                    // Very large scripts
    (code.match(/open\s*\(/g) || []).length > 10,  // Heavy file I/O
  ];
  
  if (dockerIndicators.some(Boolean)) {
    log.debug("Docker recommended: complex script detected");
    return "docker";
  }
  
  // Simple scripts can use WASM
  log.debug("Using WASM sandbox");
  return "wasm";
}

/**
 * Execute code using the best available sandbox
 */
export async function executeSmart({
  code,
  requestId,
  language = "python",
  packages = [],
  preferredMethod = "auto",
}: SmartSandboxOptions): Promise<SmartSandboxResult> {
  const startTime = Date.now();
  
  // Determine method
  let method: "wasm" | "docker" | "webvm";
  
  if (preferredMethod === "auto") {
    method = determineExecutionMethod(code, language, packages);
  } else {
    method = preferredMethod;
  }
  
  // Check availability and fallback
  const availability = await checkAvailability();
  
  let finalMethod: "wasm" | "docker" | "webvm" | "none" = method;
  
  if (method === "wasm" && !availability.wasm) {
    finalMethod = availability.docker ? "docker" : availability.webvm ? "webvm" : "none";
  } else if (method === "docker" && !availability.docker) {
    finalMethod = availability.webvm ? "webvm" : availability.wasm ? "wasm" : "none";
  } else if (method === "webvm" && !availability.webvm) {
    finalMethod = availability.docker ? "docker" : availability.wasm ? "wasm" : "none";
  }
  
  if (finalMethod === "none") {
    return {
      success: false,
      output: "",
      error: "No sandbox available. Please install Docker, enable WebAssembly, or start the WebVM service.",
      method: "none",
      duration: Date.now() - startTime,
    };
  }
  
  // Execute based on method
  try {
    switch (method) {
      case "wasm":
        return await executeWasm(code, startTime);
        
      case "docker":
        return await executeDocker(code, packages, requestId, startTime);
        
      case "webvm":
        return await executeWebVM(code, language, requestId, startTime);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    return {
      success: false,
      output: "",
      error: errorMessage,
      method,
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Execute in WASM sandbox
 */
async function executeWasm(
  code: string, 
  startTime: number
): Promise<SmartSandboxResult> {
  const result = await executeInWasmSandbox({ code });
  return {
    ...result,
    method: "wasm",
    duration: Date.now() - startTime,
  };
}

/**
 * Execute in Docker sandbox
 */
async function executeDocker(
  code: string,
  packages: string[],
  requestId: string,
  startTime: number
): Promise<SmartSandboxResult> {
  // Try pool first
  const poolContainer = await sandboxPool.acquire();
  
  if (poolContainer) {
    log.debug("Using warm Docker container from pool");
    try {
      // Would use pool container here
      // For now, fall back to regular execution
      await sandboxPool.release(poolContainer);
    } catch {
      // Fall through to regular Docker
    }
  }
  
  const result = await executeInDockerSandbox({
    code,
    packages,
    requestId,
  });
  
  return {
    success: result.success,
    output: result.output,
    error: result.error,
    chart: result.chart,
    method: "docker",
    duration: Date.now() - startTime,
  };
}

/**
 * Execute in WebVM
 */
async function executeWebVM(
  code: string,
  language: string,
  requestId: string,
  startTime: number
): Promise<SmartSandboxResult> {
  const session = await createWebVMSession();
  
  if (!session) {
    return {
      success: false,
      output: "",
      error: "Failed to create WebVM session",
      method: "webvm",
      duration: Date.now() - startTime,
    };
  }
  
  try {
    const result = await executeInWebVM(session.sessionId, code, {
      language: language as "python" | "javascript" | "bash" | "rust",
    });
    
    return {
      success: result.success,
      output: result.output,
      error: result.error,
      method: "webvm",
      duration: Date.now() - startTime,
    };
  } finally {
    await stopWebVMSession(session.sessionId);
  }
}

/**
 * Check availability of all sandbox types
 */
async function checkAvailability(): Promise<{
  wasm: boolean;
  docker: boolean;
  webvm: boolean;
}> {
  const [dockerAvailable, wasmAvailable, webvmAvailable] = await Promise.all([
    isDockerAvailable(),
    Promise.resolve(isWasmAvailable()),
    isWebVMAvailable(),
  ]);
  
  return {
    wasm: wasmAvailable,
    docker: dockerAvailable,
    webvm: webvmAvailable,
  };
}

/**
 * Pre-warm sandboxes for faster response
 */
export async function warmupSandboxes(): Promise<void> {
  const availability = await checkAvailability();
  
  // Warm Docker pool
  if (availability.docker) {
    await sandboxPool.initialize();
  }
  
  // Pre-load WASM
  if (availability.wasm) {
    const { executeInWasmSandbox } = await import("./wasm-sandbox");
    await executeInWasmSandbox({ code: "print('warmup')" });
  }
  
  log.info("Sandboxes warmed up");
}

/**
 * Get sandbox status
 */
export async function getSandboxStatus(): Promise<{
  wasm: { available: boolean };
  docker: { available: boolean; pool: { total: number; idle: number; inUse: number } };
  webvm: { available: boolean };
}> {
  const availability = await checkAvailability();
  
  return {
    wasm: {
      available: availability.wasm,
    },
    docker: {
      available: availability.docker,
      pool: sandboxPool.getStats(),
    },
    webvm: {
      available: availability.webvm,
    },
  };
}

/**
 * Get sandbox capabilities
 */
export function getSandboxCapabilities(): {
  [key: string]: {
    languages: string[];
    startupTime: string;
    features: string[];
  };
} {
  return {
    wasm: {
      languages: ["python"],
      startupTime: "~100ms",
      features: ["numpy", "pandas", "matplotlib", "instant"],
    },
    docker: {
      languages: ["python"],
      startupTime: "~50ms (warm), 2s (cold)",
      features: ["all-pip-packages", "isolated", "secure"],
    },
    webvm: {
      languages: ["python", "javascript", "bash", "rust"],
      startupTime: "~3s",
      features: ["full-linux", "apt-packages", "multi-language", "browser-vm"],
    },
  };
}
