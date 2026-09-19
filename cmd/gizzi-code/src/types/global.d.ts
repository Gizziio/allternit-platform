/**
 * Global type declarations for missing modules
 * TEMPORARY SHIM
 */

// Allternit SDK namespace declarations at top level
// These mirror the SDK's actual structure to fix TS2702 errors
// when using namespace-style type references like Allternit.Beta.Messages.X
declare namespace Allternit {
    // Main content block types
    export interface ContentBlock {
      type: 'text' | 'image' | 'tool_use' | 'tool_result' | 'thinking' | 'redacted_thinking' | 'document'
      text?: string
      thinking?: string
      data?: string
      id?: string
      name?: string
      input?: unknown
      content?: string | ContentBlock[] | unknown
    }
    
    export interface ContentBlockParam {
      type: 'text' | 'image' | 'tool_use' | 'tool_result' | 'thinking' | 'redacted_thinking' | 'document' | string
      text?: string
      thinking?: string
      data?: string
      id?: string
      name?: string
      input?: unknown
      content?: string | ContentBlockParam[] | unknown
      [key: string]: unknown
    }
    
    // Message param type
    export interface MessageParam {
      role: 'user' | 'assistant'
      content: string | ContentBlockParam[]
    }
    
    // Text and Image block params
    export interface TextBlockParam {
      type: 'text'
      text: string
      cache_control?: unknown
    }
    
    export interface ImageBlockParam {
      type: 'image'
      source: {
        type: 'base64'
        media_type: string
        data: string
      }
    }
    
    // Tool and ToolChoice types
    export interface Tool {
      name: string
      description: string
      input_schema: {
        type: 'object'
        properties?: Record<string, unknown>
        required?: string[]
      }
    }
    
    export type ToolChoice =
      | { type: 'auto' }
      | { type: 'any' }
      | { type: 'tool'; name: string }
      | 'auto'
      | 'any'

    // Beta namespace
    namespace Beta {
      namespace Messages {
        export interface BetaMessageParam {
          role: 'user' | 'assistant'
          content: string | unknown[]
        }
        
        export interface BetaToolUnion {
          name?: string
          description?: string
          input_schema?: unknown
          [key: string]: unknown
        }
        
        export interface BetaToolUseBlockParam {
          type: 'tool_use'
          id: string
          name: string
          input: unknown
        }
        
        export interface BetaToolResultBlockParam {
          type: 'tool_result'
          tool_use_id: string
          content?: string | unknown[]
          is_error?: boolean
        }
        
        export interface BetaMessage {
          id: string
          type: 'message'
          role: 'assistant'
          content: unknown[]
          usage: {
            input_tokens: number
            output_tokens: number
            cache_read_input_tokens?: number
            cache_creation_input_tokens?: number
          }
        }
        
        export interface BetaJSONOutputFormat {
          type: 'json'
          schema?: Record<string, unknown>
        }
        
        export type BetaThinkingConfigParam =
          | { type: 'enabled'; budget_tokens: number }
          | { type: 'disabled' }
      }
    }

}

// Extend NodeJS.ProcessEnv to include USER_TYPE
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      USER_TYPE?: 'external' | 'ant' | string
      [key: string]: string | undefined
    }
  }
}

// Global MACRO constant for build-time constants
declare const MACRO: {
  VERSION: string
  BRIDGE_ENABLED: boolean
  BRIDGE_VERSION: string
  SESSION_MAX_RECONNECT_ATTEMPTS: number
  SESSION_RECONNECT_BASE_DELAY_MS: number
  TOOL_MAX_OUTPUT_SIZE: number
  TOOL_TIMEOUT_MS: number
  UI_MAX_MESSAGES_DISPLAY: number
  [key: string]: unknown
}

// Markdown files (loaded as text via Bun's text loader)
declare module '*.md' {
  const content: string
  export default content
}

// External modules without type declarations (or whose installed packages
// ship no types — the lodash-es subpath blocks below are the latter: the
// installed lodash-es 4.18.1 bundles no .d.ts and there is no @types/lodash-es,
// so these handwritten shapes are the only types those imports get).
declare module 'tree-sitter' {
  export class Parser {
    setLanguage(language: unknown): void
    parse(input: string): Tree
  }
  export interface Tree {
    rootNode: unknown
  }
}

declare module 'color-diff-napi' {
  export interface ColorDiff {
    r: number
    g: number
    b: number
  }
  
  export interface ColorFile {
    name: string
    colors: ColorDiff[]
  }
  
  export interface SyntaxTheme {
    name: string
    colors: Record<string, ColorDiff>
  }
  
  export function diff(color1: ColorDiff, color2: ColorDiff): number
  export function getSyntaxTheme(themeName: string): SyntaxTheme
  
  export class ColorDiff {
    constructor(patch: unknown, firstLine: string | null, filePath: string, fileContent: string | undefined);
    render(theme: string, width: number, dim: boolean): string[] | null;
  }
  
  export class ColorFile {
    constructor(content: string, filePath: string);
    render(theme: string, width: number): string[] | null;
  }
}

// Lodash-es specific modules
declare module 'lodash-es/sumBy.js' {
  export default function sumBy<T>(collection: T[], iteratee: string | ((item: T) => number)): number
}

declare module 'lodash-es/mapValues.js' {
  export default function mapValues<T, R>(obj: Record<string, T>, iteratee: (value: T, key: string) => R): Record<string, R>
}

declare module 'lodash-es/pickBy.js' {
  export default function pickBy<T>(obj: Record<string, T>, predicate?: (value: T, key: string) => boolean): Record<string, T>
}

declare module 'lodash-es/uniqBy.js' {
  export default function uniqBy<T>(array: T[], iteratee: string | ((item: T) => unknown)): T[]
}

declare module 'lodash-es/last.js' {
  export default function last<T>(array: T[]): T | undefined
}

declare module 'lodash-es/memoize.js' {
  export default function memoize<T extends (...args: any[]) => any>(fn: T, resolver?: (...args: any[]) => any): T
}

declare module 'lodash-es/sample.js' {
  export default function sample<T>(collection: T[] | Record<string, T>): T | undefined
}

declare module 'lodash-es/isEqual.js' {
  export default function isEqual(a: any, b: any): boolean
}

declare module 'lodash-es/capitalize.js' {
  export default function capitalize(str: string): string
}

declare module 'lodash-es/reject.js' {
  export default function reject<T>(collection: T[], predicate: ((item: T) => boolean) | Record<string, any>): T[]
}

declare module 'lodash-es/partition.js' {
  export default function partition<T>(collection: T[], predicate: ((item: T) => boolean) | Record<string, any>): [T[], T[]]
}

declare module 'lodash-es/omit.js' {
  export default function omit<T extends Record<string, any>>(obj: T, keys: string | string[]): Partial<T>
}

declare module 'lodash-es/noop.js' {
  export default function noop(...args: any[]): void
}

declare module 'lodash-es/zipObject.js' {
  export default function zipObject(keys: string[], values: any[]): Record<string, any>
}

declare module 'lodash-es/mergeWith.js' {
  export default function mergeWith<T>(object: T, ...sources: any[]): T
}

declare module 'lodash-es/isPlainObject.js' {
  export default function isPlainObject(value: any): boolean
}

declare module 'lodash-es/isObject.js' {
  export default function isObject(value: any): boolean
}

declare module 'lodash-es/cloneDeep.js' {
  export default function cloneDeep<T>(value: T): T
}

declare module 'lodash-es/throttle.js' {
  export default function throttle<T extends (...args: any[]) => any>(fn: T, wait?: number, options?: { leading?: boolean; trailing?: boolean }): T
}

declare module 'lodash-es/setWith.js' {
  export default function setWith<T extends Record<string, any>>(object: T, path: string | string[], value: any, customizer?: (value: any) => any): T
}

// Global MACRO constant - moved inside declare global below
declare module '@ant/claude-for-chrome-mcp' {
  export function launchChrome(): Promise<unknown>
  export function createClaudeForChromeMcpServer(config: unknown): unknown
  export const BROWSER_TOOLS: string[]

  export interface ClaudeForChromeContext {
    browser: string
    version: string
  }

  export interface Logger {
    debug(message: string): void
    info(message: string): void
    warn(message: string): void
    error(message: string): void
  }

  export type PermissionMode = 'ask' | 'auto' | 'reject'
}

declare module '@allternit/extension' {
  export const BROWSER_TOOLS: Array<{ name: string; description: string; inputSchema: any }>
  export const ALLTERNIT_EXTENSION_MCP_SERVER_NAME: string
  export function isAllternitExtensionInstalled(): Promise<boolean>
  export function detectAvailableBrowser(): Promise<string | null>
  export function openInBrowser(url: string): Promise<boolean>
}
declare module '@anthropic-ai/mcpb' {
  export interface MCPMessage {}
  
  export interface McpbAuthor {
    name: string
    email?: string
    url?: string
  }
  
  export interface McpbServerConfig {
    command: string
    args?: string[]
    env?: Record<string, string>
  }
  
  export interface McpbManifest {
    name: string
    version: string
    author: McpbAuthor
    server?: McpbServerConfig
    tools: unknown[]
    user_config?: Record<string, McpbUserConfigurationOption>
  }
  
  export interface McpbUserConfigurationOption {
    key?: string
    label?: string
    title?: string
    description?: string
    type: 'string' | 'number' | 'boolean' | 'enum' | 'file' | 'directory'
    options?: string[]
    required?: boolean
    sensitive?: boolean
    multiple?: boolean
    default?: string | number | boolean | string[]
    min?: number
    max?: number
  }
  
  export function getMcpConfigForManifest(options: {
    manifest: McpbManifest
    extensionPath: string
    systemDirs: { dataDir?: string; configDir?: string; cacheDir?: string; HOME?: string; DESKTOP?: string; DOCUMENTS?: string; DOWNLOADS?: string; [key: string]: string | undefined }
    userConfig?: Record<string, string | number | boolean | string[]>
    pathSeparator?: string
  }): Promise<unknown>
  
  export const McpbManifestSchema: {
    safeParse(data: unknown): { success: true; data: McpbManifest } | { success: false; error: { flatten(): { fieldErrors: Record<string, string[]>; formErrors: string[] } } }
  }
}

// glob is ALSO declared in src/types/missing-modules.d.ts (GlobOptions,
// globSync) — the two blocks and the real glob types merge; this block
// additionally supplies the `glob`/`sync` named exports used by
// src/shared/util/glob.ts.
declare module 'glob' {
  export function glob(pattern: string, options?: unknown): Promise<string[]>
  export function sync(pattern: string, options?: unknown): string[]
}

// Additional external modules
declare module 'image-processor-napi' {
  export function processImage(input: unknown): Promise<unknown>
}

declare module 'proper-lockfile' {
  export interface LockOptions {
    stale?: number
    updateInterval?: number
    retries?: number | { retries: number; minTimeout?: number; maxTimeout?: number }
    realpath?: boolean
    fs?: unknown
    onCompromised?: () => void
  }
  
  export interface UnlockOptions {
    fs?: unknown
  }
  
  export interface CheckOptions {
    stale?: number
    fs?: unknown
    realpath?: boolean
  }
  
  export function lock(file: string, options?: LockOptions): Promise<() => Promise<void>>
  export function lockSync(file: string, options?: LockOptions): () => void
  export function unlock(file: string, options?: UnlockOptions): Promise<void>
  export function check(file: string, options?: CheckOptions): Promise<boolean>
}
declare module '@anthropic-ai/sandbox-runtime' {
  export interface SandboxRuntimeConfigSchema {
    fs?: FsRestrictionConfig
    network?: NetworkRestrictionConfig
    ignoreViolations?: IgnoreViolationsConfig
  }
  
  export interface FsRestrictionConfig {
    read?: FsReadRestrictionConfig
    write?: FsWriteRestrictionConfig
  }
  
  export interface FsReadRestrictionConfig {
    allow?: string[]
    deny?: string[]
  }
  
  export interface FsWriteRestrictionConfig {
    allow?: string[]
    deny?: string[]
  }
  
  export interface NetworkRestrictionConfig {
    allow?: NetworkHostPattern[]
    deny?: NetworkHostPattern[]
    allowedDomains?: string[]
  }
  
  export interface NetworkHostPattern {
    host: string
    port?: number
  }
  
  export interface IgnoreViolationsConfig {
    enabled?: boolean
    patterns?: string[]
  }
  
  export interface SandboxViolationEvent {
    type: 'fs' | 'network'
    operation: string
    path?: string
    host?: string
    timestamp: number
  }
  
  export type SandboxAskCallback = (event: NetworkHostPattern) => Promise<boolean>
  
  export interface SandboxDependencyCheck {
    name: string
    version?: string
    required: boolean
    errors?: string[]
    warnings?: string[]
  }
  
  export interface SandboxViolationStore {
    add(event: SandboxViolationEvent): void
    getAll(): SandboxViolationEvent[]
    clear(): void
    getTotalCount(): number
    subscribe(callback: (count: number) => void): () => void
  }
  
  export interface SandboxRuntimeConfig {
    fsRead?: FsReadRestrictionConfig
    fsWrite?: FsWriteRestrictionConfig
    network?: NetworkRestrictionConfig
    ignoreViolations?: IgnoreViolationsConfig
    allowUnixSockets?: boolean
    allowLocalBinding?: boolean
    enableWeakerNestedSandbox?: boolean
  }
  
  export class SandboxManager {
    constructor(config: SandboxRuntimeConfigSchema)
    checkDependency(dep: SandboxDependencyCheck): Promise<boolean>
    createViolationStore(): SandboxViolationStore
    // Static methods
    static checkDependencies(): Promise<boolean>
    static isSupportedPlatform(): boolean
    static wrapWithSandbox(command: string[]): string[]
    static initialize(): Promise<void>
    static updateConfig(config: SandboxRuntimeConfigSchema): void
    static reset(): Promise<void>
    static getFsReadConfig(): { allowedPaths: string[]; deniedPaths: string[] }
    static getFsWriteConfig(): { allowedPaths: string[]; deniedPaths: string[] }
    static getNetworkRestrictionConfig(): { allowedHosts: string[]; deniedHosts: string[] }
    static getIgnoreViolations(): boolean
    static getAllowUnixSockets(): boolean
    static getAllowLocalBinding(): boolean
    static getEnableWeakerNestedSandbox(): boolean
  }
  
  export class SandboxRuntime {
    constructor(config: SandboxRuntimeConfigSchema)
    execute(code: string): Promise<unknown>
  }
}
// ============================================================================
// Internal Module Declarations
// ============================================================================
// (The previous wildcard/relative ambient stubs for keybindings/wizard/agent/
// mcp/query/agent.js/permissions paths were removed: every live importer
// resolves the real files, so the stubs were dead weight. A file that later
// imports one of these paths without a resolvable target will surface as a
// TS2307 in its own burn batch.)
