import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  GizziRuntimeError,
  openGizziEventStream,
  requestGizziJson,
} from "@/lib/gizzi-runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type GizziSessionInfo = {
  id: string;
  title?: string;
  projectID?: string;
  directory?: string;
  version?: string;
  agentID?: string;
  surface?: "chat" | "cowork" | "code" | "browser";
  permission?: unknown;
  time?: {
    created?: number;
    updated?: number;
    archived?: number;
  };
};

type GizziMessageInfo = {
  id: string;
  sessionID: string;
  role: string;
  time?: {
    created?: number;
    completed?: number;
  };
  agent?: string;
  model?: {
    providerID?: string;
    modelID?: string;
  };
  error?: {
    name?: string;
    message?: string;
    data?: unknown;
  };
};

type GizziMessagePart = {
  type: string;
  text?: string;
  filename?: string;
  url?: string;
  tool?: string;
  state?: {
    status?: string;
    output?: unknown;
  };
};

type GizziMessage = {
  info: GizziMessageInfo;
  parts: GizziMessagePart[];
};

type GizziBusEvent = {
  type?: string;
  properties?: Record<string, unknown>;
};

// Permission request shape (matches PermissionNext.Request)
type GizziPermissionRequest = {
  id: string;
  sessionID: string;
  permission: string;
  patterns: string[];
  metadata: Record<string, unknown>;
  always: string[];
  tool?: { messageID: string; callID: string };
};

// Question request shape (matches Question.Request)
type GizziQuestionRequest = {
  id: string;
  sessionID: string;
  questions: Array<{
    header: string;
    question: string;
    options: Array<{ label: string; description: string }>;
    custom?: boolean;
    multiple?: boolean;
  }>;
};

// Part-level event property shapes from gizzi-code bus
type GizziPartUpdatedProps = {
  sessionID: string;
  messageID: string;
  part: Record<string, unknown>;
};

type GizziPartDeltaProps = {
  sessionID: string;
  messageID: string;
  partID: string;
  field: string;
  delta: string;
};

type GizziPartRemovedProps = {
  sessionID: string;
  messageID: string;
  partID: string;
};

function toRouteError(error: unknown): Response {
  if (error instanceof GizziRuntimeError) {
    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
        details: error.details,
      },
      { status: error.statusCode },
    );
  }

  return NextResponse.json(
    { error: "Runtime backend request failed" },
    { status: 500 },
  );
}

function toIso(timestamp?: number): string {
  return new Date(timestamp ?? 0).toISOString();
}

function transformSession(info: GizziSessionInfo) {
  const createdAt = toIso(info.time?.created);
  const updatedAt = toIso(info.time?.updated ?? info.time?.created);

  return {
    id: info.id,
    name: info.title,
    description: undefined,
    created_at: createdAt,
    updated_at: updatedAt,
    last_accessed: updatedAt,
    message_count: 0,
    active: !info.time?.archived,
    tags: [],
    metadata: {
      project_id: info.projectID,
      directory: info.directory,
      version: info.version,
      agent_id: info.agentID,
      surface: info.surface,
      permission: info.permission,
    },
  };
}

function extractMessageContent(parts: GizziMessagePart[]): string {
  const textParts = parts
    .map((part) => {
      if (
        (part.type === "text" || part.type === "reasoning") &&
        typeof part.text === "string"
      ) {
        return part.text;
      }

      if (part.type === "file") {
        return `[File ${part.filename ?? part.url ?? "attachment"}]`;
      }

      if (part.type === "agent" && typeof part.text === "string") {
        return part.text;
      }

      if (part.type === "tool" && part.tool) {
        return `[Tool ${part.tool}]`;
      }

      return null;
    })
    .filter((value): value is string => Boolean(value));

  if (textParts.length > 0) {
    return textParts.join("\n");
  }

  return "";
}

function transformMessage(message: GizziMessage) {
  return {
    id: message.info.id,
    role: message.info.role,
    content:
      extractMessageContent(message.parts) ||
      message.info.error?.message ||
      "[No text content]",
    timestamp: toIso(
      message.info.time?.completed ?? message.info.time?.created,
    ),
    metadata: {
      agent: message.info.agent,
      model: message.info.model,
      parts: message.parts,
      error: message.info.error,
    },
  };
}

async function fetchLatestMessage(sessionId: string) {
  const messages = await requestGizziJson<GizziMessage[]>(
    `/v1/session/${encodeURIComponent(sessionId)}/messages`,
  );
  const latest = messages.at(-1);
  return latest ? transformMessage(latest) : null;
}

async function transformBusEvent(event: GizziBusEvent) {
  const info = event.properties?.info as GizziSessionInfo | undefined;

  switch (event.type) {
    case "session.created": {
      if (!info) return null;
      return {
        type: "created",
        ...transformSession(info),
      };
    }

    case "session.updated": {
      if (!info) return null;
      return {
        type: "updated",
        session_id: info.id,
        name: info.title ?? null,
        description: null,
        active: !info.time?.archived,
        tags: [],
        metadata: {
          project_id: info.projectID,
          directory: info.directory,
          version: info.version,
          agent_id: info.agentID,
          surface: info.surface,
          permission: info.permission,
        },
      };
    }

    case "session.deleted": {
      if (!info) return null;
      return {
        type: "deleted",
        session_id: info.id,
      };
    }

    case "message.updated": {
      const messageInfo = event.properties?.info as GizziMessageInfo | undefined;
      if (!messageInfo?.sessionID) return null;

      const latestMessage = await fetchLatestMessage(messageInfo.sessionID).catch(
        () => null,
      );
      if (!latestMessage) return null;

      return {
        type: "message_added",
        session_id: messageInfo.sessionID,
        ...latestMessage,
      };
    }

    case "permission.asked": {
      const req = event.properties as GizziPermissionRequest | undefined;
      if (!req?.id || !req.sessionID) return null;
      return {
        type: "permission_asked",
        request_id: req.id,
        session_id: req.sessionID,
        permission: req.permission,
        patterns: req.patterns,
        metadata: req.metadata,
        always: req.always,
        tool: req.tool,
      };
    }

    case "permission.replied": {
      const props = event.properties as { sessionID?: string; requestID?: string; reply?: string } | undefined;
      if (!props?.requestID) return null;
      return {
        type: "permission_replied",
        request_id: props.requestID,
        session_id: props.sessionID,
        reply: props.reply,
      };
    }

    case "question.asked": {
      const req = event.properties as GizziQuestionRequest | undefined;
      if (!req?.id || !req.sessionID) return null;
      return {
        type: "question_asked",
        request_id: req.id,
        session_id: req.sessionID,
        questions: req.questions,
      };
    }

    case "message.part.updated": {
      const props = event.properties as GizziPartUpdatedProps | undefined;
      if (!props?.sessionID || !props.messageID || !props.part) return null;
      return {
        type: "part_updated",
        session_id: props.sessionID,
        message_id: props.messageID,
        part: props.part,
      };
    }

    case "message.part.delta": {
      const props = event.properties as GizziPartDeltaProps | undefined;
      if (!props?.sessionID || !props.messageID || !props.partID) return null;
      return {
        type: "part_delta",
        session_id: props.sessionID,
        message_id: props.messageID,
        part_id: props.partID,
        field: props.field,
        delta: props.delta,
      };
    }

    case "message.part.removed": {
      const props = event.properties as GizziPartRemovedProps | undefined;
      if (!props?.sessionID || !props.messageID || !props.partID) return null;
      return {
        type: "part_removed",
        session_id: props.sessionID,
        message_id: props.messageID,
        part_id: props.partID,
      };
    }

    default:
      return null;
  }
}

function parseSseDataBlock(block: string): string | null {
  const lines = block.split(/\r?\n/);
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trimStart());
    }
  }

  if (dataLines.length === 0) {
    return null;
  }

  return dataLines.join("\n");
}

async function getPathSegments(
  context: { params: Promise<{ path?: string[] }> },
): Promise<string[]> {
  const params = await context.params;
  return params.path ?? [];
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> },
): Promise<Response> {
  try {
    const path = await getPathSegments(context);

    if (path.length === 0) {
      const sessions = await requestGizziJson<GizziSessionInfo[]>(
        "/v1/session/list",
      );
      const normalized = sessions.map(transformSession);
      return NextResponse.json({
        sessions: normalized,
        count: normalized.length,
      });
    }

    if (path.length === 1 && path[0] === "sync") {
      const upstream = await openGizziEventStream("/v1/event");
      if (!upstream.body) {
        return NextResponse.json(
          { error: "Runtime event stream is unavailable" },
          { status: 503 },
        );
      }

      const encoder = new TextEncoder();
      const decoder = new TextDecoder();
      const upstreamReader = upstream.body.getReader();

      const stream = new ReadableStream({
        async start(controller) {
          controller.enqueue(encoder.encode(": connected\n\n"));
          let buffer = "";

          const abort = () => {
            upstreamReader.cancel().catch(() => {
              // Upstream stream already closed.
            });
          };

          request.signal.addEventListener("abort", abort);

          try {
            while (true) {
              const { done, value } = await upstreamReader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });
              const blocks = buffer.split(/\r?\n\r?\n/);
              buffer = blocks.pop() ?? "";

              for (const block of blocks) {
                const data = parseSseDataBlock(block);
                if (!data) continue;

                let parsed: GizziBusEvent;
                try {
                  parsed = JSON.parse(data) as GizziBusEvent;
                } catch {
                  continue;
                }

                if (parsed.type === "server.heartbeat") {
                  controller.enqueue(encoder.encode(": heartbeat\n\n"));
                  continue;
                }

                const transformed = await transformBusEvent(parsed);
                if (!transformed) continue;

                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify(transformed)}\n\n`),
                );
              }
            }
          } finally {
            request.signal.removeEventListener("abort", abort);
            try {
              controller.close();
            } catch {
              // Stream already closed.
            }
          }
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    if (path.length === 1) {
      const session = await requestGizziJson<GizziSessionInfo>(
        `/v1/session/${encodeURIComponent(path[0])}`,
      );
      return NextResponse.json(transformSession(session));
    }

    if (path.length === 2 && path[1] === "messages") {
      const messages = await requestGizziJson<GizziMessage[]>(
        `/v1/session/${encodeURIComponent(path[0])}/messages`,
      );
      return NextResponse.json(messages.map(transformMessage));
    }

    return NextResponse.json({ error: "Not found" }, { status: 404 });
  } catch (error) {
    return toRouteError(error);
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> },
): Promise<Response> {
  try {
    const path = await getPathSegments(context);
    const body = await request.json().catch(() => ({}));

    if (path.length === 0) {
      const session = await requestGizziJson<GizziSessionInfo>("/v1/session", {
        method: "POST",
        body: {
          title: body.name || body.title || "New Session",
          agentID: body.agent_id ?? body.agentId,
          surface: body.surface ?? body.metadata?.surface,
        },
      });
      return NextResponse.json(transformSession(session));
    }

    if (path.length === 2 && path[1] === "messages") {
      const role = String(body.role || "user");
      if (role !== "user") {
        return NextResponse.json(
          {
            error:
              "Only user message injection is supported by the runtime session prompt API.",
          },
          { status: 501 },
        );
      }

      const message = await requestGizziJson<GizziMessage>(
        `/v1/session/${encodeURIComponent(path[0])}/message`,
        {
          method: "POST",
          body: {
            noReply: true,
            parts: [
              {
                type: "text",
                text: String(body.text || ""),
              },
            ],
          },
        },
      );
      return NextResponse.json(transformMessage(message));
    }

    if (path.length === 2 && path[1] === "abort") {
      await requestGizziJson(`/v1/session/${encodeURIComponent(path[0])}/abort`, {
        method: "POST",
        body: {},
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Not found" }, { status: 404 });
  } catch (error) {
    return toRouteError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> },
): Promise<Response> {
  try {
    const path = await getPathSegments(context);
    if (path.length !== 1) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const session = await requestGizziJson<GizziSessionInfo>(
      `/v1/session/${encodeURIComponent(path[0])}`,
      {
        method: "PATCH",
        body: {
          title: body.name,
          archived:
            typeof body.active === "boolean" ? !body.active : undefined,
          permission: body.metadata?.permission,
          surface: body.metadata?.surface ?? body.surface,
        },
      },
    );

    return NextResponse.json(transformSession(session));
  } catch (error) {
    return toRouteError(error);
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ path?: string[] }> },
): Promise<Response> {
  try {
    const path = await getPathSegments(context);
    if (path.length !== 1) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await requestGizziJson(`/v1/session/${encodeURIComponent(path[0])}`, {
      method: "DELETE",
    });
    return new Response(null, { status: 204 });
  } catch (error) {
    return toRouteError(error);
  }
}
