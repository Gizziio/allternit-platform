"use client";

import React, { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import {
  FileText,
  FloppyDisk,
  ArrowsClockwise,
  Warning,
  Check,
  X,
} from "@phosphor-icons/react";
import type { Agent } from "@/lib/agents/agent.types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { agentWorkspaceFilesApi } from "@/lib/agents/agent-workspace-files-api";
import {
  createBotWorkspaceStore,
  type BotWorkspaceStore,
} from "@/lib/bots/bot-workspace-store";
import {
  BOT_WORKSPACE_FILES,
  BotWorkspaceConflictError,
} from "@/lib/bots/bot-workspace-contracts";
import {
  serializeBotWorkspace,
  deserializeBotWorkspace,
  computeWorkspaceRevision,
  type WorkspaceFileMap,
} from "@/lib/bots/bot-workspace-serializer";
import { isBot } from "@/lib/bots/bot-profile";
import { createModuleLogger } from "@/lib/logger";

const logger = createModuleLogger("BotWorkspaceEditor");

interface BotWorkspaceEditorProps {
  bot: Agent;
  accentColor?: string;
}

const PERSONALITY_FILES: {
  path: string;
  label: string;
  description: string;
}[] = [
  {
    path: BOT_WORKSPACE_FILES.agents,
    label: "AGENTS.md",
    description: "Purpose, model, and runtime identity",
  },
  {
    path: BOT_WORKSPACE_FILES.soul,
    label: "SOUL.md",
    description: "Personality, voice, and starter prompts",
  },
  {
    path: BOT_WORKSPACE_FILES.user,
    label: "USER.md",
    description: "Human relationship and preferences",
  },
  {
    path: BOT_WORKSPACE_FILES.tools,
    label: "TOOLS.md",
    description: "Tool guidance and allowed surfaces",
  },
  {
    path: BOT_WORKSPACE_FILES.heartbeat,
    label: "HEARTBEAT.md",
    description: "Scheduled behavior intent",
  },
];

export function BotWorkspaceEditor({ bot, accentColor }: BotWorkspaceEditorProps) {
  const [store] = useState<BotWorkspaceStore>(() => createBotWorkspaceStore());
  const [files, setFiles] = useState<WorkspaceFileMap>({});
  const [selectedPath, setSelectedPath] = useState<string>(BOT_WORKSPACE_FILES.agents);
  const [revision, setRevision] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const botId = bot.id;

  // Load existing workspace files from the server and seed the in-memory store.
  const loadFiles = async () => {
    setIsLoading(true);
    setError(null);
    setConflict(null);
    try {
      const serverFiles: WorkspaceFileMap = {};
      for (const file of PERSONALITY_FILES) {
        try {
          const content = await agentWorkspaceFilesApi.read(botId, file.path);
          serverFiles[file.path] = content;
        } catch (e) {
          // File may not exist yet; fall through to generated defaults.
          logger.info({ path: file.path, botId }, "Workspace file not found on server");
        }
      }

      // Merge server files with serialized bot defaults so missing files are
      // backfilled with canonical content.
      const canonicalBot = isBot(bot) ? bot : deserializeBotWorkspace(serverFiles);
      const merged = serializeBotWorkspace(canonicalBot, serverFiles);

      // Seed the conflict-detection store.
      const snapshot = await store.writeWorkspace(botId, merged, undefined, undefined);
      setFiles(merged);
      setRevision(snapshot.revision);

      // If the selected file was missing, default to AGENTS.md.
      if (!merged[selectedPath]) {
        setSelectedPath(BOT_WORKSPACE_FILES.agents);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load workspace";
      setError(message);
      logger.error({ err, botId }, "Workspace load failed");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [botId]);

  const selectedContent = files[selectedPath] ?? "";
  const isDirty = useMemo(() => {
    return Object.entries(files).some(([path, content]) => {
      // We don't keep a pristine copy; instead the revision hash represents
      // the last saved state. The save button re-computes and compares server-side.
      return false;
    });
  }, [files]);

  const updateSelectedContent = (value: string) => {
    setFiles((prev) => ({ ...prev, [selectedPath]: value }));
    setSavedAt(null);
  };

  const saveFiles = async () => {
    setIsSaving(true);
    setError(null);
    setConflict(null);

    try {
      // Validate round-trip: deserialize must still produce a valid Bot.
      deserializeBotWorkspace(files);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Invalid workspace";
      setError(`Round-trip validation failed: ${message}`);
      setIsSaving(false);
      return;
    }

    try {
      // Attempt atomic workspace write with revision check.
      const snapshot = await store.writeWorkspace(
        botId,
        files,
        undefined,
        revision ?? undefined,
      );

      // Persist each file to the server.
      await Promise.all(
        PERSONALITY_FILES.map((file) =>
          agentWorkspaceFilesApi.write(botId, file.path, files[file.path] ?? ""),
        ),
      );

      setRevision(snapshot.revision);
      setSavedAt(new Date().toISOString());
      setSavedAt((ts) => ts);
    } catch (err) {
      if (err instanceof BotWorkspaceConflictError) {
        setConflict(
          `Workspace was modified elsewhere. Expected revision ${err.expectedRevision}, found ${err.actualRevision}. Reload to discard your changes.`,
        );
      } else {
        const message = err instanceof Error ? err.message : "Failed to save workspace";
        setError(message);
      }
      logger.error({ err, botId }, "Workspace save failed");
    } finally {
      setIsSaving(false);
    }
  };

  const reloadFiles = async () => {
    setFiles({});
    setRevision(null);
    await loadFiles();
  };

  const selectedMeta = PERSONALITY_FILES.find((f) => f.path === selectedPath);

  return (
    <div className="flex h-full min-h-[600px] overflow-hidden rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)]">
      {/* Sidebar */}
      <div className="w-64 min-w-[240px] border-r border-[var(--border-subtle)] flex flex-col">
        <div className="p-4 border-b border-[var(--border-subtle)]">
          <h3 className="text-[13px] font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <FileText size={16} style={{ color: accentColor }} />
            Personality files
          </h3>
          <p className="text-[11px] text-[var(--text-secondary)] mt-1">
            Round-trip workspace serialization
          </p>
        </div>

        <div className="flex-1 overflow-auto p-2 space-y-1">
          {PERSONALITY_FILES.map((file) => {
            const hasContent = Boolean(files[file.path]);
            return (
              <button
                key={file.path}
                type="button"
                onClick={() => setSelectedPath(file.path)}
                className={cn(
                  "w-full text-left px-3 py-2 rounded-lg border text-[12px] transition-colors",
                  selectedPath === file.path
                    ? "border-[var(--accent-primary)]/40 bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]"
                    : "border-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
                )}
              >
                <div className="font-medium flex items-center gap-2">
                  {file.label}
                  {!hasContent && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--surface-hover)] text-[var(--text-tertiary)]">
                      new
                    </span>
                  )}
                </div>
                <div className="text-[11px] opacity-70 mt-0.5">{file.description}</div>
              </button>
            );
          })}
        </div>

        <div className="p-3 border-t border-[var(--border-subtle)] text-[11px] text-[var(--text-tertiary)]">
          {revision ? (
            <div className="font-mono truncate" title={revision}>
              rev {revision.slice(0, 8)}
            </div>
          ) : (
            <div>no revision</div>
          )}
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between gap-3 p-3 border-b border-[var(--border-subtle)]">
          <div className="min-w-0">
            <div className="text-[13px] font-medium text-[var(--text-primary)] flex items-center gap-2">
              <FileText size={14} style={{ color: accentColor }} />
              <span className="truncate">{selectedMeta?.label ?? selectedPath}</span>
            </div>
            <div className="text-[11px] text-[var(--text-secondary)]">
              {selectedMeta?.description}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={reloadFiles}
              disabled={isLoading || isSaving}
            >
              <ArrowsClockwise size={14} className={cn("mr-1.5", isLoading && "animate-spin")} />
              Reload
            </Button>
            <Button
              size="sm"
              onClick={saveFiles}
              disabled={isSaving}
            >
              {isSaving ? (
                <ArrowsClockwise size={14} className="animate-spin mr-1.5" />
              ) : (
                <FloppyDisk size={14} className="mr-1.5" />
              )}
              Save
            </Button>
          </div>
        </div>

        {conflict && (
          <div className="m-3 p-3 rounded-lg bg-[var(--status-warning)]/10 border border-[var(--status-warning)]/30 flex items-start gap-2">
            <Warning size={16} className="shrink-0 mt-0.5 text-[var(--status-warning)]" />
            <div className="flex-1 text-[12px] text-[var(--text-primary)]">
              {conflict}
            </div>
            <button
              type="button"
              onClick={() => setConflict(null)}
              className="shrink-0 p-1 rounded hover:bg-[var(--surface-hover)]"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {error && (
          <div className="m-3 p-3 rounded-lg bg-[var(--status-error)]/10 border border-[var(--status-error)]/30 flex items-start gap-2">
            <Warning size={16} className="shrink-0 mt-0.5 text-[var(--status-error)]" />
            <div className="flex-1 text-[12px] text-[var(--text-primary)]">{error}</div>
            <button
              type="button"
              onClick={() => setError(null)}
              className="shrink-0 p-1 rounded hover:bg-[var(--surface-hover)]"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {savedAt && (
          <div className="mx-3 mt-3 p-2 rounded-lg bg-[var(--status-success)]/10 border border-[var(--status-success)]/30 flex items-center gap-2 text-[12px] text-[var(--text-primary)]">
            <Check size={14} className="text-[var(--status-success)]" />
            Saved at {new Date(savedAt).toLocaleTimeString()}
          </div>
        )}

        <div className="flex-1 p-3 min-h-0">
          <Textarea
            value={selectedContent}
            onChange={(e) => updateSelectedContent(e.target.value)}
            className="w-full h-full min-h-[400px] rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-[var(--text-primary)] font-mono text-[13px] leading-relaxed resize-none p-4 focus:ring-2 focus:ring-[var(--accent-primary)]/30 focus:border-[var(--accent-primary)]/50"
            spellCheck={false}
            disabled={isLoading}
            placeholder={isLoading ? "Loading workspace…" : "Select a file to edit"}
          />
        </div>
      </div>
    </div>
  );
}
