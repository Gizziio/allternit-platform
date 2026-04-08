import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export const MCP_APPS_EXTENSION_ID = "io.modelcontextprotocol/ui";
export const MCP_APP_RESOURCE_MIME_TYPE = "text/html;profile=mcp-app";
export const MCP_APP_RESOURCE_URI_META_KEY = "ui/resourceUri";

export type McpAppToolVisibility = "model" | "app";
export type McpAppBridgeDisplayMode = "inline" | "fullscreen" | "pip";

export type McpAppBridgeAction =
  | "tools/list"
  | "tools/call"
  | "resources/list"
  | "resources/read"
  | "resources/templates/list"
  | "prompts/list";

export interface McpAppToolMeta {
  resourceUri?: string;
  visibility?: McpAppToolVisibility[];
}

export interface McpAppToolDefinition {
  name: string;
  title?: string;
  description?: string;
  inputSchema?: unknown;
  annotations?: Record<string, unknown>;
  _meta?: Record<string, unknown>;
}

export interface McpAppResourcePermissions {
  camera?: Record<string, never>;
  microphone?: Record<string, never>;
  geolocation?: Record<string, never>;
  clipboardWrite?: Record<string, never>;
}

export interface McpAppResourceCsp {
  connectDomains?: string[];
  resourceDomains?: string[];
  frameDomains?: string[];
  baseUriDomains?: string[];
}

export interface McpAppResourceMeta {
  csp?: McpAppResourceCsp;
  permissions?: McpAppResourcePermissions;
  domain?: string;
  prefersBorder?: boolean;
}

export interface McpAppTextResourceContent {
  uri: string;
  mimeType?: string;
  name?: string;
  title?: string;
  text: string;
}

export interface McpAppResourceResultLike {
  _meta?: Record<string, unknown>;
  contents?: unknown[];
}

export type McpAppBridgeRequest =
  | {
      action: "tools/list";
      connectorId: string;
      params?: { cursor?: string };
    }
  | {
      action: "tools/call";
      connectorId: string;
      params: {
        name: string;
        arguments?: Record<string, unknown>;
      };
    }
  | {
      action: "resources/list";
      connectorId: string;
      params?: { cursor?: string };
    }
  | {
      action: "resources/read";
      connectorId: string;
      params: { uri: string };
    }
  | {
      action: "resources/templates/list";
      connectorId: string;
    }
  | {
      action: "prompts/list";
      connectorId: string;
      params?: { cursor?: string };
    };

export interface McpAppRenderEventPayload {
  toolCallId: string;
  toolName: string;
  connectorId: string;
  connectorName: string;
  title: string;
  description?: string;
  resourceUri: string;
  html: string;
  allow: string;
  prefersBorder: boolean;
  tool?: McpAppToolDefinition;
  toolInput?: Record<string, unknown>;
  toolResult?: unknown;
  csp?: McpAppResourceCsp;
  permissions?: McpAppResourcePermissions;
  domain?: string;
}

export interface McpAppClientCapabilities {
  mimeTypes?: string[];
}

export interface ToolLike {
  _meta?: Record<string, unknown>;
}

export interface ClientCapabilitiesLike {
  extensions?: Record<string, unknown>;
}

export const MCP_APPS_CLIENT_CAPABILITIES = {
  extensions: {
    [MCP_APPS_EXTENSION_ID]: {
      mimeTypes: [MCP_APP_RESOURCE_MIME_TYPE],
    },
  },
} as const satisfies ClientCapabilitiesLike;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isVisibility(value: unknown): value is McpAppToolVisibility {
  return value === "model" || value === "app";
}

function getExtensionMeta(
  meta: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined {
  const extensionMeta = meta?.[MCP_APPS_EXTENSION_ID];
  return isRecord(extensionMeta) ? extensionMeta : undefined;
}

function normalizeVisibility(value: unknown): McpAppToolVisibility[] {
  if (!Array.isArray(value)) {
    return ["model", "app"];
  }

  const visibility = value.filter(isVisibility);
  return visibility.length > 0 ? visibility : ["model", "app"];
}

export function getMcpAppToolMeta(tool: ToolLike): McpAppToolMeta | undefined {
  const meta = tool._meta;
  if (!isRecord(meta)) {
    return undefined;
  }

  const nestedUi = isRecord(meta.ui) ? meta.ui : undefined;
  const nestedResourceUri =
    typeof nestedUi?.resourceUri === "string" ? nestedUi.resourceUri : undefined;
  const legacyResourceUri =
    typeof meta[MCP_APP_RESOURCE_URI_META_KEY] === "string"
      ? meta[MCP_APP_RESOURCE_URI_META_KEY]
      : undefined;
  const resourceUri = nestedResourceUri ?? legacyResourceUri;

  if (!resourceUri && !nestedUi) {
    return undefined;
  }

  if (resourceUri && !resourceUri.startsWith("ui://")) {
    throw new Error(
      `Invalid MCP App resource URI "${resourceUri}". Expected a ui:// URI.`,
    );
  }

  return {
    resourceUri,
    visibility: normalizeVisibility(nestedUi?.visibility),
  };
}

export function getMcpAppResourceUri(tool: ToolLike): string | undefined {
  return getMcpAppToolMeta(tool)?.resourceUri;
}

export function isMcpAppTool(tool: ToolLike): boolean {
  return Boolean(getMcpAppResourceUri(tool));
}

export function canModelAccessTool(tool: ToolLike): boolean {
  const toolMeta = getMcpAppToolMeta(tool);
  if (!toolMeta) {
    return true;
  }
  return toolMeta.visibility?.includes("model") ?? true;
}

export function canAppAccessTool(tool: ToolLike): boolean {
  const toolMeta = getMcpAppToolMeta(tool);
  if (!toolMeta) {
    return true;
  }
  return toolMeta.visibility?.includes("app") ?? true;
}

export function getMcpAppCapability(
  capabilities: ClientCapabilitiesLike | null | undefined,
): McpAppClientCapabilities | undefined {
  const extensionValue = capabilities?.extensions?.[MCP_APPS_EXTENSION_ID];
  if (!isRecord(extensionValue)) {
    return undefined;
  }

  const mimeTypes = Array.isArray(extensionValue.mimeTypes)
    ? extensionValue.mimeTypes.filter(
        (entry): entry is string => typeof entry === "string",
      )
    : undefined;

  return mimeTypes ? { mimeTypes } : {};
}

export function clientSupportsMcpApps(
  capabilities: ClientCapabilitiesLike | null | undefined,
): boolean {
  const appCapability = getMcpAppCapability(capabilities);
  return (
    appCapability?.mimeTypes?.includes(MCP_APP_RESOURCE_MIME_TYPE) ?? false
  );
}

export function buildMcpAppAllowAttribute(
  permissions: McpAppResourcePermissions | undefined,
): string {
  if (!permissions) {
    return "";
  }

  const directives: string[] = [];

  if (permissions.camera) {
    directives.push("camera");
  }
  if (permissions.microphone) {
    directives.push("microphone");
  }
  if (permissions.geolocation) {
    directives.push("geolocation");
  }
  if (permissions.clipboardWrite) {
    directives.push("clipboard-write");
  }

  return directives.join("; ");
}

function getStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value.filter((entry: unknown): entry is string => typeof entry === "string");
}

function serializeMcpAppToolDefinition(
  tool: ToolLike & {
    name?: string;
    title?: string;
    description?: string;
    inputSchema?: unknown;
    annotations?: unknown;
  },
  fallbackName: string,
): McpAppToolDefinition {
  return {
    name: typeof tool.name === "string" ? tool.name : fallbackName,
    title: typeof tool.title === "string" ? tool.title : undefined,
    description:
      typeof tool.description === "string" ? tool.description : undefined,
    inputSchema: tool.inputSchema,
    annotations: isRecord(tool.annotations) ? tool.annotations : undefined,
    _meta: isRecord(tool._meta) ? tool._meta : undefined,
  };
}

export function getMcpAppResourceMeta(
  resource: McpAppResourceResultLike | null | undefined,
): McpAppResourceMeta | undefined {
  const extensionMeta = getExtensionMeta(
    isRecord(resource?._meta) ? resource?._meta : undefined,
  );

  if (!extensionMeta) {
    return undefined;
  }

  const cspMeta = isRecord(extensionMeta.csp) ? extensionMeta.csp : undefined;
  const permissionsMeta = isRecord(extensionMeta.permissions)
    ? extensionMeta.permissions
    : undefined;

  const csp = cspMeta
    ? {
        connectDomains: getStringArray(
          cspMeta.connect_domains ?? cspMeta.connectDomains,
        ),
        resourceDomains: getStringArray(
          cspMeta.resource_domains ?? cspMeta.resourceDomains,
        ),
        frameDomains: getStringArray(
          cspMeta.frame_domains ?? cspMeta.frameDomains,
        ),
        baseUriDomains: getStringArray(
          cspMeta.base_uri_domains ?? cspMeta.baseUriDomains,
        ),
      }
    : undefined;

  const permissions = permissionsMeta
      ? {
        camera: isRecord(permissionsMeta.camera)
          ? (permissionsMeta.camera as Record<string, never>)
          : undefined,
        microphone: isRecord(permissionsMeta.microphone)
          ? (permissionsMeta.microphone as Record<string, never>)
          : undefined,
        geolocation: isRecord(permissionsMeta.geolocation)
          ? (permissionsMeta.geolocation as Record<string, never>)
          : undefined,
        clipboardWrite: isRecord(permissionsMeta.clipboardWrite)
          ? (permissionsMeta.clipboardWrite as Record<string, never>)
          : undefined,
      }
    : undefined;

  return {
    csp,
    permissions,
    domain:
      typeof extensionMeta.domain === "string" ? extensionMeta.domain : undefined,
    prefersBorder:
      typeof extensionMeta.prefersBorder === "boolean"
        ? extensionMeta.prefersBorder
        : undefined,
  };
}

export function getMcpAppHtmlResourceContent(
  resource: McpAppResourceResultLike | null | undefined,
): McpAppTextResourceContent | undefined {
  if (!Array.isArray(resource?.contents)) {
    return undefined;
  }

  const htmlContent = resource.contents.find((entry) => {
    if (!isRecord(entry) || typeof entry.text !== "string") {
      return false;
    }

    return (
      entry.mimeType === MCP_APP_RESOURCE_MIME_TYPE ||
      entry.mimeType === "text/html"
    );
  });

  if (!isRecord(htmlContent) || typeof htmlContent.text !== "string") {
    return undefined;
  }

  return {
    uri: typeof htmlContent.uri === "string" ? htmlContent.uri : "",
    mimeType:
      typeof htmlContent.mimeType === "string" ? htmlContent.mimeType : undefined,
    name: typeof htmlContent.name === "string" ? htmlContent.name : undefined,
    title: typeof htmlContent.title === "string" ? htmlContent.title : undefined,
    text: htmlContent.text,
  };
}

export function buildMcpAppRenderPayload({
  toolCallId,
  toolName,
  connectorId,
  connectorName,
  tool,
  resource,
  toolInput,
  toolResult,
}: {
  toolCallId: string;
  toolName: string;
  connectorId: string;
  connectorName: string;
  tool: ToolLike & {
    name?: string;
    title?: string;
    description?: string;
    inputSchema?: unknown;
    annotations?: unknown;
  };
  resource: McpAppResourceResultLike;
  toolInput?: unknown;
  toolResult?: unknown;
}): McpAppRenderEventPayload | undefined {
  const resourceUri = getMcpAppResourceUri(tool);
  const htmlContent = getMcpAppHtmlResourceContent(resource);

  if (!resourceUri || !htmlContent) {
    return undefined;
  }

  const resourceMeta = getMcpAppResourceMeta(resource);

  return {
    toolCallId,
    toolName,
    connectorId,
    connectorName,
    title:
      htmlContent.title ?? tool.title ?? tool.description ?? connectorName,
    description: tool.description,
    resourceUri,
    html: htmlContent.text,
    allow: buildMcpAppAllowAttribute(resourceMeta?.permissions),
    prefersBorder: resourceMeta?.prefersBorder ?? true,
    tool: serializeMcpAppToolDefinition(tool, toolName),
    toolInput: isRecord(toolInput) ? toolInput : undefined,
    toolResult,
    csp: resourceMeta?.csp,
    permissions: resourceMeta?.permissions,
    domain: resourceMeta?.domain,
  };
}

export function coerceMcpAppToolResult(result: unknown): CallToolResult {
  if (isRecord(result) && Array.isArray(result.content)) {
    return result as CallToolResult;
  }

  if (isRecord(result)) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
      structuredContent: result,
      ...(typeof result.isError === "boolean"
        ? { isError: result.isError }
        : {}),
    };
  }

  return {
    content: [
      {
        type: "text",
        text: result == null ? "" : String(result),
      },
    ],
  };
}
