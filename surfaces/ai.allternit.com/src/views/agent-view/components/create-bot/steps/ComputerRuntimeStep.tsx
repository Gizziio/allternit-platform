"use client";

import React, { useState } from "react";
import {
  CaretDown,
  CaretRight,
  CircleNotch,
  Cloud,
  ComputerTower,
  GearSix,
  HardDrives,
  Headphones,
  Plugs,
  SpeakerHigh,
  SpeakerSlash,
  Sparkle,
} from "@phosphor-icons/react";
import type { CreateAgentInput } from "@/lib/agents/agent.types";
import { AGENT_MODELS } from "@/lib/agents/agent-models";
import type { BrainSummary } from "@/services/brain-api";
import type { Voice } from "@/lib/agents/voice.service";
import {
  BOT_DESKTOP_PRESETS,
  defaultBotVMOperatorConfig,
  describeDesktopResources,
  presetIdForResources,
} from "@/lib/bots/vm-operator";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WIZARD_COPY } from "../wizard-copy";
import { BotBrainBindFields } from "@/lib/bots/BotBrainBindFields";
import { defaultBotBrain, normalizeBotBrain } from "@/lib/bots/bot-brain";

const HARNESS_MODES = [
  { id: "cloud", label: "Cloud", icon: Cloud },
  { id: "byok", label: "BYOK", icon: Plugs },
  { id: "local", label: "Local", icon: HardDrives },
  { id: "subprocess", label: "Subprocess", icon: GearSix },
];

const PROVIDER_COLORS: Record<string, string> = {
  openai: "#10a37f",
  anthropic: "#d97757",
  google: "#4285f4",
  local: "#8b5cf6",
  custom: "#64748b",
};

function shortId(id: string): string {
  if (!id) return "";
  if (id.length <= 16) return id;
  return `${id.slice(0, 8)}…${id.slice(-8)}`;
}

/**
 * Human-readable brain label. BrainSummary has no name field, so derive one
 * from the clone URL (basename without .git) instead of showing truncated
 * ids; fall back to the short id when the URL is unparseable.
 */
export function brainLabel(brain: BrainSummary): string {
  try {
    const path = brain.clone_url?.replace(/\.git$/i, "").split("/").filter(Boolean);
    const name = path?.slice(-2).join("/");
    if (name) return name;
  } catch {
    // fall through
  }
  return shortId(brain.brain_id);
}

interface ComputerRuntimeStepProps {
  formData: Partial<CreateAgentInput>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<CreateAgentInput>>>;
  brains: BrainSummary[];
  brainsLoading: boolean;
  apiModels: typeof AGENT_MODELS;
  modelsLoading: boolean;
  voices: Voice[];
  voicesLoading: boolean;
  isPlaying: boolean;
  onVoicePreview: () => void;
}

/** Step 4 — persistent desktop, size presets, model/provider/brain, advanced. */
export function ComputerRuntimeStep({
  formData,
  setFormData,
  brains,
  brainsLoading,
  apiModels,
  modelsLoading,
  voices,
  voicesLoading,
  isPlaying,
  onVoicePreview,
}: ComputerRuntimeStepProps) {
  const copy = WIZARD_COPY.steps.computer;
  const models = apiModels.length > 0 ? apiModels : AGENT_MODELS;
  const vmConfig = formData.vmOperator;
  const enabled = vmConfig?.enabled === true;
  const [showAdvanced, setShowAdvanced] = useState(false);

  const toggleDesktop = (checked: boolean) =>
    setFormData((prev) => ({
      ...prev,
      vmOperator: {
        ...defaultBotVMOperatorConfig(),
        ...(prev.vmOperator ?? {}),
        enabled: checked,
      },
    }));

  const patchVm = (patch: Partial<NonNullable<CreateAgentInput["vmOperator"]>>) =>
    setFormData((prev) => ({
      ...prev,
      vmOperator: {
        ...defaultBotVMOperatorConfig(),
        ...(prev.vmOperator ?? {}),
        ...patch,
      },
    }));

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-[18px] font-semibold text-[var(--text-primary)]">{copy.title}</h2>
        <p className="text-[14px] text-[var(--text-secondary)] mt-1">{copy.description}</p>
      </div>

      {/* Persistent desktop */}
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6">
        <div className="flex items-center justify-between p-4 rounded-xl border border-[var(--border-subtle)] mb-4">
          <div className="flex items-center gap-3">
            {enabled ? (
              <ComputerTower size={20} className="text-[var(--status-success)]" />
            ) : (
              <ComputerTower size={20} className="text-[var(--text-muted)]" />
            )}
            <div>
              <div className="font-medium text-[var(--text-primary)]">{copy.desktopToggleLabel}</div>
              <div className="text-[13px] text-[var(--text-secondary)]">
                {copy.desktopToggleDescription}
              </div>
            </div>
          </div>
          <Switch checked={enabled} onCheckedChange={toggleDesktop} />
        </div>

        {enabled && (
          <>
            <div className="mb-4">
              <Label className="text-[13px] font-medium text-[var(--text-primary)] mb-2 block">
                {copy.desktopSizeLabel}
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {BOT_DESKTOP_PRESETS.map((preset) => {
                  const selected = presetIdForResources(vmConfig?.resources) === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => patchVm({ resources: { ...preset.resources } })}
                      className={cn(
                        "rounded-xl border p-3 text-left transition-all",
                        selected
                          ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/10"
                          : "border-[var(--border-subtle)] bg-[var(--bg-elevated)] hover:border-[var(--border-hover)]",
                      )}
                    >
                      <span className="block text-[13px] font-semibold text-[var(--text-primary)]">
                        {preset.label}
                      </span>
                      <span className="block text-[12px] text-[var(--text-muted)]">
                        {describeDesktopResources(preset.resources)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4">
                <div className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] mb-1">
                  {copy.desktopProviderLabel}
                </div>
                <div className="text-[13px] font-medium text-[var(--text-primary)]">
                  {copy.desktopProviderValue}
                </div>
              </div>
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4">
                <div className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] mb-1">
                  {copy.desktopResourcesLabel}
                </div>
                <div className="text-[13px] font-medium text-[var(--text-primary)]">
                  {describeDesktopResources(vmConfig?.resources)}
                </div>
              </div>
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4">
                <div className="text-[11px] uppercase tracking-wider text-[var(--text-muted)] mb-1">
                  {copy.desktopPersistenceLabel}
                </div>
                <div className="text-[13px] font-medium text-[var(--text-primary)]">
                  {copy.desktopPersistenceValue}
                </div>
              </div>
            </div>

            <p className="text-[12px] text-[var(--text-muted)]">{copy.desktopNote}</p>
          </>
        )}
      </div>

      {/* Intelligence */}
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6">
        <div className="mb-5">
          <h3 className="text-[16px] font-semibold text-[var(--text-primary)]">
            {copy.intelligenceTitle}
          </h3>
          <p className="text-[13px] text-[var(--text-secondary)] mt-1">
            {copy.intelligenceDescription}
          </p>
        </div>

        <div className="mb-5">
          <BotBrainBindFields
            value={formData.brain ?? defaultBotBrain()}
            onChange={(brain) =>
              setFormData((prev) => ({
                ...prev,
                brain: normalizeBotBrain(
                  brain,
                  prev.provider && prev.model
                    ? { providerID: prev.provider, modelID: prev.model }
                    : undefined,
                ),
              }))
            }
          />
        </div>

        {brains.length > 0 ? (
          <div className="mb-5">
            <Label className="text-[14px] font-medium text-[var(--text-primary)] mb-2 block">
              {copy.knowledgeBrainLabel}
            </Label>
            {brainsLoading ? (
              <div className="h-10 rounded-lg bg-[var(--bg-primary)] animate-pulse" />
            ) : (
              <Select
                value={formData.brainId || "platform"}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, brainId: value === "platform" ? "" : value }))
                }
              >
                <SelectTrigger className="bg-[var(--bg-primary)] border-[var(--border-subtle)] text-[var(--text-primary)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[var(--bg-card)] border-[var(--border-subtle)]">
                  <SelectItem value="platform">Platform model</SelectItem>
                  {brains.map((brain) => (
                    <SelectItem key={brain.brain_id} value={brain.brain_id}>
                      {brainLabel(brain)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        ) : brainsLoading ? (
          <div className="h-10 rounded-lg bg-[var(--bg-primary)] animate-pulse mb-5" />
        ) : (
          <div className="rounded-lg border border-dashed border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4 mb-5 text-[13px] text-[var(--text-muted)]">
            {copy.noBrains}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4">
          <div>
            <Label className="text-[14px] font-medium text-[var(--text-primary)] mb-2 block">
              {copy.modelLabel}
            </Label>
            {modelsLoading ? (
              <div className="h-10 rounded-lg bg-[var(--bg-primary)] animate-pulse" />
            ) : (
              <Select
                value={formData.model}
                onValueChange={(value) => {
                  const selected = models.find((m) => m.id === value);
                  setFormData((prev) => ({
                    ...prev,
                    model: value,
                    provider: selected?.provider || prev.provider,
                  }));
                }}
              >
                <SelectTrigger className="bg-[var(--bg-primary)] border-[var(--border-subtle)] text-[var(--text-primary)]">
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent className="bg-[var(--bg-card)] border-[var(--border-subtle)] max-h-[400px]">
                  {models.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="size-2 rounded-full"
                          style={{ background: PROVIDER_COLORS[model.provider] || "var(--status-info)" }}
                        />
                        <span className="font-medium">{model.name}</span>
                        <span className="text-[12px] text-[var(--text-muted)] ml-1">
                          {model.provider.toUpperCase()}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-[14px] font-medium text-[var(--text-primary)] mb-2 block">
                {copy.providerLabel}
              </Label>
              <Select
                value={formData.provider}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, provider: value as CreateAgentInput["provider"] }))
                }
              >
                <SelectTrigger className="bg-[var(--bg-primary)] border-[var(--border-subtle)] text-[var(--text-primary)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[var(--bg-card)] border-[var(--border-subtle)]">
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="anthropic">Anthropic</SelectItem>
                  <SelectItem value="google">Google</SelectItem>
                  <SelectItem value="local">Local</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[14px] font-medium text-[var(--text-primary)] mb-2 block">
                {copy.harnessLabel}
              </Label>
              <Select
                value={formData.harness?.mode || "cloud"}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, harness: { mode: value as "byok" | "cloud" | "local" | "subprocess" } }))
                }
              >
                <SelectTrigger className="bg-[var(--bg-primary)] border-[var(--border-subtle)] text-[var(--text-primary)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[var(--bg-card)] border-[var(--border-subtle)]">
                  {HARNESS_MODES.map((mode) => (
                    <SelectItem key={mode.id} value={mode.id}>
                      <div className="flex items-center gap-2">
                        <mode.icon size={14} />
                        {mode.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Advanced */}
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)]">
        <button
          type="button"
          onClick={() => setShowAdvanced((v) => !v)}
          className="flex w-full items-center gap-2 px-6 py-4 text-left text-[14px] font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
        >
          {showAdvanced ? <CaretDown size={14} /> : <CaretRight size={14} />}
          {copy.advancedTitle}
        </button>

        {showAdvanced && (
          <div className="px-6 pb-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Label className="text-[14px] font-medium text-[var(--text-primary)] mb-2 block">
                  {copy.maxIterationsLabel}: {formData.maxIterations}
                </Label>
                <Slider
                  value={[formData.maxIterations || 10]}
                  onValueChange={([value]) => setFormData((prev) => ({ ...prev, maxIterations: value }))}
                  min={1}
                  max={50}
                  step={1}
                />
              </div>
              <div>
                <Label className="text-[14px] font-medium text-[var(--text-primary)] mb-2 block">
                  {copy.temperatureLabel}: {formData.temperature}
                </Label>
                <Slider
                  value={[formData.temperature || 0.7]}
                  onValueChange={([value]) => setFormData((prev) => ({ ...prev, temperature: value }))}
                  min={0}
                  max={2}
                  step={0.1}
                />
              </div>
            </div>

            <div>
              <h4 className="text-[14px] font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                <Headphones size={16} className="text-[var(--accent-primary)]" />
                {copy.voiceTitle}
              </h4>
              <div className="flex items-center justify-between p-4 rounded-xl border border-[var(--border-subtle)] mb-4">
                <div className="flex items-center gap-3">
                  {formData.voice?.enabled ? (
                    <SpeakerHigh size={20} className="text-[var(--status-success)]" />
                  ) : (
                    <SpeakerSlash size={20} className="text-[var(--text-muted)]" />
                  )}
                  <div>
                    <div className="font-medium text-[var(--text-primary)]">{copy.voiceToggleLabel}</div>
                    <div className="text-[13px] text-[var(--text-secondary)]">
                      {copy.voiceToggleDescription}
                    </div>
                  </div>
                </div>
                <Switch
                  checked={formData.voice?.enabled || false}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({
                      ...prev,
                      voice: { voiceId: "default", ...prev.voice, enabled: checked },
                    }))
                  }
                />
              </div>

              {formData.voice?.enabled && (
                <div className="flex items-center gap-2">
                  <Select
                    value={formData.voice?.voiceId || "default"}
                    onValueChange={(value) =>
                      setFormData((prev) => ({
                        ...prev,
                        voice: { enabled: true, voiceId: value, ...prev.voice },
                      }))
                    }
                  >
                    <SelectTrigger className="flex-1 bg-[var(--bg-primary)] border-[var(--border-subtle)] text-[var(--text-primary)]">
                      <SelectValue placeholder={voicesLoading ? copy.voiceLoading : copy.voiceSelect} />
                    </SelectTrigger>
                    <SelectContent className="bg-[var(--bg-card)] border-[var(--border-subtle)]">
                      {voices.length === 0 && (
                        <SelectItem value="default" disabled>
                          {copy.voiceDefault}
                        </SelectItem>
                      )}
                      {voices.map((voice) => (
                        <SelectItem key={voice.id} value={voice.id}>
                          {voice.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={onVoicePreview}
                    disabled={!formData.voice?.enabled || isPlaying || voicesLoading}
                  >
                    {isPlaying ? <CircleNotch size={16} className="animate-spin" /> : <Sparkle size={16} />}
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
