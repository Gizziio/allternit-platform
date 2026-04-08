"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { createA2RClient } from "@allternit/sdk";

export interface PermissionRequest {
  id: string;
  sessionID: string;
  permission: string;
  patterns: string[];
  metadata: Record<string, unknown>;
  always: string[];
  tool?: { messageID: string; callID: string };
}

export interface QuestionOption {
  label: string;
  description: string;
}

export interface QuestionItem {
  question: string;
  header: string;
  options: QuestionOption[];
  multiple?: boolean;
  custom?: boolean;
}

export interface QuestionRequest {
  id: string;
  sessionID: string;
  questions: QuestionItem[];
  tool?: { messageID: string; callID: string };
}

export interface TodoItem {
  content: string;
  status: "pending" | "in_progress" | "completed" | "cancelled";
  priority: "high" | "medium" | "low";
}

interface ComposerState {
  permissionRequest: PermissionRequest | null;
  questionRequest: QuestionRequest | null;
  todos: TodoItem[];
  todosDismissed: boolean;
}

type ComposerAction =
  | { type: "permission_asked"; payload: PermissionRequest }
  | { type: "permission_replied"; payload: { requestID: string } }
  | { type: "question_asked"; payload: QuestionRequest }
  | { type: "question_closed"; payload: { requestID: string } }
  | { type: "todo_updated"; payload: TodoItem[] }
  | { type: "dismiss_todos" }
  | { type: "reset" };

const INITIAL_STATE: ComposerState = {
  permissionRequest: null,
  questionRequest: null,
  todos: [],
  todosDismissed: false,
};

function reducer(state: ComposerState, action: ComposerAction): ComposerState {
  switch (action.type) {
    case "permission_asked":
      return { ...state, permissionRequest: action.payload };
    case "permission_replied":
      if (state.permissionRequest?.id === action.payload.requestID) {
        return { ...state, permissionRequest: null };
      }
      return state;
    case "question_asked":
      return { ...state, questionRequest: action.payload };
    case "question_closed":
      if (state.questionRequest?.id === action.payload.requestID) {
        return { ...state, questionRequest: null };
      }
      return state;
    case "todo_updated":
      return { ...state, todos: action.payload, todosDismissed: false };
    case "dismiss_todos":
      return { ...state, todosDismissed: true };
    case "reset":
      return INITIAL_STATE;
    default:
      return state;
  }
}

function normalizeTodos(raw: unknown[]): TodoItem[] {
  const VALID_STATUS = new Set(["pending", "in_progress", "completed", "cancelled"]);
  const VALID_PRIORITY = new Set(["high", "medium", "low"]);
  return raw.map((t) => {
    const item = t as Record<string, unknown>;
    const status = String(item["status"] ?? "pending");
    const priority = String(item["priority"] ?? "medium");
    return {
      content: String(item["content"] ?? ""),
      status: (VALID_STATUS.has(status) ? status : "pending") as TodoItem["status"],
      priority: (VALID_PRIORITY.has(priority) ? priority : "medium") as TodoItem["priority"],
    };
  });
}

export interface SessionComposerStateReturn {
  permissionRequest: PermissionRequest | null;
  questionRequest: QuestionRequest | null;
  todos: TodoItem[];
  allTodosDone: boolean;
  blocked: boolean;
  todosVisible: boolean;
  replyPermission: (reply: "once" | "always" | "reject", message?: string) => Promise<void>;
  replyQuestion: (answers: string[][]) => Promise<void>;
  rejectQuestion: () => Promise<void>;
  dismissTodos: () => void;
}

export function useSessionComposerState(
  serverUrl: string,
  sessionID: string,
): SessionComposerStateReturn {
  const [state, dispatch] = useReducer(reducer, INITIAL_STATE);

  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryCountRef = useRef(0);
  const esRef = useRef<EventSource | null>(null);
  const destroyedRef = useRef(false);

  const connect = useCallback(() => {
    if (destroyedRef.current) return;
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }

    const es = new EventSource(`${serverUrl}/v1/global/event`);
    esRef.current = es;

    es.onmessage = (e: MessageEvent<string>) => {
      retryCountRef.current = 0;
      let parsed: { type: string; properties: Record<string, unknown> };
      try {
        parsed = JSON.parse(e.data);
      } catch {
        return;
      }

      const { type, properties: props } = parsed;
      if (!props || props["sessionID"] !== sessionID) return;

      switch (type) {
        case "permission.asked":
          dispatch({
            type: "permission_asked",
            payload: props as unknown as PermissionRequest,
          });
          break;
        case "permission.replied":
          dispatch({
            type: "permission_replied",
            payload: { requestID: props["requestID"] as string },
          });
          break;
        case "question.asked":
          dispatch({
            type: "question_asked",
            payload: props as unknown as QuestionRequest,
          });
          break;
        case "question.replied":
        case "question.rejected":
          dispatch({
            type: "question_closed",
            payload: { requestID: props["requestID"] as string },
          });
          break;
        case "todo.updated":
          dispatch({
            type: "todo_updated",
            payload: normalizeTodos((props["todos"] as unknown[]) ?? []),
          });
          break;
      }
    };

    es.onerror = () => {
      es.close();
      esRef.current = null;
      if (destroyedRef.current) return;
      const delay = Math.min(30_000, Math.pow(2, retryCountRef.current) * 1_000);
      retryCountRef.current++;
      retryTimeoutRef.current = setTimeout(connect, delay);
    };
  }, [serverUrl, sessionID]);

  useEffect(() => {
    destroyedRef.current = false;
    retryCountRef.current = 0;
    dispatch({ type: "reset" });
    connect();

    return () => {
      destroyedRef.current = true;
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
    };
  }, [connect]);

  const sdk = useMemo(() => createA2RClient({ baseUrl: `${serverUrl}/v1` }), [serverUrl]);

  const replyPermission = useCallback(
    async (reply: "once" | "always" | "reject", message?: string) => {
      if (!state.permissionRequest) return;
      const { id } = state.permissionRequest;
      dispatch({ type: "permission_replied", payload: { requestID: id } });
      await sdk.permission.reply({
        path: { requestID: id },
        body: { reply, ...(message ? { message } : {}) },
      }).catch(() => {
        // If the reply fails the SSE will re-surface the request on reconnect
      });
    },
    [sdk, state.permissionRequest],
  );

  const replyQuestion = useCallback(
    async (answers: string[][]) => {
      if (!state.questionRequest) return;
      const { id } = state.questionRequest;
      dispatch({ type: "question_closed", payload: { requestID: id } });
      await sdk.question.reply({
        path: { requestID: id },
        body: { answers },
      }).catch(() => {});
    },
    [sdk, state.questionRequest],
  );

  const rejectQuestion = useCallback(async () => {
    if (!state.questionRequest) return;
    const { id } = state.questionRequest;
    dispatch({ type: "question_closed", payload: { requestID: id } });
    await sdk.question.reject({
      path: { requestID: id },
    }).catch(() => {});
  }, [sdk, state.questionRequest]);

  const dismissTodos = useCallback(() => {
    dispatch({ type: "dismiss_todos" });
  }, []);

  const allTodosDone =
    state.todos.length > 0 &&
    state.todos.every((t) => t.status === "completed" || t.status === "cancelled");

  return {
    permissionRequest: state.permissionRequest,
    questionRequest: state.questionRequest,
    todos: state.todos,
    allTodosDone,
    blocked: state.permissionRequest !== null || state.questionRequest !== null,
    todosVisible: state.todos.length > 0 && !state.todosDismissed,
    replyPermission,
    replyQuestion,
    rejectQuestion,
    dismissTodos,
  };
}
