"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowsClockwise,
  FloppyDisk,
  Warning,
  Check,
  FileText,
} from "@phosphor-icons/react";
import { agentWorkspaceFilesApi } from "@/lib/agents/agent-workspace-files-api";
import {
  BOT_WORKSPACE_FILES,
  type BotWorkspaceFilePath,
} from "@/lib/bots/bot-workspace-contracts";
import {
  serializeBotWorkspace,
  deserializeBotWorkspace,
  computeWorkspaceRevision,
  type WorkspaceFileMap,
} from "@/lib/bots/bot-workspace-serializer";
import type { Bot, BotCategory, BotLifecycle } from "@/lib/bots/orpc-contracts";

interface PersonalityWorkspacePanelProps {
  botId: string;
  accentColor?: string;
}

const PERSONALITY_FILES: BotWorkspaceFilePath[] = [
  BOT_WORKSPACE_FILES.agents,
  BOT_WORKSPACE_FILES.soul,
  BOT_WORKSPACE_FILES.user,
  BOT_WORKSPACE_FILES.tools,
  BOT_WORKSPACE_FILES.heartbeat,
];

const BOT_CATEGORIES: BotCategory[] = [
  "research",
  "code",
  "writing",
  "data",
  "sales",
  "design",
  "ops",
  "custom",
];

const BOT_LIFECYCLES: BotLifecycle[] = ["draft", "active", "archived", "deprecated"];

export function PersonalityWorkspacePanel({
  botId,
  accentColor,
}: PersonalityWorkspacePanelProps) {
  const [files, setFiles] = useState<WorkspaceFileMap>({});
  const [loadedRevision, setLoadedRevision] = useState<string | null>(null);
  const [bot, setBot] = useState<Bot | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [saved, setSaved] = useState(false);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    setConflict(false);
    setSaved(false);
    try {
      const list = await agentWorkspaceFilesApi.list(botId);
      const fileMap: WorkspaceFileMap = {};
      await Promise.all(
        PERSONALITY_FILES.map(async (path) => {
          const exists = list.some((f) => f.path === path);
          if (exists) {
            try {
              fileMap[path] = await agentWorkspaceFilesApi.read(botId, path);
            } catch {
              fileMap[path] = "";
            }
          } else {
            fileMap[path] = "";
          }
        }),
      );

      // Fill any missing files with serializer defaults by letting the
      // serializer produce them when existingFiles lacks an entry.
      const deserialized = deserializeBotWorkspace(fileMap);
      const revision = await computeWorkspaceRevision(fileMap);

      setFiles(fileMap);
      setLoadedRevision(revision);
      setBot(deserialized);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load workspace files");
    } finally {
      setLoading(false);
    }
  }, [botId]);

  useEffect(() => {
    void loadFiles();
  }, [loadFiles]);

  const serializedFiles = useMemo(() => {
    if (!bot) return null;
    return serializeBotWorkspace(bot, files);
  }, [bot, files]);

  const dirty = useMemo(() => {
    if (!serializedFiles || !files) return false;
    for (const path of PERSONALITY_FILES) {
      if (serializedFiles[path] !== files[path]) return true;
    }
    return false;
  }, [serializedFiles, files]);

  const updateBotProfile = useCallback(
    (patch: Partial<Bot["botProfile"]>) => {
      setBot((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          botProfile: { ...prev.botProfile, ...patch },
        };
      });
    },
    [],
  );

  const updateBotField = useCallback(
    <K extends keyof Bot>(key: K, value: Bot[K]) => {
      setBot((prev) => (prev ? { ...prev, [key]: value } : prev));
    },
    [],
  );

  const save = useCallback(
    async (force = false) => {
      if (!serializedFiles || !loadedRevision) return;
      setSaving(true);
      setError(null);
      setSaved(false);
      try {
        // Re-read current files to detect external changes.
        const currentMap: WorkspaceFileMap = {};
        const list = await agentWorkspaceFilesApi.list(botId);
        await Promise.all(
          PERSONALITY_FILES.map(async (path) => {
            if (list.some((f) => f.path === path)) {
              try {
                currentMap[path] = await agentWorkspaceFilesApi.read(botId, path);
              } catch {
                currentMap[path] = "";
              }
            } else {
              currentMap[path] = "";
            }
          }),
        );
        const currentRevision = await computeWorkspaceRevision(currentMap);
        if (currentRevision !== loadedRevision && !force) {
          setConflict(true);
          setSaving(false);
          return;
        }

        const writes = PERSONALITY_FILES.filter(
          (path) => serializedFiles[path] !== currentMap[path],
        ).map((path) =>
          agentWorkspaceFilesApi.write(botId, path, serializedFiles[path]),
        );
        await Promise.all(writes);

        setFiles(serializedFiles);
        setLoadedRevision(currentRevision);
        setConflict(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to save workspace files");
      } finally {
        setSaving(false);
      }
    },
    [botId, loadedRevision, serializedFiles],
  );

  if (loading && !bot) {
    return (
      <div className="flex h-[320px] items-center justify-center text-[var(--text-secondary)]">
        <ArrowsClockwise size={24} className="animate-spin mr-2" />
        Loading personality files…
      </div>
    );
  }

  if (!bot) {
    return (
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 text-[var(--text-secondary)]">
        {error || "Could not load workspace files."}
      </div>
    );
  }

  const profile = bot.botProfile;

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-xl border border-[var(--status-error)]/30 bg-[var(--status-error)]/10 p-4 text-[13px] text-[var(--status-error)] flex items-start gap-2">
          <Warning size={16} className="shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {conflict && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-[13px] text-amber-200 flex items-start gap-3">
          <Warning size={18} className="shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium">Workspace files changed elsewhere</p>
            <p className="opacity-80 mt-1">
              The personality files were modified after you loaded them. Save again to overwrite, or reload to keep the remote changes.
            </p>
            <div className="flex gap-2 mt-3">
              <Button
                size="sm"
                variant="outline"
                onClick={() => void loadFiles()}
              >
                Reload
              </Button>
              <Button size="sm" onClick={() => void save(true)}>
                Overwrite
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Display name">
          <Input
            value={profile.displayName}
            onChange={(e) => updateBotProfile({ displayName: e.target.value })}
            className="bg-[var(--bg-primary)] border-[var(--border-subtle)] text-[var(--text-primary)]"
          />
        </Field>

        <Field label="Handle">
          <Input
            value={profile.handle ?? ""}
            onChange={(e) => updateBotProfile({ handle: e.target.value })}
            className="bg-[var(--bg-primary)] border-[var(--border-subtle)] text-[var(--text-primary)]"
          />
        </Field>

        <Field label="Version">
          <Input
            value={profile.version ?? ""}
            onChange={(e) => updateBotProfile({ version: e.target.value })}
            className="bg-[var(--bg-primary)] border-[var(--border-subtle)] text-[var(--text-primary)]"
          />
        </Field>

        <Field label="Accent color">
          <div className="flex items-center gap-2">
            <Input
              type="color"
              value={profile.accentColor ?? "#6366f1"}
              onChange={(e) => updateBotProfile({ accentColor: e.target.value })}
              className="w-12 h-9 p-1 bg-[var(--bg-primary)] border-[var(--border-subtle)]"
            />
            <Input
              value={profile.accentColor ?? ""}
              onChange={(e) => updateBotProfile({ accentColor: e.target.value })}
              className="flex-1 bg-[var(--bg-primary)] border-[var(--border-subtle)] text-[var(--text-primary)]"
            />
          </div>
        </Field>

        <Field label="Category">
          <Select
            value={profile.botCategory ?? "custom"}
            onValueChange={(value) =>
              updateBotProfile({ botCategory: value as BotCategory })
            }
          >
            <SelectTrigger className="bg-[var(--bg-primary)] border-[var(--border-subtle)] text-[var(--text-primary)]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[var(--bg-card)] border-[var(--border-subtle)]">
              {BOT_CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Lifecycle">
          <Select
            value={profile.lifecycle ?? "draft"}
            onValueChange={(value) =>
              updateBotProfile({ lifecycle: value as BotLifecycle })
            }
          >
            <SelectTrigger className="bg-[var(--bg-primary)] border-[var(--border-subtle)] text-[var(--text-primary)]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[var(--bg-card)] border-[var(--border-subtle)]">
              {BOT_LIFECYCLES.map((lifecycle) => (
                <SelectItem key={lifecycle} value={lifecycle}>
                  {lifecycle}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <Field label="Tagline">
        <Input
          value={profile.tagline ?? ""}
          onChange={(e) => updateBotProfile({ tagline: e.target.value })}
          className="bg-[var(--bg-primary)] border-[var(--border-subtle)] text-[var(--text-primary)]"
        />
      </Field>

      <Field label="Description / purpose">
        <Textarea
          value={bot.description}
          onChange={(e) => updateBotField("description", e.target.value)}
          rows={3}
          className="bg-[var(--bg-primary)] border-[var(--border-subtle)] text-[var(--text-primary)] resize-none"
        />
      </Field>

      <Field label="Welcome message">
        <Textarea
          value={profile.welcomeMessage ?? ""}
          onChange={(e) => updateBotProfile({ welcomeMessage: e.target.value })}
          rows={2}
          className="bg-[var(--bg-primary)] border-[var(--border-subtle)] text-[var(--text-primary)] resize-none"
        />
      </Field>

      <Field label="Starter prompts (one per line)">
        <Textarea
          value={(profile.starterPrompts ?? []).join("\n")}
          onChange={(e) =>
            updateBotProfile({
              starterPrompts: e.target.value
                .split("\n")
                .map((line) => line.trim())
                .filter(Boolean),
            })
          }
          rows={3}
          className="bg-[var(--bg-primary)] border-[var(--border-subtle)] text-[var(--text-primary)] resize-none"
        />
      </Field>

      <div className="flex items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
        <Switch
          checked={profile.groupChatEnabled ?? false}
          onCheckedChange={(checked) =>
            updateBotProfile({ groupChatEnabled: checked })
          }
        />
        <Label className="text-[13px] text-[var(--text-primary)] cursor-pointer">
          Allow this bot in group chats
        </Label>
      </div>

      <div className="flex items-center gap-3">
        <Button
          onClick={() => void save(false)}
          disabled={!dirty || saving}
          className={cn("gap-1.5", accentColor && "border-none")}
          style={accentColor ? { backgroundColor: accentColor } : undefined}
        >
          {saving ? (
            <ArrowsClockwise size={14} className="animate-spin" />
          ) : saved ? (
            <Check size={14} />
          ) : (
            <FloppyDisk size={14} />
          )}
          {saved ? "Saved" : "Save personality files"}
        </Button>
        <Button
          variant="outline"
          onClick={() => void loadFiles()}
          disabled={loading}
          className="gap-1.5"
        >
          <ArrowsClockwise size={14} className={cn(loading && "animate-spin")} />
          Reload
        </Button>
      </div>

      <div className="pt-2 border-t border-[var(--border-subtle)]">
        <div className="text-[12px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider mb-2 flex items-center gap-2">
          <FileText size={12} />
          Files affected
        </div>
        <div className="flex flex-wrap gap-2">
          {PERSONALITY_FILES.map((path) => (
            <span
              key={path}
              className={cn(
                "text-[11px] px-2 py-1 rounded border",
                serializedFiles && serializedFiles[path] !== files[path]
                  ? "border-[var(--accent-primary)]/40 bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]"
                  : "border-[var(--border-subtle)] bg-[var(--bg-card)] text-[var(--text-secondary)]",
              )}
            >
              {path.split("/").pop()}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[13px] font-medium text-[var(--text-primary)]">
        {label}
      </Label>
      {children}
    </div>
  );
}
