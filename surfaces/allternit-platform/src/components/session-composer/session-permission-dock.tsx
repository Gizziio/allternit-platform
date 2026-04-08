"use client";

import { useCallback, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowsClockwise,
  Asterisk,
  CaretDown,
  Eye,
  FileText,
  FolderOpen,
  Gear,
  Globe,
  Graph,
  MagnifyingGlass,
  PencilSimpleLine,
  Terminal,
  Warning,
  X,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import type { PermissionRequest } from "./session-composer-state";
import { DockSurface } from "./dock-surface";

type Stage = "main" | "always" | "reject";

interface PermissionMeta {
  icon: React.ReactNode;
  title: string;
  detail: React.ReactNode;
}

function normalizePath(raw: unknown): string {
  if (typeof raw !== "string" || !raw) return "";
  try {
    const home = typeof window !== "undefined" ? "" : process.env["HOME"] ?? "";
    if (home && raw.startsWith(home)) {
      return "~" + raw.slice(home.length);
    }
  } catch {}
  return raw;
}

function buildMeta(request: PermissionRequest): PermissionMeta {
  const { permission, metadata, patterns } = request;
  const iconClass = "shrink-0 mt-0.5";

  if (permission === "edit") {
    const path = normalizePath(metadata["filepath"]);
    return {
      icon: <PencilSimpleLine size={15} className={iconClass} />,
      title: `Edit ${path || "file"}`,
      detail: path ? (
        <code className="text-[11px] text-[var(--text-secondary)] bg-[var(--bg-hover)] px-1.5 py-0.5 rounded-md font-mono">
          {path}
        </code>
      ) : null,
    };
  }

  if (permission === "read") {
    const path = normalizePath(metadata["filePath"] ?? metadata["filepath"]);
    return {
      icon: <Eye size={15} className={iconClass} />,
      title: `Read ${path || "file"}`,
      detail: path ? (
        <code className="text-[11px] text-[var(--text-secondary)] bg-[var(--bg-hover)] px-1.5 py-0.5 rounded-md font-mono">
          {path}
        </code>
      ) : null,
    };
  }

  if (permission === "bash") {
    const command = typeof metadata["command"] === "string" ? metadata["command"] : "";
    const description =
      typeof metadata["description"] === "string" && metadata["description"]
        ? metadata["description"]
        : "Shell command";
    return {
      icon: <Terminal size={15} className={iconClass} />,
      title: description,
      detail: command ? (
        <code className="text-[11px] text-[var(--text-secondary)] bg-[var(--bg-hover)] px-1.5 py-0.5 rounded-md font-mono whitespace-pre-wrap break-all">
          $ {command}
        </code>
      ) : null,
    };
  }

  if (permission === "glob") {
    const pattern = typeof metadata["pattern"] === "string" ? metadata["pattern"] : "";
    return {
      icon: <Asterisk size={15} className={iconClass} />,
      title: pattern ? `Glob "${pattern}"` : "Glob pattern",
      detail: null,
    };
  }

  if (permission === "grep") {
    const pattern = typeof metadata["pattern"] === "string" ? metadata["pattern"] : "";
    return {
      icon: <MagnifyingGlass size={15} className={iconClass} />,
      title: pattern ? `Grep "${pattern}"` : "Grep pattern",
      detail: null,
    };
  }

  if (permission === "list") {
    const path = normalizePath(metadata["path"]);
    return {
      icon: <FolderOpen size={15} className={iconClass} />,
      title: `List ${path || "directory"}`,
      detail: null,
    };
  }

  if (permission === "webfetch") {
    const url = typeof metadata["url"] === "string" ? metadata["url"] : "";
    return {
      icon: <Globe size={15} className={iconClass} />,
      title: `Fetch ${url || "URL"}`,
      detail: url ? (
        <span className="text-[11px] text-[var(--text-secondary)] font-mono break-all">{url}</span>
      ) : null,
    };
  }

  if (permission === "websearch") {
    const query = typeof metadata["query"] === "string" ? metadata["query"] : "";
    return {
      icon: <MagnifyingGlass size={15} className={iconClass} />,
      title: query ? `Search "${query}"` : "Web search",
      detail: null,
    };
  }

  if (permission === "codesearch") {
    const query = typeof metadata["query"] === "string" ? metadata["query"] : "";
    return {
      icon: <MagnifyingGlass size={15} className={iconClass} />,
      title: query ? `Code search "${query}"` : "Code search",
      detail: null,
    };
  }

  if (permission === "external_directory") {
    const parent =
      typeof metadata["parentDir"] === "string"
        ? metadata["parentDir"]
        : typeof metadata["filepath"] === "string"
          ? metadata["filepath"]
          : undefined;
    const derived =
      typeof patterns[0] === "string"
        ? patterns[0].includes("*")
          ? patterns[0].replace(/\/[^/]*\*.*$/, "")
          : patterns[0]
        : undefined;
    const dir = normalizePath(parent ?? derived ?? "");
    return {
      icon: <FolderOpen size={15} className={iconClass} />,
      title: `Access external directory${dir ? ` ${dir}` : ""}`,
      detail:
        patterns.length > 0 ? (
          <ul className="flex flex-col gap-0.5">
            {patterns.map((p, i) => (
              <li
                key={i}
                className="text-[11px] text-[var(--text-secondary)] font-mono"
              >
                {p}
              </li>
            ))}
          </ul>
        ) : null,
    };
  }

  if (permission === "doom_loop") {
    return {
      icon: <ArrowsClockwise size={15} className={iconClass} />,
      title: "Continue after repeated failures",
      detail: (
        <span className="text-[11px] text-[var(--text-secondary)]">
          Keeps the session running despite repeated errors.
        </span>
      ),
    };
  }

  if (permission === "task") {
    const subagentType =
      typeof metadata["subagent_type"] === "string" ? metadata["subagent_type"] : "";
    const description =
      typeof metadata["description"] === "string" ? metadata["description"] : "";
    return {
      icon: <Graph size={15} className={iconClass} />,
      title: subagentType
        ? `${subagentType.charAt(0).toUpperCase() + subagentType.slice(1)} task`
        : "Subagent task",
      detail: description ? (
        <span className="text-[11px] text-[var(--text-secondary)]">{description}</span>
      ) : null,
    };
  }

  if (permission === "file_text") {
    const path = normalizePath(metadata["filePath"] ?? metadata["filepath"]);
    return {
      icon: <FileText size={15} className={iconClass} />,
      title: `Read file ${path || ""}`,
      detail: null,
    };
  }

  return {
    icon: <Gear size={15} className={iconClass} />,
    title: `Allow ${permission}`,
    detail: null,
  };
}

interface SessionPermissionDockProps {
  request: PermissionRequest;
  onReply: (reply: "once" | "always" | "reject", message?: string) => void;
}

export function SessionPermissionDock({ request, onReply }: SessionPermissionDockProps) {
  const [stage, setStage] = useState<Stage>("main");
  const [rejectMessage, setRejectMessage] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const meta = buildMeta(request);
  const hasAlwaysGlobal = request.always.length === 1 && request.always[0] === "*";

  const handleAlways = useCallback(() => {
    setStage("always");
  }, []);

  const handleAlwaysConfirm = useCallback(() => {
    onReply("always");
  }, [onReply]);

  const handleRejectStage = useCallback(() => {
    setStage("reject");
    setTimeout(() => textareaRef.current?.focus(), 50);
  }, []);

  const handleRejectConfirm = useCallback(() => {
    onReply("reject", rejectMessage.trim() || undefined);
    setRejectMessage("");
  }, [onReply, rejectMessage]);

  const handleBack = useCallback(() => {
    setStage("main");
    setRejectMessage("");
  }, []);

  return (
    <DockSurface
      data-component="session-permission-dock"
      className="shadow-lg"
      style={{ borderLeft: "3px solid var(--status-warning)" }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border-subtle)]">
        <Warning
          size={15}
          className="shrink-0 text-[var(--status-warning)]"
          weight="fill"
        />
        <span className="text-[12px] font-semibold uppercase tracking-wide text-[var(--status-warning)]">
          Permission required
        </span>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {stage === "main" && (
          <motion.div
            key="main"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.14 }}
          >
            {/* Permission detail */}
            <div className="px-4 py-3 flex flex-col gap-2">
              <div className="flex items-start gap-2 text-[var(--text-primary)]">
                <span className="text-[var(--text-secondary)]">{meta.icon}</span>
                <span className="text-[13px] font-medium leading-snug">{meta.title}</span>
              </div>
              {meta.detail && (
                <div
                  data-slot="permission-detail"
                  className="ml-[23px] flex flex-col gap-1"
                >
                  {meta.detail}
                </div>
              )}
            </div>

            {/* Actions */}
            <div
              data-slot="permission-actions"
              className="flex items-center gap-2 px-4 py-3 border-t border-[var(--border-subtle)] bg-[var(--bg-hover)]"
            >
              <button
                data-slot="action-once"
                onClick={() => onReply("once")}
                className="flex-1 h-8 text-[12px] font-medium rounded-[10px] bg-[var(--status-warning-bg)] text-[var(--status-warning)] border border-[var(--status-warning)]/30 hover:bg-[var(--status-warning)]/20 transition-colors"
              >
                Allow once
              </button>
              <button
                data-slot="action-always"
                onClick={handleAlways}
                className="flex-1 h-8 text-[12px] font-medium rounded-[10px] bg-[var(--bg-hover)] text-[var(--text-secondary)] border border-[var(--border-default)] hover:bg-[var(--bg-active)] transition-colors"
              >
                Always allow
                <CaretDown size={11} className="inline ml-1 -mt-0.5 opacity-60" />
              </button>
              <button
                data-slot="action-reject"
                onClick={handleRejectStage}
                className="flex-1 h-8 text-[12px] font-medium rounded-[10px] bg-[var(--status-error-bg)] text-[var(--status-error)] border border-[var(--status-error)]/30 hover:bg-[var(--status-error)]/20 transition-colors"
              >
                Reject
              </button>
            </div>
          </motion.div>
        )}

        {stage === "always" && (
          <motion.div
            key="always"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.14 }}
          >
            <div className="px-4 py-3 flex flex-col gap-2">
              <p className="text-[13px] text-[var(--text-primary)] font-medium">
                Allow always?
              </p>
              {hasAlwaysGlobal ? (
                <p className="text-[12px] text-[var(--text-secondary)]">
                  This will allow{" "}
                  <span className="font-medium text-[var(--text-primary)]">
                    {request.permission}
                  </span>{" "}
                  until the session ends.
                </p>
              ) : (
                <div className="flex flex-col gap-1">
                  <p className="text-[12px] text-[var(--text-secondary)]">
                    The following patterns will be permanently allowed:
                  </p>
                  <ul className="flex flex-col gap-0.5 ml-2">
                    {request.always.map((pattern, i) => (
                      <li
                        key={i}
                        className="text-[11px] font-mono text-[var(--text-secondary)] bg-[var(--bg-hover)] px-2 py-0.5 rounded-md"
                      >
                        {pattern}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 px-4 py-3 border-t border-[var(--border-subtle)] bg-[var(--bg-hover)]">
              <button
                data-slot="back"
                onClick={handleBack}
                className="flex items-center gap-1.5 h-8 px-3 text-[12px] font-medium rounded-[10px] bg-transparent text-[var(--text-secondary)] border border-[var(--border-default)] hover:bg-[var(--bg-active)] transition-colors"
              >
                <ArrowLeft size={12} />
                Back
              </button>
              <button
                data-slot="confirm-always"
                onClick={handleAlwaysConfirm}
                className="flex-1 h-8 text-[12px] font-medium rounded-[10px] bg-[var(--status-warning-bg)] text-[var(--status-warning)] border border-[var(--status-warning)]/30 hover:bg-[var(--status-warning)]/20 transition-colors"
              >
                Confirm
              </button>
            </div>
          </motion.div>
        )}

        {stage === "reject" && (
          <motion.div
            key="reject"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.14 }}
          >
            <div className="px-4 py-3 flex flex-col gap-2">
              <p className="text-[13px] text-[var(--text-primary)] font-medium">
                Reject permission
              </p>
              <p className="text-[12px] text-[var(--text-secondary)]">
                Optionally tell the agent what to do differently:
              </p>
              <textarea
                ref={textareaRef}
                data-slot="reject-message"
                value={rejectMessage}
                onChange={(e) => setRejectMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleRejectConfirm();
                  }
                  if (e.key === "Escape") {
                    handleBack();
                  }
                }}
                placeholder="e.g. Use a different approach…"
                rows={2}
                className={cn(
                  "w-full resize-none rounded-[10px] px-3 py-2 text-[13px]",
                  "bg-[var(--bg-hover)] border border-[var(--border-default)]",
                  "text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]",
                  "outline-none focus:border-[var(--status-error)]/50 focus:ring-1 focus:ring-[var(--status-error)]/30",
                  "transition-colors",
                )}
              />
              <p className="text-[11px] text-[var(--text-tertiary)]">
                enter to confirm · esc to cancel
              </p>
            </div>
            <div className="flex items-center gap-2 px-4 py-3 border-t border-[var(--border-subtle)] bg-[var(--bg-hover)]">
              <button
                data-slot="back"
                onClick={handleBack}
                className="flex items-center gap-1.5 h-8 px-3 text-[12px] font-medium rounded-[10px] bg-transparent text-[var(--text-secondary)] border border-[var(--border-default)] hover:bg-[var(--bg-active)] transition-colors"
              >
                <ArrowLeft size={12} />
                Back
              </button>
              <button
                data-slot="confirm-reject"
                onClick={handleRejectConfirm}
                className="flex-1 h-8 text-[12px] font-medium rounded-[10px] bg-[var(--status-error-bg)] text-[var(--status-error)] border border-[var(--status-error)]/30 hover:bg-[var(--status-error)]/20 transition-colors"
              >
                <X size={12} className="inline mr-1 -mt-0.5" />
                Reject
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </DockSurface>
  );
}
