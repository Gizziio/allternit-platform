import { NextRequest, NextResponse } from "next/server";

import { createMcpClientForCallback } from "@/lib/ai/mcp/mcp-client";
import { getMcpConnectorById, getSessionByState } from "@/lib/db/mcp-queries";

export const runtime = "nodejs";

function renderCallbackHtml(title: string, message: string, closeWindow: boolean) {
  const script = closeWindow
    ? `<script>window.close();</script>`
    : "";

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    ${script}
  </head>
  <body style="font-family: 'Allternit Sans', Inter, ui-sans-serif, system-ui, sans-serif; padding: 24px; color: #111;">
    <h1 style="font-size: 18px; margin: 0 0 12px;">${title}</h1>
    <p style="margin: 0; line-height: 1.5;">${message}</p>
  </body>
</html>`;
}

function buildConnectorHeaders(
  oauthClientId?: string | null,
  oauthClientSecret?: string | null
): Record<string, string> | undefined {
  if (!oauthClientId || !oauthClientSecret) {
    return undefined;
  }

  return {
    Authorization: `Basic ${Buffer.from(
      `${oauthClientId}:${oauthClientSecret}`
    ).toString("base64")}`,
  };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  if (error) {
    return new NextResponse(
      renderCallbackHtml(
        "Connector authorization failed",
        errorDescription || error,
        false
      ),
      {
        status: 400,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }
    );
  }

  if (!code || !state) {
    return new NextResponse(
      renderCallbackHtml(
        "Invalid MCP callback",
        "Missing OAuth code or state.",
        false
      ),
      {
        status: 400,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }
    );
  }

  const session = await getSessionByState({ state });
  if (!session) {
    return new NextResponse(
      renderCallbackHtml(
        "MCP session not found",
        "This authorization session is no longer available.",
        false
      ),
      {
        status: 404,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }
    );
  }

  const connector = await getMcpConnectorById(session.mcpConnectorId);
  if (!connector) {
    return new NextResponse(
      renderCallbackHtml(
        "MCP connector not found",
        "The connector for this authorization session could not be loaded.",
        false
      ),
      {
        status: 404,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }
    );
  }

  const client = createMcpClientForCallback({
    id: connector.id,
    name: connector.name,
    url: connector.url,
    type: connector.type as "http" | "sse",
    headers: buildConnectorHeaders(
      connector.oauthClientId,
      connector.oauthClientSecret
    ),
  });

  try {
    await client.finishAuth(code, state);

    return new NextResponse(
      renderCallbackHtml(
        "Connector connected",
        "Authorization completed. You can close this window and return to Allternit.",
        true
      ),
      {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }
    );
  } catch (authError) {
    const message =
      authError instanceof Error ? authError.message : String(authError);

    return new NextResponse(
      renderCallbackHtml(
        "Connector authorization failed",
        message,
        false
      ),
      {
        status: 500,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }
    );
  }
}
