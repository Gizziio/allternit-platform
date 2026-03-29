"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { TodoWidget, type TodoStep } from "@/components/ai-elements/TodoWidget";
import type { TodoItem } from "./session-composer-state";
import { DockSurface } from "./dock-surface";

const AUTO_DISMISS_DELAY_MS = 2_500;

interface SessionTodoDockProps {
  todos: TodoItem[];
  allDone: boolean;
  onDismiss: () => void;
}

function mapToSteps(todos: TodoItem[]): TodoStep[] {
  return todos.map((t, i) => ({
    id: `todo-${i}`,
    label: t.content,
    state: mapStatus(t.status),
  }));
}

function mapStatus(status: TodoItem["status"]): TodoStep["state"] {
  switch (status) {
    case "in_progress":
      return "running";
    case "completed":
    case "cancelled":
      return "done";
    default:
      return "pending";
  }
}

function deriveTitle(todos: TodoItem[]): string {
  const running = todos.filter((t) => t.status === "in_progress").length;
  const done = todos.filter(
    (t) => t.status === "completed" || t.status === "cancelled",
  ).length;
  const total = todos.length;

  if (running > 0) return `Working · ${done}/${total}`;
  if (done === total) return `Done · ${total}/${total}`;
  return `Plan · ${done}/${total}`;
}

export function SessionTodoDock({ todos, allDone, onDismiss }: SessionTodoDockProps) {
  useEffect(() => {
    if (!allDone) return;
    const t = setTimeout(onDismiss, AUTO_DISMISS_DELAY_MS);
    return () => clearTimeout(t);
  }, [allDone, onDismiss]);

  const steps = mapToSteps(todos);
  const title = deriveTitle(todos);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.97 }}
      transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
    >
      <DockSurface data-component="session-todo-dock" className="shadow-md">
        <TodoWidget steps={steps} title={title} defaultCollapsed={false} />
      </DockSurface>
    </motion.div>
  );
}
