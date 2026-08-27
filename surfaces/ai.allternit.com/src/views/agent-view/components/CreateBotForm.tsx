"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle,
  Warning,
  ArrowRight,
  ArrowLeft,
  Robot,
  Brain,
  Sparkle,
  Image as ImageIcon,
  Ghost,
  X,
  CircleNotch,
  UploadSimple,
  Palette,
  Lightning,
  Headphones,
  SpeakerHigh,
  SpeakerSlash,
  ComputerTower,
  GearSix,
  Circle,
  Cloud,
  HardDrives,
  Plugs,
  Tag,
  ChatText,
} from "@phosphor-icons/react";
import { useAgentStore } from "@/lib/agents/agent.store";
import { getDefaultAgentModel, AGENT_MODELS } from "@/lib/agents/agent-models";
import { STUDIO_THEME } from "@/views/agent-view/AgentView.constants";
import type {
  CreateAgentInput,
  AvatarConfig,
  BotCategory,
  MascotTemplate,
} from "@/lib/agents/agent.types";
import { fetchBrains, type BrainSummary } from "@/services/brain-api";
import {
  AgentAvatarPicker,
  createDefaultAvatarPickerConfig,
  type AvatarPickerConfig,
} from "@/views/agent-view/components/AgentAvatarPicker";
import { GizziMascot, type GizziEmotion } from "@/components/ai-elements/GizziMascot";
import { MascotPreview } from "@/views/agent-view/components/AgentMascotPreview";
import { BOT_CATEGORIES } from "@/lib/bots/bot-profile";
import { api } from "@/integration/api-client";
import { voiceService, type Voice } from "@/lib/agents/voice.service";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { TagInput } from "@/components/ui/tag-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { createModuleLogger } from "@/lib/logger";

const logger = createModuleLogger("CreateBotForm");

interface CreateBotFormProps {
  isOpen: boolean;
  onClose: () => void;
}

type StepId = "identity" | "avatar" | "runtime" | "review";

interface StepInfo {
  id: StepId;
  label: string;
  description: string;
}

const STEPS: StepInfo[] = [
  { id: "identity", label: "Identity", description: "Name, tagline, and purpose" },
  { id: "avatar", label: "Avatar", description: "Visual identity and mascot" },
  { id: "runtime", label: "Runtime", description: "Brain, model, and voice" },
  { id: "review", label: "Review", description: "Preview and launch" },
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

const GIZZI_EMOTIONS: GizziEmotion[] = [
  "pleased",
  "curious",
  "focused",
  "steady",
  "alert",
  "proud",
];

const MASCOT_TEMPLATES: MascotTemplate[] = [
  "gizzi",
  "bot",
  "orb",
  "creature",
  "geometric",
  "minimal",
  "cyber",
  "magic",
  "nature",
  "data",
  "security",
  "finance",
  "healthcare",
  "education",
  "legal",
  "science",
  "gaming",
  "music",
  "sports",
  "travel",
  "food",
  "fashion",
  "realEstate",
  "retail",
];

const HARNESS_MODES = [
  { id: "cloud", label: "Cloud", icon: Cloud, description: "Managed Allternit runtime" },
  { id: "byok", label: "BYOK", icon: Plugs, description: "Bring your own API keys" },
  { id: "local", label: "Local", icon: HardDrives, description: "Run on this machine" },
  { id: "subprocess", label: "Subprocess", icon: GearSix, description: "Custom command runner" },
];

const PROVIDER_COLORS: Record<string, string> = {
  openai: "#10a37f",
  anthropic: "#d97757",
  google: "#4285f4",
  local: "#8b5cf6",
  custom: "#64748b",
};

function deriveHandle(displayName: string): string {
  return (
    displayName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 64) || "my-bot"
  );
}

function shortId(id: string): string {
  if (!id) return "";
  if (id.length <= 16) return id;
  return `${id.slice(0, 8)}…${id.slice(-8)}`;
}

export function CreateBotForm({ isOpen, onClose }: CreateBotFormProps) {
  const { createAgent, isCreating } = useAgentStore();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<Partial<CreateAgentInput>>(() => ({
    name: "",
    description: "",
    type: "worker",
    model: getDefaultAgentModel().id,
    provider: getDefaultAgentModel().provider,
    capabilities: [],
    tools: [],
    maxIterations: 10,
    temperature: 0.7,
    trustTier: "standard",
    writeScope: "workspace",
    dataClassification: "internal",
    allowedSurfaces: ["chat"],
    allowedSkills: [],
    allowedTools: [],
    category: "general",
    tags: [],
    harness: { mode: "cloud" },
    isBot: true,
    botProfile: {
      displayName: "",
      tagline: "",
      welcomeMessage: "",
      starterPrompts: [],
      accentColor: STUDIO_THEME.accent,
      groupChatEnabled: true,
      botCategory: "custom",
    },
    brainId: "",
  }));

  const [avatarMode, setAvatarMode] = useState<"initials" | "gizzi" | "mascot" | "image" | "pet">("gizzi");
  const [avatarPicker, setAvatarPicker] = useState<AvatarPickerConfig>(() =>
    createDefaultAvatarPickerConfig("")
  );
  const [mascotTemplate, setMascotTemplate] = useState<MascotTemplate>("gizzi");
  const [gizziColor, setGizziColor] = useState("#D4956A");
  const [gizziEmotion, setGizziEmotion] = useState<GizziEmotion>("pleased");
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [petUrl, setPetUrl] = useState("");

  const [brains, setBrains] = useState<BrainSummary[]>([]);
  const [brainsLoading, setBrainsLoading] = useState(false);
  const [apiModels, setApiModels] = useState<typeof AGENT_MODELS>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [voicesLoading, setVoicesLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const stepId = STEPS[step].id;

  // Reset when reopened
  useEffect(() => {
    if (!isOpen) return;
    setStep(0);
    setError(null);
    setFormData({
      name: "",
      description: "",
      type: "worker",
      model: getDefaultAgentModel().id,
      provider: getDefaultAgentModel().provider,
      capabilities: [],
      tools: [],
      maxIterations: 10,
      temperature: 0.7,
      trustTier: "standard",
      writeScope: "workspace",
      dataClassification: "internal",
      allowedSurfaces: ["chat"],
      allowedSkills: [],
      allowedTools: [],
      category: "general",
      tags: [],
      harness: { mode: "cloud" },
      isBot: true,
      botProfile: {
        displayName: "",
        tagline: "",
        welcomeMessage: "",
        starterPrompts: [],
        accentColor: STUDIO_THEME.accent,
        groupChatEnabled: true,
        botCategory: "custom",
      },
      brainId: "",
    });
    setAvatarMode("gizzi");
    setAvatarPicker(createDefaultAvatarPickerConfig(""));
    setMascotTemplate("gizzi");
    setGizziColor("#D4956A");
    setGizziEmotion("pleased");
    setImageDataUrl(null);
    setPetUrl("");
  }, [isOpen]);

  // Load brains, models, voices
  useEffect(() => {
    if (!isOpen) return;

    setBrainsLoading(true);
    fetchBrains()
      .then(setBrains)
      .catch((err) => logger.error({ err }, "Failed to load brains"))
      .finally(() => setBrainsLoading(false));

    setModelsLoading(true);
    api
      .get("/api/v1/models")
      .then((models) => {
        if (Array.isArray(models)) setApiModels(models as typeof AGENT_MODELS);
      })
      .catch(() => setApiModels(AGENT_MODELS))
      .finally(() => setModelsLoading(false));

    setVoicesLoading(true);
    voiceService
      .listVoices()
      .then(setVoices)
      .catch(() => setVoices([]))
      .finally(() => setVoicesLoading(false));
  }, [isOpen]);

  const updateBotProfile = useCallback(
    (patch: Partial<NonNullable<CreateAgentInput["botProfile"]>>) => {
      setFormData((prev) => ({
        ...prev,
        botProfile: { ...(prev.botProfile || {}), ...patch } as CreateAgentInput["botProfile"],
      }));
    },
    []
  );

  const updateAccentColor = useCallback(
    (color: string) => {
      updateBotProfile({ accentColor: color });
      if (avatarMode === "gizzi") setGizziColor(color);
    },
    [avatarMode, updateBotProfile]
  );

  const handleImageUpload = (file: File) => {
    if (file.size > 15_000_000) {
      setError("Image too large (max 15MB).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setImageDataUrl(reader.result as string);
      setAvatarMode("image");
    };
    reader.onerror = () => setError("Failed to read image.");
    reader.readAsDataURL(file);
  };

  const buildAvatarConfig = useCallback((): AvatarConfig => {
    const accent = formData.botProfile?.accentColor || STUDIO_THEME.accent;

    switch (avatarMode) {
      case "initials":
        return {
          type: "color",
          colors: {
            primary: avatarPicker.bgColor,
            secondary: avatarPicker.textColor,
            glow: avatarPicker.bgColor,
          },
          style: { primaryColor: avatarPicker.bgColor, accentColor: avatarPicker.textColor },
        } as AvatarConfig;
      case "image":
        return {
          type: "image",
          uri: imageDataUrl || undefined,
          colors: { primary: accent, secondary: "#ffffff", glow: accent },
        } as AvatarConfig;
      case "pet":
        return {
          type: "mascot",
          mascotTemplate: "pet",
          colors: { primary: accent, secondary: "#ffffff", glow: accent },
          pet: petUrl
            ? {
                spriteUrl: petUrl,
                frameWidth: 192,
                frameHeight: 208,
                columns: 8,
                rows: 9,
              }
            : undefined,
        } as AvatarConfig;
      case "mascot":
        return {
          type: "mascot",
          mascotTemplate,
          colors: { primary: accent, secondary: "#ffffff", glow: accent },
        } as AvatarConfig;
      case "gizzi":
      default:
        return {
          type: "mascot",
          mascotTemplate: "gizzi",
          colors: { primary: gizziColor, secondary: "#ffffff", glow: gizziColor },
          currentEmotion: gizziEmotion,
        } as AvatarConfig;
    }
  }, [avatarMode, avatarPicker, formData.botProfile?.accentColor, gizziColor, gizziEmotion, imageDataUrl, mascotTemplate, petUrl]);

  const canAdvance = useMemo(() => {
    switch (stepId) {
      case "identity":
        return (
          (formData.name?.length || 0) >= 2 &&
          (formData.botProfile?.displayName?.length || 0) >= 2 &&
          (formData.description?.length || 0) >= 3
        );
      case "avatar":
        return true;
      case "runtime":
        return true;
      case "review":
        return true;
    }
  }, [stepId, formData]);

  const stepValidation = useMemo(
    () => ({
      identity: canAdvance,
      avatar: true,
      runtime: true,
      review: canAdvance,
    }),
    [canAdvance]
  );

  const handleNext = () => {
    if (step < STEPS.length - 1 && canAdvance) setStep((s) => s + 1);
  };

  const handleBack = () => {
    if (step > 0) setStep((s) => s - 1);
  };

  const handleCreate = async () => {
    if (!canAdvance || isCreating) return;
    setError(null);

    const botProfile = formData.botProfile!;
    const name = formData.name || deriveHandle(botProfile.displayName || "my-bot");
    const accentColor = botProfile.accentColor || STUDIO_THEME.accent;
    const avatar = buildAvatarConfig();

    const payload = {
      ...formData,
      name,
      description: botProfile.tagline || formData.description || "",
      avatar,
      botProfile: {
        ...botProfile,
        displayName: botProfile.displayName || name,
        accentColor,
      } as CreateAgentInput["botProfile"],
      brainId: formData.brainId || undefined,
      config: {
        ...(formData.config || {}),
        brainId: formData.brainId || undefined,
      },
    } as CreateAgentInput;

    try {
      const created = await createAgent(payload);
      onClose();
      window.dispatchEvent(
        new CustomEvent("allternit:open-view", {
          detail: { viewType: "bot-home", context: { botId: created.id } },
        })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create bot.");
    }
  };

  const handleVoicePreview = async () => {
    if (isPlaying) return;
    const voiceId = formData.voice?.voiceId || "default";
    setIsPlaying(true);
    try {
      const audioUrl = await voiceService.previewVoice(
        voiceId,
        `Hi, I'm ${formData.botProfile?.displayName || "your new bot"}.`
      );
      const audio = new Audio(audioUrl);
      audio.onended = () => setIsPlaying(false);
      audio.play();
    } catch {
      setIsPlaying(false);
    }
  };

  const checklist = useMemo(() => {
    const items = [
      { id: "name", label: "Bot handle", satisfied: (formData.name?.length || 0) >= 2 },
      { id: "displayName", label: "Display name", satisfied: (formData.botProfile?.displayName?.length || 0) >= 2 },
      { id: "description", label: "Purpose / tagline", satisfied: (formData.description?.length || 0) >= 3 },
      { id: "avatar", label: "Avatar", satisfied: true },
      { id: "model", label: "Model configured", satisfied: Boolean(formData.model) },
    ];
    return {
      items,
      requiredTotal: items.length,
      requiredSatisfied: items.filter((i) => i.satisfied).length,
      isValid: items.every((i) => i.satisfied),
    };
  }, [formData]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[var(--shell-overlay-backdrop)] backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isCreating) onClose();
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        className="relative flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] shadow-2xl"
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--border-subtle)] px-6 py-4">
          <div>
            <h2 className="text-xl font-medium text-[var(--text-primary)] flex items-center gap-2">
              <Robot size={22} className="text-[var(--accent-primary)]" />
              Create bot
            </h2>
            <p className="text-[13px] text-[var(--text-secondary)]">
              {STEPS[step].description}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isCreating}
            className="size-8 inline-flex items-center justify-center rounded-lg border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors disabled:opacity-50"
          >
            <X size={14} weight="bold" />
          </button>
        </div>

        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Main content */}
          <div className="flex flex-1 flex-col min-h-0">
            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="mx-6 mt-4 flex items-center gap-2 rounded-lg border border-[var(--status-error)]/30 bg-[var(--status-error)]/10 px-4 py-3 text-[13px] text-[var(--status-error)]"
                >
                  <Warning size={16} weight="fill" />
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Step grid */}
            <div className="px-6 pt-5 pb-2">
              <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {STEPS.map((s, idx) => {
                    const selected = idx === step;
                    const completed = idx < step;
                    const unlocked = idx <= step;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        disabled={!unlocked}
                        onClick={() => unlocked && setStep(idx)}
                        className={cn(
                          "text-left transition-all duration-200 p-3 rounded-lg border",
                          selected
                            ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/10"
                            : completed
                              ? "border-[var(--accent-primary)]/40 bg-[var(--accent-primary)]/5"
                              : "border-[var(--border-subtle)] bg-[var(--bg-card)]"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={cn(
                              "text-sm font-medium",
                              selected ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]"
                            )}
                          >
                            {s.label}
                          </span>
                          {completed || selected ? (
                            <CheckCircle size={16} className="text-[var(--accent-primary)]" />
                          ) : (
                            <Circle size={16} className="text-[var(--text-muted)]" />
                          )}
                        </div>
                        <p className="text-[11px] text-[var(--text-muted)] mt-1">{s.description}</p>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-3 px-3 py-2 rounded-md border border-[var(--border-subtle)] text-[12px] text-[var(--text-secondary)]">
                  Step {step + 1} of {STEPS.length}: {STEPS[step].description}
                </div>
              </div>
            </div>

            {/* Step content */}
            <div className="flex-1 overflow-auto px-6 py-2">
              <AnimatePresence mode="wait">
                <motion.div
                  key={stepId}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="pb-24"
                >
                  {stepId === "identity" && (
                    <IdentityStep
                      formData={formData}
                      setFormData={setFormData}
                      updateBotProfile={updateBotProfile}
                      updateAccentColor={updateAccentColor}
                    />
                  )}
                  {stepId === "avatar" && (
                    <AvatarStep
                      botProfile={formData.botProfile!}
                      avatarMode={avatarMode}
                      setAvatarMode={setAvatarMode}
                      avatarPicker={avatarPicker}
                      setAvatarPicker={setAvatarPicker}
                      mascotTemplate={mascotTemplate}
                      setMascotTemplate={setMascotTemplate}
                      gizziColor={gizziColor}
                      setGizziColor={setGizziColor}
                      gizziEmotion={gizziEmotion}
                      setGizziEmotion={setGizziEmotion}
                      imageDataUrl={imageDataUrl}
                      setImageDataUrl={setImageDataUrl}
                      petUrl={petUrl}
                      setPetUrl={setPetUrl}
                      fileInputRef={fileInputRef}
                      onImageUpload={handleImageUpload}
                    />
                  )}
                  {stepId === "runtime" && (
                    <RuntimeStep
                      formData={formData}
                      setFormData={setFormData}
                      brains={brains}
                      brainsLoading={brainsLoading}
                      apiModels={apiModels}
                      modelsLoading={modelsLoading}
                      voices={voices}
                      voicesLoading={voicesLoading}
                      isPlaying={isPlaying}
                      onVoicePreview={handleVoicePreview}
                    />
                  )}
                  {stepId === "review" && (
                    <ReviewStep
                      formData={formData}
                      avatarMode={avatarMode}
                      mascotTemplate={mascotTemplate}
                      gizziColor={gizziColor}
                      gizziEmotion={gizziEmotion}
                      imageDataUrl={imageDataUrl}
                      petUrl={petUrl}
                      brainCount={brains.length}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Footer */}
            <div className="shrink-0 flex items-center justify-between border-t border-[var(--border-subtle)] bg-[var(--bg-card)] px-6 py-4">
              <Button variant="outline" onClick={step === 0 ? onClose : handleBack} disabled={isCreating}>
                {step === 0 ? "Cancel" : "Previous"}
              </Button>

              {step < STEPS.length - 1 ? (
                <Button
                  onClick={handleNext}
                  disabled={!canAdvance}
                  className="gap-1.5 bg-gradient-to-r from-[var(--accent-primary)] to-[#B08D6E] text-[var(--ui-text-inverse)] border-none"
                >
                  Next
                  <ArrowRight size={14} />
                </Button>
              ) : (
                <Button
                  onClick={handleCreate}
                  disabled={!canAdvance || isCreating}
                  className="gap-1.5 bg-gradient-to-r from-[var(--accent-primary)] to-[#B08D6E] text-[var(--ui-text-inverse)] border-none"
                >
                  {isCreating ? (
                    <>
                      <CircleNotch size={14} className="animate-spin" />
                      Creating…
                    </>
                  ) : (
                    <>
                      <Sparkle size={14} weight="fill" />
                      Create bot
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>

          {/* Side checklist */}
          <aside className="w-[260px] shrink-0 hidden xl:flex flex-col border-l border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
            <h3 className="text-[14px] font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
              <CheckCircle size={16} className="text-[var(--accent-primary)]" />
              Creation Checklist
            </h3>
            <div className="mb-4">
              <div className="flex items-center justify-between text-[12px] text-[var(--text-secondary)] mb-1">
                <span>Required</span>
                <span className="font-medium text-[var(--text-primary)]">
                  {checklist.requiredSatisfied}/{checklist.requiredTotal}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-[var(--bg-primary)] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[var(--accent-primary)] transition-[width] duration-300"
                  style={{
                    width: `${checklist.requiredTotal ? (checklist.requiredSatisfied / checklist.requiredTotal) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
            <ul className="space-y-2">
              {checklist.items.map((item) => (
                <li
                  key={item.id}
                  className={cn(
                    "flex items-start gap-2 text-[13px]",
                    item.satisfied ? "text-[var(--text-secondary)]" : "text-[var(--text-muted)]"
                  )}
                >
                  {item.satisfied ? (
                    <CheckCircle size={14} className="text-[var(--status-success)] shrink-0 mt-0.5" />
                  ) : (
                    <Circle size={14} className="text-[var(--text-muted)] shrink-0 mt-0.5" />
                  )}
                  <span>{item.label}</span>
                </li>
              ))}
            </ul>

            {/* Live preview card */}
            <div className="mt-6 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4">
              <div className="text-[12px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
                Preview
              </div>
              <div className="flex items-center gap-3">
                <div
                  className="flex size-12 items-center justify-center rounded-xl text-[18px] font-bold"
                  style={{
                    background: `color-mix(in srgb, ${formData.botProfile?.accentColor || STUDIO_THEME.accent} 18%, transparent)`,
                    color: formData.botProfile?.accentColor || STUDIO_THEME.accent,
                  }}
                >
                  {formData.botProfile?.displayName?.slice(0, 2).toUpperCase() || "B"}
                </div>
                <div className="min-w-0">
                  <div className="text-[14px] font-semibold text-[var(--text-primary)] truncate">
                    {formData.botProfile?.displayName || "Untitled bot"}
                  </div>
                  <div className="text-[12px] text-[var(--text-muted)] truncate">
                    @{formData.name || "bot"}
                  </div>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </motion.div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Identity step                                                              */
/* -------------------------------------------------------------------------- */

function IdentityStep({
  formData,
  setFormData,
  updateBotProfile,
  updateAccentColor,
}: {
  formData: Partial<CreateAgentInput>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<CreateAgentInput>>>;
  updateBotProfile: (patch: Partial<NonNullable<CreateAgentInput["botProfile"]>>) => void;
  updateAccentColor: (color: string) => void;
}) {
  const botProfile = formData.botProfile!;
  const accentColor = botProfile.accentColor || STUDIO_THEME.accent;

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

  return (
    <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6">
      <div className="mb-6">
        <h2 className="text-[18px] font-semibold text-[var(--text-primary)] flex items-center gap-2">
          <Sparkle size={20} className="text-[var(--accent-primary)]" />
          Bot Identity
        </h2>
        <p className="text-[14px] text-[var(--text-secondary)] mt-1">
          Define the handle, display name, and tagline for this bot. The handle is what users type after @.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
        <div>
          <Label className="text-[14px] font-medium text-[var(--text-primary)] mb-2 block">Display name</Label>
          <Input
            value={botProfile.displayName || ""}
            onChange={(e) => {
              const value = e.target.value;
              updateBotProfile({ displayName: value });
              setFormData((prev) => ({ ...prev, name: prev.name || deriveHandle(value) }));
            }}
            placeholder="e.g. Research Assistant"
            className="bg-[var(--bg-primary)] border-[var(--border-subtle)] text-[var(--text-primary)]"
          />
        </div>
        <div>
          <Label className="text-[14px] font-medium text-[var(--text-primary)] mb-2 block">Handle</Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-[14px]">@</span>
            <Input
              value={formData.name || ""}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: deriveHandle(e.target.value) }))}
              placeholder="research-assistant"
              className="pl-7 bg-[var(--bg-primary)] border-[var(--border-subtle)] text-[var(--text-primary)]"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
        <div>
          <Label className="text-[14px] font-medium text-[var(--text-primary)] mb-2 block">Tagline</Label>
          <Input
            value={botProfile.tagline || ""}
            onChange={(e) => updateBotProfile({ tagline: e.target.value })}
            placeholder="Short description shown on the bot card"
            className="bg-[var(--bg-primary)] border-[var(--border-subtle)] text-[var(--text-primary)]"
          />
        </div>
        <div>
          <Label className="text-[14px] font-medium text-[var(--text-primary)] mb-2 block">Category</Label>
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
      </div>

      <div className="mb-5">
        <Label className="text-[14px] font-medium text-[var(--text-primary)] mb-2 block">Purpose / description</Label>
        <Textarea
          value={formData.description || ""}
          onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
          placeholder="What does this bot do?"
          rows={3}
          className="bg-[var(--bg-primary)] border-[var(--border-subtle)] text-[var(--text-primary)] resize-none"
        />
      </div>

      <div className="mb-5">
        <Label className="text-[14px] font-medium text-[var(--text-primary)] mb-2 block">Welcome message</Label>
        <Textarea
          value={botProfile.welcomeMessage || ""}
          onChange={(e) => updateBotProfile({ welcomeMessage: e.target.value })}
          placeholder="Hi! I'm your new bot. How can I help?"
          rows={2}
          className="bg-[var(--bg-primary)] border-[var(--border-subtle)] text-[var(--text-primary)] resize-none"
        />
      </div>

      <div className="mb-2">
        <Label className="text-[14px] font-medium text-[var(--text-primary)] mb-2 block">Accent color</Label>
        <div className="flex flex-wrap gap-2">
          {ACCENT_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => updateAccentColor(color)}
              className={cn(
                "size-9 rounded-full transition-transform hover:scale-110",
                accentColor === color && "ring-2 ring-[var(--text-primary)] ring-offset-2 ring-offset-[var(--bg-card)]"
              )}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>

      <div className="mt-5">
        <Label className="text-[14px] font-medium text-[var(--text-primary)] mb-2 flex items-center gap-2">
          <ChatText size={14} />
          Starter prompts
        </Label>
        <TagInput
          value={botProfile.starterPrompts || []}
          onChange={(tags) => updateBotProfile({ starterPrompts: tags.slice(0, 5) })}
          placeholder="Add quick-start prompts users can click…"
        />
        <p className="text-[11px] text-[var(--text-muted)] mt-1">Max 5 starter prompts.</p>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Avatar step                                                                */
/* -------------------------------------------------------------------------- */

function AvatarStep({
  botProfile,
  avatarMode,
  setAvatarMode,
  avatarPicker,
  setAvatarPicker,
  mascotTemplate,
  setMascotTemplate,
  gizziColor,
  setGizziColor,
  gizziEmotion,
  setGizziEmotion,
  imageDataUrl,
  setImageDataUrl,
  petUrl,
  setPetUrl,
  fileInputRef,
  onImageUpload,
}: {
  botProfile: NonNullable<CreateAgentInput["botProfile"]>;
  avatarMode: string;
  setAvatarMode: (mode: any) => void;
  avatarPicker: AvatarPickerConfig;
  setAvatarPicker: React.Dispatch<React.SetStateAction<AvatarPickerConfig>>;
  mascotTemplate: MascotTemplate;
  setMascotTemplate: (t: MascotTemplate) => void;
  gizziColor: string;
  setGizziColor: (c: string) => void;
  gizziEmotion: GizziEmotion;
  setGizziEmotion: (e: GizziEmotion) => void;
  imageDataUrl: string | null;
  setImageDataUrl: (url: string | null) => void;
  petUrl: string;
  setPetUrl: (url: string) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onImageUpload: (file: File) => void;
}) {
  const accentColor = botProfile.accentColor || STUDIO_THEME.accent;
  const displayName = botProfile.displayName || "Bot";

  const preview = useMemo(() => {
    switch (avatarMode) {
      case "initials":
        return (
          <div
            className="flex items-center justify-center rounded-2xl text-[28px] font-bold"
            style={{
              width: 96,
              height: 96,
              background: avatarPicker.bgColor,
              color: avatarPicker.textColor,
              borderRadius: avatarPicker.shape === "circle" ? "50%" : avatarPicker.shape === "rounded" ? "20px" : "8px",
            }}
          >
            {avatarPicker.initial || displayName.slice(0, 2).toUpperCase()}
          </div>
        );
      case "image":
        return imageDataUrl ? (
          <img src={imageDataUrl} alt="Bot avatar" className="size-24 rounded-2xl object-cover" />
        ) : (
          <ImageIcon size={48} className="text-[var(--text-muted)]" />
        );
      case "pet":
        return petUrl ? <PetPreview spriteUrl={petUrl} /> : <Ghost size={48} className="text-[var(--text-muted)]" />;
      case "mascot":
        return (
          <div className="scale-[0.72] origin-center">
            <MascotPreview config={{ mascotTemplate, style: { primaryColor: accentColor } }} name="" />
          </div>
        );
      case "gizzi":
      default:
        return <GizziMascot size={96} emotion={gizziEmotion} />;
    }
  }, [accentColor, avatarMode, avatarPicker, displayName, gizziEmotion, imageDataUrl, mascotTemplate, petUrl]);

  return (
    <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6">
      <div className="mb-6">
        <h2 className="text-[18px] font-semibold text-[var(--text-primary)] flex items-center gap-2">
          <Palette size={20} className="text-[var(--accent-primary)]" />
          Avatar
        </h2>
        <p className="text-[14px] text-[var(--text-secondary)] mt-1">
          Choose a visual identity for your bot. Gizzi is the default companion.
        </p>
      </div>

      {/* Preview */}
      <div className="flex justify-center mb-6">
        <div
          className="flex size-36 items-center justify-center rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)]"
          style={{ boxShadow: `0 0 40px ${accentColor}18` }}
        >
          {preview}
        </div>
      </div>

      {/* Mode tabs */}
      <div className="flex flex-wrap justify-center gap-2 mb-6">
        <ModeButton active={avatarMode === "gizzi"} onClick={() => setAvatarMode("gizzi")} icon={Robot} label="Gizzi" />
        <ModeButton active={avatarMode === "mascot"} onClick={() => setAvatarMode("mascot")} icon={Sparkle} label="Mascot" />
        <ModeButton active={avatarMode === "initials"} onClick={() => setAvatarMode("initials")} icon={Tag} label="Initials" />
        <ModeButton active={avatarMode === "image"} onClick={() => setAvatarMode("image")} icon={ImageIcon} label="Image" />
        <ModeButton active={avatarMode === "pet"} onClick={() => setAvatarMode("pet")} icon={Ghost} label="Pet" />
      </div>

      {/* Mode-specific controls */}
      {avatarMode === "gizzi" && (
        <div className="space-y-5">
          <div>
            <Label className="text-[14px] font-medium text-[var(--text-primary)] mb-2 block">Gizzi color</Label>
            <div className="flex flex-wrap gap-2">
              {["#D4956A", "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e", "#10b981", "#06b6d4", "#0ea5e9", "#3b82f6", "#64748b"].map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setGizziColor(color)}
                  className={cn(
                    "size-9 rounded-full transition-transform hover:scale-110",
                    gizziColor === color && "ring-2 ring-[var(--text-primary)] ring-offset-2 ring-offset-[var(--bg-card)]"
                  )}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
          <div>
            <Label className="text-[14px] font-medium text-[var(--text-primary)] mb-2 block">Mood</Label>
            <div className="flex flex-wrap gap-2">
              {GIZZI_EMOTIONS.map((emotion) => (
                <button
                  key={emotion}
                  type="button"
                  onClick={() => setGizziEmotion(emotion)}
                  className={cn(
                    "h-9 rounded-full px-4 text-[12px] font-medium capitalize transition-colors",
                    gizziEmotion === emotion
                      ? "bg-[var(--text-primary)] text-[var(--bg-elevated)]"
                      : "bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
                  )}
                >
                  {emotion}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {avatarMode === "mascot" && (
        <div>
          <Label className="text-[14px] font-medium text-[var(--text-primary)] mb-2 block">Mascot catalogue</Label>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[280px] overflow-auto p-1">
            {MASCOT_TEMPLATES.map((template) => (
              <button
                key={template}
                type="button"
                onClick={() => setMascotTemplate(template)}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-xl border p-3 transition-all",
                  mascotTemplate === template
                    ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/10"
                    : "border-[var(--border-subtle)] bg-[var(--bg-elevated)] hover:border-[var(--border-hover)]"
                )}
              >
                <div className="scale-[0.55] origin-center">
                  <MascotPreview config={{ mascotTemplate: template, style: { primaryColor: accentColor } }} name="" />
                </div>
                <span className="text-[11px] font-medium capitalize text-[var(--text-primary)]">{template}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {avatarMode === "initials" && (
        <div className="max-w-[400px]">
          <AgentAvatarPicker
            name={displayName}
            config={avatarPicker}
            onChange={setAvatarPicker}
          />
        </div>
      )}

      {avatarMode === "image" && (
        <div className="space-y-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onImageUpload(file);
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            className="w-full gap-1.5"
          >
            <UploadSimple size={14} />
            Upload an image
          </Button>
          {imageDataUrl && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setImageDataUrl(null);
                setAvatarMode("gizzi");
              }}
            >
              Remove image — use Gizzi
            </Button>
          )}
        </div>
      )}

      {avatarMode === "pet" && (
        <div className="space-y-3">
          <div>
            <Label className="text-[14px] font-medium text-[var(--text-primary)] mb-2 block">Codex-style spritesheet URL</Label>
            <Input
              value={petUrl}
              onChange={(e) => setPetUrl(e.target.value)}
              placeholder="https://example.com/pet.webp"
              className="bg-[var(--bg-primary)] border-[var(--border-subtle)] text-[var(--text-primary)]"
            />
          </div>
          <p className="text-[11px] text-[var(--text-muted)]">
            Spritesheets should be 8 columns × 9 rows of 192×208 px frames.
          </p>
        </div>
      )}
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Runtime step                                                               */
/* -------------------------------------------------------------------------- */

function RuntimeStep({
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
}: {
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
}) {
  const models = apiModels.length > 0 ? apiModels : AGENT_MODELS;
  const hasBrains = brains.length > 0;
  const brainMode = hasBrains && formData.brainId ? "brain" : hasBrains ? "model" : "model";

  return (
    <section className="space-y-6">
      {/* Brain / Model */}
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6">
        <div className="mb-5">
          <h2 className="text-[18px] font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <Brain size={20} className="text-[var(--accent-primary)]" />
            Intelligence
          </h2>
          <p className="text-[14px] text-[var(--text-secondary)] mt-1">
            Route this bot through a gizzi brain or select a model directly.
          </p>
        </div>

        {hasBrains ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, brainId: undefined }))}
                className={cn(
                  "flex flex-col items-start rounded-xl border p-4 text-left transition-all",
                  !formData.brainId
                    ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/10"
                    : "border-[var(--border-subtle)] bg-[var(--bg-elevated)] hover:border-[var(--border-hover)]"
                )}
              >
                <span className="text-[14px] font-semibold text-[var(--text-primary)]">Platform model</span>
                <span className="text-[12px] text-[var(--text-muted)]">Use the model selected below</span>
              </button>
              <button
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, brainId: brains[0]?.brain_id }))}
                className={cn(
                  "flex flex-col items-start rounded-xl border p-4 text-left transition-all",
                  formData.brainId
                    ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/10"
                    : "border-[var(--border-subtle)] bg-[var(--bg-elevated)] hover:border-[var(--border-hover)]"
                )}
              >
                <span className="text-[14px] font-semibold text-[var(--text-primary)]">Gizzi brain</span>
                <span className="text-[12px] text-[var(--text-muted)]">Route through a local brain</span>
              </button>
            </div>

            {formData.brainId && (
              <div>
                <Label className="text-[14px] font-medium text-[var(--text-primary)] mb-2 block">Brain</Label>
                {brainsLoading ? (
                  <div className="h-10 rounded-lg bg-[var(--bg-primary)] animate-pulse" />
                ) : (
                  <Select
                    value={formData.brainId}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, brainId: value }))}
                  >
                    <SelectTrigger className="bg-[var(--bg-primary)] border-[var(--border-subtle)] text-[var(--text-primary)]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[var(--bg-card)] border-[var(--border-subtle)]">
                      {brains.map((brain) => (
                        <SelectItem key={brain.brain_id} value={brain.brain_id}>
                          {shortId(brain.brain_id)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}
          </div>
        ) : brainsLoading ? (
          <div className="h-20 rounded-lg bg-[var(--bg-primary)] animate-pulse" />
        ) : (
          <div className="rounded-lg border border-dashed border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4 text-[13px] text-[var(--text-muted)]">
            No gizzi brains found. Select a platform model below.
          </div>
        )}

        {/* Model selection */}
        <div className="mt-5">
          <Label className="text-[14px] font-medium text-[var(--text-primary)] mb-2 block">Model</Label>
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
          <div>
            <Label className="text-[14px] font-medium text-[var(--text-primary)] mb-2 block">Provider</Label>
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
            <Label className="text-[14px] font-medium text-[var(--text-primary)] mb-2 block">Harness</Label>
            <Select
              value={formData.harness?.mode || "cloud"}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, harness: { mode: value as any } }))
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

      {/* Advanced runtime */}
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6">
        <div className="mb-5">
          <h2 className="text-[18px] font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <GearSix size={20} className="text-[var(--accent-primary)]" />
            Advanced Runtime
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <Label className="text-[14px] font-medium text-[var(--text-primary)] mb-2 block">
              Max iterations: {formData.maxIterations}
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
              Temperature: {formData.temperature}
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

        {/* Voice */}
        <div>
          <h3 className="text-[16px] font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
            <Headphones size={18} className="text-[var(--accent-primary)]" />
            Voice
          </h3>
          <div className="flex items-center justify-between p-4 rounded-xl border border-[var(--border-subtle)] mb-4">
            <div className="flex items-center gap-3">
              {formData.voice?.enabled ? (
                <SpeakerHigh size={20} className="text-[var(--status-success)]" />
              ) : (
                <SpeakerSlash size={20} className="text-[var(--text-muted)]" />
              )}
              <div>
                <div className="font-medium text-[var(--text-primary)]">Enable voice</div>
                <div className="text-[13px] text-[var(--text-secondary)]">Speak responses with text-to-speech.</div>
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
                  <SelectValue placeholder={voicesLoading ? "Loading voices…" : "Select voice"} />
                </SelectTrigger>
                <SelectContent className="bg-[var(--bg-card)] border-[var(--border-subtle)]">
                  {voices.length === 0 && (
                    <SelectItem value="default" disabled>
                      Default voice
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
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Review step                                                                */
/* -------------------------------------------------------------------------- */

function ReviewStep({
  formData,
  avatarMode,
  mascotTemplate,
  gizziColor,
  gizziEmotion,
  imageDataUrl,
  petUrl,
  brainCount,
}: {
  formData: Partial<CreateAgentInput>;
  avatarMode: string;
  mascotTemplate: MascotTemplate;
  gizziColor: string;
  gizziEmotion: GizziEmotion;
  imageDataUrl: string | null;
  petUrl: string;
  brainCount: number;
}) {
  const botProfile = formData.botProfile!;
  const accentColor = botProfile.accentColor || STUDIO_THEME.accent;

  const avatarLabel =
    avatarMode === "image"
      ? "Custom image"
      : avatarMode === "pet"
        ? "Codex-style pet"
        : avatarMode === "initials"
          ? "Initials"
          : avatarMode === "mascot"
            ? `Mascot · ${mascotTemplate}`
            : "Gizzi mascot";

  const preview =
    avatarMode === "image" && imageDataUrl ? (
      <img src={imageDataUrl} alt="Bot avatar" className="size-16 rounded-2xl object-cover" />
    ) : avatarMode === "pet" && petUrl ? (
      <PetPreview spriteUrl={petUrl} />
    ) : avatarMode === "gizzi" ? (
      <GizziMascot size={64} emotion={gizziEmotion} />
    ) : avatarMode === "mascot" ? (
      <div className="scale-[0.55] origin-center">
        <MascotPreview config={{ mascotTemplate, style: { primaryColor: accentColor } }} name="" />
      </div>
    ) : (
      <div
        className="flex size-16 items-center justify-center rounded-2xl text-[22px] font-bold"
        style={{
          background: `color-mix(in srgb, ${accentColor} 18%, transparent)`,
          color: accentColor,
        }}
      >
        {botProfile.displayName?.slice(0, 2).toUpperCase() || "B"}
      </div>
    );

  return (
    <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-6">
      <div className="mb-6">
        <h2 className="text-[18px] font-semibold text-[var(--text-primary)] flex items-center gap-2">
          <CheckCircle size={20} className="text-[var(--accent-primary)]" />
          Review
        </h2>
        <p className="text-[14px] text-[var(--text-secondary)] mt-1">Here is how your bot will appear.</p>
      </div>

      <div
        className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-6 mb-6"
        style={{ boxShadow: `0 0 40px ${accentColor}12` }}
      >
        <div className="flex items-start gap-4">
          {preview}
          <div className="min-w-0">
            <h3 className="text-[18px] font-semibold text-[var(--text-primary)]">
              {botProfile.displayName || "Untitled bot"}
            </h3>
            <p className="text-[13px] text-[var(--text-secondary)]">
              {botProfile.tagline || formData.description || "No tagline"}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {botProfile.botCategory && (
                <span
                  className="rounded-md px-2 py-0.5 text-[10px] font-medium capitalize"
                  style={{ background: "var(--surface-hover)", color: "var(--text-secondary)" }}
                >
                  {BOT_CATEGORIES[botProfile.botCategory].label}
                </span>
              )}
              <span className="text-[10px] text-[var(--text-muted)]">@{formData.name || "bot"}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ReviewRow label="Brain" value={formData.brainId ? shortId(formData.brainId) : brainCount > 0 ? "Platform model" : "No brains available"} />
        <ReviewRow label="Model" value={`${formData.provider?.toUpperCase()} · ${formData.model}`} />
        <ReviewRow label="Avatar" value={avatarLabel} />
        <ReviewRow label="Harness" value={formData.harness?.mode || "cloud"} />
        <ReviewRow label="Voice" value={formData.voice?.enabled ? "Enabled" : "Disabled"} />
        <ReviewRow label="Max iterations" value={String(formData.maxIterations)} />
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function ModeButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors",
        active
          ? "bg-[var(--text-primary)] text-[var(--bg-elevated)]"
          : "bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"
      )}
    >
      <Icon size={14} />
      {label}
    </button>
  );
}

function PetPreview({ spriteUrl }: { spriteUrl: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !spriteUrl) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0, 192, 208, 0, 0, canvas.width, canvas.height);
    };
    img.onerror = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "var(--text-tertiary)";
      ctx.font = "10px sans-serif";
      ctx.fillText("Could not load", 8, 60);
    };
    img.src = spriteUrl;
  }, [spriteUrl]);

  return (
    <canvas
      ref={canvasRef}
      width={96}
      height={104}
      className="rounded-lg"
      style={{ imageRendering: "pixelated" }}
    />
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4">
      <span className="text-[13px] text-[var(--text-muted)]">{label}</span>
      <span className="text-right text-[13px] font-medium text-[var(--text-primary)]">{value}</span>
    </div>
  );
}
