// ============================================================================
// A2UI Generation API - Request agent to generate A2UI payload
// ============================================================================
// POST /api/a2ui/generate - Request agent to generate A2UI from prompt
// ============================================================================

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth-sqlite";
import { db } from "@/lib/db/client-sqlite";
import { a2uiSession, chat } from "@/lib/db/schema-sqlite";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";

const KERNEL_URL = process.env.NEXT_PUBLIC_KERNEL_URL || "http://127.0.0.1:3004";

export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    const userId = session?.user?.id || "anonymous";

    const body = await req.json();
    const { chat_id, prompt, context = {} } = body;

    if (!chat_id || !prompt) {
      return NextResponse.json(
        { error: "Missing required fields: chat_id, prompt" },
        { status: 400 }
      );
    }

    // Verify chat exists and belongs to user
    const [chatRecord] = await db
      .select()
      .from(chat)
      .where(and(eq(chat.id, chat_id), eq(chat.userId, userId)))
      .limit(1);

    if (!chatRecord) {
      return NextResponse.json(
        { error: "Chat not found" },
        { status: 404 }
      );
    }

    // Request agent to generate A2UI payload via kernel
    let generatedPayload;
    let agentResponse;

    try {
      const kernelResponse = await fetch(`${KERNEL_URL}/v1/a2ui/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id,
          prompt,
          context: {
            ...context,
            chat_history: chatRecord.kernelSessionId || undefined,
          },
        }),
      });

      if (kernelResponse.ok) {
        agentResponse = await kernelResponse.json();
        generatedPayload = agentResponse.payload;
      } else {
        // Kernel doesn't have A2UI generation endpoint - use mock for development
        console.log(`[A2UI Generate] Kernel A2UI generate not available, using mock`);
        generatedPayload = mockGenerateA2UI(prompt, context);
      }
    } catch (kernelError) {
      // Kernel not available - use mock for development
      console.log(`[A2UI Generate] Kernel not available, using mock`);
      generatedPayload = mockGenerateA2UI(prompt, context);
    }

    // Validate generated payload
    if (!generatedPayload || !generatedPayload.version || !generatedPayload.surfaces) {
      return NextResponse.json(
        { error: "Agent returned invalid A2UI payload" },
        { status: 500 }
      );
    }

    // Create A2UI session with generated payload
    const sessionId = nanoid();
    const now = new Date();

    const [newSession] = await db
      .insert(a2uiSession)
      .values({
        id: sessionId,
        chatId: chat_id,
        userId,
        agentId: agentResponse?.agent_id || null,
        payload: JSON.stringify(generatedPayload),
        dataModel: JSON.stringify(context.dataModel || {}),
        status: "active",
        source: "agent_generated",
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    console.log(`[A2UI Generate] Created session ${sessionId} for chat ${chat_id}`);

    return NextResponse.json({
      sessionId: newSession.id,
      payload: generatedPayload,
      dataModel: context.dataModel || {},
      createdAt: newSession.createdAt,
    });
  } catch (error) {
    console.error("[A2UI Generate] POST error:", error);
    return NextResponse.json(
      { error: "Failed to generate A2UI", details: String(error) },
      { status: 500 }
    );
  }
}

// Mock A2UI generator for development
function mockGenerateA2UI(
  prompt: string,
  context: Record<string, unknown>
): Record<string, unknown> {
  console.log(`[A2UI Mock] Generating for prompt: ${prompt}`);

  // Simple keyword-based mock responses
  const lowerPrompt = prompt.toLowerCase();

  if (lowerPrompt.includes("form") || lowerPrompt.includes("input")) {
    return generateFormPayload(prompt, context);
  }

  if (lowerPrompt.includes("chart") || lowerPrompt.includes("graph")) {
    return generateChartPayload(prompt, context);
  }

  if (lowerPrompt.includes("table") || lowerPrompt.includes("list")) {
    return generateTablePayload(prompt, context);
  }

  // Default card layout
  return generateDefaultPayload(prompt, context);
}

function generateFormPayload(
  prompt: string,
  context: Record<string, unknown>
): Record<string, unknown> {
  return {
    version: "1.0",
    surfaces: [
      {
        id: "main",
        title: "Generated Form",
        components: [
          {
            type: "Container",
            props: {
              direction: "column",
              padding: 24,
              gap: 16,
            },
            children: [
              {
                type: "Text",
                props: {
                  content: prompt,
                  variant: "title",
                },
              },
              {
                type: "TextField",
                props: {
                  label: "Name",
                  valuePath: "form.name",
                  placeholder: "Enter your name",
                },
              },
              {
                type: "TextField",
                props: {
                  label: "Description",
                  valuePath: "form.description",
                  multiline: true,
                  placeholder: "Enter description",
                },
              },
              {
                type: "Stack",
                props: {
                  direction: "row",
                  gap: 8,
                  justify: "end",
                },
                children: [
                  {
                    type: "Button",
                    props: {
                      label: "Cancel",
                      variant: "secondary",
                      action: "cancel",
                    },
                  },
                  {
                    type: "Button",
                    props: {
                      label: "Submit",
                      variant: "primary",
                      action: "submit",
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
    dataModel: {
      form: {
        name: context.name || "",
        description: context.description || "",
      },
    },
  };
}

function generateChartPayload(
  prompt: string,
  context: Record<string, unknown>
): Record<string, unknown> {
  return {
    version: "1.0",
    surfaces: [
      {
        id: "main",
        title: "Generated Chart",
        components: [
          {
            type: "Container",
            props: {
              direction: "column",
              padding: 24,
            },
            children: [
              {
                type: "Text",
                props: {
                  content: prompt,
                  variant: "title",
                },
              },
              {
                type: "Chart",
                props: {
                  type: "line",
                  dataPath: "chartData",
                  xAxis: { key: "label", type: "category" },
                  series: [
                    { key: "value", name: "Value", color: "#007aff" },
                  ],
                  height: 300,
                },
              },
            ],
          },
        ],
      },
    ],
    dataModel: {
      chartData: context.chartData || [
        { label: "Jan", value: 100 },
        { label: "Feb", value: 150 },
        { label: "Mar", value: 120 },
        { label: "Apr", value: 180 },
      ],
    },
  };
}

function generateTablePayload(
  prompt: string,
  context: Record<string, unknown>
): Record<string, unknown> {
  return {
    version: "1.0",
    surfaces: [
      {
        id: "main",
        title: "Generated Table",
        components: [
          {
            type: "Container",
            props: {
              direction: "column",
              padding: 24,
            },
            children: [
              {
                type: "Text",
                props: {
                  content: prompt,
                  variant: "title",
                },
              },
              {
                type: "DataTable",
                props: {
                  dataPath: "tableData",
                  columns: [
                    { key: "name", header: "Name" },
                    { key: "status", header: "Status" },
                    { key: "value", header: "Value", align: "right" },
                  ],
                },
              },
            ],
          },
        ],
      },
    ],
    dataModel: {
      tableData: context.tableData || [
        { name: "Item 1", status: "Active", value: 100 },
        { name: "Item 2", status: "Pending", value: 200 },
        { name: "Item 3", status: "Done", value: 150 },
      ],
    },
  };
}

function generateDefaultPayload(
  prompt: string,
  context: Record<string, unknown>
): Record<string, unknown> {
  return {
    version: "1.0",
    surfaces: [
      {
        id: "main",
        title: "Generated UI",
        components: [
          {
            type: "Card",
            props: {
              title: prompt.slice(0, 50),
            },
            children: [
              {
                type: "Text",
                props: {
                  content:
                    "This is a generated A2UI interface based on your request.",
                },
              },
              {
                type: "Stack",
                props: {
                  direction: "row",
                  gap: 8,
                },
                children: [
                  {
                    type: "Button",
                    props: {
                      label: "OK",
                      variant: "primary",
                      action: "confirm",
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
    dataModel: context.dataModel || {},
  };
}
