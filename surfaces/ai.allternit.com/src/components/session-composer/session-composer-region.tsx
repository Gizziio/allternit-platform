"use client";

import { useCallback, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  PromptInput,
  PromptInputActions,
  PromptInputTextarea,
} from "@/components/prompt-kit/prompt-input";
import { useSessionComposerState } from "./session-composer-state";
import { SessionPermissionDock } from "./session-permission-dock";
import { SessionQuestionDock } from "./session-question-dock";
import { SessionTodoDock } from "./session-todo-dock";

export interface SessionComposerRegionProps {
  serverUrl: string;
  sessionID: string;
  isLoading: boolean;
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  placeholder?: string;
  className?: string;
}

export function SessionComposerRegion({
  serverUrl,
  sessionID,
  isLoading,
  value,
  onValueChange,
  onSubmit,
  onStop,
  placeholder = "Ask anything…",
  className,
}: SessionComposerRegionProps) {
  const {
    permissionRequest,
    questionRequest,
    todos,
    allTodosDone,
    blocked,
    todosVisible,
    replyPermission,
    replyQuestion,
    rejectQuestion,
    dismissTodos,
  } = useSessionComposerState(serverUrl, sessionID);

  const containerRef = useRef<HTMLDivElement>(null);

  const autofocusTextarea = useCallback(() => {
    if (blocked) return;
    const textarea = containerRef.current?.querySelector<HTMLTextAreaElement>("textarea");
    if (textarea && document.activeElement !== textarea) {
      textarea.focus();
    }
  }, [blocked]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return;
      if (e.key.length !== 1) return;
      autofocusTextarea();
    }

    document.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => document.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [autofocusTextarea]);

  return (
    <div
      ref={containerRef}
      data-component="session-composer-region"
      data-blocked={blocked ? "true" : "false"}
      className={className}
      style={{ display: "flex", flexDirection: "column", gap: "8px" }}
    >
      {/* Todo dock — mounts above prompt, exits with animation */}
      <AnimatePresence>
        {todosVisible && (
          <SessionTodoDock
            todos={todos}
            allDone={allTodosDone}
            onDismiss={dismissTodos}
          />
        )}
      </AnimatePresence>

      {/* Blocker or prompt */}
      <AnimatePresence mode="wait" initial={false}>
        {permissionRequest ? (
          <motion.div
            key={`perm-${permissionRequest.id}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.16 }}
          >
            <SessionPermissionDock
              request={permissionRequest}
              onReply={replyPermission}
            />
          </motion.div>
        ) : questionRequest ? (
          <motion.div
            key={`q-${questionRequest.id}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.16 }}
          >
            <SessionQuestionDock
              request={questionRequest}
              onReply={replyQuestion}
              onReject={rejectQuestion}
            />
          </motion.div>
        ) : (
          <motion.div
            key="prompt"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.14 }}
          >
            <PromptInput
              isLoading={isLoading}
              value={value}
              onValueChange={onValueChange}
              onSubmit={onSubmit}
              onStop={onStop}
            >
              <PromptInputTextarea placeholder={placeholder} />
              <PromptInputActions />
            </PromptInput>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
