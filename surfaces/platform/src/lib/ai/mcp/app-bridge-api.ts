import type { McpAppBridgeRequest } from "./apps";

const MCP_APP_BRIDGE_API_ROUTE = "/api/mcp/apps";

function getErrorMessage(payload: unknown, fallback: string): string {
  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    typeof payload.error === "string"
  ) {
    return payload.error;
  }

  return fallback;
}

export async function requestMcpAppBridge<T>(
  request: McpAppBridgeRequest,
): Promise<T> {
  const response = await fetch(MCP_APP_BRIDGE_API_ROUTE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  const payload = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    throw new Error(
      getErrorMessage(payload, `MCP Apps bridge request failed (${response.status})`),
    );
  }

  return payload as T;
}
