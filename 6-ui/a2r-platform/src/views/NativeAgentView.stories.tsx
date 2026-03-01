import type { Meta, StoryObj } from "@storybook/react";
import { useRef } from "react";
import { NativeAgentView } from "./NativeAgentView";
import {
  useNativeAgentStore,
  type NativeSession,
  type NativeMessage,
  type Canvas,
} from "@/lib/agents/native-agent.store";

const meta: Meta<typeof NativeAgentView> = {
  title: "Views/Agent Sessions",
  component: NativeAgentView,
  parameters: {
    layout: "fullscreen",
    a2r: {
      componentId: "native-agent-view",
      evidence: {
        types: ["VISUAL_SNAPSHOT"],
        dagNode: "ui/views/native-agent",
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

const seededSessions: NativeSession[] = [
  {
    id: "session-alpha",
    name: "Strategic Review",
    description: "Primary working session",
    createdAt: "2026-02-27T00:00:00.000Z",
    updatedAt: "2026-02-27T00:12:00.000Z",
    lastAccessedAt: "2026-02-27T00:12:00.000Z",
    messageCount: 4,
    isActive: true,
    tags: ["priority"],
    metadata: {
      operator_note:
        "Hold this thread in safe mode until the GUI handoff is fully verified.",
    },
  },
  {
    id: "session-beta",
    name: "Sandbox Draft",
    description: "Secondary exploration session",
    createdAt: "2026-02-26T22:00:00.000Z",
    updatedAt: "2026-02-26T22:21:00.000Z",
    lastAccessedAt: "2026-02-26T22:21:00.000Z",
    messageCount: 2,
    isActive: false,
    tags: [],
  },
];

const seededMessages: Record<string, NativeMessage[]> = {
  "session-alpha": [
    {
      id: "msg-user-1",
      role: "user",
      content:
        "Review the runtime wiring status and highlight the riskiest remaining GUI gaps.",
      timestamp: "2026-02-27T00:02:00.000Z",
    },
    {
      id: "msg-assistant-1",
      role: "assistant",
      content:
        "The riskiest gaps were stale frontend contracts around sessions, workflow execution, replay, and prewarm. Those are now pointed at the real backend routes.",
      timestamp: "2026-02-27T00:03:00.000Z",
      toolCalls: [
        {
          id: "tool-1",
          name: "read_runtime_status",
          arguments: { surface: "prewarm" },
        },
      ],
    },
    {
      id: "msg-tool-1",
      role: "tool",
      content: '{"pool_size":2,"available":2,"in_use":0}',
      timestamp: "2026-02-27T00:03:04.000Z",
      toolCallId: "tool-1",
    },
    {
      id: "msg-assistant-2",
      role: "assistant",
      content:
        "The agent workspace is now using the same sand-glass surface language as the rest of the updated runtime views, so it reads like a native a2r screen rather than a bolt-on panel.",
      timestamp: "2026-02-27T00:05:00.000Z",
    },
  ],
};

const seededCanvases: Record<string, Canvas> = {
  "canvas-architecture": {
    id: "canvas-architecture",
    sessionId: "session-alpha",
    type: "document",
    title: "GUI Wiring Notes",
    content: `NativeAgentView
- Session boot now waits for the real list load
- Duplicate message fetches removed
- Canvas remains intentionally local until a backend canvas route exists`,
    createdAt: "2026-02-27T00:04:00.000Z",
    updatedAt: "2026-02-27T00:08:00.000Z",
  },
  "canvas-terminal": {
    id: "canvas-terminal",
    sessionId: "session-alpha",
    type: "terminal",
    title: "Runtime Console",
    content:
      "$ pnpm exec vitest run native-agent.store.test.ts NativeAgentView.test.tsx\nPASS 50 tests",
    createdAt: "2026-02-27T00:09:00.000Z",
    updatedAt: "2026-02-27T00:09:00.000Z",
  },
};

function seedStoryStore(streaming = false) {
  useNativeAgentStore.setState((state) => ({
    ...state,
    sessions: seededSessions,
    activeSessionId: "session-alpha",
    messages: seededMessages,
    canvases: seededCanvases,
    sessionCanvases: {
      "session-alpha": ["canvas-architecture", "canvas-terminal"],
    },
    executionMode: {
      mode: "safe",
      updatedAt: "2026-02-27T00:11:00.000Z",
      supportedModes: ["plan", "safe", "auto"],
    },
    streaming: {
      isStreaming: streaming,
      currentMessageId: streaming ? "msg-assistant-2" : null,
      abortController: null,
      error: null,
      streamBuffer: streaming ? "Finalizing the updated view…" : "",
    },
    error: null,
    isLoadingSessions: false,
    isUpdatingSession: false,
    isLoadingMessages: false,
    isLoadingTools: false,
    isExecutingTool: false,
    isLoadingExecutionMode: false,
    isSavingExecutionMode: false,
    isSessionSyncConnected: true,
    sessionSyncError: null,
    eventSource: null,
    fetchSessions: async () => {},
    fetchExecutionMode: async () => {},
    createSession: async () => seededSessions[0],
    updateSession: async (sessionId, updates) => {
      useNativeAgentStore.setState((currentState) => ({
        sessions: currentState.sessions.map((session) =>
          session.id === sessionId
            ? {
                ...session,
                name: updates.name ?? session.name,
                description: updates.description ?? session.description,
                isActive: updates.isActive ?? session.isActive,
                tags: updates.tags ?? session.tags,
                metadata: updates.metadata
                  ? { ...session.metadata, ...updates.metadata }
                  : session.metadata,
                updatedAt: new Date().toISOString(),
                lastAccessedAt: new Date().toISOString(),
              }
            : session,
        ),
      }));
    },
    deleteSession: async () => {},
    setExecutionMode: async (mode) => {
      useNativeAgentStore.setState((currentState) => ({
        executionMode: currentState.executionMode
          ? {
              ...currentState.executionMode,
              mode,
              updatedAt: new Date().toISOString(),
            }
          : {
              mode,
              updatedAt: new Date().toISOString(),
              supportedModes: ["plan", "safe", "auto"],
            },
      }));
    },
    setActiveSession: (sessionId: string | null) => {
      useNativeAgentStore.setState({ activeSessionId: sessionId });
    },
    fetchMessages: async () => {},
    sendMessage: async () => {},
    sendMessageStream: async () => {},
    abortGeneration: async () => {
      useNativeAgentStore.setState((currentState) => ({
        streaming: {
          ...currentState.streaming,
          isStreaming: false,
          currentMessageId: null,
        },
      }));
    },
    fetchTools: async () => {},
    executeTool: async () => ({
      toolCallId: "story-tool-call",
      result: { ok: true },
    }),
    createCanvas: async (sessionId, contentOrOptions, type, language) => {
      const nextCanvas: Canvas =
        typeof contentOrOptions === "string"
          ? {
              id: `canvas-${Date.now()}`,
              sessionId,
              content: contentOrOptions,
              type: type || "text",
              language,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }
          : {
              id: `canvas-${Date.now()}`,
              sessionId,
              content: contentOrOptions.content || "",
              type: contentOrOptions.type,
              title: contentOrOptions.title,
              language: contentOrOptions.language,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };

      useNativeAgentStore.setState((currentState) => ({
        canvases: {
          ...currentState.canvases,
          [nextCanvas.id]: nextCanvas,
        },
        sessionCanvases: {
          ...currentState.sessionCanvases,
          [sessionId]: [
            ...(currentState.sessionCanvases[sessionId] || []),
            nextCanvas.id,
          ],
        },
      }));

      return nextCanvas;
    },
    updateCanvas: async (canvasId, updates) => {
      useNativeAgentStore.setState((currentState) => ({
        canvases: {
          ...currentState.canvases,
          [canvasId]: {
            ...currentState.canvases[canvasId],
            ...updates,
            updatedAt: new Date().toISOString(),
          },
        },
      }));
    },
    deleteCanvas: async (canvasId) => {
      useNativeAgentStore.setState((currentState) => {
        const nextCanvases = { ...currentState.canvases };
        const canvas = nextCanvases[canvasId];
        delete nextCanvases[canvasId];

        return {
          canvases: nextCanvases,
          sessionCanvases: {
            ...currentState.sessionCanvases,
            [canvas?.sessionId || "session-alpha"]: (
              currentState.sessionCanvases[
                canvas?.sessionId || "session-alpha"
              ] || []
            ).filter((id) => id !== canvasId),
          },
        };
      });
    },
    fetchSessionCanvases: async () => {},
    connectSessionSync: () => () => {},
    disconnectSessionSync: () => {},
    connectStream: () => () => {},
    disconnectStream: () => {},
    clearError: () => useNativeAgentStore.setState({ error: null }),
    clearMessages: () => {},
    resetStreaming: () => {},
  }));
}

function SeededNativeAgentView({ streaming = false }: { streaming?: boolean }) {
  const hasSeeded = useRef(false);

  if (!hasSeeded.current) {
    seedStoryStore(streaming);
    hasSeeded.current = true;
  }

  return (
    <NativeAgentView
      bootstrapStrategy="manual"
      syncSessions={false}
      onOpenRuntimeOps={() => {}}
    />
  );
}

export const ConversationWorkbench: Story = {
  render: () => <SeededNativeAgentView />,
};

export const StreamingWorkbench: Story = {
  render: () => <SeededNativeAgentView streaming />,
};
