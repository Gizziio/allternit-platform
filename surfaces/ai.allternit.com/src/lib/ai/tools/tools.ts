import type { FileUIPart, ModelMessage, Tool } from "ai";
import type { ModelId } from "@/lib/ai/app-models";
import {
  buildMcpAppRenderPayload,
  canModelAccessTool,
  getMcpAppResourceUri,
  isMcpAppTool,
} from "@/lib/ai/mcp/apps";
import { getOrCreateMcpClient, type MCPClient } from "@/lib/ai/mcp/mcp-client";
import { createToolId } from "@/lib/ai/mcp-name-id";
import { agentBrowserTool } from "@/lib/ai/tools/agent-browser-tool";
import { codeExecution } from "@/lib/ai/tools/code-execution";
import { createCodeDocumentTool } from "@/lib/ai/tools/documents/create-code-document";
import { createSheetDocumentTool } from "@/lib/ai/tools/documents/create-sheet-document";
import { createTextDocumentTool } from "@/lib/ai/tools/documents/create-text-document";
import { editCodeDocumentTool } from "@/lib/ai/tools/documents/edit-code-document";
import { editSheetDocumentTool } from "@/lib/ai/tools/documents/edit-sheet-document";
import { editTextDocumentTool } from "@/lib/ai/tools/documents/edit-text-document";
import { generateA2UITool } from "@/lib/ai/tools/generate-a2ui";
import { generateWebArtifactTool } from "@/lib/ai/tools/generate-web-artifact";
import { generateImageTool } from "@/lib/ai/tools/generate-image";
import { getWeather } from "@/lib/ai/tools/get-weather";
import { readDocument } from "@/lib/ai/tools/read-document";
import { retrieveUrl } from "@/lib/ai/tools/retrieve-url";
import { tavilyWebSearch } from "@/lib/ai/tools/web-search";
import { config } from "@/lib/config";
import type { CostAccumulator } from "@/lib/credits/cost-accumulator";
import type { McpConnector } from "@/lib/db/schema";
import { createModuleLogger } from "@/lib/logger";
import { isMultimodalImageModel } from "@/lib/models/image-model-id";
import type { StreamWriter } from "../types";
import { deepResearch } from "./deep-research/deep-research";
import {
  notebookIngestTool,
  notebookQueryTool,
  notebookSummarizeTool,
} from "./notebook";
import type { ToolSession } from "./types";

const log = createModuleLogger("tools:mcp");

type RawMcpTool = Awaited<ReturnType<MCPClient["listTools"]>>["tools"][number];
type ToolExecutionContext = {
  toolCallId?: string;
} & Record<string, unknown>;
type ExecutableTool = Tool & {
  execute?: (
    input: unknown,
    options: ToolExecutionContext,
  ) => Promise<unknown> | unknown;
  _meta?: Record<string, unknown>;
  title?: string;
  description?: string;
};

function wrapMcpAppTool({
  connectorId,
  connectorName,
  dataStream,
  mcpClient,
  rawTool,
  tool,
  toolId,
}: {
  connectorId: string;
  connectorName: string;
  dataStream: StreamWriter;
  mcpClient: MCPClient;
  rawTool: RawMcpTool;
  tool: Tool;
  toolId: string;
}): Tool {
  const executableTool = tool as ExecutableTool;
  const resourceUri = getMcpAppResourceUri(rawTool);

  if (!executableTool.execute || !resourceUri) {
    return tool;
  }

  return {
    ...executableTool,
    async execute(input, options) {
      const result = await executableTool.execute?.(input, options);
      const toolCallId =
        typeof options?.toolCallId === "string" ? options.toolCallId : undefined;

      if (!toolCallId) {
        return result;
      }

      try {
        const resource = await mcpClient.readResource(resourceUri);
        const renderPayload = buildMcpAppRenderPayload({
          toolCallId,
          toolName: toolId,
          connectorId,
          connectorName,
          tool: rawTool,
          resource,
          toolInput: input,
          toolResult: result,
        });

        if (renderPayload) {
          dataStream.write({
            type: "mcp_app",
            ...renderPayload,
          });
        }
      } catch (error) {
        log.warn(
          {
            connectorId,
            connectorName,
            toolId,
            resourceUri,
            error,
          },
          "Failed to resolve MCP App resource after tool execution"
        );
      }

      return result;
    },
  } as Tool;
}

export function getTools({
  dataStream,
  session,
  messageId,
  selectedModel,
  attachments = [],
  lastGeneratedImage = null,
  contextForLLM,
  costAccumulator,
}: {
  dataStream: StreamWriter;
  session: ToolSession;
  messageId: string;
  selectedModel: ModelId;
  attachments: FileUIPart[];
  lastGeneratedImage: { imageUrl: string; name: string } | null;
  contextForLLM: ModelMessage[];
  costAccumulator: CostAccumulator;
}) {
  const imageToolModelId = isMultimodalImageModel(selectedModel)
    ? selectedModel
    : undefined;
  const documentToolProps = {
    session,
    messageId,
    selectedModel,
    costAccumulator,
  };

  return {
    getWeather,
    createTextDocument: createTextDocumentTool(documentToolProps),
    createCodeDocument: createCodeDocumentTool(documentToolProps),
    createSheetDocument: createSheetDocumentTool(documentToolProps),
    editTextDocument: editTextDocumentTool(documentToolProps),
    editCodeDocument: editCodeDocumentTool(documentToolProps),
    editSheetDocument: editSheetDocumentTool(documentToolProps),
    readDocument: readDocument({
      session,
      dataStream,
    }),
    ...(config.integrations.urlRetrieval ? { retrieveUrl } : {}),
    ...(config.integrations.webSearch
      ? {
          webSearch: tavilyWebSearch({
            dataStream,
            writeTopLevelUpdates: true,
            costAccumulator,
          }),
        }
      : {}),

    ...(config.integrations.sandbox
      ? { codeExecution: codeExecution({ costAccumulator }) }
      : {}),
    ...(config.integrations.imageGeneration
      ? {
          generateImage: generateImageTool({
            attachments,
            lastGeneratedImage,
            modelId: imageToolModelId as import("@/lib/models/image-model-id").ImageModelId,
            costAccumulator,
          }),
        }
      : {}),
    ...(config.integrations.webSearch
      ? {
          deepResearch: deepResearch({
            session,
            dataStream,
            messageId,
            messages: contextForLLM,
            costAccumulator,
          }),
        }
      : {}),
    ...(config.integrations.agentBrowser
      ? { agentBrowser: agentBrowserTool }
      : {}),
    generateA2UI: generateA2UITool({ costAccumulator }),
    generateWebArtifact: generateWebArtifactTool({ costAccumulator }),
    notebookIngest: notebookIngestTool({ dataStream, costAccumulator }),
    notebookQuery: notebookQueryTool({ dataStream, costAccumulator }),
    notebookSummarize: notebookSummarizeTool({ dataStream, costAccumulator }),
  };
}

/**
 * Creates MCP clients for the given connectors and returns their tools.
 * Uses OAuth-aware MCP clients that can authenticate with OAuth 2.1 + PKCE.
 * Returns both the tools and a cleanup function to close all clients.
 */
export async function getMcpTools({
  connectors,
  dataStream,
}: {
  connectors: McpConnector[];
  dataStream: StreamWriter;
}): Promise<{
  tools: Record<string, Tool>;
  cleanup: () => Promise<void>;
}> {
  if (!config.integrations.mcp) {
    return {
      tools: {},
      cleanup: async () => Promise.resolve(),
    };
  }

  const enabledConnectors = connectors.filter((c) => c.enabled);

  if (enabledConnectors.length === 0) {
    return {
      tools: {},
      cleanup: async () => Promise.resolve(),
    };
  }

  const clients: MCPClient[] = [];
  const allTools: Record<string, Tool> = {};

  for (const connector of enabledConnectors) {
    try {
      // Get or create OAuth-aware MCP client
      const mcpClient = getOrCreateMcpClient({
        id: connector.id,
        name: connector.name,
        url: connector.url,
        type: connector.type,
        // Legacy Basic auth headers for connectors that have client credentials
        headers:
          connector.oauthClientId && connector.oauthClientSecret
            ? {
                Authorization: `Basic ${Buffer.from(`${connector.oauthClientId}:${connector.oauthClientSecret}`).toString("base64")}`,
              }
            : undefined,
      });

      // Attempt to connect
      await mcpClient.connect();

      // Skip connectors that need OAuth authorization
      if (mcpClient.status === "authorizing") {
        log.info(
          { connector: connector.name },
          "MCP connector needs OAuth authorization, skipping"
        );
        continue;
      }

      // Skip if not connected
      if (mcpClient.status !== "connected") {
        log.warn(
          { connector: connector.name, status: mcpClient.status },
          "MCP connector not connected, skipping"
        );
        continue;
      }

      clients.push(mcpClient);
      const [tools, rawToolsResult] = await Promise.all([
        mcpClient.tools(),
        mcpClient.listTools(),
      ]);
      const rawToolsByName = new Map(
        rawToolsResult.tools.map((tool: any) => [tool.name, tool] as const)
      );
      let modelVisibleToolCount = 0;
      let hiddenAppToolCount = 0;

      // Namespace tool names with connector nameId to avoid collisions
      // Format: {namespace}.{toolName} or global.{namespace}.{toolName}
      const isGlobal = connector.userId === null;
      for (const [toolName, tool] of Object.entries(tools)) {
        const rawTool = rawToolsByName.get(toolName);
        const toolDefinition = rawTool ?? tool;

        if (!canModelAccessTool(toolDefinition as any)) {
          hiddenAppToolCount += 1;
          continue;
        }

        const toolId = createToolId(connector.nameId, toolName, isGlobal);
        allTools[toolId] =
          rawTool && isMcpAppTool(rawTool)
            ? wrapMcpAppTool({
                connectorId: connector.id,
                connectorName: connector.name,
                dataStream,
                mcpClient,
                rawTool,
                tool: tool as Tool,
                toolId,
              })
            : (tool as Tool);
        modelVisibleToolCount += 1;
      }

      log.info(
        {
          connector: connector.name,
          toolCount: Object.keys(tools).length,
          modelVisibleToolCount,
          hiddenAppToolCount,
          mcpAppToolCount: (Object.values(tools) as any[]).filter(isMcpAppTool).length,
        },
        "MCP client connected"
      );
    } catch (error) {
      log.error(
        { connector: connector.name, error },
        "Failed to connect to MCP server"
      );
      // Continue with other connectors even if one fails
    }
  }

  const cleanup = async () => {
    await Promise.all(
      clients.map(async (client) => {
        try {
          await client.close();
        } catch (error) {
          log.error({ error }, "Failed to close MCP client");
        }
      })
    );
  };

  return { tools: allTools, cleanup };
}
