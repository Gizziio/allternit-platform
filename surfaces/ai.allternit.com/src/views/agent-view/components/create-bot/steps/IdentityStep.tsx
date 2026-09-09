"use client";

import React from "react";
import { ChatText } from "@phosphor-icons/react";
import type { BotCategory, CreateAgentInput } from "@/lib/agents/agent.types";
import { BOT_CATEGORIES } from "@/lib/bots/bot-profile";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { TagInput } from "@/components/ui/tag-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WIZARD_COPY } from "../wizard-copy";
import { deriveHandle, hasDisplayName } from "../wizard-state";
import { AvatarEditor, type AvatarEditorState } from "./AvatarEditor";

const ACCENT_COLORS = [
  "#D4956A",
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#f43f5e",
  "#f97316",
  "#f59e0b",
  "#10b981",
  "#06b6d4",
  "#0ea5e9",
  "#3b82f6",
  "#64748b",
];

const CATEGORY_OPTIONS: BotCategory[] = [
  "research",
  "code",
  "writing",
  "data",
  "sales",
  "design",
  "ops",
  "custom",
];

interface IdentityStepProps extends AvatarEditorState {
  formData: Partial<CreateAgentInput>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<CreateAgentInput>>>;
  updateBotProfile: (patch: Partial<NonNullable<CreateAgentInput["botProfile"]>>) => void;
  updateAccentColor: (color: string) => void;
  onError: (message: string) => void;
}

/** Step 2 — name, handle, category, copy, accent, starter prompts, and avatar. */
export function IdentityStep({
  formData,
  setFormData,
  updateBotProfile,
  updateAccentColor,
  onError,
  ...avatarState
}: IdentityStepProps) {
  const copy = WIZARD_COPY.steps.identity;
  const botProfile = formData.botProfile!;
  const accentColor = botProfile.accentColor || "#D4956A";
  const nameValid = hasDisplayName(formData);

  return (
    <section className="space-y-8">
      <div>
        <h2 className="text-[18px] font-semibold text-[var(--text-primary)]">{copy.title}</h2>
        <p className="text-[14px] text-[var(--text-secondary)] mt-1">{copy.description}</p>
      </div>

      {/* Display name — the only hard gate in the wizard */}
      <div>
        <Label className="text-[14px] font-medium text-[var(--text-primary)] mb-2 block">
          {copy.displayNameLabel}
        </Label>
        <Input
          value={botProfile.displayName || ""}
          onChange={(e) => {
            const value = e.target.value;
            updateBotProfile({ displayName: value });
            setFormData((prev) => ({ ...prev, name: prev.name || deriveHandle(value) }));
          }}
          placeholder={copy.displayNamePlaceholder}
          className="bg-[var(--bg-primary)] border-[var(--border-subtle)] text-[var(--text-primary)] text-[16px] py-3"
        />
        <p className={cn("text-[11px] mt-1.5", nameValid ? "text-[var(--text-muted)]" : "text-[var(--status-error)]")}>
          {nameValid
            ? `${copy.displayNameHint} Handle: @${formData.name || "bot"} (auto-derived)`
            : copy.nameTooShort}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label className="text-[14px] font-medium text-[var(--text-primary)] mb-2 block">
            {copy.handleLabel}
          </Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-[14px]">@</span>
            <Input
              value={formData.name || ""}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: deriveHandle(e.target.value) }))}
              placeholder={copy.handlePlaceholder}
              className="pl-7 bg-[var(--bg-primary)] border-[var(--border-subtle)] text-[var(--text-primary)]"
            />
          </div>
        </div>
        <div>
          <Label className="text-[14px] font-medium text-[var(--text-primary)] mb-2 block">
            {copy.taglineLabel}
          </Label>
          <Input
            value={botProfile.tagline || ""}
            onChange={(e) => updateBotProfile({ tagline: e.target.value })}
            placeholder={copy.taglinePlaceholder}
            className="bg-[var(--bg-primary)] border-[var(--border-subtle)] text-[var(--text-primary)]"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label className="text-[14px] font-medium text-[var(--text-primary)] mb-2 block">
            {copy.categoryLabel}
          </Label>
          <Select
            value={botProfile.botCategory || "custom"}
            onValueChange={(value) => updateBotProfile({ botCategory: value as BotCategory })}
          >
            <SelectTrigger className="bg-[var(--bg-primary)] border-[var(--border-subtle)] text-[var(--text-primary)]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[var(--bg-card)] border-[var(--border-subtle)]">
              {CATEGORY_OPTIONS.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {BOT_CATEGORIES[cat].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[14px] font-medium text-[var(--text-primary)] mb-2 block">
            {copy.accentLabel}
          </Label>
          <div className="flex flex-wrap gap-2">
            {ACCENT_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => updateAccentColor(color)}
                className={cn(
                  "size-9 rounded-full transition-transform hover:scale-110",
                  accentColor === color &&
                    "ring-2 ring-[var(--text-primary)] ring-offset-2 ring-offset-[var(--bg-card)]",
                )}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </div>
      </div>

      <div>
        <Label className="text-[14px] font-medium text-[var(--text-primary)] mb-2 block">
          {copy.purposeLabel}
        </Label>
        <Textarea
          value={formData.description || ""}
          onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
          placeholder={copy.purposePlaceholder}
          rows={3}
          className="bg-[var(--bg-primary)] border-[var(--border-subtle)] text-[var(--text-primary)] resize-none"
        />
      </div>

      <div>
        <Label className="text-[14px] font-medium text-[var(--text-primary)] mb-2 block">
          {copy.welcomeLabel}
        </Label>
        <Textarea
          value={botProfile.welcomeMessage || ""}
          onChange={(e) => updateBotProfile({ welcomeMessage: e.target.value })}
          placeholder={copy.welcomePlaceholder}
          rows={2}
          className="bg-[var(--bg-primary)] border-[var(--border-subtle)] text-[var(--text-primary)] resize-none"
        />
      </div>

      <div>
        <Label className="text-[14px] font-medium text-[var(--text-primary)] mb-2 flex items-center gap-2">
          <ChatText size={14} />
          {copy.starterPromptsLabel}
        </Label>
        <TagInput
          value={botProfile.starterPrompts || []}
          onChange={(tags) => updateBotProfile({ starterPrompts: tags.slice(0, 5) })}
          placeholder={copy.starterPromptsPlaceholder}
        />
        <p className="text-[11px] text-[var(--text-muted)] mt-1">{copy.starterPromptsHint}</p>
      </div>

      {/* Avatar — the five existing modes, lifted as-is */}
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6">
        <div className="mb-6">
          <h3 className="text-[16px] font-semibold text-[var(--text-primary)]">{copy.avatarTitle}</h3>
          <p className="text-[13px] text-[var(--text-secondary)] mt-1">{copy.avatarDescription}</p>
        </div>
        <AvatarEditor botProfile={botProfile} onError={onError} {...avatarState} />
      </div>
    </section>
  );
}
