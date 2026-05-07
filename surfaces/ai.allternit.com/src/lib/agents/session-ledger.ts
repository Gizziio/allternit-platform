export type SessionSurface = "chat" | "cowork" | "code" | "browser" | "design";

export type SessionEventActor = "user" | "assistant" | "tool" | "system" | "ui";

export type SessionEventType =
  | "session.created"
  | "session.updated"
  | "message.created"
  | "message.delta"
  | "message.completed"
  | "tool.call.started"
  | "tool.call.completed"
  | "tool.call.failed"
  | "artifact.created"
  | "artifact.updated"
  | "observation.created"
  | "action.started"
  | "action.completed"
  | "action.failed"
  | "ui.surface.changed"
  | "ui.panel.toggled"
  | "ui.view.changed"
  | "ui.selection.changed"
  | "agent.mode.changed"
  | "agent.profile.selected"
  | "agent.capabilities.changed"
  | "session.intent.changed"
  | "context.snapshot.created"
  | "summary.created"
  | "browser.nav.started"
  | "browser.nav.completed"
  | "browser.tab.created"
  | "browser.tab.closed"
  | "browser.dom.observed"
  | "code.file.opened"
  | "code.file.edited"
  | "code.diff.created"
  | "cowork.task.created"
  | "cowork.task.updated"
  | "presence.updated";

export interface SessionEvent {
  id: string;
  sessionId: string;
  runId?: string;
  parentEventId?: string;
  causationEventId?: string;
  correlationId?: string;
  surface?: SessionSurface;
  actor: SessionEventActor;
  type: SessionEventType;
  subtype?: string;
  payload: Record<string, unknown>;
  createdAt: string;
  seq: number;
}

export interface SessionEventEnvelope {
  sessionId: string;
  seq: number;
  event: SessionEvent;
}

export interface SessionProjectionCache {
  chat?: {
    messageIds: string[];
  };
  cowork?: {
    taskIds: string[];
    activeTaskId?: string;
  };
  code?: {
    activeFile?: string;
    touchedFiles: string[];
  };
  browser?: {
    activeTabId?: string;
    urls: string[];
  };
}

export function createEmptyProjectionCache(): SessionProjectionCache {
  return {
    chat: { messageIds: [] },
    cowork: { taskIds: [] },
    code: { touchedFiles: [] },
    browser: { urls: [] },
  };
}

export function isBehavioralUiEvent(type: SessionEventType): boolean {
  return (
    type === "ui.surface.changed" ||
    type === "ui.panel.toggled" ||
    type === "ui.view.changed" ||
    type === "ui.selection.changed" ||
    type === "agent.mode.changed" ||
    type === "agent.profile.selected" ||
    type === "agent.capabilities.changed"
  );
}
