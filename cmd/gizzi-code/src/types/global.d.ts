/**
 * Global type declarations for missing modules
 * TEMPORARY SHIM
 */

// Anthropic SDK namespace declarations at top level
// These mirror the SDK's actual structure to fix TS2702 errors
// when using namespace-style type references like Anthropic.Beta.Messages.X
declare namespace Anthropic {
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

// External modules without type declarations
declare module 'qrcode' {
  export function toString(data: string, options?: unknown): Promise<string>
  export function toDataURL(data: string, options?: unknown): Promise<string>
}

declare module 'tree-sitter' {
  export class Parser {
    setLanguage(language: unknown): void
    parse(input: string): Tree
  }
  export interface Tree {
    rootNode: unknown
  }
}

declare module 'glob' {
  export function glob(pattern: string, options?: unknown): Promise<string[]>
  export function sync(pattern: string, options?: unknown): string[]
}

declare module 'asciichart' {
  export function plot(data: number[], options?: unknown): string
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

declare module 'supports-hyperlinks' {
  export function supportsHyperlink(stream: unknown): boolean
}

declare module 'url-handler-napi' {
  export function parse(url: string): unknown
}

// OpenTelemetry modules
declare module '@opentelemetry/api-logs' {
  export interface Logger {
    emit(logRecord: { severityNumber?: number; severityText?: string; body?: string; attributes?: Record<string, unknown> }): void
  }
  export const logs: {
    getLogger(name: string, version?: string): Logger
  }
  
  export interface AnyValueMap {
    [key: string]: unknown
  }
}

declare module '@opentelemetry/sdk-logs' {
  export interface LogRecord {
    severityNumber?: number
    severityText?: string
    body?: string
    attributes?: Record<string, unknown>
  }
  
  export class LoggerProvider {
    constructor(config?: { resource?: unknown; processors?: LogRecordProcessor[] })
    forceFlush(): Promise<void>
    shutdown(): Promise<void>
    addLogRecordProcessor(processor: LogRecordProcessor): void
  }
  
  export interface LogRecordProcessor {
    onEmit(logRecord: LogRecord): void
    shutdown(): Promise<void>
    forceFlush(): Promise<void>
  }
  
  export class BatchLogRecordProcessor implements LogRecordProcessor {
    constructor(exporter: LogRecordExporter, options?: { scheduledDelayMillis?: number; maxExportBatchSize?: number; maxQueueSize?: number })
    onEmit(logRecord: LogRecord): void
    shutdown(): Promise<void>
    forceFlush(): Promise<void>
  }
  
  export interface LogRecordExporter {
    export(records: LogRecord[], resultCallback: (result: { code: number }) => void): void
    shutdown(): Promise<void>
  }
  
  export class ConsoleLogRecordExporter implements LogRecordExporter {
    export(records: LogRecord[], resultCallback: (result: { code: number }) => void): void
    shutdown(): Promise<void>
  }
  
  export interface ReadableLogRecord extends LogRecord {
    timestamp: number
    observedTimestamp: number
    severityNumber?: number
    severityText?: string
    body?: string
    attributes: Record<string, unknown>
  }
}

declare module '@opentelemetry/sdk-metrics' {
  export interface MetricData {
    descriptor: {
      name: string
      description: string
      unit: string
      type: string
    }
    dataPoints: DataPoint[]
  }
  
  export interface DataPoint {
    attributes: Record<string, unknown>
    value: number
    startTime: number
    endTime: number
  }
  
  export interface ResourceMetrics {
    resource: unknown
    scopeMetrics: unknown[]
  }
  
  export interface PushMetricExporter {
    export(metrics: ResourceMetrics, resultCallback: (result: { code: ExportResultCode; error?: Error }) => void): void
    shutdown(): Promise<void>
    forceFlush(): Promise<void>
    getPreferredAggregationTemporality(): AggregationTemporality
  }
  
  export enum AggregationTemporality {
    DELTA = 0,
    CUMULATIVE = 1
  }
  
  export enum ExportResultCode {
    SUCCESS = 0,
    FAILED = 1
  }
  
  export class ConsoleMetricExporter implements PushMetricExporter {
    export(metrics: ResourceMetrics, resultCallback: (result: { code: ExportResultCode; error?: Error }) => void): void
    shutdown(): Promise<void>
    forceFlush(): Promise<void>
    getPreferredAggregationTemporality(): AggregationTemporality
  }
  
  export class MeterProvider {
    forceFlush(): Promise<void>
    shutdown(): Promise<void>
    addMetricReader(reader: MetricReader): void
  }
  
  export interface MetricReader {
    getPreferredAggregationTemporality(): AggregationTemporality
  }
  
  export class PeriodicExportingMetricReader implements MetricReader {
    constructor(options: { exporter: PushMetricExporter; exportIntervalMillis?: number })
    getPreferredAggregationTemporality(): AggregationTemporality
  }
}

declare module '@opentelemetry/sdk-trace-base' {
  export class BasicTracerProvider {
    forceFlush(): Promise<void>
    shutdown(): Promise<void>
    addSpanProcessor(processor: SpanProcessor): void
  }
  
  export interface SpanProcessor {
    onStart(span: unknown): void
    onEnd(span: unknown): void
    shutdown(): Promise<void>
    forceFlush(): Promise<void>
  }
  
  export class BatchSpanProcessor implements SpanProcessor {
    constructor(exporter: SpanExporter)
    onStart(span: unknown): void
    onEnd(span: unknown): void
    shutdown(): Promise<void>
    forceFlush(): Promise<void>
  }
  
  export interface SpanExporter {
    export(spans: unknown[], resultCallback: (result: { code: number }) => void): void
    shutdown(): Promise<void>
  }
  
  export class ConsoleSpanExporter implements SpanExporter {
    export(spans: unknown[], resultCallback: (result: { code: number }) => void): void
    shutdown(): Promise<void>
  }
}

declare module '@opentelemetry/exporter-trace-otlp-http' {
  export class OTLPTraceExporter {
    constructor(options?: { url?: string; headers?: Record<string, string> })
  }
}

declare module '@opentelemetry/exporter-metrics-otlp-http' {
  export class OTLPMetricExporter {
    constructor(options?: { url?: string; headers?: Record<string, string> })
  }
}

declare module '@opentelemetry/exporter-logs-otlp-http' {
  export class OTLPLogExporter {
    constructor(options?: { url?: string; headers?: Record<string, string> })
  }
}

declare module '@opentelemetry/exporter-trace-otlp-grpc' {
  export class OTLPTraceExporter {
    constructor(options?: { url?: string; headers?: Record<string, string> })
  }
}

declare module '@opentelemetry/exporter-trace-otlp-proto' {
  export class OTLPTraceExporter {
    constructor(options?: { url?: string; headers?: Record<string, string> })
  }
}

declare module '@opentelemetry/exporter-metrics-otlp-grpc' {
  export class OTLPMetricExporter {
    constructor(options?: { url?: string; headers?: Record<string, string> })
  }
}

declare module '@opentelemetry/exporter-metrics-otlp-proto' {
  export class OTLPMetricExporter {
    constructor(options?: { url?: string; headers?: Record<string, string> })
  }
}

declare module '@opentelemetry/exporter-logs-otlp-grpc' {
  export class OTLPLogExporter {
    constructor(options?: { url?: string; headers?: Record<string, string> })
  }
}

declare module '@opentelemetry/exporter-logs-otlp-proto' {
  export class OTLPLogExporter {
    constructor(options?: { url?: string; headers?: Record<string, string> })
  }
}

declare module '@opentelemetry/exporter-prometheus' {
  export class PrometheusExporter {
    constructor(options?: { port?: number; endpoint?: string })
  }
}

declare module '@opentelemetry/core' {
  export enum ExportResultCode {
    SUCCESS = 0,
    FAILED = 1
  }
  
  export interface ExportResult {
    code: ExportResultCode
    error?: Error
  }
  
  export interface TraceId {
    traceId: string
    spanId: string
  }
}

declare module '@opentelemetry/resources' {
  export interface Resource {
    attributes: Record<string, unknown>
    merge(other: Resource): Resource
  }
  
  export function resourceFromAttributes(attributes: Record<string, unknown>): Resource
  export function envDetector(): { detect(): Promise<Resource> }
  export function hostDetector(): { detect(): Promise<Resource> }
  export function osDetector(): { detect(): Promise<Resource> }
}

// AWS SDK modules
declare module '@aws-sdk/client-bedrock-runtime' {
  export class BedrockRuntimeClient {
    constructor(config?: any)
    send(command: any): Promise<any>
  }
}

declare module '@aws-sdk/client-bedrock' {
  export class BedrockClient {
    constructor(config?: any)
    send(command: any): Promise<any>
  }
  
  export class ListInferenceProfilesCommand {
    constructor(input: any)
  }
  
  export class GetInferenceProfileCommand {
    constructor(input: any)
  }
}

declare module '@aws-sdk/client-sts' {
  export class STSClient {
    constructor(config?: any)
    send(command: any): Promise<any>
  }
  export class GetCallerIdentityCommand {
    constructor(input: any)
  }
}

declare module '@aws-sdk/credential-provider-node' {
  export function defaultProvider(): unknown
}

declare module '@aws-sdk/credential-providers' {
  export function fromIni(options?: { ignoreCache?: boolean }): () => Promise<unknown>
}

// Smithy modules
declare module '@smithy/node-http-handler' {
  export class NodeHttpHandler {
    constructor(options?: any)
  }
}

declare module '@smithy/core' {
  export class NoAuthSigner {
    constructor()
  }
}

// GrowthBook
declare module '@growthbook/growthbook' {
  export class GrowthBook {
    constructor(options?: unknown)
    loadFeatures(): Promise<void>
    isOn(feature: string): boolean
    getFeatureValue<T>(feature: string, defaultValue: T): T
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

// Global MACRO constant - moved inside declare global below
declare module 'figures' {
  function figures(figure: string): string
  export = figures
  export const heart: string
  export const cross: string
  export const pointer: string
  export const tick: string
  export const warning: string
  export const info: string
  export const bullet: string
  export const arrowRight: string
  export const arrowLeft: string
  export const arrowUp: string
  export const arrowDown: string
  export const arrowUpSmall: string
  export const arrowDownSmall: string
  export const arrowRightSmall: string
  export const triangleUp: string
  export const triangleDown: string
  export const triangleRight: string
  export const triangleLeft: string
  export const triangleUpSmall: string
  export const triangleDownSmall: string
  export const triangleRightSmall: string
  export const triangleLeftSmall: string
  export const triangleUpOutline: string
  export const pointerSmall: string
  export const checkboxOn: string
  export const checkboxOff: string
  export const radioOn: string
  export const radioOff: string
  export const questionMarkPrefix: string
  export const line: string
  export const ellipsis: string
  export const point: string
  export const play: string
  export const square: string
  export const squareSmall: string
  export const squareSmallFilled: string
  export const circle: string
  export const circleFilled: string
  export const circleDotted: string
  export const circleDouble: string
  export const circleCircle: string
  export const circleCross: string
  export const circlePipe: string
  export const circleQuestionMark: string
  export const bulletWhite: string
  export const dot: string
  export const lineVertical: string
  export const lineHorizontal: string
  export const lineUpDownRight: string
  export const lineUpRight: string
  export const cornerTopLeft: string
  export const cornerTopRight: string
  export const cornerBottomLeft: string
  export const cornerBottomRight: string
  export const tickSmall: string
  export const crossSmall: string
  export const star: string
  export const hash: string
  export const infoSmall: string
  export const warningSmall: string
}
declare module 'usehooks-ts' {
  export function useLocalStorage<T>(key: string, initialValue: T): [T, (v: T) => void]
  export function useInterval(callback: () => void, delay: number | null): void
  
  export interface DebouncedFunction<T extends (...args: unknown[]) => unknown> {
    (...args: Parameters<T>): ReturnType<T>
    cancel(): void
    flush(): ReturnType<T>
  }
  
  export function useDebounceCallback<T extends (...args: unknown[]) => unknown>(
    callback: T,
    delay: number
  ): DebouncedFunction<T>
}

// @ant/* SDK modules
declare module '@ant/computer-use-mcp' {
  export function executeComputerUse(options: unknown): Promise<unknown>
  export function executeComputerUseRequest(request: unknown): Promise<unknown>
  export function buildComputerUseTools(config: unknown, coordinateMode?: string): unknown[]
  export function createComputerUseMcpServer(config: unknown): unknown
  export function bindSessionContext(context: unknown): unknown
  export function targetImageSize(physW: number, physH: number, params: unknown): [number, number]
  export const API_RESIZE_PARAMS: unknown
  
  export interface ComputerExecutor {
    execute(command: unknown): Promise<unknown>
    capabilities?: unknown
  }
  
  export interface DisplayGeometry {
    width: number
    height: number
  }
  
  export interface FrontmostApp {
    name: string
    bundleId: string
    pid: number
    displayName?: string
  }
  
  export interface InstalledApp {
    name: string
    bundleId: string
    path: string
  }
  
  export interface RunningApp {
    name: string
    bundleId: string
    pid: number
  }
  
  export interface ResolvePrepareCaptureResult {
    success: boolean
    path?: string
    error?: string
  }
  
  export interface ScreenshotResult {
    success: boolean
    data?: string
    path?: string
    error?: string
  }
  
  export interface ScreenshotDims {
    width: number
    height: number
  }
  
  export interface ComputerUseSessionContext {
    sessionId: string
    geometry: DisplayGeometry
  }
  
  export interface CuCallToolResult {
    content: Array<{ type: string; text?: string; source?: unknown }>
    isError?: boolean
  }
  
  export const API_RESIZE_PARAMS: string[]
  export const targetImageSize: number
}

declare module '@ant/computer-use-mcp/types' {
  export interface ComputerUseOptions {}
  
  export interface CuPermissionRequest {
    toolUseId: string
    appId: string
    flags: number
  }
  
  export interface CuPermissionResponse {
    granted: boolean
    flags: number
  }
  
  export const DEFAULT_GRANT_FLAGS: number
  
  export type CoordinateMode = 'absolute' | 'relative'
  
  export interface CuSubGates {
    screenshot?: boolean
    input?: boolean
    navigate?: boolean
  }
  
  export interface ComputerUseHostAdapter {
    getDisplayGeometry(): Promise<DisplayGeometry>
    getFrontmostApp(): Promise<FrontmostApp>
    getInstalledApps(): Promise<InstalledApp[]>
    getRunningApps(): Promise<RunningApp[]>
    resolvePrepareCapture(): Promise<ResolvePrepareCaptureResult>
    takeScreenshot(): Promise<ScreenshotResult>
  }
  
  export interface Logger {
    debug(message: string): void
    info(message: string): void
    warn(message: string): void
    error(message: string): void
  }
  
  export interface DisplayGeometry {
    width: number
    height: number
  }
  
  export interface FrontmostApp {
    name: string
    bundleId: string
    pid: number
  }
  
  export interface InstalledApp {
    name: string
    bundleId: string
    path: string
  }
  
  export interface RunningApp {
    name: string
    bundleId: string
    pid: number
  }
  
  export interface ResolvePrepareCaptureResult {
    success: boolean
    path?: string
    error?: string
  }
  
  export interface ScreenshotResult {
    success: boolean
    data?: string
    path?: string
    error?: string
  }
}

declare module '@ant/computer-use-mcp/sentinelApps' {
  export interface SentinelApp {
    id: string
    name: string
    bundleId: string
  }
  export const SENTINEL_APPS: SentinelApp[]
  export function getSentinelCategory(bundleId: string): string | undefined
}

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

// ============================================================================
// Model Context Protocol SDK
// ============================================================================

declare module '@modelcontextprotocol/sdk/client/auth.js' {
  export function discoverAuthorizationServerMetadata(url: string | URL, options?: { fetchFn?: FetchLike }): Promise<AuthorizationServerMetadata | undefined>
  export function discoverOAuthServerInfo(url: string, options?: { fetchFn?: FetchLike; resourceMetadataUrl?: URL }): Promise<{
    authorizationServerMetadata?: AuthorizationServerMetadata
    authorizationEndpoint: string
    tokenEndpoint: string
  }>
  export class OAuthClientProvider {
    constructor(config: { clientId: string; redirectUri: string })
    getClient(): Promise<OAuthClientInformation>
  }
  
  export interface OAuthDiscoveryState {
    url: string
    state: 'pending' | 'success' | 'error'
    error?: string
    authorizationServerUrl?: string
    resourceMetadataUrl?: string
    resourceMetadata?: unknown
    authorizationServerMetadata?: AuthorizationServerMetadata
  }
  
  export interface OAuthTokens {
    access_token: string
    refresh_token?: string
    expires_in?: number
    token_type?: string
    scope?: string
  }
  
  export class UnauthorizedError extends Error {}
  
  export function exchangeAuthorizationCode(options: {
    clientInformation: OAuthClientInformation
    authorizationCode: string
  }): Promise<OAuthTokens>
  
  export function startAuthorization(issuer: string | URL, options: {
    serverUrl?: string
    metadata?: AuthorizationServerMetadata
    clientInformation: OAuthClientInformation
    clientUri?: string
    redirectUrl?: string
    scope?: string
    state?: string
  }): Promise<OAuthAuthorizationState>
  
  export function refreshAuthorization(
    serverUrl: URL,
    options: {
      metadata: AuthorizationServerMetadata
      clientInformation: OAuthClientInformation
      refreshToken: string
      resource?: URL
      fetchFn?: FetchLike
    }
  ): Promise<OAuthTokens>
  
  export interface OAuthClientInformation {
    client_id: string
    client_secret?: string
  }
  
  export interface OAuthClientInformationFull extends OAuthClientInformation {
    client_id_issued_at?: number
    client_secret_expires_at?: number
  }
  
  export interface OAuthAuthorizationState {
    authorizationUrl: URL
    codeVerifier: string
  }
  
  export interface AuthFlowOptions {
    serverUrl: string
    authorizationCode?: string
    scope?: string
    resourceMetadataUrl?: URL
  }
  
  export function auth(provider: OAuthClientProvider, options: AuthFlowOptions): Promise<'AUTHORIZED' | 'REDIRECT'>
  
  // Additional exports used by the codebase
  export function exchangeAuthorization(
    issuer: string,
    options: {
      metadata: AuthorizationServerMetadata
      clientInformation: OAuthClientInformation
      authorizationCode: string
      codeVerifier: string
      redirectUri: string
      fetchFn?: FetchLike
    }
  ): Promise<{ id_token?: string; access_token?: string; expires_in?: number }>
}

declare module '@modelcontextprotocol/sdk/server/auth/errors.js' {
  export class InvalidTokenError extends Error {}
  export class OAuthCallbackError extends Error {
    constructor(message: string, code?: string)
    code?: string
  }
  export class InvalidGrantError extends Error {}
  export class OAuthError extends Error {
    errorCode?: string
  }
  export class ServerError extends Error {}
  export class TemporarilyUnavailableError extends Error {}
  export class TooManyRequestsError extends Error {}
}

declare module '@modelcontextprotocol/sdk/shared/auth.js' {
  export interface OAuthMetadata {
    issuer: string
    authorization_endpoint: string
    token_endpoint: string
    registration_endpoint?: string
    revocation_endpoint?: string
    scopes_supported?: string[]
    grant_types_supported?: string[]
    token_endpoint_auth_methods_supported?: string[]
    revocation_endpoint_auth_methods_supported?: string[]
  }
  export interface AuthorizationServerMetadata {
    issuer: string
    authorization_endpoint: string
    token_endpoint: string
    registration_endpoint?: string
    revocation_endpoint?: string
    revocation_endpoint_auth_methods_supported?: string[]
    scopes_supported?: string[]
    grant_types_supported?: string[]
    token_endpoint_auth_methods_supported?: string[]
    scope?: string
    default_scope?: string
  }
  export interface OAuthClientInformation {
    client_id: string
    client_secret?: string
    redirect_uris?: string[]
  }
  export interface OAuthClientInformationFull extends OAuthClientInformation {
    client_name?: string
    client_uri?: string
    logo_uri?: string
    scope?: string
    grant_types?: string[]
    response_types?: string[]
    token_endpoint_auth_method?: string
  }
  export interface OAuthTokens {
    access_token: string
    refresh_token?: string
    expires_in?: number
    token_type?: string
    scope?: string
  }
  
  // Zod schema-like interfaces
  type SafeParseResult<T> = {
    success: true
    data: T
  } | {
    success: false
    error: { message: string }
  }
  
  export const OAuthMetadataSchema: {
    parse(data: unknown): AuthorizationServerMetadata
    safeParse(data: unknown): SafeParseResult<AuthorizationServerMetadata>
  }
  export const OAuthTokensSchema: {
    parse(data: unknown): OAuthTokens
    safeParse(data: unknown): SafeParseResult<OAuthTokens>
  }
  export const OAuthErrorResponseSchema: {
    parse(data: unknown): { error: string; error_description?: string }
    safeParse(data: unknown): SafeParseResult<{ error: string; error_description?: string }>
  }
  
  export interface OAuthClientMetadata {
    client_name?: string
    client_uri?: string
    redirect_uris?: string[]
    grant_types?: string[]
    response_types?: string[]
    token_endpoint_auth_method?: string
    scope?: string
  }
  
  export interface OpenIdProviderDiscoveryMetadata {
    issuer: string
    authorization_endpoint: string
    token_endpoint: string
    userinfo_endpoint?: string
    jwks_uri?: string
    scopes_supported?: string[]
  }
  
  export const OpenIdProviderDiscoveryMetadataSchema: {
    safeParse(data: unknown): SafeParseResult<OpenIdProviderDiscoveryMetadata>
  }
  
  export function generateAuthUrl(options: {
    serverUrl: string
    metadata: OAuthMetadata
    codeVerifier: string
    clientMetadata: OAuthClientMetadata
  }): string
}

declare module '@modelcontextprotocol/sdk/shared/transport.js' {
  export interface Transport {
    start(): Promise<void>
    close(): Promise<void>
    send(message: JSONRPCMessage): Promise<void>
    onclose?: () => void
    onerror?: (error: Error) => void
    onmessage?: (message: JSONRPCMessage) => void
  }
  
  export type FetchLike = ((url: string | URL, init?: RequestInit) => Promise<Response>) & {
    preconnect?: (url: string | URL, init?: RequestInit) => Promise<void>
  }
  
  export function createFetchWithInit(fetchImpl?: FetchLike, init?: RequestInit): FetchLike
}

declare module '@modelcontextprotocol/sdk/types.js' {
  export interface JSONRPCMessage {
    jsonrpc: '2.0'
    id?: string | number
    method?: string
    params?: unknown
    result?: unknown
    error?: {
      code: number
      message: string
      data?: unknown
    }
  }
  
  export interface Tool {
    name: string
    description?: string
    inputSchema: {
      type: 'object'
      properties?: Record<string, unknown>
      required?: string[]
    }
    // Additional properties used by the codebase
    _meta?: {
      title?: string
      deprecated?: boolean
      [key: string]: unknown
    }
    annotations?: {
      readOnly?: boolean
      destructive?: boolean
      openWorld?: boolean
      [key: string]: unknown
    }
  }
  
  export interface Resource {
    uri: string
    name: string
    description?: string
    mimeType?: string
  }
  
  export interface Prompt {
    name: string
    description?: string
    arguments?: PromptArgument[]
  }
  
  export interface PromptArgument {
    name: string
    description?: string
    required?: boolean
  }
  
  export interface ServerCapabilities {
    tools?: {
      listChanged?: boolean
    }
    resources?: {
      subscribe?: boolean
      listChanged?: boolean
    }
    prompts?: {
      listChanged?: boolean
    }
    logging?: {}
    experimental?: {
      [key: string]: unknown
    }
  }
  
  export interface ClientCapabilities {
    roots?: {
      listChanged?: boolean
    }
    sampling?: {}
  }
  
  export interface Implementation {
    name: string
    version: string
  }
  
  export interface TextContent {
    type: 'text'
    text: string
  }
  
  export interface ImageContent {
    type: 'image'
    data: string
    mimeType: string
  }
  
  export type Content = TextContent | ImageContent | AudioContent
  
  export interface AudioContent {
    type: 'audio'
    data: string
    mimeType: string
  }
  
  export interface CallToolResult {
    content: Content[]
    isError?: boolean
    _meta?: {
      title?: string
      [key: string]: unknown
    }
    structuredContent?: unknown
  }
  
  export interface ReadResourceResult {
    contents: Array<{
      uri: string
      mimeType?: string
      text?: string
      blob?: string
    }>
  }
  
  export interface ElicitRequestURLParams {
    url: string
    message?: string
    mode?: string
    elicitationId?: string
  }
  
  export type ElicitRequestParams = ElicitRequestURLParams | ElicitRequestFormParams
  
  export interface ElicitRequestFormParams {
    title: string
    message?: string
    mode?: string
    requestedSchema?: {
      properties: Record<string, PrimitiveSchemaDefinition | object>
      required?: string[]
    }
    fields?: ElicitField[]
  }
  
  export interface ElicitField {
    name: string
    label?: string
    type?: string
    required?: boolean
    options?: Array<{ label: string; value: string }>
  }
  
  export interface ElicitResult {
    values: Record<string, string>
    action?: 'accept' | 'decline' | string
    [key: string]: unknown
  }
  
  export interface PrimitiveSchemaDefinition {
    type: 'string' | 'number' | 'boolean' | 'object' | 'array'
    description?: string
    properties?: Record<string, PrimitiveSchemaDefinition>
    items?: PrimitiveSchemaDefinition
    enum?: string[]
    format?: string
    [key: string]: unknown
  }
  
  export const ListToolsRequestSchema: unique symbol
  export const CallToolRequestSchema: unique symbol
  export const ListResourcesRequestSchema: unique symbol
  export const ReadResourceRequestSchema: unique symbol
  export const ListPromptsRequestSchema: unique symbol
  export const GetPromptRequestSchema: unique symbol
  
  export interface CallToolRequest {
    params: {
      name: string
      arguments?: Record<string, unknown>
    }
  }
  
  export interface ListToolsRequest {}
  export interface ListResourcesRequest {}
  export interface ReadResourceRequest {
    params: {
      uri: string
    }
  }
  export interface ListPromptsRequest {}
  export interface GetPromptRequest {
    params: {
      name: string
      arguments?: Record<string, unknown>
    }
  }
  
  // Schemas for request handlers
  export const CallToolResultSchema: unique symbol
  export const ListPromptsResultSchema: unique symbol
  export const ListResourcesResultSchema: unique symbol
  
  // Elicit types
  export const ElicitRequestSchema: unique symbol
  export const ElicitationCompleteNotificationSchema: unique symbol
  
  // Error types
  export enum ErrorCode {
    ParseError = -32700,
    InvalidRequest = -32600,
    MethodNotFound = -32601,
    InvalidParams = -32602,
    InternalError = -32603,
    UrlElicitationRequired = -32001,
    FormElicitationRequired = -32002,
  }
  
  export class McpError extends Error {
    constructor(code: ErrorCode, message: string, data?: unknown)
    code: ErrorCode
    data?: unknown
  }
  
  // List results
  export interface ListToolsResult {
    tools: Tool[]
  }
  
  export interface ListPromptsResult {
    prompts: Prompt[]
  }
  
  export interface ListResourcesResult {
    resources: Resource[]
  }
  
  // Additional schema exports
  export const ListRootsRequestSchema: unique symbol
  export const ListToolsResultSchema: unique symbol
  
  // Resource link type
  export interface ResourceLink {
    uri: string
    title?: string
    name?: string
    [key: string]: unknown
  }
  
  // Prompt message type
  export interface PromptMessage {
    role: 'user' | 'assistant'
    content: TextContent | ImageContent
  }
}

declare module '@modelcontextprotocol/sdk/client/index.js' {
  export class Client {
    constructor(
      info: { name: string; version: string },
      capabilities?: {
        roots?: { listChanged?: boolean }
        sampling?: {}
        elicitation?: {}
        [key: string]: unknown
      }
    )
    // Internal transport reference for SDK control
    transport?: {
      onmessage?: (message: unknown) => void
      send?: (message: unknown) => Promise<void>
      start?: () => Promise<void>
      close?: () => Promise<void>
    }
    // Event handlers
    onerror?: (error: Error) => void
    onclose?: () => void
    connect(transport: Transport): Promise<void>
    close(): Promise<void>
    listTools(): Promise<{ tools: Tool[] }>
    callTool(params: { name: string; arguments?: Record<string, unknown> }, options?: { signal?: AbortSignal; timeout?: number; onprogress?: (progress: unknown) => void }): Promise<CallToolResult>
    listResources(): Promise<{ resources: Resource[] }>
    readResource(params: { uri: string }): Promise<ReadResourceResult>
    listPrompts(): Promise<{ prompts: Prompt[] }>
    getPrompt(params: { name: string; arguments?: Record<string, unknown> }): Promise<{
      description?: string
      messages: Array<{
        role: 'user' | 'assistant'
        content: { type: 'text'; text: string }
      }>
    }>
    // Additional client methods
    getServerCapabilities?(): ServerCapabilities | undefined
    getServerVersion?(): { name: string; version: string } | undefined
    getInstructions?(): string | undefined
    request?<T, R>(method: string, params: T): Promise<R>
    setRequestHandler?<T, R>(schema: symbol, handler: (request: T, extra: unknown) => Promise<R>): void
    setNotificationHandler<T extends Record<string, unknown> = Record<string, unknown>>(method: string, handler: (params: T) => void): void
    removeNotificationHandler(method: string): void
    notification<T extends Record<string, unknown> = Record<string, unknown>>(method: string, params?: T): Promise<void>
    setRequestHandler<T, R>(method: string, handler: (params: T) => R): void
    setRequestHandler(method: typeof CallToolRequestSchema, handler: (req: CallToolRequest) => Promise<CallToolResult>): void
    setRequestHandler(method: typeof ListToolsRequestSchema, handler: (req: ListToolsRequest) => Promise<{ tools: Tool[] }>): void
    setRequestHandler(method: typeof ListResourcesRequestSchema, handler: (req: ListResourcesRequest) => Promise<{ resources: Resource[] }>): void
    setRequestHandler(method: typeof ReadResourceRequestSchema, handler: (req: ReadResourceRequest) => Promise<ReadResourceResult>): void
    setRequestHandler(method: typeof ListPromptsRequestSchema, handler: (req: ListPromptsRequest) => Promise<{ prompts: Prompt[] }>): void
    setRequestHandler(method: typeof GetPromptRequestSchema, handler: (req: GetPromptRequest) => Promise<{ description?: string; messages: unknown[] }>): void
    removeRequestHandler(method: string): void
  }
  
  import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
  import type { Tool, CallToolResult, Resource, ReadResourceResult, Prompt } from '@modelcontextprotocol/sdk/types.js'
}

declare module '@modelcontextprotocol/sdk/client/sse.js' {
  export type FetchLike = (url: string | URL, init?: RequestInit) => Promise<Response>
  
  export interface SSEClientTransportOptions {
    authProvider?: unknown
    requestInit?: RequestInit
    fetch?: typeof fetch | FetchLike
    eventSourceInit?: {
      fetch?: typeof fetch | FetchLike
    }
  }
  
  export class SSEClientTransport {
    constructor(url: URL, opts?: SSEClientTransportOptions)
    start(): Promise<void>
    close(): Promise<void>
    send(message: unknown): Promise<void>
  }
}

declare module '@modelcontextprotocol/sdk/client/stdio.js' {
  export class StdioClientTransport {
    constructor(options: {
      command: string
      args?: string[]
      env?: Record<string, string>
    })
    start(): Promise<void>
    close(): Promise<void>
    send(message: unknown): Promise<void>
    // Additional properties
    stderr?: NodeJS.ReadableStream
    pid?: number
  }
}

declare module '@modelcontextprotocol/sdk/client/streamableHttp.js' {
  export interface StreamableHTTPClientTransportOptions {
    authProvider?: unknown
    requestInit?: RequestInit
    fetch?: typeof fetch | FetchLike
  }
  
  export class StreamableHTTPClientTransport {
    constructor(url: URL, opts?: StreamableHTTPClientTransportOptions)
    start(): Promise<void>
    close(): Promise<void>
    send(message: unknown): Promise<void>
  }
}

declare module '@modelcontextprotocol/sdk/server/index.js' {
  export class Server {
    constructor(
      info: { name: string; version: string },
      capabilities?: ServerCapabilities
    )
    connect(transport: Transport): Promise<void>
    close(): Promise<void>
    setRequestHandler<T, R>(method: string, handler: (params: T) => R): void
    setNotificationHandler<T extends Record<string, unknown> = Record<string, unknown>>(method: string, handler: (params: T) => void): void
    notification<T extends Record<string, unknown> = Record<string, unknown>>(method: string, params?: T): Promise<void>
  }
  
  import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
  import type { ServerCapabilities } from '@modelcontextprotocol/sdk/types.js'
}

declare module '@modelcontextprotocol/sdk/server/stdio.js' {
  export class StdioServerTransport {
    constructor()
    start(): Promise<void>
    close(): Promise<void>
    send(message: unknown): Promise<void>
  }
}

declare module '@alcalzone/ansi-tokenize' {
  export type AnsiCode = {
    code: number | string
    type?: 'color' | 'style' | 'reset' | 'ansi'
    rgb?: [number, number, number]
    endCode?: string
    name?: string
  }
  
  export type Token = {
    type: 'text' | 'ansi'
    value: string
    code?: number
  }
  
  export type StyledChar = {
    char: string
    width: number
    styles: AnsiCode[]
  }
  
  export function tokenize(input: string): Token[]
  export function ansiCodesToString(codes: AnsiCode[]): string
  export function reduceAnsiCodes(current: AnsiCode[], additions: AnsiCode[]): AnsiCode[]
  export function undoAnsiCodes(codes: AnsiCode[]): AnsiCode[]
  export function diffAnsiCodes(oldCodes: AnsiCode[], newCodes: AnsiCode[]): AnsiCode[]
  export function styledCharsFromTokens(tokens: unknown[]): StyledChar[]
}

// Additional external modules
declare module 'react-reconciler/constants.js' {
  export const SyncLane: number
  export const InputContinuousHydrationLane: number
  export const DefaultEventPriority: number
  export const DiscreteEventPriority: number
  export const ContinuousEventPriority: number
  export const NoEventPriority: number
}

// React 18 PropsWithChildren for older imports
declare module 'react' {
  export type PropsWithChildren<P = unknown> = P & { children?: ReactNode }
  export type Dispatch<A> = (value: A) => void
  export type SetStateAction<S> = S | ((prevState: S) => S)
}
declare module 'react-reconciler' {
  export interface ReconcilerInstance {
    createContainer(containerInfo: unknown, tag: number, hydrationCallbacks: unknown | null, isStrictMode: boolean, concurrentUpdatesByDefaultOverride: boolean | null, identifierPrefix: string, onRecoverableError: (error: Error) => void, transitionCallbacks: unknown | null): unknown
    updateContainer(element: unknown, container: unknown, parentComponent: unknown | null, callback: (() => void) | null): number
    getPublicRootInstance(container: unknown): unknown
    flushSync(fn: () => void): void
    batchedUpdates(fn: () => void): void
  }
  export default function ReactReconciler(config: unknown): ReconcilerInstance
  export const ConcurrentRoot: number
  export const LegacyRoot: number
}
declare module 'image-processor-napi' {
  export function processImage(input: unknown): Promise<unknown>
}
declare module 'cli-highlight' {
  export function highlight(code: string, options?: { language?: string }): string
}

declare module 'code-excerpt' {
  export interface CodeExcerptOptions {
    around?: number
    maxLine?: number
  }
  
  export interface CodeExcerptResult {
    line: number
    value: string
  }
  
  export default function codeExcerpt(
    source: string,
    line: number,
    options?: CodeExcerptOptions
  ): CodeExcerptResult[]
  
  // Named export used by some imports
  export { CodeExcerptResult }
}

declare module 'auto-bind' {
  export default function autoBind<T extends object>(
    self: T,
    options?: { include?: (string | symbol)[]; exclude?: (string | symbol)[] }
  ): T
}
declare module '@smithy/node-http-handler' {
  export class NodeHttpHandler {}
}
declare module '@smithy/core' {
  export interface SmithyConfiguration {}
}
declare module '@commander-js/extra-typings' {
  export { Command, Option, Argument } from 'commander'
  export class InvalidArgumentError extends Error {
    constructor(message: string)
  }
}
declare module 'xss' {
  function filterXSS(input: string, options?: unknown): string
  export = filterXSS
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
  export function unlock(file: string, options?: UnlockOptions): Promise<void>
  export function check(file: string, options?: CheckOptions): Promise<boolean>
}
declare module 'fflate' {
  export function gzip(data: Uint8Array, options?: unknown): Uint8Array
  export function gunzip(data: Uint8Array, options?: unknown): Uint8Array
}
declare module 'audio-capture-napi' {
  export function captureAudio(options?: unknown): Promise<unknown>
  export function isNativeAudioAvailable(): boolean
  export function isNativeRecordingActive(): boolean
  export function stopNativeRecording(): Promise<void>
  export function startNativeRecording(options?: unknown): Promise<void>
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

// Keybinding types
declare module '*/keybindings/types.js' {
  export type KeybindingContextName = 'global' | 'input' | 'chat' | 'sidebar' | 'modal' | 'Scroll' | 'MessageActions' | 'Plugin' | 'DiffDialog' | 'ModelPicker' | 'Select'
  export type KeybindingAction = 'command' | 'callback' | string
  export interface ParsedBinding {
    keys: string[]
    command: string
    context: KeybindingContextName
  }
  export interface ParsedKeystroke {
    key: string
    modifiers: string[]
  }
}
declare module '../keybindings/types.js' {
  export type KeybindingContextName = 'global' | 'input' | 'chat' | 'sidebar' | 'modal' | 'Scroll' | 'MessageActions' | 'Plugin' | 'DiffDialog' | 'ModelPicker' | 'Select'
  export type KeybindingAction = 'command' | 'callback' | string
  export interface ParsedBinding {
    keys: string[]
    command: string
    context: KeybindingContextName
  }
  export interface ParsedKeystroke {
    key: string
    modifiers: string[]
  }
}
declare module 'src/components/keybindings/types.js' {
  export type KeybindingContextName = 'global' | 'input' | 'chat' | 'sidebar' | 'modal' | 'Scroll' | 'MessageActions' | 'Plugin' | 'DiffDialog' | 'ModelPicker' | 'Select'
  export type KeybindingAction = 'command' | 'callback' | string
  export interface ParsedBinding {
    keys: string[]
    command: string
    context: KeybindingContextName
  }
  export interface ParsedKeystroke {
    key: string
    modifiers: string[]
  }
}

// Wizard types
declare module '*/wizard/types.js' {
  export interface WizardStepComponent {
    title: string
    description?: string
    validate?: () => boolean
    onNext?: () => void
  }
}
declare module '../wizard/types.js' {
  export interface WizardStepComponent {
    title: string
    description?: string
    validate?: () => boolean
    onNext?: () => void
  }
}
declare module 'src/components/wizard/types.js' {
  export interface WizardStepComponent {
    title: string
    description?: string
    validate?: () => boolean
    onNext?: () => void
  }
}

// Agent wizard types
declare module '*/agents/new-agent-creation/types.js' {
  export interface AgentWizardData {
    name: string
    description?: string
    color?: string
    avatar?: string
    systemPrompt?: string
    tools?: string[]
    mcpServers?: string[]
    [key: string]: unknown
  }
}
declare module '../types.js' {
  export interface AgentWizardData {
    name: string
    description?: string
    color?: string
    avatar?: string
    systemPrompt?: string
    tools?: string[]
    mcpServers?: string[]
    [key: string]: unknown
  }
}
declare module './types.js' {
  export interface AgentWizardData {
    name: string
    description?: string
    color?: string
    avatar?: string
    systemPrompt?: string
    tools?: string[]
    mcpServers?: string[]
    [key: string]: unknown
  }
}
declare module 'src/components/agents/new-agent-creation/types.js' {
  export interface AgentWizardData {
    name: string
    description?: string
    color?: string
    avatar?: string
    systemPrompt?: string
    tools?: string[]
    mcpServers?: string[]
    [key: string]: unknown
  }
}

// MCP Server types
declare module '*/mcp/types.js' {
  export interface StdioServerInfo {
    name: string
    command: string
    args: string[]
    env?: Record<string, string>
    status: 'connected' | 'disconnected'
  }
  export interface HTTPServerInfo {
    name: string
    url: string
    status: 'connected' | 'disconnected'
  }
  export interface SSEServerInfo {
    name: string
    url: string
    status: 'connected' | 'disconnected'
  }
  export interface ClaudeAIServerInfo {
    name: string
    type: 'claude-ai'
    status: 'connected' | 'disconnected'
  }
  export type ServerInfo = StdioServerInfo | HTTPServerInfo | SSEServerInfo | ClaudeAIServerInfo
  export interface McpServerStatus {
    name: string
    status: 'connected' | 'disconnected' | 'error'
    error?: string
    tools?: unknown[]
  }
}
declare module '../mcp/types.js' {
  export interface StdioServerInfo {
    name: string
    command: string
    args: string[]
    env?: Record<string, string>
    status: 'connected' | 'disconnected'
  }
  export interface HTTPServerInfo {
    name: string
    url: string
    status: 'connected' | 'disconnected'
  }
  export interface SSEServerInfo {
    name: string
    url: string
    status: 'connected' | 'disconnected'
  }
  export interface ClaudeAIServerInfo {
    name: string
    type: 'claude-ai'
    status: 'connected' | 'disconnected'
  }
  export type ServerInfo = StdioServerInfo | HTTPServerInfo | SSEServerInfo | ClaudeAIServerInfo
}
declare module '../../components/mcp/types.js' {
  export interface StdioServerInfo {
    name: string
    command: string
    args: string[]
    env?: Record<string, string>
    status: 'connected' | 'disconnected'
  }
  export interface HTTPServerInfo {
    name: string
    url: string
    status: 'connected' | 'disconnected'
  }
  export interface SSEServerInfo {
    name: string
    url: string
    status: 'connected' | 'disconnected'
  }
  export interface ClaudeAIServerInfo {
    name: string
    type: 'claude-ai'
    status: 'connected' | 'disconnected'
  }
  export type ServerInfo = StdioServerInfo | HTTPServerInfo | SSEServerInfo | ClaudeAIServerInfo
}

// Query event types
declare module '*/query.js' {
  export interface StreamEvent {
    type: 'content' | 'error' | 'done' | 'tool_use' | 'tool_result'
    content?: string
    delta?: string
    toolUse?: unknown
    error?: Error
  }
  export interface RequestStartEvent {
    type: 'request_start'
    requestId: string
    timestamp: number
  }
}
declare module '../query.js' {
  export interface StreamEvent {
    type: 'content' | 'error' | 'done' | 'tool_use' | 'tool_result'
    content?: string
    delta?: string
    toolUse?: unknown
    error?: Error
  }
}
declare module './query.js' {
  export interface StreamEvent {
    type: 'content' | 'error' | 'done' | 'tool_use' | 'tool_result'
    content?: string
    delta?: string
    toolUse?: unknown
    error?: Error
  }
}

// Agent types
declare module '*/agent.js' {
  export interface AgentMcpServerInfo {
    name: string
    description?: string
    tools?: unknown[]
    sourceAgents?: string[]
  }
}
declare module '../agent.js' {
  export interface AgentMcpServerInfo {
    name: string
    description?: string
    tools?: unknown[]
    sourceAgents?: string[]
  }
}
declare module '../../services/agent.js' {
  export interface AgentMcpServerInfo {
    name: string
    description?: string
    tools?: unknown[]
    sourceAgents?: string[]
  }
}

// Permissions types
declare module '*/permissions.js' {
  export type PermissionMode = 'ask' | 'auto' | 'reject'
  export type PermissionBehavior = 'allow' | 'deny' | 'ask'
  export type SimplePermissionResult = 'granted' | 'denied' | 'pending' | 'timeout'
  
  export interface PermissionAllowDecision {
    behavior: 'allow'
    updatedInput?: Record<string, unknown>
    userModified?: boolean
    toolUseID?: string
    tool_use_id?: string
  }
  
  export interface PermissionAskDecision {
    behavior: 'ask'
    message: string
    updatedInput?: Record<string, unknown>
    suggestions?: PermissionUpdate[]
    blockedPath?: string
    toolUseID?: string
    tool_use_id?: string
  }
  
  export interface PermissionDenyDecision {
    behavior: 'deny'
    message: string
    toolUseID?: string
    tool_use_id?: string
  }
  
  export type PermissionDecision = PermissionAllowDecision | PermissionAskDecision | PermissionDenyDecision
  
  export type PermissionResult = PermissionDecision | {
    behavior: 'passthrough'
    message: string
    toolUseID?: string
    tool_use_id?: string
  }
  
  export interface PermissionUpdate {
    id: string
    result: SimplePermissionResult
    timestamp: number
    toolUseID?: string
    tool_use_id?: string
  }
}
declare module '../permissions.js' {
  export type PermissionMode = 'ask' | 'auto' | 'reject'
  export type PermissionBehavior = 'allow' | 'deny' | 'ask'
  export type SimplePermissionResult = 'granted' | 'denied' | 'pending' | 'timeout'
  
  export interface PermissionAllowDecision {
    behavior: 'allow'
    updatedInput?: Record<string, unknown>
    userModified?: boolean
    toolUseID?: string
    tool_use_id?: string
  }
  
  export interface PermissionAskDecision {
    behavior: 'ask'
    message: string
    updatedInput?: Record<string, unknown>
    suggestions?: PermissionUpdate[]
    blockedPath?: string
    toolUseID?: string
    tool_use_id?: string
  }
  
  export interface PermissionDenyDecision {
    behavior: 'deny'
    message: string
    toolUseID?: string
    tool_use_id?: string
  }
  
  export type PermissionDecision = PermissionAllowDecision | PermissionAskDecision | PermissionDenyDecision
  
  export type PermissionResult = PermissionDecision | {
    behavior: 'passthrough'
    message: string
    toolUseID?: string
    tool_use_id?: string
  }
  
  export interface PermissionUpdate {
    id: string
    result: SimplePermissionResult
    timestamp: number
    toolUseID?: string
    tool_use_id?: string
  }
}
declare module 'src/services/permissions.js' {
  export type PermissionMode = 'ask' | 'auto' | 'reject'
  export type PermissionBehavior = 'allow' | 'deny' | 'ask'
  export type SimplePermissionResult = 'granted' | 'denied' | 'pending' | 'timeout'
  
  export interface PermissionAllowDecision {
    behavior: 'allow'
    updatedInput?: Record<string, unknown>
    userModified?: boolean
    toolUseID?: string
    tool_use_id?: string
  }
  
  export interface PermissionAskDecision {
    behavior: 'ask'
    message: string
    updatedInput?: Record<string, unknown>
    suggestions?: PermissionUpdate[]
    blockedPath?: string
    toolUseID?: string
    tool_use_id?: string
  }
  
  export interface PermissionDenyDecision {
    behavior: 'deny'
    message: string
    toolUseID?: string
    tool_use_id?: string
  }
  
  export type PermissionDecision = PermissionAllowDecision | PermissionAskDecision | PermissionDenyDecision
  
  export type PermissionResult = PermissionDecision | {
    behavior: 'passthrough'
    message: string
    toolUseID?: string
    tool_use_id?: string
  }
  
  export interface PermissionUpdate {
    id: string
    result: SimplePermissionResult
    timestamp: number
    toolUseID?: string
    tool_use_id?: string
  }
}

// Hook types
declare module '*/hooks.js' {
  export interface HookInput {
    name: string
    args: Record<string, unknown>
    context: Record<string, unknown>
    sessionId: string
    timestamp: number
    tool_name?: string
    toolName?: string
    type?: string
    event?: string
    data?: unknown
  }
  export interface HookJSONOutput {
    success: boolean
    output?: unknown
    error?: string
  }
  export interface SyncHookJSONOutput extends HookJSONOutput {
    sync: true
    // Hook event specific fields
    hookSpecificOutput?: {
      hookEventName?: string
      permissionDecision?: 'allow' | 'deny' | 'ask'
      permissionDecisionReason?: string
      updatedInput?: Record<string, unknown>
      additionalContext?: Record<string, unknown>
      initialUserMessage?: string
      updatedMCPToolOutput?: unknown
      retry?: boolean
      decision?: string
      action?: string
      content?: string
      [key: string]: unknown
    }
    // Common fields
    decision?: 'approve' | 'block'
    reason?: string
    systemMessage?: string
    continue?: boolean
    stopReason?: string
    output?: Record<string, unknown>
  }
  export interface StopHookInfo {
    name: string
    duration: number
    result?: unknown
  }
}
declare module '../hooks.js' {
  export interface HookInput {
    name: string
    args: Record<string, unknown>
    context: Record<string, unknown>
    sessionId: string
    timestamp: number
    tool_name?: string
    toolName?: string
    type?: string
    event?: string
    data?: unknown
  }
  export interface HookJSONOutput {
    success: boolean
    output?: unknown
    error?: string
  }
  export interface SyncHookJSONOutput extends HookJSONOutput {
    sync: true
  }
}
declare module 'src/services/hooks.js' {
  export interface HookInput {
    name: string
    args: Record<string, unknown>
    context: Record<string, unknown>
    sessionId: string
    timestamp: number
    tool_name?: string
    toolName?: string
    type?: string
    event?: string
    data?: unknown
  }
  export interface HookJSONOutput {
    success: boolean
    output?: unknown
    error?: string
  }
  export interface SyncHookJSONOutput extends HookJSONOutput {
    sync: true
  }
}
declare module '../../services/hooks.js' {
  export interface HookInput {
    name: string
    args: Record<string, unknown>
    context: Record<string, unknown>
    sessionId: string
    timestamp: number
    tool_name?: string
    toolName?: string
    type?: string
    event?: string
    data?: unknown
  }
  export interface HookJSONOutput {
    success: boolean
    output?: unknown
    error?: string
  }
  export interface SyncHookJSONOutput extends HookJSONOutput {
    sync: true
  }
}

// Compact types
declare module '*/compact.js' {
  export type PartialCompactDirection = 'up' | 'down' | 'both'
}
declare module '../compact.js' {
  export type PartialCompactDirection = 'up' | 'down' | 'both'
}
declare module 'src/services/compact/compact.js' {
  export type PartialCompactDirection = 'up' | 'down' | 'both'
}

// OAuth types
declare module '*/oauth/types.js' {
  export type SubscriptionType = 'free' | 'pro' | 'max' | 'team' | 'enterprise'
  export interface OAuthTokens {
    accessToken: string
    refreshToken?: string
    expiresAt?: number
  }
}
declare module '../oauth/types.js' {
  export type SubscriptionType = 'free' | 'pro' | 'max' | 'team' | 'enterprise'
  export interface OAuthTokens {
    accessToken: string
    refreshToken?: string
    expiresAt?: number
  }
}
declare module 'src/services/oauth/types.js' {
  export type SubscriptionType = 'free' | 'pro' | 'max' | 'team' | 'enterprise'
  export interface OAuthTokens {
    accessToken: string
    refreshToken?: string
    expiresAt?: number
  }
}

// SDK Additional types
declare module '*/sdk/coreTypes.js' {
  export interface SDKStatus {
    state: 'idle' | 'loading' | 'error' | 'success'
    message?: string
    progress?: number
  }
  export interface ModelInfo {
    id: string
    name: string
    contextWindow: number
    maxTokens: number
    pricing?: {
      input: number
      output: number
    }
  }
  export interface SDKUserMessageReplay {
    message: string
    timestamp: number
    attachments?: unknown[]
  }
  export interface NormalizedAssistantMessage {
    role: 'assistant'
    content: string
    tool_calls?: unknown[]
  }
  export interface SDKAssistantMessage {
    role: 'assistant'
    content: string | unknown[]
    tool_calls?: unknown[]
    usage?: {
      input_tokens: number
      output_tokens: number
    }
  }
}
declare module '../sdk/coreTypes.js' {
  export interface SDKStatus {
    state: 'idle' | 'loading' | 'error' | 'success'
    message?: string
    progress?: number
  }
  export interface ModelInfo {
    id: string
    name: string
    contextWindow: number
    maxTokens: number
    pricing?: {
      input: number
      output: number
    }
  }
  export interface SDKUserMessageReplay {
    message: string
    timestamp: number
    attachments?: unknown[]
  }
  export interface NormalizedAssistantMessage {
    role: 'assistant'
    content: string
    tool_calls?: unknown[]
  }
  export interface SDKAssistantMessage {
    role: 'assistant'
    content: string | unknown[]
    tool_calls?: unknown[]
    usage?: {
      input_tokens: number
      output_tokens: number
    }
  }
}
declare module 'src/entrypoints/sdk/coreTypes.js' {
  export interface SDKStatus {
    state: 'idle' | 'loading' | 'error' | 'success'
    message?: string
    progress?: number
  }
  export interface ModelInfo {
    id: string
    name: string
    contextWindow: number
    maxTokens: number
    pricing?: {
      input: number
      output: number
    }
  }
  export interface SDKUserMessageReplay {
    message: string
    timestamp: number
    attachments?: unknown[]
  }
  export interface NormalizedAssistantMessage {
    role: 'assistant'
    content: string
    tool_calls?: unknown[]
  }
  export interface SDKAssistantMessage {
    role: 'assistant'
    content: string | unknown[]
    tool_calls?: unknown[]
    usage?: {
      input_tokens: number
      output_tokens: number
    }
  }
}

// MCP Server Config types
declare module '*/sdk/mcpTypes.js' {
  export interface McpServerConfigForProcessTransport {
    name: string
    command: string
    args?: string[]
    env?: Record<string, string>
    cwd?: string
  }
}
declare module '../sdk/mcpTypes.js' {
  export interface McpServerConfigForProcessTransport {
    name: string
    command: string
    args?: string[]
    env?: Record<string, string>
    cwd?: string
  }
}
declare module 'src/entrypoints/sdk/mcpTypes.js' {
  export interface McpServerConfigForProcessTransport {
    name: string
    command: string
    args?: string[]
    env?: Record<string, string>
    cwd?: string
  }
}

// Context collapse types
declare module '*/contextCollapse/index.js' {
  export function getStats(): {
    collapsedCount: number
    totalTokens: number
    savedTokens: number
  }
  export function isContextCollapseEnabled(): boolean
  export function collapseContext(messages: unknown[]): unknown[]
}
declare module '../contextCollapse/index.js' {
  export function getStats(): {
    collapsedCount: number
    totalTokens: number
    savedTokens: number
  }
  export function isContextCollapseEnabled(): boolean
  export function collapseContext(messages: unknown[]): unknown[]
}
declare module '../../services/contextCollapse/index.js' {
  export function getStats(): {
    collapsedCount: number
    totalTokens: number
    savedTokens: number
  }
  export function isContextCollapseEnabled(): boolean
  export function collapseContext(messages: unknown[]): unknown[]
}
declare module 'src/services/contextCollapse/index.js' {
  export function getStats(): {
    collapsedCount: number
    totalTokens: number
    savedTokens: number
  }
  export function isContextCollapseEnabled(): boolean
  export function collapseContext(messages: unknown[]): unknown[]
}

// Missing utility files
declare module '*/sdkHeapDumpMonitor.js' {
  export function startHeapMonitoring(): void
  export function stopHeapMonitoring(): void
  export function captureHeapSnapshot(): Promise<string>
}
declare module '../utils/sdkHeapDumpMonitor.js' {
  export function startHeapMonitoring(): void
  export function stopHeapMonitoring(): void
  export function captureHeapSnapshot(): Promise<string>
}
declare module 'src/utils/sdkHeapDumpMonitor.js' {
  export function startHeapMonitoring(): void
  export function stopHeapMonitoring(): void
  export function captureHeapSnapshot(): Promise<string>
}

declare module '*/sessionDataUploader.js' {
  export interface SessionDataUploadResult {
    success: boolean
    uploadId?: string
    error?: string
  }
  export function uploadSessionData(data: unknown): Promise<SessionDataUploadResult>
}
declare module '../utils/sessionDataUploader.js' {
  export interface SessionDataUploadResult {
    success: boolean
    uploadId?: string
    error?: string
  }
  export function uploadSessionData(data: unknown): Promise<SessionDataUploadResult>
}
declare module 'src/utils/sessionDataUploader.js' {
  export interface SessionDataUploadResult {
    success: boolean
    uploadId?: string
    error?: string
  }
  export function uploadSessionData(data: unknown): Promise<SessionDataUploadResult>
}

// ============================================================================
// Anthropic SDK external package
// ============================================================================
declare module '@anthropic-ai/sdk/resources/index.mjs' {
  // Type exports
  export interface Base64ImageSource {
    type: 'base64'
    media_type: string
    data: string
  }
  
  export interface ContentBlock {
    type: 'text' | 'image' | 'tool_use' | 'tool_result' | 'thinking' | 'redacted_thinking' | 'document'
    text?: string
    thinking?: string
    signature?: string
    id?: string
    name?: string
    input?: unknown
    data?: string
  }
  
  export interface ContentBlockParam {
    type: 'text' | 'image' | 'tool_use' | 'tool_result' | 'document'
    text?: string
    source?: {
      type: 'base64' | 'url'
      media_type: string
      data: string
    }
    id?: string
    tool_use_id?: string
    name?: string
    input?: unknown
    content?: string | unknown[]
    is_error?: boolean
    [key: string]: unknown
  }
  
  export interface RedactedThinkingBlock {
    type: 'redacted_thinking'
    data: string
  }
  
  export type RedactedThinkingBlockParam = RedactedThinkingBlock
  
  export interface TextBlockParam {
    type: 'text'
    text: string
  }
  
  export interface ImageBlockParam {
    type: 'image'
    source: {
      type: 'base64' | 'url'
      media_type: string
      data: string
    }
  }
  
  export interface ThinkingBlock {
    type: 'thinking'
    thinking: string
    signature?: string
  }
  
  export type ThinkingBlockParam = ThinkingBlock
  
  export interface ToolResultBlockParam {
    type: 'tool_result'
    tool_use_id: string
    content: string | Array<{type: string; text?: string}>
    is_error?: boolean
  }
  
  export interface ToolUseBlock {
    type: 'tool_use'
    id: string
    name: string
    input: Record<string, unknown>
  }
  
  export type ToolUseBlockParam = ToolUseBlock
  
  export interface MessageParam {
    role: 'user' | 'assistant'
    content: string | ContentBlockParam[]
  }
  
  export class Messages {
    create(params: unknown, options?: unknown): Promise<unknown>
    stream(params: unknown, options?: unknown): AsyncIterable<unknown>
    withResponse<T>(): Promise<T>
  }
  export class Beta {
    messages: Messages
  }
  export default class AnthropicSDK {
    apiKey: string
    messages: Messages
    beta: Beta
    constructor(config: { apiKey: string; baseURL?: string })
  }
}
declare module '@anthropic-ai/sdk/resources/messages.js' {
  export class Messages {
    create(params: unknown, options?: unknown): Promise<unknown>
    stream(params: unknown, options?: unknown): AsyncIterable<unknown>
    withResponse<T>(): Promise<T>
  }
  
  // Content block types
  export interface ContentBlockParam {
    type: 'text' | 'tool_use' | 'tool_result' | 'image' | 'document'
    text?: string
    id?: string
    name?: string
    input?: unknown
    content?: string | unknown[]
    tool_use_id?: string
    source?: {
      type: 'base64' | 'url'
      media_type: string
      data: string
    }
  }
  
  export interface ToolUseBlockParam {
    type: 'tool_use'
    id: string
    name: string
    input: Record<string, unknown>
  }
  
  export interface ToolResultBlockParam {
    type: 'tool_result'
    tool_use_id: string
    content: string | Array<{type: string; text?: string}>
    is_error?: boolean
  }
  
  export interface Base64ImageSource {
    type: 'base64'
    media_type: string
    data: string
  }
}

declare module '@anthropic-ai/sdk/resources/messages.js' {
  export interface Base64ImageSource {
    type: 'base64'
    media_type: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp' | string
    data: string
  }
  
  export interface URLImageSource {
    type: 'url'
    url: string
  }
  
  export interface ImageBlockParam {
    type: 'image'
    source: Base64ImageSource | URLImageSource
  }
  
  export interface TextBlockParam {
    type: 'text'
    text: string
  }
  
  export interface ContentBlockParam {
    type: 'text' | 'image' | 'tool_use' | 'tool_result' | 'document'
    text?: string
    source?: Base64ImageSource | URLImageSource
    id?: string
    name?: string
    input?: unknown
    tool_use_id?: string
    content?: string | unknown[]
    is_error?: boolean
  }
  
  export interface ToolUseBlockParam {
    type: 'tool_use'
    id: string
    name: string
    input: Record<string, unknown>
  }
  
  export interface ToolResultBlockParam {
    type: 'tool_result'
    tool_use_id: string
    content: string | Array<{type: string; text?: string}>
    is_error?: boolean
  }
  
  export interface MessageParam {
    role: 'user' | 'assistant'
    content: string | ContentBlockParam[]
  }
}

declare module '@anthropic-ai/sdk/resources/messages/messages.mjs' {
  export class Messages {
    create(params: unknown, options?: unknown): Promise<unknown>
    stream(params: unknown, options?: unknown): AsyncIterable<unknown>
    withResponse<T>(): Promise<T>
  }
  
  export interface ToolResultBlockParam {
    type: 'tool_result'
    tool_use_id: string
    content: string | Array<{type: string; text?: string}>
    is_error?: boolean
  }
  
  export interface ToolUseBlockParam {
    type: 'tool_use'
    id: string
    name: string
    input: Record<string, unknown>
  }
  
  export interface Base64ImageSource {
    type: 'base64'
    media_type: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp' | string
    data: string
  }
  
  export interface URLImageSource {
    type: 'url'
    url: string
  }
  
  export interface ImageBlockParam {
    type: 'image'
    source: Base64ImageSource | URLImageSource
  }
  
  export interface TextBlockParam {
    type: 'text'
    text: string
  }
  
  export interface ContentBlockParam {
    type: 'text' | 'image' | 'tool_use' | 'tool_result' | 'document'
    text?: string
    source?: Base64ImageSource | URLImageSource
    id?: string
    name?: string
    input?: unknown
    tool_use_id?: string
    content?: string | unknown[]
    is_error?: boolean
  }
}

declare module '@anthropic-ai/sdk/streaming.mjs' {
  export interface Stream<T> {
    [Symbol.asyncIterator](): AsyncIterator<T>
    controller: AbortController
  }
}

declare module '@anthropic-ai/sdk' {
  // Logger interface
  export interface Logger {
    error(message: string, ...args: unknown[]): void
    warn(message: string, ...args: unknown[]): void
    info(message: string, ...args: unknown[]): void
    debug(message: string, ...args: unknown[]): void
  }
  
  // Fetch type that matches the expected signature
  export type FetchType = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
  
  // Client options interface
  export interface ClientOptions {
    apiKey?: string | null
    authToken?: string
    baseURL?: string
    timeout?: number
    maxRetries?: number
    defaultHeaders?: Record<string, string>
    fetch?: FetchType
    logger?: Logger
    fetchOptions?: RequestInit
    dangerouslyAllowBrowser?: boolean
  }
  
  // Anthropic class - usable as both type and value
  export class Anthropic {
    constructor(options?: ClientOptions)
    apiKey: string
    baseURL: string
    maxRetries: number
    timeout: number
    messages: {
      create(params: unknown, options?: unknown): Promise<unknown>
      stream(params: unknown, options?: unknown): AsyncIterable<unknown>
    }
    beta: {
      messages: {
        create(params: unknown, options?: unknown): Promise<unknown>
        stream(params: unknown, options?: unknown): AsyncIterable<unknown>
      }
    }
  }
  
  // Re-export Anthropic as a type alias for convenience
  export type { Anthropic as AnthropicType }
  
  // Default export - the Anthropic class
  export { Anthropic as default }
  
  export class APIError extends Error {
    status: number
    headers: Headers
    error?: unknown
    requestID?: string
  }
  
  export class APIUserAbortError extends APIError {
    readonly status: 499
  }
  
  export class APIConnectionError extends APIError {
    readonly status: 0
  }
  
  export class APIConnectionTimeoutError extends APIError {
    readonly status: 408
    constructor(options?: { message?: string; cause?: unknown })
  }
  
  export namespace Tool {
    interface AnyTool {
      name: string
      description: string
      parameters: unknown
    }
  }
  
  export namespace Messages {
    interface ContentBlock {
      type: string
      text?: string
      thinking?: string
      signature?: string
      id?: string
      name?: string
      input?: unknown
      content?: string | unknown[]
      tool_use_id?: string
      is_error?: boolean
    }
    interface TextBlock extends ContentBlock { type: 'text'; text: string }
    interface ImageBlock extends ContentBlock { type: 'image'; source: unknown }
    interface ToolUseBlock extends ContentBlock { type: 'tool_use'; id: string; name: string; input: unknown }
    interface ToolResultBlock extends ContentBlock { type: 'tool_result'; tool_use_id: string; content: string | unknown[] }
  }
  
  export namespace Beta {
    export namespace Messages {
      interface BetaMessageParam {
        role: 'user' | 'assistant'
        content: string | unknown[]
      }
    }
  }
}

declare module '@anthropic-ai/sdk/error' {
  export class APIError extends Error {
    status: number
    headers: Headers
    error?: unknown
    requestID?: string
  }
  
  export class APIUserAbortError extends APIError {
    readonly status: 499
  }
  
  export class APIConnectionTimeoutError extends APIError {
    readonly status: 408
  }
}

declare module '@aws-sdk/client-bedrock-runtime' {
  export class BedrockRuntimeClient {}
  export interface CountTokensCommandInput {
    modelId: string
    messages: unknown[]
  }
}

declare module '@anthropic-ai/bedrock-sdk' {
  export interface BedrockClientOptions {
    awsRegion?: string
    region?: string
    credentials?: unknown
    skipAuth?: boolean
    defaultHeaders?: Record<string, string>
    awsAccessKey?: string
    awsSecretKey?: string
    awsSessionToken?: string
    maxRetries?: number
    timeout?: number
    fetch?: typeof fetch
    logger?: unknown
    fetchOptions?: RequestInit
    dangerouslyAllowBrowser?: boolean
  }
  
  export class AnthropicBedrock {
    constructor(config?: BedrockClientOptions)
    messages: {
      create(params: unknown): Promise<unknown>
      stream(params: unknown): AsyncIterable<unknown>
    }
  }
}

declare module '@anthropic-ai/foundry-sdk' {
  export interface FoundryClientOptions {
    apiKey?: string
    baseURL?: string
    azureADTokenProvider?: () => Promise<string>
    defaultHeaders?: Record<string, string>
    maxRetries?: number
    timeout?: number
    fetch?: typeof fetch
    logger?: unknown
    fetchOptions?: RequestInit
    dangerouslyAllowBrowser?: boolean
  }
  
  export class AnthropicFoundry {
    constructor(config?: FoundryClientOptions)
    messages: {
      create(params: unknown): Promise<unknown>
      stream(params: unknown): AsyncIterable<unknown>
    }
  }
}

declare module '@anthropic-ai/vertex-sdk' {
  import type { GoogleAuth } from 'google-auth-library'
  
  export interface VertexClientOptions {
    region?: string
    projectId?: string
    googleAuth?: GoogleAuth
    defaultHeaders?: Record<string, string>
    maxRetries?: number
    timeout?: number
    fetch?: typeof fetch
    logger?: unknown
    fetchOptions?: RequestInit
    dangerouslyAllowBrowser?: boolean
  }
  
  export class AnthropicVertex {
    constructor(config?: VertexClientOptions)
    messages: {
      create(params: unknown): Promise<unknown>
      stream(params: unknown): AsyncIterable<unknown>
    }
  }
}

declare module '@anthropic-ai/sdk/resources/beta/messages/messages.mjs' {
  export interface BetaMessageStreamParams {
    model: string
    messages: unknown[]
    max_tokens?: number
    system?: string
    temperature?: number
    thinking?: {
      type: 'enabled' | 'disabled'
      budget_tokens?: number
    }
    speed?: 'fast' | 'normal' | 'slow'
  }
  
  // Content block types
  export interface BetaContentBlock {
    type: 'text' | 'tool_use' | 'thinking' | 'redacted_thinking' | 'image'
    text?: string
    thinking?: string
    signature?: string
    id?: string
    name?: string
    input?: unknown
  }
  
  export interface BetaContentBlockParam {
    type: 'text' | 'tool_use' | 'tool_result' | 'thinking' | 'redacted_thinking' | 'image' | 'document' | string
    text?: string
    thinking?: string
    signature?: string
    id?: string
    name?: string
    input?: unknown
    tool_use_id?: string
    content?: string | unknown[]
    source?: unknown
    [key: string]: unknown
  }
  
  export interface BetaImageBlockParam {
    type: 'image'
    source: {
      type: 'base64' | 'url'
      media_type: string
      data: string
    }
  }
  
  export interface BetaThinkingBlock {
    type: 'thinking'
    thinking: string
    signature?: string
  }
  
  export interface BetaRedactedThinkingBlock {
    type: 'redacted_thinking'
    data: string
  }
  
  export interface BetaToolUseBlock {
    type: 'tool_use'
    id: string
    name: string
    input: Record<string, unknown>
  }
  
  export interface BetaToolResultBlockParam {
    type: 'tool_result'
    tool_use_id: string
    content: string | Array<{type: string; text?: string}>
    is_error?: boolean
  }
  
  // Message types
  export interface BetaMessage {
    id: string
    type: 'message'
    role: 'assistant'
    content: BetaContentBlock[]
    model: string
    stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use' | null
    stop_sequence?: string
    usage: BetaUsage
  }
  
  export interface BetaMessageParam {
    role: 'user' | 'assistant'
    content: string | BetaContentBlockParam[]
  }
  
  // Usage types
  export interface BetaUsage {
    input_tokens: number
    output_tokens: number
    cache_creation_input_tokens?: number
    cache_read_input_tokens?: number
    server_tool_use?: { web_search_requests: number; web_fetch_requests: number }
    service_tier?: string | null
    cache_creation?: {
      ephemeral_1h_input_tokens: number
      ephemeral_5m_input_tokens: number
    }
    inference_geo?: string | null
    iterations?: number | null
    speed?: string | null
  }
  
  export interface BetaMessageDeltaUsage {
    output_tokens: number
    input_tokens?: number
    cache_creation_input_tokens?: number
    cache_read_input_tokens?: number
  }
  
  // Stop reason
  export type BetaStopReason = 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use' | null
  
  // Non-beta type aliases (for backward compatibility)
  export type ContentBlock = BetaContentBlock
  export type ContentBlockParam = BetaContentBlockParam
  export type RedactedThinkingBlock = BetaRedactedThinkingBlock
  export type RedactedThinkingBlockParam = BetaRedactedThinkingBlock
  export type TextBlockParam = BetaContentBlockParam
  export type ThinkingBlock = BetaThinkingBlock
  export type ThinkingBlockParam = BetaThinkingBlock
  export type ToolResultBlockParam = BetaToolResultBlockParam
  export type ToolUseBlock = BetaToolUseBlock
  export type ToolUseBlockParam = BetaToolUseBlock
  
  // Tool types
  export type BetaToolUnion = 
    | { type: 'custom'; name: string; description?: string; input_schema: unknown }
    | { type: 'bash'; name: 'bash' }
    | { type: 'computer_20250124'; name: 'computer'; display_width_px: number; display_height_px: number }
    | { type: 'text_editor_20250124'; name: 'str_replace_editor' }
    | { type: 'web_search_20250124'; name: 'web_search' }
    | BetaTool
  
  export interface BetaTool {
    name: string
    description?: string
    input_schema: unknown
    type?: string
  }
  
  export interface BetaToolChoiceAuto {
    type: 'auto'
    disable_parallel_tool_use?: boolean
  }
  
  export interface BetaToolChoiceTool {
    type: 'tool'
    name: string
    disable_parallel_tool_use?: boolean
  }
  
  // Output config
  export interface BetaOutputConfig {
    type: 'message'
    effort?: 'low' | 'medium' | 'high' | 'max'
    format?: 'json' | 'json_schema' | string
  }
  
  export interface BetaJSONOutputFormat {
    type: 'json'
    schema?: unknown
  }
  
  // Streaming events
  export type BetaRawMessageStreamEvent =
    | { type: 'message_start'; message: BetaMessage }
    | { type: 'content_block_start'; index: number; content_block: BetaContentBlock }
    | { type: 'content_block_delta'; index: number; delta: { type: 'text_delta'; text: string } | { type: 'thinking_delta'; thinking: string } | { type: 'signature_delta'; signature: string } | { type: 'input_json_delta'; partial_json: string } }
    | { type: 'content_block_stop'; index: number }
    | { type: 'message_delta'; delta: { stop_reason?: BetaStopReason; stop_sequence?: string }; usage: BetaMessageDeltaUsage }
    | { type: 'message_stop' }
  
  // Document block
  export interface BetaRequestDocumentBlock {
    type: 'document'
    source: {
      type: 'base64' | 'url'
      media_type: string
      data: string
    }
    title?: string
    context?: string
  }
  
  // Web search tool
  export interface BetaWebSearchTool20250305 {
    type: 'web_search_20250305'
    name: 'web_search'
    allowed_domains?: string[]
    [key: string]: unknown
  }
}

declare module '@anthropic-ai/sdk/resources/beta/messages.js' {
  export class BetaMessages {
    create(params: unknown, options?: unknown): Promise<unknown>
    stream(params: unknown, options?: unknown): AsyncIterable<unknown>
  }
  
  export interface BetaMessageStreamParams {
    model: string
    messages: unknown[]
    max_tokens?: number
    system?: string
    temperature?: number
    thinking?: {
      type: 'enabled' | 'disabled'
      budget_tokens?: number
    }
    speed?: 'fast' | 'normal' | 'slow'
  }
  
  export interface BetaContentBlock {
    type: 'text' | 'tool_use' | 'thinking' | 'redacted_thinking'
    text?: string
    thinking?: string
    signature?: string
    id?: string
    name?: string
    input?: unknown
  }
  
  export type BetaToolUnion = 
    | { type: 'custom'; name: string; description?: string; input_schema: unknown }
    | { type: 'bash'; name: 'bash' }
    | { type: 'computer_20250124'; name: 'computer'; display_width_px: number; display_height_px: number }
    | { type: 'text_editor_20250124'; name: 'str_replace_editor' }
    | { type: 'web_search_20250124'; name: 'web_search' }
}

declare module '@anthropic-ai/claude-agent-sdk' {
  export type PermissionMode = 'ask' | 'auto' | 'reject'
  
  export interface AgentConfig {
    name: string
    model?: string
    systemPrompt?: string
    permissionMode?: PermissionMode
  }
  export class ClaudeAgent {
    constructor(config: AgentConfig)
    run(input: string): Promise<unknown>
  }
}

// ============================================================================
// Missing internal modules - Component level
// ============================================================================
declare module '*/assistant/index.js' {
  export interface AssistantSession {
    id: string
    status: 'idle' | 'active' | 'paused'
  }
  export function createAssistantSession(): Promise<AssistantSession>
  export function getAssistantSession(id: string): AssistantSession | null
}
declare module '../assistant/index.js' {
  export interface AssistantSession {
    id: string
    status: 'idle' | 'active' | 'paused'
  }
  export function createAssistantSession(): Promise<AssistantSession>
  export function getAssistantSession(id: string): AssistantSession | null
}
declare module '../../assistant/index.js' {
  export interface AssistantSession {
    id: string
    status: 'idle' | 'active' | 'paused'
  }
}

declare module '*/proactive/index.js' {
  export interface ProactiveSuggestion {
    id: string
    text: string
    confidence: number
  }
  export function getProactiveSuggestions(context: unknown): ProactiveSuggestion[]
}
declare module '../proactive/index.js' {
  export interface ProactiveSuggestion {
    id: string
    text: string
    confidence: number
  }
  export function getProactiveSuggestions(context: unknown): ProactiveSuggestion[]
}
declare module '../../proactive/index.js' {
  export interface ProactiveSuggestion {
    id: string
    text: string
    confidence: number
  }
}

// ============================================================================
// Missing internal modules - Commands
// ============================================================================
declare module '*/commands/workflows/index.js' {
  export interface WorkflowCommand {
    name: string
    description: string
    execute(): Promise<void>
  }
  export const workflowCommands: WorkflowCommand[]
}
declare module './commands/workflows/index.js' {
  export interface WorkflowCommand {
    name: string
    description: string
    execute(): Promise<void>
  }
  export const workflowCommands: WorkflowCommand[]
}

declare module '*/commands/peers/index.js' {
  export interface PeerConnection {
    id: string
    status: 'connected' | 'disconnected'
  }
  export function connectToPeer(peerId: string): Promise<PeerConnection>
}
declare module './commands/peers/index.js' {
  export interface PeerConnection {
    id: string
    status: 'connected' | 'disconnected'
  }
  export function connectToPeer(peerId: string): Promise<PeerConnection>
}

declare module '*/commands/fork/index.js' {
  export function forkSession(sessionId: string): Promise<string>
}
declare module './commands/fork/index.js' {
  export function forkSession(sessionId: string): Promise<string>
}

declare module '*/commands/buddy/index.js' {
  export interface BuddyConfig {
    enabled: boolean
    personality?: string
  }
  export function initializeBuddy(config: BuddyConfig): void
}
declare module './commands/buddy/index.js' {
  export interface BuddyConfig {
    enabled: boolean
    personality?: string
  }
  export function initializeBuddy(config: BuddyConfig): void
}

// ============================================================================
// Missing internal modules - Services
// ============================================================================
declare module '*/services/skillSearch/localSearch.js' {
  export interface SearchResult {
    id: string
    title: string
    relevance: number
  }
  export function searchSkills(query: string): Promise<SearchResult[]>
}
declare module './services/skillSearch/localSearch.js' {
  export interface SearchResult {
    id: string
    title: string
    relevance: number
  }
  export function searchSkills(query: string): Promise<SearchResult[]>
}
declare module '../services/skillSearch/localSearch.js' {
  export interface SearchResult {
    id: string
    title: string
    relevance: number
  }
  export function searchSkills(query: string): Promise<SearchResult[]>
}

declare module '*/services/skillSearch/featureCheck.js' {
  export function isSkillSearchEnabled(): boolean
}
declare module './services/skillSearch/featureCheck.js' {
  export function isSkillSearchEnabled(): boolean
}
declare module '../services/skillSearch/featureCheck.js' {
  export function isSkillSearchEnabled(): boolean
}

declare module '*/services/compact/snipProjection.js' {
  export interface SnipProjection {
    start: number
    end: number
    content: string
  }
  export function projectSnip(messages: unknown[], range: unknown): SnipProjection
}
declare module './services/compact/snipProjection.js' {
  export interface SnipProjection {
    start: number
    end: number
    content: string
  }
  export function projectSnip(messages: unknown[], range: unknown): SnipProjection
}
declare module '../services/compact/snipProjection.js' {
  export interface SnipProjection {
    start: number
    end: number
    content: string
  }
  export function projectSnip(messages: unknown[], range: unknown): SnipProjection
}

// ============================================================================
// Missing internal modules - Tools
// ============================================================================
declare module '*/tools/WorkflowTool/createWorkflowCommand.js' {
  export function createWorkflowCommand(name: string, steps: unknown[]): unknown
}
declare module './tools/WorkflowTool/createWorkflowCommand.js' {
  export function createWorkflowCommand(name: string, steps: unknown[]): unknown
}
declare module '../tools/WorkflowTool/createWorkflowCommand.js' {
  export function createWorkflowCommand(name: string, steps: unknown[]): unknown
}

declare module '*/tools/SendUserFileTool/prompt.js' {
  export function buildSendFilePrompt(filePath: string): string
}
declare module '../tools/SendUserFileTool/prompt.js' {
  export function buildSendFilePrompt(filePath: string): string
}
declare module '../../tools/SendUserFileTool/prompt.js' {
  export function buildSendFilePrompt(filePath: string): string
}

declare module '*/tools/TungstenTool/TungstenTool.js' {
  export class TungstenTool {
    name: string
    description: string
    execute(args: unknown): Promise<unknown>
  }
}
declare module '../tools/TungstenTool/TungstenTool.js' {
  export class TungstenTool {
    name: string
    description: string
    execute(args: unknown): Promise<unknown>
  }
}
declare module '../../tools/TungstenTool/TungstenTool.js' {
  export class TungstenTool {
    name: string
    description: string
    execute(args: unknown): Promise<unknown>
  }
}

// ============================================================================
// Missing internal modules - SSH
// ============================================================================
declare module '*/ssh/createSSHSession.js' {
  export interface SSHSession {
    id: string
    host: string
    status: 'connected' | 'disconnected'
  }
  export function createSSHSession(host: string, config?: unknown): Promise<SSHSession>
}
declare module '../ssh/createSSHSession.js' {
  export interface SSHSession {
    id: string
    host: string
    status: 'connected' | 'disconnected'
  }
  export function createSSHSession(host: string, config?: unknown): Promise<SSHSession>
}
declare module '../../ssh/createSSHSession.js' {
  export interface SSHSession {
    id: string
    host: string
    status: 'connected' | 'disconnected'
  }
}

// ============================================================================
// Missing internal modules - Components
// ============================================================================
declare module '*/components/agents/SnapshotUpdateDialog.js' {
  import { FC } from 'react'
  export const SnapshotUpdateDialog: FC<{
    agentType: string
    scope: import('./types.js').AgentMemoryScope
    snapshotTimestamp: string
    onComplete: (result: 'merge' | 'keep' | 'replace') => void
    onCancel: () => void
  }>
}
declare module '../components/agents/SnapshotUpdateDialog.js' {
  import { FC } from 'react'
  export const SnapshotUpdateDialog: FC<{
    agentType: string
    scope: import('../types.js').AgentMemoryScope
    snapshotTimestamp: string
    onComplete: (result: 'merge' | 'keep' | 'replace') => void
    onCancel: () => void
  }>
}
declare module '../../components/agents/SnapshotUpdateDialog.js' {
  import { FC } from 'react'
  export const SnapshotUpdateDialog: FC<{
    agentType: string
    scope: import('../../types.js').AgentMemoryScope
    snapshotTimestamp: string
    onComplete: (result: 'merge' | 'keep' | 'replace') => void
    onCancel: () => void
  }>
}

// ============================================================================
// Missing internal modules - Types
// ============================================================================
declare module '*/types/statusLine.js' {
  export interface StatusLineState {
    text: string
    type: 'info' | 'warning' | 'error' | 'success'
    timeout?: number
  }
}
declare module './types/statusLine.js' {
  export interface StatusLineState {
    text: string
    type: 'info' | 'warning' | 'error' | 'success'
    timeout?: number
  }
}
declare module '../types/statusLine.js' {
  export interface StatusLineState {
    text: string
    type: 'info' | 'warning' | 'error' | 'success'
    timeout?: number
  }
}

declare module '*/types/messageQueueTypes.js' {
  export interface MessageQueueItem {
    id: string
    priority: number
    data: unknown
  }
}
declare module './types/messageQueueTypes.js' {
  export interface MessageQueueItem {
    id: string
    priority: number
    data: unknown
  }
}
declare module '../types/messageQueueTypes.js' {
  export interface MessageQueueItem {
    id: string
    priority: number
    data: unknown
  }
}

declare module '*/types/fileSuggestion.js' {
  export interface FileSuggestion {
    path: string
    relevance: number
    reason?: string
  }
}
declare module './types/fileSuggestion.js' {
  export interface FileSuggestion {
    path: string
    relevance: number
    reason?: string
  }
}
declare module '../types/fileSuggestion.js' {
  export interface FileSuggestion {
    path: string
    relevance: number
    reason?: string
  }
}

declare module '*/types/connectorText.js' {
  export interface ConnectorText {
    id: string
    content: string
    connector: string
  }
}
declare module './types/connectorText.js' {
  export interface ConnectorText {
    id: string
    content: string
    connector: string
  }
}
declare module '../types/connectorText.js' {
  export interface ConnectorText {
    id: string
    content: string
    connector: string
  }
}
declare module 'src/types/connectorText.js' {
  export interface ConnectorText {
    id: string
    content: string
    connector: string
  }
}

// ============================================================================
// Missing internal modules - Tasks
// ============================================================================
declare module '*/tasks/MonitorMcpTask/MonitorMcpTask.js' {
  export interface MonitorMcpTaskConfig {
    serverName: string
    interval?: number
  }
  export class MonitorMcpTask {
    constructor(config: MonitorMcpTaskConfig)
    start(): void
    stop(): void
  }
}
declare module './tasks/MonitorMcpTask/MonitorMcpTask.js' {
  export interface MonitorMcpTaskConfig {
    serverName: string
    interval?: number
  }
  export class MonitorMcpTask {
    constructor(config: MonitorMcpTaskConfig)
    start(): void
    stop(): void
  }
}
declare module '../tasks/MonitorMcpTask/MonitorMcpTask.js' {
  export interface MonitorMcpTaskConfig {
    serverName: string
    interval?: number
  }
  export class MonitorMcpTask {
    constructor(config: MonitorMcpTaskConfig)
    start(): void
    stop(): void
  }
}
declare module '../../tasks/MonitorMcpTask/MonitorMcpTask.js' {
  export interface MonitorMcpTaskConfig {
    serverName: string
    interval?: number
  }
  export class MonitorMcpTask {
    constructor(config: MonitorMcpTaskConfig)
    start(): void
    stop(): void
  }
}

// ============================================================================
// Missing internal modules - Skills
// ============================================================================
declare module '*/skills/mcpSkills.js' {
  export interface McpSkill {
    name: string
    description: string
    execute(args: unknown): Promise<unknown>
  }
  export const mcpSkills: McpSkill[]
  export interface FetchMcpSkillsForClient {
    (serverName: string, client: unknown): Promise<unknown>
    cache: Map<string, unknown>
  }
  export const fetchMcpSkillsForClient: FetchMcpSkillsForClient
}
declare module './skills/mcpSkills.js' {
  export interface McpSkill {
    name: string
    description: string
    execute(args: unknown): Promise<unknown>
  }
  export const mcpSkills: McpSkill[]
  export interface FetchMcpSkillsForClient {
    (serverName: string, client: unknown): Promise<unknown>
    cache: Map<string, unknown>
  }
  export const fetchMcpSkillsForClient: FetchMcpSkillsForClient
}
declare module '../skills/mcpSkills.js' {
  export interface McpSkill {
    name: string
    description: string
    execute(args: unknown): Promise<unknown>
  }
  export const mcpSkills: McpSkill[]
  export interface FetchMcpSkillsForClient {
    (serverName: string, client: unknown): Promise<unknown>
    cache: Map<string, unknown>
  }
  export const fetchMcpSkillsForClient: FetchMcpSkillsForClient
}
declare module '../../skills/mcpSkills.js' {
  export interface McpSkill {
    name: string
    description: string
    execute(args: unknown): Promise<unknown>
  }
  export const mcpSkills: McpSkill[]
  export interface FetchMcpSkillsForClient {
    (serverName: string, client: unknown): Promise<unknown>
    cache: Map<string, unknown>
  }
  export const fetchMcpSkillsForClient: FetchMcpSkillsForClient
}

// ============================================================================
// Missing internal modules - Utils
// ============================================================================
declare module '*/utils/attributionHooks.js' {
  export interface AttributionInfo {
    source: string
    confidence: number
  }
  export function getAttribution(content: string): AttributionInfo[]
}
declare module './utils/attributionHooks.js' {
  export interface AttributionInfo {
    source: string
    confidence: number
  }
  export function getAttribution(content: string): AttributionInfo[]
}
declare module '../utils/attributionHooks.js' {
  export interface AttributionInfo {
    source: string
    confidence: number
  }
  export function getAttribution(content: string): AttributionInfo[]
}
declare module '../../utils/attributionHooks.js' {
  export interface AttributionInfo {
    source: string
    confidence: number
  }
  export function getAttribution(content: string): AttributionInfo[]
}

// ============================================================================
// Missing internal modules - Entrypoints
// ============================================================================
declare module '*/entrypoints/sdk/sdkUtilityTypes.js' {
  export interface SDKUtilityConfig {
    name: string
    enabled: boolean
  }
}
declare module './entrypoints/sdk/sdkUtilityTypes.js' {
  export interface SDKUtilityConfig {
    name: string
    enabled: boolean
  }
}
declare module '../entrypoints/sdk/sdkUtilityTypes.js' {
  export interface SDKUtilityConfig {
    name: string
    enabled: boolean
  }
}
declare module '../../entrypoints/sdk/sdkUtilityTypes.js' {
  export interface SDKUtilityConfig {
    name: string
    enabled: boolean
  }
}

// ============================================================================
// Missing internal modules - Local types/utils
// ============================================================================
declare module './types.js' {
  export interface LocalTypes {
    [key: string]: unknown
  }
}
declare module './utils.js' {
  export function localUtil(): void
}
declare module './unifiedTypes.js' {
  export interface UnifiedType {
    type: string
    data: unknown
  }
}
declare module '../unifiedTypes.js' {
  export interface UnifiedType {
    type: string
    data: unknown
  }
}
declare module './server/parseConnectUrl.js' {
  export function parseConnectUrl(url: string): { host: string; port: number; path?: string }
}
declare module '../server/parseConnectUrl.js' {
  export function parseConnectUrl(url: string): { host: string; port: number; path?: string }
}
declare module './coreTypes.generated.js' {
  export interface GeneratedCoreTypes {
    version: string
    types: unknown[]
  }
}
declare module '../coreTypes.generated.js' {
  export interface GeneratedCoreTypes {
    version: string
    types: unknown[]
  }
}

// External package
declare module 'stack-utils' {
  export function clean(stack: string): string
  export function captureString(limit?: number, startStackFunction?: unknown): string
  export class StackUtils {
    constructor(options?: { internals?: RegExp[]; cwd?: string })
    capture(limit?: number, startStackFunction?: unknown): StackLine[]
  }
  export interface StackLine {
    file?: string
    line?: number
    column?: number
    type?: string
    method?: string
    function?: string
  }
}

// ============================================================================
// React Type Declarations - React 19 Compatible
// ============================================================================

declare module 'react' {
  // ReactNode - accepts any valid child (matches @types/react)
  export type ReactNode = 
    | ReactElement
    | string
    | number
    | boolean
    | null
    | undefined
    | Iterable<ReactNode>
  
  // ReactElement - represents a JSX element  
  export interface ReactElement<
    P = any,
    T extends string | JSXElementConstructor<any> = string | JSXElementConstructor<any>
  > {
    type: T
    props: P
    key: string | null
  }
  
  // ReactPortal - for portals
  export interface ReactPortal extends ReactElement {
    children: ReactNode
  }
  
  // Component types
  export type FC<P = {}> = FunctionComponent<P>
  
  export interface FunctionComponent<P = {}> {
    (props: P, context?: any): ReactElement<any, any> | null
    displayName?: string
    defaultProps?: Partial<P>
  }
  
  export type ComponentType<P = {}> = FunctionComponent<P> | ClassComponent<P>
  
  export interface ClassComponent<P = {}> {
    new (props: P): Component<P>
  }
  
  export class Component<P = {}, S = {}> {
    constructor(props: P)
    props: P
    state: S
    context: any
    refs: { [key: string]: any }
    setState(state: Partial<S> | ((prevState: S) => Partial<S>)): void
    forceUpdate(callback?: () => void): void
    render(): ReactNode
    componentDidMount?(): void
    componentDidUpdate?(prevProps: P, prevState: S, snapshot?: any): void
    componentWillUnmount?(): void
    shouldComponentUpdate?(nextProps: P, nextState: S): boolean
    static getDerivedStateFromProps?(props: any, state: any): any
    static getDerivedStateFromError?(error: any): any
    componentDidCatch?(error: Error, errorInfo: any): void
    getSnapshotBeforeUpdate?(prevProps: P, prevState: S): any
  }
  
  // PureComponent
  export class PureComponent<P = {}, S = {}> extends Component<P, S> {}
  
  // Hooks
  export function useState<T>(initialState: T | (() => T)): [T, (state: T | ((prev: T) => T)) => void]
  export function useEffect(effect: (() => void | (() => void)) | (() => undefined), deps?: readonly any[]): void
  export function useLayoutEffect(effect: (() => void | (() => void)) | (() => undefined), deps?: readonly any[]): void
  export function useCallback<T extends (...args: any[]) => any>(callback: T, deps: readonly any[]): T
  export function useMemo<T>(factory: () => T, deps: readonly any[]): T
  export function useRef<T>(initialValue: T): MutableRefObject<T>
  export function useRef<T>(initialValue: T | null): RefObject<T>
  export function useRef<T = undefined>(): MutableRefObject<T | undefined>
  export function useContext<T>(context: Context<T>): T
  export function useReducer<S, A>(reducer: (state: S, action: A) => S, initialState: S): [S, (action: A) => void]
  export function useReducer<S, A>(reducer: (state: S, action: A) => S, initialState: S, init: (arg: S) => S): [S, (action: A) => void]
  export function useImperativeHandle<T>(ref: Ref<T> | undefined, createHandle: () => T, deps?: readonly any[]): void
  export function useDebugValue<T>(value: T, format?: (value: T) => any): void
  
  // Ref types
  export interface MutableRefObject<T> {
    current: T
  }
  
  export interface RefObject<T> {
    current: T | null
  }
  
  export type Ref<T> = RefObject<T> | ((instance: T | null) => void) | null
  
  // Context
  export interface Context<T> {
    Provider: Provider<T>
    Consumer: Consumer<T>
    displayName?: string
  }
  
  export interface Provider<T> {
    (props: { value: T; children?: ReactNode }): ReactElement | null
  }
  
  export interface Consumer<T> {
    (props: { children: (value: T) => ReactNode }): ReactElement | null
  }
  
  export function createContext<T>(defaultValue: T): Context<T>
  
  // JSX
  export interface JSXElementConstructor<P> {
    (props: P): ReactElement<any, any> | null
  }
  
  // Attributes
  export interface HTMLAttributes<T> {
    className?: string
    style?: CSSProperties
    children?: ReactNode
    onClick?: (event: MouseEvent<T>) => void
    onChange?: (event: ChangeEvent<T>) => void
    onKeyDown?: (event: KeyboardEvent<T>) => void
    onKeyUp?: (event: KeyboardEvent<T>) => void
    onKeyPress?: (event: KeyboardEvent<T>) => void
    onFocus?: (event: FocusEvent<T>) => void
    onBlur?: (event: FocusEvent<T>) => void
    onMouseEnter?: (event: MouseEvent<T>) => void
    onMouseLeave?: (event: MouseEvent<T>) => void
    onMouseDown?: (event: MouseEvent<T>) => void
    onMouseUp?: (event: MouseEvent<T>) => void
    onSubmit?: (event: FormEvent<T>) => void
    id?: string
    role?: string
    tabIndex?: number
    title?: string
    hidden?: boolean
    defaultChecked?: boolean
    defaultValue?: string | number | readonly string[]
  }
  
  export interface CSSProperties {
    [key: string]: string | number | undefined
  }
  
  export interface SyntheticEvent<T = Element> {
    currentTarget: T
    target: EventTarget & T
    bubbles: boolean
    cancelable: boolean
    defaultPrevented: boolean
    eventPhase: number
    isTrusted: boolean
    preventDefault(): void
    stopPropagation(): void
    timeStamp: number
    type: string
    persist(): void
  }
  
  export interface MouseEvent<T = Element> extends SyntheticEvent<T> {
    altKey: boolean
    button: number
    buttons: number
    clientX: number
    clientY: number
    ctrlKey: boolean
    metaKey: boolean
    pageX: number
    pageY: number
    relatedTarget: EventTarget | null
    screenX: number
    screenY: number
    shiftKey: boolean
  }
  
  export interface KeyboardEvent<T = Element> extends SyntheticEvent<T> {
    altKey: boolean
    charCode: number
    ctrlKey: boolean
    key: string
    keyCode: number
    locale: string
    location: number
    metaKey: boolean
    repeat: boolean
    shiftKey: boolean
    which: number
    getModifierState(key: string): boolean
  }
  
  export interface ChangeEvent<T = Element> extends SyntheticEvent<T> {
    target: EventTarget & { value: string; checked?: boolean }
  }
  
  export interface FocusEvent<T = Element> extends SyntheticEvent<T> {
    relatedTarget: EventTarget | null
  }
  
  export interface FormEvent<T = Element> extends SyntheticEvent<T> {}
  
  export interface EventTarget {
    value?: string
    checked?: boolean
    focus?(): void
    blur?(): void
  }
  
  // React 18+ specific hooks
  export function useId(): string
  export function useSyncExternalStore<T>(
    subscribe: (callback: () => void) => () => void,
    getSnapshot: () => T,
    getServerSnapshot?: () => T
  ): T
  
  export function useTransition(): [boolean, (callback: () => void) => void]
  export function useDeferredValue<T>(value: T): T
  export function useInsertionEffect(effect: () => void | (() => void), deps?: readonly any[]): void
  
  // Other exports
  export function memo<P extends object>(component: FunctionComponent<P>, propsAreEqual?: (prevProps: P, nextProps: P) => boolean): FunctionComponent<P>
  export function forwardRef<T, P = {}>(render: (props: P, ref: React.Ref<T>) => ReactElement | null): ForwardRefExoticComponent<PropsWithoutRef<P> & RefAttributes<T>>
  
  export interface ForwardRefExoticComponent<P> extends FunctionComponent<P> {}
  export interface RefAttributes<T> {
    ref?: Ref<T>
  }
  export type PropsWithoutRef<P> = Pick<P, Exclude<keyof P, 'ref'>>
  
  export function lazy<T extends ComponentType<any>>(factory: () => Promise<{ default: T }>): T
  export function Suspense(props: { children?: ReactNode; fallback?: ReactNode }): ReactElement
  
  // React 19 specific
  export function use<T>(promise: Promise<T> | Context<T>): T
  export function useActionState<State, Payload>(
    action: (state: Awaited<State>, payload: Payload) => State | Promise<State>,
    initialState: Awaited<State>,
    permalink?: string
  ): [state: Awaited<State>, dispatch: (payload: Payload) => void, isPending: boolean]
  export function useFormStatus(): {
    pending: boolean
    data: FormData | null
    method: string | null
    action: ((formData: FormData) => void) | null
  }
  export function useOptimistic<T, A>(
    passthrough: T,
    reducer?: (state: T, action: A) => T
  ): [T, (action: A) => void]
  export function useEffectEvent<T extends (...args: any[]) => any>(callback: T): T
  
  export const Fragment: unique symbol
  export const StrictMode: unique symbol
  export const Profiler: unique symbol
  export const Suspense: unique symbol
  
  // Children utilities
  export namespace Children {
    function map<T, C>(children: C | readonly C[], fn: (child: C, index: number) => T): T | null
    function forEach<C>(children: C | readonly C[], fn: (child: C, index: number) => void): void
    function count(children: any): number
    function only<C>(children: C): C
    function toArray<C>(children: C | readonly C[]): C[]
  }
  
  // isValidElement
  export function isValidElement<P>(object: any): object is ReactElement<P>
  
  // cloneElement
  export function cloneElement<P>(
    element: ReactElement<P>,
    props?: Partial<P> & { children?: ReactNode },
    ...children: ReactNode[]
  ): ReactElement<P>
  
  // createElement
  export function createElement<P extends {}>(
    type: string | JSXElementConstructor<P>,
    props?: (P & { children?: ReactNode }) | null,
    ...children: ReactNode[]
  ): ReactElement<P>
  
  // Fragment
  export function Fragment(props: { children?: ReactNode }): ReactElement | null
}

// JSX namespace
declare global {
  namespace JSX {
    // JSX.Element must be compatible with ReactElement
    type Element = import('react').ReactElement<any, any> | null
    
    // ElementClass must be compatible with Component class
    type ElementClass = import('react').Component<any> | { render(): import('react').ReactNode }
    
    // ElementAttributesProperty defines where to find the props type
    interface ElementAttributesProperty {
      props: {}
    }
    
    // ElementChildrenAttribute defines where to find the children type
    interface ElementChildrenAttribute {
      children: {}
    }
    
    // IntrinsicAttributes for built-in elements
    interface IntrinsicAttributes {
      key?: string | number | bigint
    }
    
    // IntrinsicClassAttributes for class components
    interface IntrinsicClassAttributes<T> {
      ref?: import('react').Ref<T>
    }
    
    // IntrinsicElements - HTML element types
    interface IntrinsicElements {
      div: import('react').HTMLAttributes<HTMLDivElement>
      span: import('react').HTMLAttributes<HTMLSpanElement>
      p: import('react').HTMLAttributes<HTMLParagraphElement>
      a: import('react').HTMLAttributes<HTMLAnchorElement>
      button: import('react').HTMLAttributes<HTMLButtonElement>
      input: import('react').HTMLAttributes<HTMLInputElement>
      textarea: import('react').HTMLAttributes<HTMLTextAreaElement>
      form: import('react').HTMLAttributes<HTMLFormElement>
      label: import('react').HTMLAttributes<HTMLLabelElement>
      img: import('react').HTMLAttributes<HTMLImageElement>
      ul: import('react').HTMLAttributes<HTMLUListElement>
      ol: import('react').HTMLAttributes<HTMLOListElement>
      li: import('react').HTMLAttributes<HTMLLIElement>
      h1: import('react').HTMLAttributes<HTMLHeadingElement>
      h2: import('react').HTMLAttributes<HTMLHeadingElement>
      h3: import('react').HTMLAttributes<HTMLHeadingElement>
      h4: import('react').HTMLAttributes<HTMLHeadingElement>
      h5: import('react').HTMLAttributes<HTMLHeadingElement>
      h6: import('react').HTMLAttributes<HTMLHeadingElement>
      header: import('react').HTMLAttributes<HTMLElement>
      footer: import('react').HTMLAttributes<HTMLElement>
      main: import('react').HTMLAttributes<HTMLElement>
      section: import('react').HTMLAttributes<HTMLElement>
      article: import('react').HTMLAttributes<HTMLElement>
      aside: import('react').HTMLAttributes<HTMLElement>
      nav: import('react').HTMLAttributes<HTMLElement>
      strong: import('react').HTMLAttributes<HTMLElement>
      em: import('react').HTMLAttributes<HTMLElement>
      code: import('react').HTMLAttributes<HTMLElement>
      pre: import('react').HTMLAttributes<HTMLPreElement>
      br: import('react').HTMLAttributes<HTMLBRElement>
      hr: import('react').HTMLAttributes<HTMLHRElement>
      table: import('react').HTMLAttributes<HTMLTableElement>
      thead: import('react').HTMLAttributes<HTMLTableSectionElement>
      tbody: import('react').HTMLAttributes<HTMLTableSectionElement>
      tr: import('react').HTMLAttributes<HTMLTableRowElement>
      th: import('react').HTMLAttributes<HTMLTableCellElement>
      td: import('react').HTMLAttributes<HTMLTableCellElement>
      select: import('react').HTMLAttributes<HTMLSelectElement>
      option: import('react').HTMLAttributes<HTMLOptionElement>
      [elemName: string]: any
    }
  }
}

// HTML Element interfaces for React
declare global {
  interface HTMLDivElement extends Element {}
  interface HTMLSpanElement extends Element {}
  interface HTMLParagraphElement extends Element {}
  interface HTMLAnchorElement extends Element {}
  interface HTMLButtonElement extends Element {}
  interface HTMLInputElement extends Element {}
  interface HTMLTextAreaElement extends Element {}
  interface HTMLFormElement extends Element {}
  interface HTMLLabelElement extends Element {}
  interface HTMLImageElement extends Element {}
  interface HTMLUListElement extends Element {}
  interface HTMLOListElement extends Element {}
  interface HTMLLIElement extends Element {}
  interface HTMLHeadingElement extends Element {}
  interface HTMLPreElement extends Element {}
  interface HTMLBRElement extends Element {}
  interface HTMLHRElement extends Element {}
  interface HTMLTableElement extends Element {}
  interface HTMLTableSectionElement extends Element {}
  interface HTMLTableRowElement extends Element {}
  interface HTMLTableCellElement extends Element {}
  interface HTMLSelectElement extends Element {}
  interface HTMLOptionElement extends Element {}
}

// ============================================================================
// Node.js Crypto Module
// ============================================================================

declare module 'crypto' {
  export type UUID = string
  
  export function randomUUID(): UUID
  export function randomBytes(size: number): Buffer
  export function createHash(algorithm: string): Hash
  
  export interface Hash {
    update(data: string | Buffer): Hash
    digest(encoding: 'hex'): string
    digest(): Buffer
  }
  
  export function createCipheriv(algorithm: string, key: Buffer, iv: Buffer): Cipher
  export function createDecipheriv(algorithm: string, key: Buffer, iv: Buffer): Decipher
  
  export interface Cipher {
    update(data: string): Buffer
    final(): Buffer
  }
  
  export interface Decipher {
    update(data: Buffer): Buffer
    final(): Buffer
  }
}

// Missing module declarations
declare module 'src/services/skillSearch/prefetch.js' {
  export function prefetchSkills(): Promise<void>
}
declare module 'src/jobs/classifier.js' {
  export function classifyInput(input: string): Promise<string>
}
declare module 'src/query/transitions.js' {
  export function transitionQuery(state: unknown): Promise<unknown>
}
declare module 'src/utils/taskSummary.js' {
  export function generateTaskSummary(tasks: unknown[]): string
}

// Missing exports from compact modules
declare module 'src/services/compact/snipCompact.js' {
  export function snipCompactIfNeeded(messages: unknown[]): Promise<unknown>
  export function isSnipRuntimeEnabled(): boolean
}
declare module 'src/services/contextCollapse/index.js' {
  export function applyCollapsesIfNeeded(messages: unknown[]): Promise<unknown>
  export function isContextCollapseEnabled(): boolean
}

// Deep SDK module declarations
declare module '@anthropic-ai/sdk/resources/messages.js' {
  export * from '@anthropic-ai/sdk'
}

declare module '@anthropic-ai/sdk/resources/beta/messages.js' {
  export * from '@anthropic-ai/sdk'
  export type BetaToolUnion = Anthropic.Beta.Messages.BetaToolUnion
  export type BetaMessageParam = Anthropic.Beta.Messages.BetaMessageParam
}

declare module '@anthropic-ai/sdk/resources/messages/messages.mjs' {
  export * from '@anthropic-ai/sdk'
}

declare module '@anthropic-ai/sdk/streaming.mjs' {
  export interface Stream<T> implements AsyncIterable<T> {
    [Symbol.asyncIterator](): AsyncIterator<T>
  }
}

declare module '@anthropic-ai/sdk/error' {
  export class APIError extends Error {
    status?: number
    code?: string
  }
  export class NotFoundError extends APIError {}
  export class BadRequestError extends APIError {}
  export class AuthenticationError extends APIError {}
  export class PermissionDeniedError extends APIError {}
  export class RateLimitError extends APIError {}
  export class InternalServerError extends APIError {}
}

declare module '@anthropic-ai/sdk' {
  export class NotFoundError extends Error {
    status?: number
    code?: string
  }
  export class AuthenticationError extends Error {
    status?: number
    code?: string
  }
}

// usehooks-ts module
declare module 'usehooks-ts' {
  export function useDebounceCallback<T extends (...args: unknown[]) => unknown>(callback: T, delay: number): T & { cancel(): void; flush(): void }
  export function useDebounce<T>(value: T, delay: number): T
  export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((prev: T) => T)) => void]
  export function useSessionStorage<T>(key: string, initialValue: T): [T, (value: T | ((prev: T) => T)) => void]
  export function useMediaQuery(query: string): boolean
  export function useInterval(callback: () => void, delay: number | null): void
  export function useTimeout(callback: () => void, delay: number | null): void
  export function useBoolean(initialValue?: boolean): { value: boolean; setValue: (value: boolean) => void; setTrue: () => void; setFalse: () => void; toggle: () => void }
  export function useCountdown(options: { countStart: number; countStop?: number; intervalMs?: number }): { count: number; start: () => void; stop: () => void; reset: () => void }
  export function useCounter(initialValue?: number): { count: number; increment: () => void; decrement: () => void; reset: () => void; setCount: (value: number | ((prev: number) => number)) => void }
  export function useToggle(initialValue?: boolean): [boolean, () => void, () => void, () => void]
  export function useCopyToClipboard(): [string | null, (text: string) => Promise<boolean>]
  export function useDarkMode(): { isDarkMode: boolean; toggle: () => void; enable: () => void; disable: () => void; set: (value: boolean) => void }
  export function useElementSize<T extends HTMLElement>(): [React.RefObject<T>, { width: number; height: number }]
  export function useFetch<T>(url: string): { data: T | undefined; error: Error | undefined; isLoading: boolean }
  export function useHover<T extends HTMLElement>(): [React.RefObject<T>, boolean]
  export function useIntersectionObserver<T extends HTMLElement>(options?: IntersectionObserverInit): [React.RefObject<T>, IntersectionObserverEntry | undefined]
  export function useIsClient(): boolean
  export function useIsMounted(): boolean
  export function useLockedBody(locked?: boolean): [boolean, (locked: boolean) => void]
  export function useMap<K, V>(initialValue?: Iterable<[K, V]>): { map: Map<K, V>; set: (key: K, value: V) => void; remove: (key: K) => void; has: (key: K) => boolean; get: (key: K) => V | undefined; clear: () => void; setAll: (entries: Iterable<[K, V]>) => void; reset: () => void }
  export function useOnClickOutside<T extends HTMLElement>(ref: React.RefObject<T>, handler: (event: MouseEvent | TouchEvent) => void): void
  export function useReadLocalStorage<T>(key: string): T | undefined
  export function useResizeObserver<T extends HTMLElement>(callback: (entries: ResizeObserverEntry[]) => void): React.RefObject<T>
  export function useScreen(): { width: number; height: number }
  export function useScript(src: string): 'idle' | 'loading' | 'ready' | 'error'
  export function useSet<T>(initialValue?: Iterable<T>): { set: Set<T>; add: (value: T) => void; remove: (value: T) => void; has: (value: T) => boolean; clear: () => void; reset: () => void }
  export function useStep(maxStep: number): { currentStep: number; goToNextStep: () => void; goToPrevStep: () => void; reset: () => void; canGoToNextStep: boolean; canGoToPrevStep: boolean; setStep: (step: number) => void }
  export function useTernaryDarkMode(): { ternaryDarkMode: 'system' | 'dark' | 'light'; setTernaryDarkMode: (value: 'system' | 'dark' | 'light') => void; toggleTernaryDarkMode: () => void; isDarkMode: boolean }
  export function useWindowSize(): { width: number; height: number }
}

// Zod module stub
declare module 'zod' {
  export interface ZodType<T = unknown> {
    parse(val: unknown): T
    safeParse(val: unknown): { success: true; data: T } | { success: false; error: { message: string; issues: unknown[] } }
    optional(): ZodType<T | undefined>
    nullable(): ZodType<T | null>
    nullish(): ZodType<T | null | undefined>
    array(): ZodType<T[]>
    record<V>(): ZodType<Record<string, V>>
    transform<R>(fn: (val: T) => R): ZodType<R>
    passthrough(): ZodType<T>
  }
  export interface ZodObject<T extends Record<string, ZodType>> extends ZodType<T> {
    shape: T
  }
  export interface ZodString extends ZodType<string> {}
  export interface ZodNumber extends ZodType<number> {}
  export interface ZodBoolean extends ZodType<boolean> {}
  export interface ZodUnknown extends ZodType<unknown> {}
  export interface ZodOptional<T> extends ZodType<T | undefined> {}
  export interface ZodArray<T> extends ZodType<T[]> {}
  
  export function object<T extends Record<string, ZodType>>(shape: T): ZodObject<T>
  export function string(): ZodString
  export function number(): ZodNumber
  export function boolean(): ZodBoolean
  export function unknown(): ZodUnknown
  export function array<T>(item: ZodType<T>): ZodArray<T>
  export function record<V>(valueType: ZodType<V>): ZodType<Record<string, V>>
  export function union<T extends readonly ZodType[]>(types: T): ZodType<unknown>
  export function literal<T extends string | number | boolean>(val: T): ZodType<T>
  export function enum_<T extends [string, ...string[]]>(values: T): ZodType<T[number]>
  export function optional<T>(type: ZodType<T>): ZodType<T | undefined>
  export function nullable<T>(type: ZodType<T>): ZodType<T | null>
  export function intersection<T, U>(left: ZodType<T>, right: ZodType<U>): ZodType<T & U>
  export function discriminatedUnion<K extends string, T extends readonly ZodType[]>(key: K, types: T): ZodType<unknown>
  export const z: {
    object: typeof object
    string: typeof string
    number: typeof number
    boolean: typeof boolean
    unknown: typeof unknown
    array: typeof array
    record: typeof record
    union: typeof union
    literal: typeof literal
    enum: typeof enum_
    optional: typeof optional
    nullable: typeof nullable
    intersection: typeof intersection
    discriminatedUnion: typeof discriminatedUnion
  }
  export default z
}

// Bridge modules that may not exist in all builds
declare module '../bridge/webhookSanitizer.js' {
  export function sanitizeInboundWebhookContent(content: string): string
}

// Specific markdown file declarations for skills
// These fix TS2307 errors for markdown imports in bundled skills
declare module '*.md' {
  const content: string
  export = content
  export default content
}

// Additional @ant module stubs
declare module '@ant/computer-use-input' {
  export interface InputConfig {
    type: string
  }
  export function loadInput(config: InputConfig): Promise<any>
}

declare module '@ant/computer-use-swift' {
  export function loadSwift(): Promise<any>
}

// JSX Intrinsic elements for Ink (custom renderer)
// Must be at top level (not in declare global) to work with TS
namespace JSX {
  interface IntrinsicElements {
    'ink-text': {
      children?: any
      style?: Record<string, unknown>
      dimColor?: boolean
    }
    'ink-box': {
      ref?: any
      children?: any
      style?: Record<string, unknown>
      tabIndex?: number
      autoFocus?: boolean
      onClick?: () => void
      onFocus?: () => void
      onFocusCapture?: () => void
      onBlur?: () => void
      onBlurCapture?: () => void
      onMouseEnter?: () => void
      onMouseLeave?: () => void
      onKeyDown?: (e: { key: string }) => void
      onKeyDownCapture?: (e: { key: string }) => void
    }
    'ink-link': {
      children?: any
      style?: Record<string, unknown>
      url?: string
      onClick?: () => void
    }
    'ink-raw-ansi': {
      children?: any
      style?: Record<string, unknown>
    }
  }
}

// File is a script (not a module) so top-level declarations are global
