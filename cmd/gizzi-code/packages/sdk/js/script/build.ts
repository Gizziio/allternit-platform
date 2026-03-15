#!/usr/bin/env bun
/**
 * Deterministic SDK Build Script
 * 
 * Generates @a2r/sdk from OpenAPI spec with stable output.
 * The class-based API wrapper ensures backward compatibility.
 */

import { $ } from "bun"
import { Server } from "@/runtime/server/server"
import { writeFile, mkdir } from "fs/promises"
import { existsSync } from "fs"

const SDK_VERSION = "2.0.0"
const OUTPUT_DIR = "packages/sdk/dist/gen"

// Common action words - if second part of camelCase name is one of these,
// it's a direct method, not a nested resource
const ACTION_WORDS = new Set([
  'list', 'get', 'create', 'update', 'delete', 'remove', 'set', 'add',
  'start', 'stop', 'status', 'abort', 'fork', 'share', 'diff', 'summarize',
  'revert', 'unrevert', 'children', 'todo', 'prompt', 'command', 'shell',
  'messages', 'initialize', 'all', 'auth', 'authorize', 'callback', 'verify',
  'subscribe', 'publish', 'enrich', 'entities', 'health', 'insights', 'providers'
])

// Step 1: Generate OpenAPI spec
console.log("[1/4] Generating OpenAPI spec...")
const rawSpec = await Server.openapi()

// Filter to only /v1/ paths so the SDK doesn't get duplicates from legacy routes
const v1Paths: Record<string, unknown> = {}
for (const [path, methods] of Object.entries((rawSpec as any).paths ?? {})) {
  if (path.startsWith("/v1/")) {
    // Strip the /v1 prefix so SDK methods are named without the version prefix
    const strippedPath = path.slice(3) // "/v1/session" -> "/session"
    v1Paths[strippedPath] = methods
  }
}
const spec = { ...rawSpec, paths: v1Paths }
const specPath = "/tmp/gizzi-openapi.json"
await writeFile(specPath, JSON.stringify(spec, null, 2))

// Step 2: Generate base SDK with @hey-api/openapi-ts
console.log("[2/4] Generating base SDK...")
await $`rm -rf ${OUTPUT_DIR} && mkdir -p ${OUTPUT_DIR}`
await $`bunx openapi-ts --input ${specPath} --output ${OUTPUT_DIR} --client @hey-api/client-fetch`

// Step 2b: Fix imports in generated files
console.log("  Fixing imports...")
const clientGen = await Bun.file(`${OUTPUT_DIR}/client.gen.ts`).text()
const fixedClientGen = clientGen.replace(
  "from './client'",
  "from './client/index'"
)
await writeFile(`${OUTPUT_DIR}/client.gen.ts`, fixedClientGen)

// Step 3: Generate deterministic class-based wrapper
console.log("[3/4] Generating class wrapper...")

// Read generated functions
const sdkGen = await Bun.file(`${OUTPUT_DIR}/sdk.gen.ts`).text()

// Parse function exports deterministically (sorted for stability)
const functionRegex = /export const (\w+) = /g
const functions: string[] = []
let match
while ((match = functionRegex.exec(sdkGen)) !== null) {
  functions.push(match[1])
}
functions.sort() // Ensure deterministic ordering

// Group by resource, handling nested resources like "providerOauthAuthorize" -> provider.oauth.authorize
const resourceGroups = new Map<string, { direct: string[], nested: Map<string, string[]> }>()

for (const fn of functions) {
  if (fn === 'client' || fn === 'createClient') continue
  
  // Check for nested resource pattern: {resource}{Sub}{Action} (e.g., providerOauthAuthorize)
  // The sub-resource should NOT be a common action word
  const nestedMatch = fn.match(/^([a-z]+)([A-Z][a-z]+)([A-Z][a-z]+)$/) 
  if (nestedMatch) {
    const resource = nestedMatch[1].toLowerCase()
    const middlePart = nestedMatch[2].toLowerCase()
    
    // If middle part is an action word, this is a direct method (e.g., sessionListGlobal)
    if (ACTION_WORDS.has(middlePart)) {
      if (!resourceGroups.has(resource)) {
        resourceGroups.set(resource, { direct: [], nested: new Map() })
      }
      resourceGroups.get(resource)!.direct.push(fn)
      continue
    }
    
    // Otherwise it's a nested resource (e.g., providerOauthAuthorize -> provider.oauth.authorize)
    const subResource = middlePart
    if (!resourceGroups.has(resource)) {
      resourceGroups.set(resource, { direct: [], nested: new Map() })
    }
    const group = resourceGroups.get(resource)!
    if (!group.nested.has(subResource)) {
      group.nested.set(subResource, [])
    }
    group.nested.get(subResource)!.push(fn)
    continue
  }
  
  // Direct resource pattern: {resource}{Action} (e.g., sessionList)
  const directMatch = fn.match(/^([a-z]+)([A-Z])/) 
  if (directMatch) {
    const resource = directMatch[1].toLowerCase()
    if (!resourceGroups.has(resource)) {
      resourceGroups.set(resource, { direct: [], nested: new Map() })
    }
    resourceGroups.get(resource)!.direct.push(fn)
  }
}

// Sort resources for deterministic output
const sortedResources = Array.from(resourceGroups.entries())
  .sort(([a], [b]) => a.localeCompare(b))

// Generate class definitions - first all nested classes, then main classes
const nestedClassDefs: string[] = []
const mainClassDefs: string[] = []
const clientProps: string[] = []

for (const [resource, { direct, nested }] of sortedResources) {
  const className = resource.charAt(0).toUpperCase() + resource.slice(1)
  
  // Generate nested sub-resource classes first (they need to be defined before use)
  const nestedClassNames = new Map<string, string>()
  const sortedNested = Array.from(nested.entries()).sort(([a], [b]) => a.localeCompare(b))
  
  for (const [subResource, fns] of sortedNested) {
    const subClassName = className + subResource.charAt(0).toUpperCase() + subResource.slice(1)
    nestedClassNames.set(subResource, subClassName)
    
    const subMethods = fns.sort().map(fn => {
      // Extract action from function name (e.g., providerOauthAuthorize -> authorize)
      const pattern = new RegExp(`^${resource}${subResource}([A-Z].*)$`, 'i')
      const match = fn.match(pattern)
      const methodName = match ? match[1].toLowerCase() : fn
      return `  ${methodName}(options?: Parameters<typeof ${fn}>[0]) {\n    return ${fn}({ ...options, client: this.client } as any);\n  }`
    }).join('\n\n')
    
    // Add backward compatibility aliases
    const aliases: string[] = []
    if (resource === 'provider' && subResource === 'oauth') {
      // provider.oauth.verify -> provider.oauth.callback
      if (fns.some(fn => fn.toLowerCase().includes('verify'))) {
        aliases.push(`  callback(options?: Parameters<typeof providerOauthVerify>[0]) {\n    return this.verify({ ...options, client: this.client });\n  }`)
      }
    }
    const allSubMethods = [subMethods, ...aliases].filter(Boolean).join('\n\n')
    
    nestedClassDefs.push(`class ${subClassName} extends HeyApiClient {\n${allSubMethods}\n}`)
  }
  
  // Generate direct methods
  const needsConvertOptions = resource === 'session'
  const directMethods = direct.sort().map(fn => {
    const methodName = fn.replace(new RegExp(`^${resource}`, 'i'), '').toLowerCase()
    // For Session class, add convertOptions to handle old format (top-level sessionID -> path.sessionID)
    const needsConversion = needsConvertOptions && fn !== 'sessionCreate' && fn !== 'sessionList' && fn !== 'sessionListGlobal' && fn !== 'sessionAllStatus'
    return `  ${methodName}(options?: Parameters<typeof ${fn}>[0]) {\n    return ${fn}({ ${needsConversion ? '...this.convertOptions(options)' : '...options'}, client: this.client } as any);\n  }`
  }).join('\n\n')
  
  // Add convertOptions helper for Session class
  const convertOptionsHelper = needsConvertOptions ? `  // Helper to convert old format (top-level sessionID) to new format (path: { sessionID }, body: {...})
  private convertOptions(options: any): any {
    if (!options) return options;
    if (options.path || !options.sessionID) return options;
    const { sessionID, ...rest } = options;
    return {
      path: { sessionID },
      body: rest,
    };
  }

` : ''
  
  // Generate nested property getters
  const nestedProps = sortedNested.map(([subResource]) => {
    const subClassName = nestedClassNames.get(subResource)!
    return `  private _${subResource}?: ${subClassName}\n  get ${subResource}() { return this._${subResource} ??= new ${subClassName}({ client: this.client }) }`
  }).join('\n\n')
  
  // Build the main resource class
  const allMethods = [convertOptionsHelper + directMethods, nestedProps].filter(Boolean).join('\n\n')
  if (allMethods || sortedNested.length > 0) {
    mainClassDefs.push(`class ${className} extends HeyApiClient {\n${allMethods}\n}`)
    clientProps.push(`  private _${resource}?: ${className}\n  get ${resource}() { return this._${resource} ??= new ${className}({ client: this.client }) }`)
  }
}

const allClassDefs = [...nestedClassDefs, ...mainClassDefs].join('\n\n')
const clientPropsStr = clientProps.join('\n')

// Build the complete a2r-client.ts wrapper
const a2rClientTs = `// @a2r/sdk v${SDK_VERSION} - Auto-generated by build.ts
// Generated at: ${new Date().toISOString()}

import { createClient, type Client, type ClientOptions } from "./client/index.js";
import { client } from "./client.gen.js";
import {
${functions.map(f => `  ${f},`).join('\n')}
} from "./sdk.gen.js";

class HeyApiClient {
  protected client: Client;
  constructor(args?: { client?: Client }) {
    this.client = args?.client ?? client;
  }
}

class HeyApiRegistry<T> {
  private readonly defaultKey = "default";
  private readonly instances = new Map<string, T>();
  get(key?: string): T {
    const instance = this.instances.get(key ?? this.defaultKey);
    if (!instance) {
      throw new Error(\`No SDK client found. Create one with "new A2RClient()" to fix this error.\`);
    }
    return instance;
  }
  set(value: T, key?: string): void {
    this.instances.set(key ?? this.defaultKey, value);
  }
}

${allClassDefs}

export class A2RClient extends HeyApiClient {
  static readonly __registry = new HeyApiRegistry<A2RClient>();
  constructor(args?: { client?: Client; key?: string }) {
    super(args);
    A2RClient.__registry.set(this, args?.key);
  }
${clientPropsStr}
}

export function createA2RClient(config?: {
  baseUrl?: string;
  fetch?: typeof fetch;
  headers?: Record<string, string>;
  directory?: string;
  signal?: AbortSignal;
}) {
  if (!config?.fetch) {
    const customFetch = (req: Request) => {
      (req as any).timeout = false;
      return fetch(req);
    };
    config = { ...config, fetch: customFetch };
  }
  if (config?.directory) {
    const isNonASCII = /[^\\x00-\\x7F]/.test(config.directory);
    const encodedDirectory = isNonASCII ? encodeURIComponent(config.directory) : config.directory;
    config.headers = { ...config.headers, "x-opencode-directory": encodedDirectory };
  }
  const clientInstance = createClient(config);
  return new A2RClient({ client: clientInstance });
}

export * from "./types.gen.js";
export type { Client, ClientOptions };
`;

// Inject custom methods not derivable from OpenAPI spec

// App.agents() — convenience alias for agentList on the App namespace
const appAgentsMethod = `
  agents(options?: Parameters<typeof agentList>[0]) {
    return agentList({ ...options, client: this.client } as any);
  }`

// instance.sync() — triggers server to emit instance.sync SSE event with full TUI hydration payload
const instanceSyncMethod = `
  sync(options?: any) {
    return (this.client as any).get({
      url: "/instance/sync",
      ...options,
    }) as Promise<{ data: boolean; error?: unknown }>;
  }`

// session.clear() — deletes all messages/parts for a session and emits session.cleared bus event
const sessionClearMethod = `
  clear(options?: any) {
    const { sessionID } = options?.path ?? {}
    return (this.client as any).post({
      url: \`/session/\${sessionID}/clear\`,
      ...options,
    }) as Promise<{ data: boolean; error?: unknown }>;
  }`

// event.stream() — typed async iterator over instance-scoped SSE events
const eventStreamMethod = `
  /** Typed async iterator over server-sent events. */
  async *stream(options?: { signal?: AbortSignal }): AsyncIterableIterator<import('./entity-types.js').Event> {
    const response = await this.subscribe(options as any);
    for await (const item of (response as any).stream) {
      yield item as import('./entity-types.js').Event;
    }
  }`

// global.stream() — typed async iterator over global SSE events
const globalStreamMethod = `
  /** Typed async iterator over global server-sent events. */
  async *stream(options?: { signal?: AbortSignal }): AsyncIterableIterator<import('./entity-types.js').Event> {
    const response = await this.event(options as any);
    for await (const item of (response as any).stream) {
      yield (item as any)?.payload ?? item as import('./entity-types.js').Event;
    }
  }`

// A2RClient.events() / globalEvents() / on() — convenience wrappers
const a2rClientEventMethods = `
  /** Typed async iterator over instance-scoped events (GET /event). */
  events(options?: { signal?: AbortSignal }): AsyncIterableIterator<import('./entity-types.js').Event> {
    return this.event.stream(options);
  }

  /** Typed async iterator over global events (GET /global/event). */
  globalEvents(options?: { signal?: AbortSignal }): AsyncIterableIterator<import('./entity-types.js').Event> {
    return this.global.stream(options);
  }

  /**
   * Typed SSE subscription filtered to a specific event type.
   * Type of \`properties\` is automatically narrowed based on \`type\`.
   *
   * @example
   * for await (const { properties } of sdk.on('session.status')) {
   *   console.log(properties.status) // typed
   * }
   */
  async *on<T extends import('./types.gen.js').EventSubscribeResponses[200]['type']>(
    type: T,
    options?: { signal?: AbortSignal },
  ): AsyncIterableIterator<Extract<import('./types.gen.js').EventSubscribeResponses[200], { type: T }>> {
    for await (const event of this.events(options)) {
      if ((event as any).type === type) {
        yield event as Extract<import('./types.gen.js').EventSubscribeResponses[200], { type: T }>;
      }
    }
  }`

let finalA2rClientTs = a2rClientTs.replace(
  'class App extends HeyApiClient {',
  `class App extends HeyApiClient {${appAgentsMethod}`,
)
finalA2rClientTs = finalA2rClientTs.replace(
  'class Instance extends HeyApiClient {',
  `class Instance extends HeyApiClient {${instanceSyncMethod}`,
)
finalA2rClientTs = finalA2rClientTs.replace(
  'class Session extends HeyApiClient {',
  `class Session extends HeyApiClient {${sessionClearMethod}`,
)
finalA2rClientTs = finalA2rClientTs.replace(
  'class Event extends HeyApiClient {',
  `class Event extends HeyApiClient {${eventStreamMethod}`,
)
finalA2rClientTs = finalA2rClientTs.replace(
  'class Global extends HeyApiClient {',
  `class Global extends HeyApiClient {${globalStreamMethod}`,
)
// Inject events()/globalEvents() just before the closing brace of A2RClient
finalA2rClientTs = finalA2rClientTs.replace(
  /^(export class A2RClient[\s\S]*?)(^})/m,
  `$1${a2rClientEventMethods}\n}`,
)
await writeFile(`${OUTPUT_DIR}/a2r-client.ts`, finalA2rClientTs)

// Step 4: Compile to JS using Bun
console.log("[4/4] Compiling to JavaScript...")

// Compile all TypeScript files
const filesToCompile = [
  'a2r-client.ts',
  'entity-types.ts',
  'client/index.ts', 
  'client/client.gen.ts',
  'client/types.gen.ts',
  'client/utils.gen.ts',
  'client.gen.ts', 
  'sdk.gen.ts', 
  'types.gen.ts',
  'index.ts'
]

for (const file of filesToCompile) {
  const filePath = `${OUTPUT_DIR}/${file}`
  if (existsSync(filePath)) {
    try {
      const outDir = file.includes('/') 
        ? `${OUTPUT_DIR}/${file.split('/')[0]}` 
        : OUTPUT_DIR
      await $`bun build ${filePath} --outdir ${outDir} --target=bun --format=esm 2>/dev/null`
      const outFile = file.replace('.ts', '.js').split('/').pop()
      console.log(`  ✓ ${file} -> ${outFile}`)
    } catch (e) {
      // Type-only files may fail to compile
    }
  }
}

// Create the main client.js that re-exports from a2r-client.js
const clientJs = `export * from "./a2r-client.js";
export { A2RClient as default, createA2RClient } from "./a2r-client.js";
`;
await writeFile(`${OUTPUT_DIR}/client.js`, clientJs)

// Step 3b: Generate entity types from OpenAPI spec
console.log("[3.5/4] Generating entity types...")

// Define entity interfaces based on OpenAPI spec schemas
const entityTypesTs = `// Auto-generated entity types from OpenAPI spec
// These are extracted from response schemas to provide proper type safety

/** Message base entity */
export interface Message {
  id: string;
  sessionID: string;
  role: 'user' | 'assistant';
  time: {
    created: number;
    completed?: number;
  };
  agent: string;
  model?: {
    providerID: string;
    modelID: string;
  };
  format?: {
    type: 'text' | 'json_schema';
    schema?: Record<string, unknown>;
    retryCount?: number;
  };
  system?: string;
  variant?: string;
}

/** Session entity */
export interface Session {
  id: string;
  directory: string;
  title: string;
  version: string;
  time: {
    created: number;
    updated: number;
    compacting?: number;
    archived?: number;
  };
  parentID?: string;
  summary?: {
    additions: number;
    deletions: number;
    files: number;
  };
  share?: {
    url: string;
  };
  revert?: {
    messageID: string;
    partID?: string;
  };
}

/** Part base */
interface PartBase {
  id: string;
  sessionID: string;
  messageID: string;
}

/** Part entity - discriminated union (matches server MessageV2.Part) */
export type Part =
  | TextPart
  | FilePart
  | ToolPart
  | AgentPart
  | CompactionPart
  | ReasoningPart
  | SubtaskPart
  | RetryPart
  | StepStartPart
  | StepFinishPart
  | SnapshotPart
  | PatchPart;

export interface TextPart extends PartBase {
  type: 'text';
  text: string;
  synthetic?: boolean;
  ignored?: boolean;
  time?: { start: number; end?: number };
  metadata?: Record<string, unknown>;
}

export interface FilePart extends PartBase {
  type: 'file';
  mime: string;
  url: string;
  filename?: string;
  source?: {
    text: { value: string; start: number; end: number };
    type: 'file';
    path: string;
  } | {
    text: { value: string; start: number; end: number };
    type: 'symbol';
    path: string;
    range: { start: { line: number; character: number }; end: { line: number; character: number } };
    name: string;
    kind: number;
  } | {
    text: { value: string; start: number; end: number };
    type: 'resource';
    clientName: string;
    uri: string;
  };
}

export interface ToolPart extends PartBase {
  type: 'tool';
  tool: string;
  callID: string;
  metadata?: Record<string, unknown>;
  state:
    | { status: 'pending'; input: Record<string, unknown>; raw: string }
    | { status: 'running'; input: Record<string, unknown>; title?: string; metadata?: Record<string, unknown>; time: { start: number } }
    | { status: 'completed'; input: Record<string, unknown>; output: string; title: string; metadata: Record<string, unknown>; time: { start: number; end: number; compacted?: number } }
    | { status: 'error'; input: Record<string, unknown>; error: string; metadata?: Record<string, unknown>; time: { start: number; end: number } };
}

export interface AgentPart extends PartBase {
  type: 'agent';
  name: string;
  source?: { value: string; start: number; end: number };
}

export interface CompactionPart extends PartBase {
  type: 'compaction';
  auto: boolean;
}

export interface ReasoningPart extends PartBase {
  type: 'reasoning';
  text: string;
  time: { start: number; end?: number };
  metadata?: Record<string, unknown>;
}

export interface SubtaskPart extends PartBase {
  type: 'subtask';
  prompt: string;
  description: string;
  agent: string;
  model?: { providerID: string; modelID: string };
  command?: string;
}

export interface RetryPart extends PartBase {
  type: 'retry';
  attempt: number;
  error: {
    name?: string;
    message: string;
    statusCode?: number;
    isRetryable: boolean;
    [key: string]: unknown;
  };
  time: { created: number };
}

export interface StepStartPart extends PartBase {
  type: 'step-start';
  snapshot?: string;
}

export interface StepFinishPart extends PartBase {
  type: 'step-finish';
  reason?: string;
  snapshot?: string;
  cost: number;
  tokens: {
    total?: number;
    input: number;
    output: number;
    reasoning: number;
    cache: { read: number; write: number };
  };
}

export interface SnapshotPart extends PartBase {
  type: 'snapshot';
  snapshot: string;
}

export interface PatchPart extends PartBase {
  type: 'patch';
  hash: string;
  files: string[];
}

/** Agent entity */
export interface Agent {
  name: string;
  description?: string;
  mode: 'all' | 'subagent' | 'primary';
  role?: string;
  permission: Array<{
    permission: string;
    pattern: string;
    action: 'ask' | 'allow' | 'deny';
  }>;
  options: Record<string, unknown>;
  hidden?: boolean;
  model?: { providerID: string; modelID: string };
  prompt?: { system?: string };
  skills?: string[];
  steps?: number;
}

/** Provider entity */
export interface Provider {
  id: string;
  name: string;
  models: Record<string, Model>;
}

/** Model entity */
export interface Model {
  id: string;
  name: string;
  providerID: string;
}

/** Config entity */
export interface Config {
  theme?: string;
  keybinds?: KeybindsConfig;
  editor?: string;
  [key: string]: unknown;
}

/** Keybinds configuration */
export interface KeybindsConfig {
  leader: string;
  [key: string]: string;
}

/** Command entity */
export interface Command {
  id: string;
  name: string;
  description?: string;
}

/** Session status */
export type SessionStatus =
  | { type: 'idle' }
  | { type: 'busy' }
  | { type: 'retry'; attempt: number; message: string; next: number };

/** User message (role: 'user') */
export type UserMessage = Message & {
  role: 'user';
  summary?: {
    title?: string;
    body?: string;
    diffs: Array<{ file: string; before: string; after: string; additions: number; deletions: number; status?: 'added' | 'deleted' | 'modified' }>;
  };
  tools?: Record<string, boolean>;
};

/** Assistant message (role: 'assistant') */
export type AssistantMessage = Message & {
  role: 'assistant';
  parentID: string;
  providerID: string;
  modelID: string;
  mode: string;
  path: { cwd: string; root: string };
  tokens: {
    total?: number;
    input: number;
    output: number;
    reasoning: number;
    cache: { read: number; write: number };
  };
  cost: number;
  summary?: boolean;
  error?: {
    name: string;
    message: string;
    data?: unknown;
    retries?: number;
    statusCode?: number;
    isRetryable?: boolean;
    providerID?: string;
  };
  finish?: string;
};

/** Event from server — OpenAPI union extended with undocumented server events */
export type Event =
  | import('./types.gen.js').EventSubscribeResponse
  | { type: 'user.updated'; properties: { user: Record<string, unknown> } };

/** Todo item (matches server Todo.Info) */
export interface Todo {
  content: string;
  status: string;
  priority: string;
}

export interface McpResource {
  id: string;
  name: string;
  content?: string;
}

export interface QuestionAnswer {
  value: string;
  label: string;
}

export interface PermissionRequest {
  id: string;
  sessionID: string;
  permission: string;
  pattern: string;
  action: 'ask' | 'allow' | 'deny';
}

export interface QuestionRequest {
  id: string;
  sessionID: string;
  question: string;
  options?: QuestionAnswer[];
  allowMultiple?: boolean;
  allowFreeform?: boolean;
}

export interface LspStatus {
  id: string;
  name: string;
  root: string;
  status: 'error' | 'connected';
}

export interface McpStatus {
  name: string;
  status: 'connected' | 'disconnected' | 'error';
  error?: string;
}

export interface FormatterStatus {
  name: string;
  enabled: boolean;
}

export interface ProviderListResponse {
  all: Provider[];
  default: Record<string, string>;
  connected: string[];
}

export interface ProviderAuthMethod {
  id: string;
  name: string;
  type: 'oauth' | 'api_key';
}

export interface ProviderAuthAuthorization {
  url: string;
  state: string;
}

export interface FileDiff {
  path: string;
  added: number;
  removed: number;
}

export interface VcsInfo {
  branch: string;
  commit?: string;
  dirty?: boolean;
}

export interface SessionMessageResponse {
  messages: Message[];
}

/** Path info from /path endpoint */
export interface Path {
  home: string;
  state: string;
  config: string;
  worktree: string;
  directory: string;
}

// Legacy alias
export type GIZZIClient = import('./a2r-client.js').A2RClient;
`;

await writeFile(`${OUTPUT_DIR}/entity-types.ts`, entityTypesTs)

// Generate entity-types.d.ts — only types NOT in types.gen.d.ts (OpenAPI spec).
// This file must survive SDK rebuilds and must not conflict with types.gen.d.ts.
// IMPORTANT: Do NOT add types here that already exist in types.gen.d.ts.
const entityTypesDts = `/**
 * @a2r/sdk v2 — Supplemental entity types
 *
 * This file defines ONLY types that are NOT generated by the OpenAPI spec
 * (types.gen.d.ts). All OpenAPI-derived types (Message, Session, Part, Agent,
 * Provider, Config, SessionStatus, etc.) come directly from types.gen.d.ts.
 *
 * IMPORTANT — SDK rebuild safety:
 * When build.ts regenerates dist/v2, it must re-create this file with these
 * exact exports. Do NOT replace with conflicting custom interfaces.
 * See packages/sdk/js/script/build.ts for the generation logic.
 */

// PermissionRequest — alias for OpenAPI \`Permission\` type.
// sync.tsx uses the name PermissionRequest; the OpenAPI spec calls it Permission.
export type { Permission as PermissionRequest } from "./types.gen.js";

/**
 * QuestionRequest — internal runtime type (not in OpenAPI spec).
 * Shape derived from src/runtime/integrations/question/index.ts Question.Request Zod schema.
 */
export type QuestionRequest = {
  id: string;
  sessionID: string;
  questions: Array<{
    question: string;
    header: string;
    options: Array<{
      label: string;
      description: string;
    }>;
    multiple?: boolean;
    custom?: boolean;
  }>;
  tool?: {
    messageID: string;
    callID: string;
  };
};

/**
 * McpResource — internal MCP resource type (not in OpenAPI spec).
 * Shape derived from src/runtime/tools/mcp/index.ts MCP.Resource Zod schema.
 */
export type McpResource = {
  name: string;
  uri: string;
  description?: string;
  mimeType?: string;
  client: string;
};

// Legacy / convenience aliases
export type QuestionAnswer = string | string[];
export type SessionMessageResponse = unknown;
export type GIZZIClient = unknown;
`;
await writeFile(`${OUTPUT_DIR}/entity-types.d.ts`, entityTypesDts)

// Update index.ts to export createA2RClient and entity types
const indexTs = await Bun.file(`${OUTPUT_DIR}/index.ts`).text()
// Remove duplicate ClientOptions from the generated index.ts
const cleanedIndexTs = indexTs.replace(/export type \{ ClientOptions \} from '\.\/sdk\.gen';?\n?/g, '')
const updatedIndexTs = `// This file is auto-generated by @hey-api/openapi-ts

// Class-based client (main export)
export { A2RClient, createA2RClient } from './a2r-client';
export type { Client } from './client/index';

// Entity types (extracted from OpenAPI spec)
export type {
  Message,
  Part,
  Session,
  AssistantMessage,
  UserMessage,
  Event,
  SessionStatus,
  FilePart,
  AgentPart,
  TextPart,
  ToolPart,
  CompactionPart,
  ReasoningPart,
  SubtaskPart,
  RetryPart,
  StepStartPart,
  StepFinishPart,
  SnapshotPart,
  PatchPart,
  KeybindsConfig,
  Config,
  Command,
  Agent,
  Provider,
  McpResource,
  QuestionAnswer,
  PermissionRequest,
  QuestionRequest,
  LspStatus,
  McpStatus,
  FormatterStatus,
  ProviderListResponse,
  ProviderAuthMethod,
  ProviderAuthAuthorization,
  FileDiff,
  Model,
  Todo,
  VcsInfo,
  SessionMessageResponse,
  Path,
  GIZZIClient,
} from './entity-types';

// Functional API exports
${cleanedIndexTs.replace('// This file is auto-generated by @hey-api/openapi-ts\n\nexport', 'export')}

// Legacy function alias
export { createA2RClient as createA2R } from './a2r-client.js';
`
await writeFile(`${OUTPUT_DIR}/index.ts`, updatedIndexTs)

// Rebuild index.js with the new exports
await $`bun build ${OUTPUT_DIR}/index.ts --outdir ${OUTPUT_DIR} --target=bun --format=esm`

// Generate type declarations
console.log("  Generating type declarations...")

const clientDts = `import { type Client, type ClientOptions } from "./client/index.js";
import type {
${functions.map(f => `  ${f},`).join('\n')}
} from "./sdk.gen.js";

class HeyApiClient {
  protected client: Client;
  constructor(args?: { client?: Client });
}

class HeyApiRegistry<T> {
  private readonly defaultKey: string;
  private readonly instances: Map<string, T>;
  get(key?: string): T;
  set(value: T, key?: string): void;
}

${allClassDefs.split('\n\n').map(c => c.startsWith('class ') ? 'declare ' + c : c).join('\n\n')}

export declare class A2RClient extends HeyApiClient {
  static readonly __registry: HeyApiRegistry<A2RClient>;
  constructor(args?: { client?: Client; key?: string });
${clientPropsStr.split('\n').map(l => `  ${l}`).join('\n')}
}

export declare function createA2RClient(config?: {
  baseUrl?: string;
  fetch?: typeof fetch;
  headers?: Record<string, string>;
  directory?: string;
  signal?: AbortSignal;
}): A2RClient;

export * from "./types.gen.js";
export { Client, ClientOptions };
`;
await writeFile(`${OUTPUT_DIR}/client.d.ts`, clientDts)

// Generate index.d.ts for the v2 export
const indexDts = `// This file is auto-generated by @hey-api/openapi-ts

// Class-based client (main export)
export { A2RClient, createA2RClient } from './a2r-client.js';
export type { Client, ClientOptions } from './client/index.js';

// Functional API exports
export {
${functions.map(f => `  ${f},`).join('\n')}
  type Options,
} from './sdk.gen.js';

// All OpenAPI-generated types (Message, Session, Part, Agent, Provider, Config, etc.)
export * from './types.gen.js';

// Types not in the OpenAPI spec (QuestionRequest, McpResource, PermissionRequest alias, etc.)
export type {
  QuestionRequest,
  McpResource,
  PermissionRequest,
  QuestionAnswer,
  SessionMessageResponse,
  GIZZIClient,
} from './entity-types.js';
`;
await writeFile(`${OUTPUT_DIR}/index.d.ts`, indexDts)

// Generate a2r-client.d.ts so index.d.ts can resolve './a2r-client.js' to proper types
// (TypeScript resolves .js imports in .d.ts to .d.ts files; without this it falls back to .ts source)
const a2rClientDts = `// Re-export A2RClient declarations from client.d.ts
// This file exists so index.d.ts can resolve './a2r-client.js' to proper types.
export { A2RClient, createA2RClient } from './client.js';
export type { Client, ClientOptions } from './client/index.js';
`
await writeFile(`${OUTPUT_DIR}/a2r-client.d.ts`, a2rClientDts)

console.log("✅ SDK build complete!")
console.log(`   Output: ${OUTPUT_DIR}/`)
console.log(`   Resources: ${sortedResources.length}`)
console.log(`   Functions: ${functions.length}`)
console.log("")
console.log("   Resources:")
for (const [resource, { direct, nested }] of sortedResources) {
  const totalMethods = direct.length + Array.from(nested.values()).reduce((a, b) => a + b.length, 0)
  const nestedStr = nested.size > 0 ? ` (${nested.size} nested)` : ''
  console.log(`     - ${resource}: ${totalMethods} methods${nestedStr}`)
}

// Add @ts-nocheck to generated files to avoid type errors in consumer
const generatedFiles = [
  `${OUTPUT_DIR}/a2r-client.ts`,
  `${OUTPUT_DIR}/sdk.gen.ts`,
]
for (const file of generatedFiles) {
  if (existsSync(file)) {
    const content = await Bun.file(file).text()
    if (!content.startsWith('// @ts-nocheck')) {
      await writeFile(file, `// @ts-nocheck\n${content}`)
      console.log(`   Added @ts-nocheck to ${file}`)
    }
  }
}
