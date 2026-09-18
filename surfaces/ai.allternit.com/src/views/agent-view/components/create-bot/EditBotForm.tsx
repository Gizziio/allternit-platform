"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { CircleNotch, X } from "@phosphor-icons/react";
import type { Agent, CreateAgentInput } from "@/lib/agents/agent.types";
import { useAgentStore } from "@/lib/agents/agent.store";
import { saveBotAvatar } from "@/lib/bots/bot-assets-api";
import { createModuleLogger } from "@/lib/logger";
import { hasDisplayName } from "./wizard-state";
import { WIZARD_COPY } from "./wizard-copy";
import { IdentityStep } from "./steps/IdentityStep";
import { JobStep } from "./steps/JobStep";
import type { AvatarEditorState } from "./steps/AvatarEditor";
import { refineSystemPrompt } from "./describeBot";
import {
  buildAvatarConfigFromEditor,
  hydrateAvatarEditorFromConfig,
  type AvatarEditorValues,
} from "./avatar-config";

const logger = createModuleLogger("EditBotForm");

interface EditBotFormProps {
  bot: Agent;
  isOpen: boolean;
  onClose: () => void;
}

function formFromBot(bot: Agent): Partial<CreateAgentInput> {
  return {
    name: bot.name,
    description: bot.description,
    systemPrompt: bot.systemPrompt || "",
    allowedTools: bot.allowedTools ?? bot.tools ?? [],
    botProfile: {
      displayName: bot.botProfile?.displayName || bot.name,
      tagline: bot.botProfile?.tagline || "",
      welcomeMessage: bot.botProfile?.welcomeMessage || "",
      starterPrompts: bot.botProfile?.starterPrompts || [],
      accentColor: bot.botProfile?.accentColor || "#B08D6E",
      groupChatEnabled: bot.botProfile?.groupChatEnabled ?? true,
      botCategory: bot.botProfile?.botCategory || "custom",
    },
  };
}

/**
 * Edit bot — identity, sprite/avatar, job, and tools. Not Edit Agent
 * (harness / trust / surfaces). Same AvatarEditor as Create bot.
 */
export function EditBotForm({ bot, isOpen, onClose }: EditBotFormProps) {
  const { updateAgent } = useAgentStore();
  const [formData, setFormData] = useState<Partial<CreateAgentInput>>(() => formFromBot(bot));
  const [avatar, setAvatar] = useState<AvatarEditorValues>(() =>
    hydrateAvatarEditorFromConfig(bot.avatar, bot.botProfile?.accentColor),
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [refining, setRefining] = useState(false);
  const [refineError, setRefineError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setFormData(formFromBot(bot));
    setAvatar(hydrateAvatarEditorFromConfig(bot.avatar, bot.botProfile?.accentColor));
    setError(null);
    setRefineError(null);
    setSaving(false);
  }, [isOpen, bot]);

  const updateBotProfile = useCallback(
    (patch: Partial<NonNullable<CreateAgentInput["botProfile"]>>) => {
      setFormData((prev) => ({
        ...prev,
        botProfile: { ...(prev.botProfile || {}), ...patch } as CreateAgentInput["botProfile"],
      }));
    },
    [],
  );

  const updateAccentColor = useCallback(
    (color: string) => {
      updateBotProfile({ accentColor: color });
      if (avatar.avatarMode === "gizzi") {
        setAvatar((prev) => ({ ...prev, gizziColor: color }));
      }
    },
    [avatar.avatarMode, updateBotProfile],
  );

  const avatarState: AvatarEditorState = useMemo(
    () => ({
      avatarMode: avatar.avatarMode,
      setAvatarMode: (mode) => setAvatar((prev) => ({ ...prev, avatarMode: mode })),
      avatarPicker: avatar.avatarPicker,
      setAvatarPicker: (next) =>
        setAvatar((prev) => ({
          ...prev,
          avatarPicker: typeof next === "function" ? next(prev.avatarPicker) : next,
        })),
      mascotTemplate: avatar.mascotTemplate,
      setMascotTemplate: (t) => setAvatar((prev) => ({ ...prev, mascotTemplate: t })),
      gizziColor: avatar.gizziColor,
      setGizziColor: (c) => setAvatar((prev) => ({ ...prev, gizziColor: c })),
      gizziEmotion: avatar.gizziEmotion,
      setGizziEmotion: (e) => setAvatar((prev) => ({ ...prev, gizziEmotion: e })),
      imageDataUrl: avatar.imageDataUrl,
      setImageDataUrl: (url) => setAvatar((prev) => ({ ...prev, imageDataUrl: url })),
      petUrl: avatar.petUrl,
      setPetUrl: (url) => setAvatar((prev) => ({ ...prev, petUrl: url })),
      packSelection: avatar.packSelection,
      setPackSelection: (sel) => setAvatar((prev) => ({ ...prev, packSelection: sel })),
    }),
    [avatar],
  );

  const handleRefine = async () => {
    if (refining) return;
    setRefining(true);
    setRefineError(null);
    try {
      const result = await refineSystemPrompt({
        description: formData.description || formData.botProfile?.tagline || "",
        displayName: formData.botProfile?.displayName || undefined,
        currentSystemPrompt: formData.systemPrompt || undefined,
      });
      if (!result?.systemPrompt) {
        setRefineError(WIZARD_COPY.errors.refineFailed);
        return;
      }
      setFormData((prev) => ({ ...prev, systemPrompt: result.systemPrompt! }));
    } catch {
      setRefineError(WIZARD_COPY.errors.refineFailed);
    } finally {
      setRefining(false);
    }
  };

  const handleSave = async () => {
    if (saving) return;
    if (!hasDisplayName(formData)) {
      setError(WIZARD_COPY.steps.identity.nameTooShort);
      return;
    }
    setSaving(true);
    setError(null);
    const accent = formData.botProfile?.accentColor || "#B08D6E";
    const avatarConfig = buildAvatarConfigFromEditor(avatar, accent);
    const displayName = formData.botProfile!.displayName.trim();
    const description =
      formData.botProfile?.tagline?.trim() ||
      formData.description?.trim() ||
      bot.description;
    try {
      await updateAgent(bot.id, {
        description,
        systemPrompt: formData.systemPrompt,
        allowedTools: formData.allowedTools,
        avatar: avatarConfig,
        botProfile: {
          ...bot.botProfile,
          ...formData.botProfile,
          displayName,
          accentColor: accent,
        },
      });
      void saveBotAvatar(bot.id, avatarConfig);
      onClose();
    } catch (err) {
      logger.error({ err }, "Failed to update bot");
      setError(err instanceof Error ? err.message : WIZARD_COPY.edit.saveFailed);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose, saving]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] overflow-auto bg-[var(--bg-elevated)] text-[var(--text-primary)]">
      <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col px-8 pb-12 pt-10 lg:pl-[320px]">
        <header className="sticky top-0 z-10 bg-[var(--bg-elevated)] pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1
                className="text-3xl font-medium tracking-tight text-[var(--text-primary)]"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {WIZARD_COPY.edit.title}
              </h1>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                {WIZARD_COPY.edit.subtitle}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="size-9 inline-flex items-center justify-center rounded-lg border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] disabled:opacity-50"
              aria-label={WIZARD_COPY.header.closeLabel}
            >
              <X size={16} weight="bold" />
            </button>
          </div>
        </header>

        <div className="flex flex-col gap-10 py-4">
          <IdentityStep
            formData={formData}
            setFormData={setFormData}
            updateBotProfile={updateBotProfile}
            updateAccentColor={updateAccentColor}
            onError={setError}
            {...avatarState}
          />
          <JobStep
            formData={formData}
            setFormData={setFormData}
            refining={refining}
            onRefine={handleRefine}
            refineError={refineError}
          />
        </div>

        {error && (
          <p className="mt-2 text-sm text-[var(--status-error)]" role="alert">
            {error}
          </p>
        )}

        <footer className="sticky bottom-0 z-10 mt-auto flex items-center justify-end gap-3 bg-[var(--bg-elevated)] py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="h-10 rounded-lg border border-[var(--border-default)] px-4 text-sm font-medium text-[var(--text-secondary)] hover:border-[var(--border-hover)] hover:text-[var(--text-primary)] disabled:opacity-50"
          >
            {WIZARD_COPY.footer.cancel}
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || !hasDisplayName(formData)}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--text-primary)] px-4 text-sm font-medium text-[var(--bg-elevated)] disabled:opacity-50"
          >
            {saving ? (
              <>
                <CircleNotch size={14} className="animate-spin" />
                {WIZARD_COPY.edit.savingCta}
              </>
            ) : (
              WIZARD_COPY.edit.saveCta
            )}
          </button>
        </footer>
      </div>
    </div>
  );
}
