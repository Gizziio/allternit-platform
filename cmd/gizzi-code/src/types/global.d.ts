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

}

// File is a script (not a module) so top-level declarations are global
