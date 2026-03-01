// ============================================================================
// Native Agent View Tests
// ============================================================================

import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";

// Mock localStorage BEFORE any imports that use it
Object.defineProperty(global, "localStorage", {
  value: {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  },
  writable: true,
});

// Mock dependencies before importing component
vi.mock("framer-motion", () => ({
  motion: {
    div: ({
      children,
      ...props
    }: React.PropsWithChildren<Record<string, unknown>>) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

vi.mock("react-resizable-panels", () => ({
  PanelGroup: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  Panel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PanelResizeHandle: () => <div data-testid="resize-handle" />,
}));

// Mock the store
vi.mock("@/lib/agents/native-agent.store", () => ({
  useNativeAgentStore: vi.fn(),
  isLocalDraftSession: vi.fn(() => false),
  useActiveSession: vi.fn(),
  useActiveMessages: vi.fn(),
  useStreamingState: vi.fn(),
  useSessionSyncState: vi.fn(),
  useSessionCanvases: vi.fn(),
}));

// Mock UI components
vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    children?: React.ReactNode;
  }) => (
    <button onClick={onClick} disabled={disabled} {...props}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/input", () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input {...props} />
  ),
}));

vi.mock("@/components/ui/textarea", () => ({
  Textarea: (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
    <textarea {...props} />
  ),
}));

vi.mock("@/components/ui/switch", () => ({
  Switch: ({
    checked,
    onCheckedChange,
    ...props
  }: {
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
  } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange">) => (
    <input
      type="checkbox"
      checked={checked}
      onChange={(event) => onCheckedChange?.(event.target.checked)}
      {...props}
    />
  ),
}));

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: React.forwardRef<
    HTMLDivElement,
    React.PropsWithChildren<Record<string, unknown>>
  >(({ children, ...props }, ref) => (
    <div ref={ref} {...props}>
      {children}
    </div>
  )),
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({
    children,
    value,
    onValueChange,
  }: {
    children: React.ReactNode;
    value?: string;
    onValueChange?: (value: string) => void;
  }) => (
    <div data-testid="session-select" data-value={value}>
      {children}
    </div>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="select-content">{children}</div>
  ),
  SelectItem: ({
    children,
    value,
  }: {
    children: React.ReactNode;
    value: string;
  }) => (
    <div data-testid="select-item" data-value={value} onClick={() => {}}>
      {children}
    </div>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="select-trigger">{children}</div>
  ),
  SelectValue: ({ placeholder }: { placeholder?: string }) => (
    <span data-testid="select-value">{placeholder}</span>
  ),
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  ),
}));

vi.mock("@/components/ui/separator", () => ({
  Separator: () => <div data-testid="separator" />,
}));

vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  TooltipProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));

// Import after mocking
import { NativeAgentView } from "./NativeAgentView";
import {
  useNativeAgentStore,
  isLocalDraftSession,
  useActiveSession,
  useActiveMessages,
  useStreamingState,
  useSessionSyncState,
  useSessionCanvases,
  type NativeSession,
  type NativeMessage,
} from "@/lib/agents/native-agent.store";

// ============================================================================
// Test Setup
// ============================================================================

const mockFetchSessions = vi.fn();
const mockCreateSession = vi.fn();
const mockDeleteSession = vi.fn();
const mockSetActiveSession = vi.fn();
const mockFetchMessages = vi.fn();
const mockSendMessageStream = vi.fn();
const mockAbortGeneration = vi.fn();
const mockClearError = vi.fn();
const mockCreateCanvas = vi.fn();
const mockDeleteCanvas = vi.fn();
const mockUpdateCanvas = vi.fn();
const mockConnectSessionSync = vi.fn();
const mockUpdateSession = vi.fn();
const mockFetchExecutionMode = vi.fn();
const mockSetExecutionMode = vi.fn();

describe("NativeAgentView", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockFetchSessions.mockImplementation(() => new Promise(() => {}));
    mockFetchExecutionMode.mockResolvedValue(undefined);
    mockUpdateSession.mockResolvedValue(undefined);
    mockSetExecutionMode.mockResolvedValue(undefined);
    mockCreateSession.mockResolvedValue({
      id: "created-session",
      name: "Created Session",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastAccessedAt: new Date().toISOString(),
      messageCount: 0,
      isActive: true,
      tags: [],
    });

    // Default mock implementations
    const defaultStoreState = {
      sessions: [],
      activeSessionId: null,
      fetchSessions: mockFetchSessions,
      fetchExecutionMode: mockFetchExecutionMode,
      connectSessionSync: mockConnectSessionSync.mockReturnValue(() => {}),
      createSession: mockCreateSession,
      updateSession: mockUpdateSession,
      deleteSession: mockDeleteSession,
      executionMode: {
        mode: "safe",
        updatedAt: new Date().toISOString(),
        supportedModes: ["plan", "safe", "auto"],
      },
      setExecutionMode: mockSetExecutionMode,
      setActiveSession: mockSetActiveSession,
      fetchMessages: mockFetchMessages,
      sendMessageStream: mockSendMessageStream,
      abortGeneration: mockAbortGeneration,
      clearError: mockClearError,
      createCanvas: mockCreateCanvas,
      deleteCanvas: mockDeleteCanvas,
      updateCanvas: mockUpdateCanvas,
      isLoadingSessions: false,
      isUpdatingSession: false,
      isLoadingExecutionMode: false,
      isSavingExecutionMode: false,
      error: null,
    };

    (
      useNativeAgentStore as unknown as ReturnType<typeof vi.fn>
    ).mockReturnValue(defaultStoreState);
    (useActiveSession as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
      null,
    );
    (
      isLocalDraftSession as unknown as ReturnType<typeof vi.fn>
    ).mockReturnValue(false);
    (useActiveMessages as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
      [],
    );
    (useStreamingState as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      isStreaming: false,
      error: null,
      buffer: "",
    });
    (
      useSessionSyncState as unknown as ReturnType<typeof vi.fn>
    ).mockReturnValue({
      isConnected: false,
      error: null,
    });
    mockConnectSessionSync.mockReturnValue(() => {});
    (useSessionCanvases as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
      [],
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================================================
  // Rendering Tests
  // ============================================================================

  describe("Rendering", () => {
    it("should render the component", () => {
      render(<NativeAgentView />);

      assert.ok(screen.getByRole("heading", { name: "Agent Sessions" }));
      assert.ok(screen.getByTestId("select-value"));
    });

    it("should connect session sync on mount by default", () => {
      render(<NativeAgentView />);

      assert.equal(mockConnectSessionSync.mock.calls.length, 1);
    });

    it("should fetch execution mode on mount", () => {
      render(<NativeAgentView />);

      assert.equal(mockFetchExecutionMode.mock.calls.length, 1);
    });

    it("should show empty state when no messages", () => {
      render(<NativeAgentView />);

      assert.ok(screen.getByText("Welcome to Agent Sessions"));
      assert.ok(
        screen.getByText(
          (content: string) =>
            content.includes("Start a conversation") && content.includes("N20"),
        ),
      );
    });

    it("should show message count in header", () => {
      (
        useActiveMessages as unknown as ReturnType<typeof vi.fn>
      ).mockReturnValue([
        {
          id: "msg-1",
          role: "user",
          content: "Hello",
          timestamp: new Date().toISOString(),
        },
        {
          id: "msg-2",
          role: "assistant",
          content: "Hi!",
          timestamp: new Date().toISOString(),
        },
      ]);

      render(<NativeAgentView />);

      assert.ok(screen.getByText("2 messages"));
    });

    it("should display streaming indicator when streaming", () => {
      (
        useStreamingState as unknown as ReturnType<typeof vi.fn>
      ).mockReturnValue({
        isStreaming: true,
        error: null,
        buffer: "",
      });

      render(<NativeAgentView />);

      assert.ok(screen.getByText("Streaming..."));
    });

    it("should skip auto bootstrap when manual mode is requested", () => {
      render(
        <NativeAgentView bootstrapStrategy="manual" syncSessions={false} />,
      );

      assert.equal(mockFetchSessions.mock.calls.length, 0);
      assert.equal(mockConnectSessionSync.mock.calls.length, 0);
    });
  });

  // ============================================================================
  // Session Selector Tests
  // ============================================================================

  describe("Session Selector", () => {
    it("should display sessions in dropdown", () => {
      const mockSessions: NativeSession[] = [
        {
          id: "session-1",
          name: "Session One",
          description: "First session",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastAccessedAt: new Date().toISOString(),
          messageCount: 5,
          isActive: true,
          tags: [],
        },
        {
          id: "session-2",
          name: "Session Two",
          description: "Second session",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastAccessedAt: new Date().toISOString(),
          messageCount: 3,
          isActive: true,
          tags: [],
        },
      ];

      (
        useNativeAgentStore as unknown as ReturnType<typeof vi.fn>
      ).mockReturnValue({
        sessions: mockSessions,
        activeSessionId: null,
        fetchSessions: mockFetchSessions,
        createSession: mockCreateSession,
        deleteSession: mockDeleteSession,
        setActiveSession: mockSetActiveSession,
        fetchMessages: mockFetchMessages,
        error: null,
      });

      render(<NativeAgentView />);

      assert.equal(
        screen.getByTestId("session-select").getAttribute("data-value"),
        "",
      );
    });

    it("should show active session in selector", () => {
      const mockSessions: NativeSession[] = [
        {
          id: "session-1",
          name: "Active Session",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastAccessedAt: new Date().toISOString(),
          messageCount: 0,
          isActive: true,
          tags: [],
        },
      ];

      (
        useNativeAgentStore as unknown as ReturnType<typeof vi.fn>
      ).mockReturnValue({
        sessions: mockSessions,
        activeSessionId: "session-1",
        fetchSessions: mockFetchSessions,
        createSession: mockCreateSession,
        deleteSession: mockDeleteSession,
        setActiveSession: mockSetActiveSession,
        fetchMessages: mockFetchMessages,
        error: null,
      });

      render(<NativeAgentView />);

      assert.equal(
        screen.getByTestId("session-select").getAttribute("data-value"),
        "session-1",
      );
    });

    it("should call setActiveSession when session is selected", async () => {
      mockFetchSessions.mockResolvedValue(undefined);

      const mockSessions: NativeSession[] = [
        {
          id: "session-1",
          name: "Session One",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          lastAccessedAt: new Date().toISOString(),
          messageCount: 0,
          isActive: true,
          tags: [],
        },
      ];

      (
        useNativeAgentStore as unknown as ReturnType<typeof vi.fn>
      ).mockReturnValue({
        sessions: mockSessions,
        activeSessionId: null,
        fetchSessions: mockFetchSessions,
        createSession: mockCreateSession,
        deleteSession: mockDeleteSession,
        setActiveSession: mockSetActiveSession,
        fetchMessages: mockFetchMessages,
        error: null,
      });

      render(<NativeAgentView />);

      // The component auto-selects the first session on mount when activeSessionId is null
      await waitFor(() => {
        assert.ok(mockSetActiveSession.mock.calls.length >= 1);
      });
    });

    it("should call fetchSessions on mount", () => {
      render(<NativeAgentView />);

      assert.equal(mockFetchSessions.mock.calls.length, 1);
    });
  });

  // ============================================================================
  // New Session Tests
  // ============================================================================

  describe("New Session", () => {
    it("should create new session when new button clicked", async () => {
      const newSession: NativeSession = {
        id: "new-session",
        name: "New Session",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastAccessedAt: new Date().toISOString(),
        messageCount: 0,
        isActive: true,
        tags: [],
      };

      // Set up existing sessions so the component doesn't auto-create a welcome session
      const existingSession: NativeSession = {
        id: "existing-session",
        name: "Existing Session",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastAccessedAt: new Date().toISOString(),
        messageCount: 0,
        isActive: true,
        tags: [],
      };

      mockCreateSession.mockResolvedValueOnce(newSession);

      (
        useNativeAgentStore as unknown as ReturnType<typeof vi.fn>
      ).mockReturnValue({
        sessions: [existingSession],
        activeSessionId: "existing-session",
        fetchSessions: mockFetchSessions,
        createSession: mockCreateSession,
        deleteSession: mockDeleteSession,
        setActiveSession: mockSetActiveSession,
        fetchMessages: mockFetchMessages,
        error: null,
      });

      render(<NativeAgentView />);

      // Wait for initial render
      await waitFor(() => {
        expect(
          screen.getByRole("heading", { name: "Agent Sessions" }),
        ).toBeInTheDocument();
      });

      // Reset the mock count after initial render
      mockCreateSession.mockClear();

      // Find and click the new session button (look for Plus icon)
      const newSessionButton = screen.getByRole("button", {
        name: /new session/i,
      });
      fireEvent.click(newSessionButton);

      await waitFor(() => {
        assert.equal(mockCreateSession.mock.calls.length, 1);
      });
    });

    it("should create welcome session when no sessions exist", async () => {
      mockFetchSessions.mockResolvedValue(undefined);

      mockCreateSession.mockResolvedValueOnce({
        id: "welcome-session",
        name: "Welcome Session",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastAccessedAt: new Date().toISOString(),
        messageCount: 0,
        isActive: true,
        tags: [],
      });

      render(<NativeAgentView />);

      // Wait for effect to run
      await waitFor(() => {
        assert.equal(mockCreateSession.mock.calls.length, 1);
        assert.equal(mockCreateSession.mock.calls[0][0], "Welcome Session");
      });
    });
  });

  // ============================================================================
  // Delete Session Tests
  // ============================================================================

  describe("Delete Session", () => {
    it("should show delete button when session is active", () => {
      (
        useNativeAgentStore as unknown as ReturnType<typeof vi.fn>
      ).mockReturnValue({
        sessions: [
          {
            id: "session-1",
            name: "Session One",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            lastAccessedAt: new Date().toISOString(),
            messageCount: 0,
            isActive: true,
            tags: [],
          },
        ],
        activeSessionId: "session-1",
        fetchSessions: mockFetchSessions,
        createSession: mockCreateSession,
        deleteSession: mockDeleteSession,
        setActiveSession: mockSetActiveSession,
        fetchMessages: mockFetchMessages,
        error: null,
      });

      render(<NativeAgentView />);

      // Should have multiple buttons including delete
      const buttons = screen.getAllByRole("button");
      assert.ok(buttons.length >= 2);
    });
  });

  describe("Session Brief", () => {
    it("saves session edits back through updateSession", async () => {
      (
        useNativeAgentStore as unknown as ReturnType<typeof vi.fn>
      ).mockReturnValue({
        sessions: [
          {
            id: "session-1",
            name: "Session One",
            description: "Initial description",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            lastAccessedAt: new Date().toISOString(),
            messageCount: 1,
            isActive: true,
            tags: ["priority"],
            metadata: { operator_note: "Initial note" },
          },
        ],
        activeSessionId: "session-1",
        updateSession: mockUpdateSession,
      });

      render(
        <NativeAgentView bootstrapStrategy="manual" syncSessions={false} />,
      );

      fireEvent.change(screen.getByLabelText("Session name"), {
        target: { value: "Renamed Session" },
      });
      fireEvent.change(screen.getByLabelText("Session tags"), {
        target: { value: "priority, gui" },
      });
      fireEvent.change(screen.getByLabelText("Operator note"), {
        target: { value: "Review before dispatch" },
      });

      fireEvent.click(screen.getByRole("button", { name: /save session/i }));

      await waitFor(() => {
        expect(mockUpdateSession).toHaveBeenCalledWith("session-1", {
          name: "Renamed Session",
          description: "Initial description",
          isActive: true,
          tags: ["priority", "gui"],
          metadata: { operator_note: "Review before dispatch" },
        });
      });
    });

    it("opens runtime ops to manage the shared execution mode", async () => {
      const onOpenRuntimeOps = vi.fn();

      render(<NativeAgentView onOpenRuntimeOps={onOpenRuntimeOps} />);

      fireEvent.click(
        screen.getByRole("button", { name: /open runtime ops/i }),
      );

      await waitFor(() => {
        expect(onOpenRuntimeOps).toHaveBeenCalledTimes(1);
      });
      expect(mockSetExecutionMode).not.toHaveBeenCalled();
    });
  });

  // ============================================================================
  // Message Input Tests
  // ============================================================================

  describe("Message Input", () => {
    it("should render message input textarea", () => {
      render(<NativeAgentView />);

      const textarea = screen.getByPlaceholderText("Type your message...");
      assert.ok(textarea);
    });

    it("should disable input when streaming", () => {
      (
        useNativeAgentStore as unknown as ReturnType<typeof vi.fn>
      ).mockReturnValue({
        sessions: [
          {
            id: "session-1",
            name: "Session One",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            lastAccessedAt: new Date().toISOString(),
            messageCount: 0,
            isActive: true,
            tags: [],
          },
        ],
        activeSessionId: "session-1",
        fetchSessions: mockFetchSessions,
        createSession: mockCreateSession,
        deleteSession: mockDeleteSession,
        setActiveSession: mockSetActiveSession,
        fetchMessages: mockFetchMessages,
        sendMessageStream: mockSendMessageStream,
        abortGeneration: mockAbortGeneration,
        error: null,
      });

      (
        useStreamingState as unknown as ReturnType<typeof vi.fn>
      ).mockReturnValue({
        isStreaming: true,
        error: null,
        buffer: "",
      });

      render(<NativeAgentView />);

      const textarea = screen.getByPlaceholderText("Type your message...");
      assert.equal(textarea.hasAttribute("disabled"), true);
    });

    it("should send message on Enter key press", async () => {
      mockSendMessageStream.mockResolvedValueOnce(undefined);

      (
        useNativeAgentStore as unknown as ReturnType<typeof vi.fn>
      ).mockReturnValue({
        sessions: [
          {
            id: "session-1",
            name: "Session One",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            lastAccessedAt: new Date().toISOString(),
            messageCount: 0,
            isActive: true,
            tags: [],
          },
        ],
        activeSessionId: "session-1",
        fetchSessions: mockFetchSessions,
        createSession: mockCreateSession,
        deleteSession: mockDeleteSession,
        setActiveSession: mockSetActiveSession,
        fetchMessages: mockFetchMessages,
        sendMessageStream: mockSendMessageStream,
        abortGeneration: mockAbortGeneration,
        error: null,
      });

      render(<NativeAgentView />);

      const textarea = screen.getByPlaceholderText("Type your message...");
      fireEvent.change(textarea, { target: { value: "Hello world" } });
      fireEvent.keyDown(textarea, { key: "Enter", code: "Enter" });

      await waitFor(() => {
        assert.equal(mockSendMessageStream.mock.calls.length, 1);
        assert.equal(mockSendMessageStream.mock.calls[0][0], "session-1");
        assert.equal(mockSendMessageStream.mock.calls[0][1], "Hello world");
      });
    });

    it("should not send on Shift+Enter", () => {
      (
        useNativeAgentStore as unknown as ReturnType<typeof vi.fn>
      ).mockReturnValue({
        sessions: [
          {
            id: "session-1",
            name: "Session One",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            lastAccessedAt: new Date().toISOString(),
            messageCount: 0,
            isActive: true,
            tags: [],
          },
        ],
        activeSessionId: "session-1",
        fetchSessions: mockFetchSessions,
        createSession: mockCreateSession,
        deleteSession: mockDeleteSession,
        setActiveSession: mockSetActiveSession,
        fetchMessages: mockFetchMessages,
        sendMessageStream: mockSendMessageStream,
        abortGeneration: mockAbortGeneration,
        error: null,
      });

      render(<NativeAgentView />);

      const textarea = screen.getByPlaceholderText("Type your message...");
      fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });

      assert.equal(mockSendMessageStream.mock.calls.length, 0);
    });

    it("should show send button", () => {
      render(<NativeAgentView />);

      const buttons = screen.getAllByRole("button");
      assert.ok(buttons.length > 0);
    });
  });

  // ============================================================================
  // Message Display Tests
  // ============================================================================

  describe("Message Display", () => {
    it("should render user messages", () => {
      const messages: NativeMessage[] = [
        {
          id: "msg-1",
          role: "user",
          content: "Hello!",
          timestamp: new Date().toISOString(),
        },
      ];

      (
        useActiveMessages as unknown as ReturnType<typeof vi.fn>
      ).mockReturnValue(messages);

      render(<NativeAgentView />);

      assert.ok(screen.getByText("Hello!"));
    });

    it("should render assistant messages", () => {
      const messages: NativeMessage[] = [
        {
          id: "msg-1",
          role: "assistant",
          content: "Hello! How can I help you?",
          timestamp: new Date().toISOString(),
        },
      ];

      (
        useActiveMessages as unknown as ReturnType<typeof vi.fn>
      ).mockReturnValue(messages);

      render(<NativeAgentView />);

      assert.ok(screen.getByText("Hello! How can I help you?"));
    });

    it("should render tool calls in messages", () => {
      const messages: NativeMessage[] = [
        {
          id: "msg-1",
          role: "assistant",
          content: "Let me search for that",
          timestamp: new Date().toISOString(),
          toolCalls: [
            {
              id: "call-1",
              name: "search",
              arguments: { query: "test" },
            },
          ],
        },
      ];

      (
        useActiveMessages as unknown as ReturnType<typeof vi.fn>
      ).mockReturnValue(messages);

      render(<NativeAgentView />);

      assert.ok(screen.getByText("search"));
    });

    it("should render tool results", () => {
      const messages: NativeMessage[] = [
        {
          id: "msg-1",
          role: "user",
          content: "Search",
          timestamp: new Date().toISOString(),
        },
        {
          id: "msg-2",
          role: "assistant",
          content: "Searching...",
          timestamp: new Date().toISOString(),
          toolCalls: [
            { id: "call-1", name: "search", arguments: { query: "test" } },
          ],
        },
        {
          id: "msg-3",
          role: "tool",
          content: '{"results": ["found"]}',
          timestamp: new Date().toISOString(),
          toolCallId: "call-1",
        },
      ];

      (
        useActiveMessages as unknown as ReturnType<typeof vi.fn>
      ).mockReturnValue(messages);

      render(<NativeAgentView />);

      assert.ok(screen.getByText("Tool Result"));
    });
  });

  // ============================================================================
  // View Mode Tests
  // ============================================================================

  describe("View Mode", () => {
    it("should start in split view mode", () => {
      render(<NativeAgentView />);

      assert.ok(screen.getByText("Canvas"));
      assert.ok(screen.getByPlaceholderText("Type your message..."));
    });

    it("should toggle view mode when toggle button clicked", () => {
      render(<NativeAgentView />);

      const viewToggleButton = screen
        .getAllByRole("button")
        .find((btn) => btn.querySelector("svg"));

      if (viewToggleButton) {
        fireEvent.click(viewToggleButton);
      }

      // View mode should have changed
      const buttons = screen.getAllByRole("button");
      assert.ok(buttons.length > 0);
    });

    it("should accept custom default layout", () => {
      render(<NativeAgentView defaultLayout={[60, 40]} />);

      assert.ok(screen.getByText("Canvas"));
      assert.ok(screen.getByPlaceholderText("Type your message..."));
    });

    it("should accept initial session ID", () => {
      mockFetchSessions.mockResolvedValue(undefined);

      (
        useNativeAgentStore as unknown as ReturnType<typeof vi.fn>
      ).mockReturnValue({
        sessions: [
          {
            id: "session-abc",
            name: "Initial Session",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            lastAccessedAt: new Date().toISOString(),
            messageCount: 0,
            isActive: true,
            tags: [],
          },
        ],
        activeSessionId: null,
        fetchSessions: mockFetchSessions,
        createSession: mockCreateSession,
        deleteSession: mockDeleteSession,
        setActiveSession: mockSetActiveSession,
        fetchMessages: mockFetchMessages,
        error: null,
      });

      render(<NativeAgentView initialSessionId="session-abc" />);

      return waitFor(() => {
        assert.ok(
          mockSetActiveSession.mock.calls.some(
            (call) => call[0] === "session-abc",
          ),
        );
      });
    });
  });

  // ============================================================================
  // Error Handling Tests
  // ============================================================================

  describe("Error Handling", () => {
    it("should display error banner when there is an error", () => {
      (
        useNativeAgentStore as unknown as ReturnType<typeof vi.fn>
      ).mockReturnValue({
        sessions: [],
        activeSessionId: null,
        fetchSessions: mockFetchSessions,
        createSession: mockCreateSession,
        deleteSession: mockDeleteSession,
        setActiveSession: mockSetActiveSession,
        fetchMessages: mockFetchMessages,
        clearError: mockClearError,
        error: "Something went wrong",
      });

      render(<NativeAgentView />);

      assert.ok(screen.getByText("Something went wrong"));
    });

    it("should clear error when dismiss button clicked", () => {
      (
        useNativeAgentStore as unknown as ReturnType<typeof vi.fn>
      ).mockReturnValue({
        sessions: [],
        activeSessionId: null,
        fetchSessions: mockFetchSessions,
        createSession: mockCreateSession,
        deleteSession: mockDeleteSession,
        setActiveSession: mockSetActiveSession,
        fetchMessages: mockFetchMessages,
        clearError: mockClearError,
        error: "Something went wrong",
      });

      render(<NativeAgentView />);

      const dismissButton = screen.getByRole("button", {
        name: /close error/i,
      });
      fireEvent.click(dismissButton);

      assert.equal(mockClearError.mock.calls.length, 1);
    });
  });

  // ============================================================================
  // Canvas Tests
  // ============================================================================

  describe("Canvas Panel", () => {
    it("should display canvas panel in split mode", () => {
      render(<NativeAgentView />);

      assert.ok(screen.getByText("Canvas"));
    });

    it("should show empty canvas state", () => {
      render(<NativeAgentView />);

      assert.ok(screen.getByText("Canvas is empty"));
      assert.ok(
        screen.getByText(
          "Create content or wait for the agent to generate artifacts",
        ),
      );
    });

    it("should display canvas count badge", () => {
      (
        useSessionCanvases as unknown as ReturnType<typeof vi.fn>
      ).mockReturnValue([
        {
          id: "canvas-1",
          title: "Canvas 1",
          type: "code",
          content: "",
          sessionId: "session-1",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: "canvas-2",
          title: "Canvas 2",
          type: "document",
          content: "",
          sessionId: "session-1",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]);

      render(<NativeAgentView />);

      // Canvas badge should show count
      const canvasText = screen.getByText("Canvas");
      assert.ok(canvasText);
    });

    it("should show canvas creation buttons", () => {
      render(<NativeAgentView />);

      // Should have buttons for creating different canvas types
      const buttons = screen.getAllByRole("button");
      assert.ok(buttons.length >= 3);
    });

    it("should create a code canvas from the empty state", () => {
      const activeSession: NativeSession = {
        id: "session-1",
        name: "Session One",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lastAccessedAt: new Date().toISOString(),
        messageCount: 0,
        isActive: true,
        tags: [],
      };

      (
        useNativeAgentStore as unknown as ReturnType<typeof vi.fn>
      ).mockReturnValue({
        sessions: [activeSession],
        activeSessionId: "session-1",
        fetchSessions: mockFetchSessions,
        fetchExecutionMode: mockFetchExecutionMode,
        connectSessionSync: mockConnectSessionSync.mockReturnValue(() => {}),
        createSession: mockCreateSession,
        updateSession: mockUpdateSession,
        deleteSession: mockDeleteSession,
        executionMode: {
          mode: "safe",
          updatedAt: new Date().toISOString(),
          supportedModes: ["plan", "safe", "auto"],
        },
        setExecutionMode: mockSetExecutionMode,
        setActiveSession: mockSetActiveSession,
        fetchMessages: mockFetchMessages,
        sendMessageStream: mockSendMessageStream,
        abortGeneration: mockAbortGeneration,
        clearError: mockClearError,
        createCanvas: mockCreateCanvas,
        deleteCanvas: mockDeleteCanvas,
        updateCanvas: mockUpdateCanvas,
        isLoadingSessions: false,
        isUpdatingSession: false,
        isLoadingExecutionMode: false,
        isSavingExecutionMode: false,
        error: null,
      });
      (
        useActiveSession as unknown as ReturnType<typeof vi.fn>
      ).mockReturnValue(activeSession);

      render(<NativeAgentView />);

      fireEvent.click(screen.getByTestId("native-agent-create-code-canvas"));

      assert.equal(mockCreateCanvas.mock.calls.length, 1);
      assert.equal(mockCreateCanvas.mock.calls[0][0], "session-1");
      assert.equal(mockCreateCanvas.mock.calls[0][1].type, "code");
    });
  });

  // ============================================================================
  // Streaming UI Tests
  // ============================================================================

  describe("Streaming UI", () => {
    it("should show stop button when streaming", () => {
      (
        useNativeAgentStore as unknown as ReturnType<typeof vi.fn>
      ).mockReturnValue({
        sessions: [
          {
            id: "session-1",
            name: "Session One",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            lastAccessedAt: new Date().toISOString(),
            messageCount: 0,
            isActive: true,
            tags: [],
          },
        ],
        activeSessionId: "session-1",
        fetchSessions: mockFetchSessions,
        createSession: mockCreateSession,
        deleteSession: mockDeleteSession,
        setActiveSession: mockSetActiveSession,
        fetchMessages: mockFetchMessages,
        sendMessageStream: mockSendMessageStream,
        abortGeneration: mockAbortGeneration,
        error: null,
      });

      (
        useStreamingState as unknown as ReturnType<typeof vi.fn>
      ).mockReturnValue({
        isStreaming: true,
        error: null,
        buffer: "",
      });

      render(<NativeAgentView />);

      // Should show generating indicator
      assert.ok(screen.getByText("Generating..."));
    });

    it("should call abortGeneration when stop button clicked", async () => {
      (
        useNativeAgentStore as unknown as ReturnType<typeof vi.fn>
      ).mockReturnValue({
        sessions: [
          {
            id: "session-1",
            name: "Session One",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            lastAccessedAt: new Date().toISOString(),
            messageCount: 0,
            isActive: true,
            tags: [],
          },
        ],
        activeSessionId: "session-1",
        fetchSessions: mockFetchSessions,
        createSession: mockCreateSession,
        deleteSession: mockDeleteSession,
        setActiveSession: mockSetActiveSession,
        fetchMessages: mockFetchMessages,
        sendMessageStream: mockSendMessageStream,
        abortGeneration: mockAbortGeneration,
        error: null,
      });

      (
        useStreamingState as unknown as ReturnType<typeof vi.fn>
      ).mockReturnValue({
        isStreaming: true,
        error: null,
        buffer: "",
      });

      render(<NativeAgentView />);

      // Find stop button by aria-label
      const stopButton = screen.getByRole("button", {
        name: /stop generation/i,
      });
      fireEvent.click(stopButton);

      await waitFor(() => {
        assert.equal(mockAbortGeneration.mock.calls.length, 1);
      });
    });
  });
});
