"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, CircleNotch, Sparkle, Warning, X } from "@phosphor-icons/react";
import type {
  AvatarConfig,
  BotCategory,
  CreateAgentInput,
} from "@/lib/agents/agent.types";
import { getDefaultAgentModel, AGENT_MODELS } from "@/lib/agents/agent-models";
import { STUDIO_THEME } from "@/views/agent-view/AgentView.constants";
import { fetchBrains, type BrainSummary } from "@/services/brain-api";
import {
  createDefaultAvatarPickerConfig,
  type AvatarPickerConfig,
} from "@/views/agent-view/components/AgentAvatarPicker";
import type { BotTemplate } from "@/lib/bots/bots.manifest";
import { getBotTemplate } from "@/lib/bots/bots.manifest";
import { BOT_CATEGORY_DEFAULT_TOOLS } from "@/lib/bots/bot-tool-registry";
import { defaultBotVMOperatorConfig } from "@/lib/bots/vm-operator";
import { api } from "@/integration/api-client";
import { voiceService, type Voice } from "@/lib/agents/voice.service";
import { cn } from "@/lib/utils";
import { createModuleLogger } from "@/lib/logger";
import { WIZARD_COPY } from "./wizard-copy";
import {
  WIZARD_STEPS,
  createChecklistFor,
  deriveHandle,
  stepGateMet,
  type WizardStepId,
} from "./wizard-state";
import { useCreateBotSubmit } from "./useCreateBotSubmit";
import { describeBot, refineSystemPrompt } from "./describeBot";
import { StartStep, BLANK_TEMPLATE_ID } from "./steps/StartStep";
import { IdentityStep } from "./steps/IdentityStep";
import { JobStep } from "./steps/JobStep";
import { ComputerRuntimeStep } from "./steps/ComputerRuntimeStep";
import { type AvatarEditorState } from "./steps/AvatarEditor";
import { AVATAR_PACKS } from "./avatar-packs";

const logger = createModuleLogger("CreateBotWizard");

interface CreateBotWizardProps {
  isOpen: boolean;
  onClose: () => void;
  /**
   * Optional prefill (bot templates, duplicates). Create Bot stays atomic —
   * a draft only seeds the form; the single submit still writes all four
   * Bot fields and provisions the persistent desktop.
   */
  draft?: Partial<CreateAgentInput>;
}

/**
 * BOT_TEMPLATES build agents whose `category` is the Agent category (mapped
 * from the BotCategory at the factory). Reverse the mapping so selecting a
 * template seeds the bot's BotCategory — same values the old inline
 * START_TEMPLATES carried.
 */
const AGENT_CATEGORY_TO_BOT_CATEGORY: Record<string, BotCategory> = {
  research: "research",
  engineering: "code",
  creative: "writing",
  marketing: "sales",
  design: "design",
  operations: "ops",
  general: "custom",
};

function buildInitialFormData(draft?: Partial<CreateAgentInput>): Partial<CreateAgentInput> {
  return {
    name: draft?.name || "",
    description: draft?.description || "",
    type: draft?.type ?? "worker",
    model: draft?.model ?? getDefaultAgentModel().id,
    provider: draft?.provider ?? getDefaultAgentModel().provider,
    capabilities: draft?.capabilities ?? [],
    tools: draft?.tools ?? [],
    maxIterations: draft?.maxIterations ?? 10,
    temperature: draft?.temperature ?? 0.7,
    trustTier: draft?.trustTier ?? "standard",
    writeScope: draft?.writeScope ?? "workspace",
    dataClassification: draft?.dataClassification ?? "internal",
    allowedSurfaces: draft?.allowedSurfaces ?? ["chat"],
    allowedSkills: draft?.allowedSkills ?? [],
    allowedTools: draft?.allowedTools ?? [],
    category: draft?.category ?? "general",
    tags: draft?.tags ?? [],
    harness: draft?.harness ?? { mode: "cloud" },
    isBot: true,
    // Atomic Bot contract: every bot carries a JOB system prompt and a
    // persistent Computer Cloud desktop config from the moment it is created.
    systemPrompt: draft?.systemPrompt || "",
    vmOperator: draft?.vmOperator ?? defaultBotVMOperatorConfig(),
    botProfile: {
      displayName: draft?.botProfile?.displayName || "",
      tagline: draft?.botProfile?.tagline || "",
      welcomeMessage: draft?.botProfile?.welcomeMessage || "",
      starterPrompts: draft?.botProfile?.starterPrompts || [],
      accentColor: draft?.botProfile?.accentColor || "#B08D6E",
      groupChatEnabled: draft?.botProfile?.groupChatEnabled ?? true,
      botCategory: draft?.botProfile?.botCategory || "custom",
    },
    brainId: draft?.brainId || "",
    brain: draft?.brain ?? { mode: "allternit_cloud" },
  };
}

export function CreateBotWizard({ isOpen, onClose, draft }: CreateBotWizardProps) {
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [describing, setDescribing] = useState(false);
  const [refining, setRefining] = useState(false);
  const [describeError, setDescribeError] = useState<string | null>(null);
  const [refineError, setRefineError] = useState<string | null>(null);

  const [formData, setFormData] = useState<Partial<CreateAgentInput>>(() => buildInitialFormData());

  const [avatarMode, setAvatarMode] = useState<AvatarEditorState["avatarMode"]>("gizzi");
  const [avatarPicker, setAvatarPicker] = useState<AvatarPickerConfig>(() =>
    createDefaultAvatarPickerConfig(""),
  );
  const [mascotTemplate, setMascotTemplate] = useState<AvatarEditorState["mascotTemplate"]>("gizzi");
  const [gizziColor, setGizziColor] = useState("#B08D6E");
  const [gizziEmotion, setGizziEmotion] = useState<AvatarEditorState["gizziEmotion"]>("pleased");
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [petUrl, setPetUrl] = useState("");
  const [packSelection, setPackSelection] = useState<AvatarEditorState["packSelection"]>(() => {
    const firstPack = AVATAR_PACKS[0];
    return { packId: firstPack.id, spriteId: firstPack.sprites[0].id };
  });

  const [brains, setBrains] = useState<BrainSummary[]>([]);
  const [brainsLoading, setBrainsLoading] = useState(false);
  const [apiModels, setApiModels] = useState<typeof AGENT_MODELS>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [voicesLoading, setVoicesLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const formDataRef = useRef(formData);
  formDataRef.current = formData;

  const submit = useCreateBotSubmit({
    getFormData: () => formDataRef.current,
    getAvatar: () => buildAvatarConfigRef.current(),
    onClose,
  });

  const buildAvatarConfig = useCallback((): AvatarConfig => {
    const accent = formDataRef.current.botProfile?.accentColor || STUDIO_THEME.accent;

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
      case "packs": {
        const pack = AVATAR_PACKS.find((p) => p.id === packSelection.packId);
        const sprite = pack?.sprites.find((s) => s.id === packSelection.spriteId);
        // Animated-capable sprites ride the pet renderer (Codex-carry sheet
        // format); portrait-only sprites fall back to a static image avatar.
        if (pack && sprite?.sheetUrl) {
          return {
            type: "mascot",
            mascotTemplate: "pet",
            colors: { primary: accent, secondary: "#ffffff", glow: accent },
            pet: {
              spriteUrl: sprite.sheetUrl,
              frameWidth: 192,
              frameHeight: 208,
              columns: 8,
              rows: 9,
            },
          } as AvatarConfig;
        }
        return {
          type: "image",
          uri: sprite?.portraitUrl,
          colors: { primary: accent, secondary: "#ffffff", glow: accent },
        } as AvatarConfig;
      }
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
  }, [avatarMode, avatarPicker, gizziColor, gizziEmotion, imageDataUrl, mascotTemplate, packSelection, petUrl]);

  const buildAvatarConfigRef = useRef(buildAvatarConfig);
  buildAvatarConfigRef.current = buildAvatarConfig;

  // Reset when reopened (applying the optional draft prefill)
  useEffect(() => {
    if (!isOpen) return;
    setStep(0);
    setError(null);
    setSelectedTemplateId(null);
    setFormData(buildInitialFormData(draft));
    setAvatarMode("gizzi");
    setAvatarPicker(createDefaultAvatarPickerConfig(""));
    setMascotTemplate("gizzi");
    setGizziColor("#B08D6E");
    setGizziEmotion("pleased");
    setImageDataUrl(null);
    setPetUrl("");
    setPackSelection({
      packId: AVATAR_PACKS[0].id,
      spriteId: AVATAR_PACKS[0].sprites[0].id,
    });
    setDescribing(false);
    setRefining(false);
    setDescribeError(null);
    setRefineError(null);
    submit.reset();
  }, [isOpen, draft, submit.reset]);

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

  // Pre-select runtime defaults (zero-config): as soon as brains and models
  // load, pick the first available option so the last step never has to be
  // touched. The user can still override anything there.
  useEffect(() => {
    if (brains.length === 0) return;
    setFormData((prev) => (prev.brainId ? prev : { ...prev, brainId: brains[0].brain_id }));
  }, [brains]);

  useEffect(() => {
    const models = apiModels.length > 0 ? apiModels : AGENT_MODELS;
    if (models.length === 0) return;
    setFormData((prev) =>
      models.some((m) => m.id === prev.model)
        ? prev
        : { ...prev, model: models[0].id, provider: models[0].provider },
    );
  }, [apiModels]);

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
      if (avatarMode === "gizzi") setGizziColor(color);
    },
    [avatarMode, updateBotProfile],
  );

  /**
   * Template selection seeds the same fields the old applyTemplate did —
   * botCategory, accentColor, tagline, welcomeMessage, starterPrompts,
   * description fallback, and the category tool allowlist — plus the
   * template's real authored systemPrompt, read from the Agent the template
   * factory builds. `null` is the blank card: reset those fields to defaults.
   */
  const applyTemplate = useCallback(
    (template: BotTemplate | null) => {
      if (!template) {
        setSelectedTemplateId(BLANK_TEMPLATE_ID);
        const initial = buildInitialFormData(draft);
        setFormData((prev) => ({
          ...prev,
          description: initial.description,
          systemPrompt: initial.systemPrompt,
          allowedTools: initial.allowedTools,
          botProfile: {
            ...prev.botProfile,
            displayName: prev.botProfile?.displayName || initial.botProfile?.displayName || "",
            tagline: initial.botProfile?.tagline || "",
            welcomeMessage: initial.botProfile?.welcomeMessage || "",
            starterPrompts: initial.botProfile?.starterPrompts || [],
            accentColor: initial.botProfile?.accentColor || "#B08D6E",
            botCategory: initial.botProfile?.botCategory || "custom",
          } as CreateAgentInput["botProfile"],
        }));
        return;
      }

      const agent = template.create();
      const botCategory =
        AGENT_CATEGORY_TO_BOT_CATEGORY[agent.category ?? "general"] ?? "custom";
      const accentColor = agent.botProfile?.accentColor || "#B08D6E";

      setSelectedTemplateId(template.id);
      updateBotProfile({
        botCategory,
        accentColor,
        tagline: agent.botProfile?.tagline || "",
        welcomeMessage: agent.botProfile?.welcomeMessage || "",
        starterPrompts: agent.botProfile?.starterPrompts || [],
      });
      if (avatarMode === "gizzi") setGizziColor(accentColor);
      // Seed purpose and the authored job from the template; keep tools at the
      // category default only when the user hasn't customized them yet.
      setFormData((prev) => ({
        ...prev,
        description: prev.description || agent.description || "",
        systemPrompt: prev.systemPrompt || agent.systemPrompt || "",
        allowedTools: prev.allowedTools?.length
          ? prev.allowedTools
          : [...(BOT_CATEGORY_DEFAULT_TOOLS[botCategory] ?? [])],
      }));
    },
    [avatarMode, draft, updateBotProfile],
  );

  /**
   * Describe-to-prefill (milestone 5): one LLM call, then seed the wizard
   * from the parsed result. The suggested template's defaults (accent,
   * avatar color, category tools) are applied underneath first; parsed
   * fields win on top. No match → blank card. Null result → inline error
   * on the Start step ("Couldn't prefill — try again"); the selected
   * template's state is untouched.
   */
  const handleDescribe = async (text: string) => {
    if (describing) return;
    setDescribing(true);
    setDescribeError(null);
    try {
      const result = await describeBot({ description: text });
      if (!result) {
        setDescribeError(WIZARD_COPY.errors.describeFailed);
        return;
      }
      const suggested = result.suggestedTemplateId
        ? getBotTemplate(result.suggestedTemplateId)
        : undefined;
      applyTemplate(suggested ?? null);
      setFormData((prev) => ({
        ...prev,
        description: result.description || prev.description,
        systemPrompt: result.systemPrompt || prev.systemPrompt,
        allowedTools: result.allowedTools?.length ? result.allowedTools : prev.allowedTools,
      }));
      const profilePatch: Partial<NonNullable<CreateAgentInput["botProfile"]>> = {};
      if (result.displayName) profilePatch.displayName = result.displayName;
      if (result.tagline) profilePatch.tagline = result.tagline;
      if (result.welcomeMessage) profilePatch.welcomeMessage = result.welcomeMessage;
      if (result.starterPrompts?.length) profilePatch.starterPrompts = result.starterPrompts;
      if (result.botCategory) profilePatch.botCategory = result.botCategory;
      if (Object.keys(profilePatch).length > 0) updateBotProfile(profilePatch);
      if (result.displayName) {
        setFormData((prev) => ({
          ...prev,
          name: prev.name || deriveHandle(result.displayName!),
        }));
      }
    } catch {
      setDescribeError(WIZARD_COPY.errors.describeFailed);
    } finally {
      setDescribing(false);
    }
  };

  /** Job-step refine: rewrite the system prompt from name + description. */
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
      if (!result) {
        setRefineError(WIZARD_COPY.errors.refineFailed);
        return;
      }
      if (result.systemPrompt) {
        setFormData((prev) => ({ ...prev, systemPrompt: result.systemPrompt! }));
      }
    } catch {
      setRefineError(WIZARD_COPY.errors.refineFailed);
    } finally {
      setRefining(false);
    }
  };

  // Esc closes the wizard, but never while a submit is in flight (old
  // behavior: close is blocked while creating).
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && submit.phase === "idle") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose, submit.phase]);

  const handleVoicePreview = async () => {
    if (isPlaying) return;
    const voiceId = formData.voice?.voiceId || "default";
    setIsPlaying(true);
    try {
      const audioUrl = await voiceService.previewVoice(
        voiceId,
        `Hi, I'm ${formData.botProfile?.displayName || "your new bot"}.`,
      );
      const audio = new Audio(audioUrl);
      audio.onended = () => setIsPlaying(false);
      audio.play();
    } catch {
      setIsPlaying(false);
    }
  };

  const stepId: WizardStepId = WIZARD_STEPS[step].id;
  const busy = submit.phase !== "idle";
  const showProvisioning =
    submit.phase === "creating" ||
    submit.phase === "provisioning" ||
    (submit.phase === "error" && submit.hasCreatedBot);

  // The Create gate: the creation checklist run against the exact payload the
  // submit path will send (see wizard-state.ts).
  const checklist = useMemo(
    () => createChecklistFor(formData, buildAvatarConfig()),
    [formData, buildAvatarConfig],
  );

  const handleNext = () => {
    if (!stepGateMet(stepId, formData)) return;
    if (step < WIZARD_STEPS.length - 1) setStep((s) => s + 1);
  };

  const handleBack = () => {
    if (step > 0) setStep((s) => s - 1);
  };

  const avatarState: AvatarEditorState = {
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
    packSelection,
    setPackSelection,
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] overflow-auto bg-[var(--bg-elevated)] text-[var(--text-primary)]">
      {/* Approved page chrome — same checklist as ProjectView / LibraryView:
          full-width elevated root, inner max-w-6xl container with px-8
          pt-10 pb-12. On large screens the left padding clears the shell's
          floating rail controls (ui/shell/FloatingWidgets.tsx RailControls,
          rendered at fixed top-0 left-0 z-[150] ABOVE this overlay):
          railWidth 248 (RAIL_DEFAULT_WIDTH, ShellFrame) + the desktop
          trafficLightClearance 72. Wizard z-index stays 100 — the rail
          controls must remain reachable. */}
      <div className="mx-auto flex min-h-full w-full max-w-6xl flex-col px-8 pb-12 pt-10 lg:pl-[320px]">
        <header className="sticky top-0 z-10 bg-[var(--bg-elevated)] pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1
                className="text-3xl font-medium tracking-tight text-[var(--text-primary)]"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {WIZARD_COPY.header.title}
              </h1>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                {WIZARD_COPY.header.subtitle}
              </p>
              <p className="mt-1 text-[13px] text-[var(--text-tertiary)]">
                {WIZARD_COPY.footer.stepLine(step + 1, WIZARD_STEPS.length, WIZARD_STEPS[step].label)}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              aria-label={WIZARD_COPY.header.closeLabel}
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-[var(--border-default)] text-[var(--text-secondary)] transition-colors hover:border-[var(--border-hover)] hover:text-[var(--text-primary)] disabled:opacity-50"
            >
              <X size={14} weight="bold" />
            </button>
          </div>
        </header>

        <AnimatePresence>
          {(error || submit.error) && !showProvisioning && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mt-2 flex items-center gap-2 rounded-lg border border-[var(--status-error)]/30 bg-[var(--status-error)]/10 px-4 py-3 text-[13px] text-[var(--status-error)]"
            >
              <Warning size={16} weight="fill" />
              {error || submit.error}
            </motion.div>
          )}
        </AnimatePresence>

        <main className="flex-1 min-w-0">
          {showProvisioning ? (
            <ProvisioningView
              phase={submit.phase as "creating" | "provisioning" | "error"}
              status={submit.provisioningStatus}
              error={submit.error}
              displayName={formData.botProfile?.displayName || "My Bot"}
              onRetry={submit.retryProvisioning}
              onDismiss={submit.dismissToBotHome}
            />
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={stepId}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="max-w-3xl"
              >
                <div className="rounded-xl border border-[var(--border-default)] bg-[var(--bg-elevated)] p-6">
                  {stepId === "start" && (
                    <StartStep
                      selectedTemplateId={selectedTemplateId}
                      onSelectTemplate={applyTemplate}
                      describing={describing}
                      onDescribe={handleDescribe}
                      describeError={describeError}
                    />
                  )}
                  {stepId === "identity" && (
                    <IdentityStep
                      formData={formData}
                      setFormData={setFormData}
                      updateBotProfile={updateBotProfile}
                      updateAccentColor={updateAccentColor}
                      onError={setError}
                      {...avatarState}
                    />
                  )}
                  {stepId === "job" && (
                    <JobStep
                      formData={formData}
                      setFormData={setFormData}
                      refining={refining}
                      onRefine={handleRefine}
                      refineError={refineError}
                    />
                  )}
                  {stepId === "computer" && (
                    <ComputerRuntimeStep
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
                </div>
              </motion.div>
            </AnimatePresence>
          )}
        </main>

        {/* Nav row — Back/Next on steps 1–3, Create bot only on step 4.
            Approved button shapes (see AutomationTasksView / LibraryView):
            neutral bordered secondary, inverted primary. */}
        {!showProvisioning && (
          <footer className="sticky bottom-0 z-10 mt-5 flex max-w-3xl items-center justify-between bg-[var(--bg-elevated)] py-4">
            <button
              type="button"
              onClick={step === 0 ? onClose : handleBack}
              disabled={busy}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border-default)] px-3.5 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--border-hover)] hover:text-[var(--text-primary)] disabled:opacity-50"
            >
              {step === 0 ? (
                WIZARD_COPY.footer.cancel
              ) : (
                <>
                  <ArrowLeft size={14} />
                  {WIZARD_COPY.footer.back}
                </>
              )}
            </button>

            <div className="flex items-center gap-2">
              {step < WIZARD_STEPS.length - 1 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={!stepGateMet(stepId, formData)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[var(--text-primary)] px-4 text-sm font-medium text-[var(--bg-elevated)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {WIZARD_COPY.footer.next}
                  <ArrowRight size={14} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void submit.submit()}
                  disabled={!checklist.isValid || busy}
                  title={checklist.isValid ? undefined : WIZARD_COPY.steps.computer.createDisabledHint}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[var(--text-primary)] px-4 text-sm font-medium text-[var(--bg-elevated)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submit.phase === "creating" ? (
                    <>
                      <CircleNotch size={14} className="animate-spin" />
                      {WIZARD_COPY.steps.computer.creatingCta}
                    </>
                  ) : (
                    <>
                      <Sparkle size={14} weight="fill" />
                      {WIZARD_COPY.steps.computer.createCta}
                    </>
                  )}
                </button>
              )}
            </div>
          </footer>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Success state — visible provisioning, per the atomic-create contract       */
/* -------------------------------------------------------------------------- */

function ProvisioningView({
  phase,
  status,
  error,
  displayName,
  onRetry,
  onDismiss,
}: {
  phase: "creating" | "provisioning" | "error";
  status: "creating" | "running" | "stopped" | "error" | "timeout" | null;
  error: string | null;
  displayName: string;
  onRetry: () => void;
  onDismiss: () => void;
}) {
  const copy = WIZARD_COPY.provisioning;
  const failed = phase === "error";

  const title = failed
    ? error ?? copy.errorPrefix
    : phase === "creating"
      ? copy.creatingTitle
      : status === "running"
        ? copy.runningTitle
        : copy.title;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto flex max-w-md flex-col items-center pt-16 text-center"
    >
      <div
        className={cn(
          "flex size-16 items-center justify-center rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)]",
        )}
      >
        {failed ? (
          <Warning size={28} weight="fill" className="text-[var(--status-error)]" />
        ) : (
          <CircleNotch size={28} className="animate-spin text-[var(--text-secondary)]" />
        )}
      </div>

      <h2 className="mt-6 text-xl font-semibold text-[var(--text-primary)]">{title}</h2>
      <p className="mt-2 text-[14px] text-[var(--text-secondary)]">
        {failed ? displayName : copy.description}
      </p>

      {!failed && phase === "provisioning" && (
        <div className="mt-6 flex items-center gap-2 rounded-full border border-[var(--border-default)] bg-[var(--bg-card)] px-4 py-2 text-[12px] text-[var(--text-secondary)]">
          <span
            className={cn(
              "size-1.5 rounded-full",
              status === "running" ? "bg-[var(--status-success)]" : "animate-pulse bg-[var(--status-warning)]",
            )}
          />
          {status === "running"
            ? "Desktop running"
            : status === "timeout"
              ? copy.proceedNote
              : "Provisioning computer"}
        </div>
      )}

      {failed && (
        <div className="mt-6 flex items-center gap-2">
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[var(--text-primary)] px-4 text-sm font-medium text-[var(--bg-elevated)] transition-opacity hover:opacity-90"
          >
            <CircleNotch size={14} />
            {copy.retry}
          </button>
          <button
            type="button"
            onClick={onDismiss}
            className="inline-flex h-9 items-center rounded-lg border border-[var(--border-default)] px-3.5 text-sm font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]"
          >
            {copy.openHome}
          </button>
        </div>
      )}
    </motion.div>
  );
}
