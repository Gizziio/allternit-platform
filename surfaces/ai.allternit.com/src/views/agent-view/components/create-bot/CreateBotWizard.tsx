"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, CircleNotch, Sparkle, Warning, X } from "@phosphor-icons/react";
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
import { Button } from "@/components/ui/button";
import { createModuleLogger } from "@/lib/logger";
import { WIZARD_COPY } from "./wizard-copy";
import {
  WIZARD_STEPS,
  canNavigateTo,
  createChecklistFor,
  deriveHandle,
  stepGateMet,
  type WizardStepId,
} from "./wizard-state";
import { useCreateBotSubmit } from "./useCreateBotSubmit";
import { describeBot, refineSystemPrompt } from "./describeBot";
import { WizardPreview } from "./WizardPreview";
import { StartStep, BLANK_TEMPLATE_ID } from "./steps/StartStep";
import { IdentityStep } from "./steps/IdentityStep";
import { JobStep } from "./steps/JobStep";
import { ComputerRuntimeStep } from "./steps/ComputerRuntimeStep";
import { type AvatarEditorState } from "./steps/AvatarEditor";

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
      accentColor: draft?.botProfile?.accentColor || "#D4956A",
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

  const [formData, setFormData] = useState<Partial<CreateAgentInput>>(() => buildInitialFormData());

  const [avatarMode, setAvatarMode] = useState<AvatarEditorState["avatarMode"]>("gizzi");
  const [avatarPicker, setAvatarPicker] = useState<AvatarPickerConfig>(() =>
    createDefaultAvatarPickerConfig(""),
  );
  const [mascotTemplate, setMascotTemplate] = useState<AvatarEditorState["mascotTemplate"]>("gizzi");
  const [gizziColor, setGizziColor] = useState("#D4956A");
  const [gizziEmotion, setGizziEmotion] = useState<AvatarEditorState["gizziEmotion"]>("pleased");
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [petUrl, setPetUrl] = useState("");

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
  }, [avatarMode, avatarPicker, gizziColor, gizziEmotion, imageDataUrl, mascotTemplate, petUrl]);

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
    setGizziColor("#D4956A");
    setGizziEmotion("pleased");
    setImageDataUrl(null);
    setPetUrl("");
    setDescribing(false);
    setRefining(false);
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
            accentColor: initial.botProfile?.accentColor || "#D4956A",
            botCategory: initial.botProfile?.botCategory || "custom",
          } as CreateAgentInput["botProfile"],
        }));
        return;
      }

      const agent = template.create();
      const botCategory =
        AGENT_CATEGORY_TO_BOT_CATEGORY[agent.category ?? "general"] ?? "custom";
      const accentColor = agent.botProfile?.accentColor || "#D4956A";

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
   * fields win on top. No match → blank card. Null result → silent no-op,
   * the selected template's state is untouched.
   */
  const handleDescribe = async (text: string) => {
    if (describing) return;
    setDescribing(true);
    try {
      const result = await describeBot({ description: text });
      if (!result) return;
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
      // Silent by contract — never block the wizard on the accelerator.
    } finally {
      setDescribing(false);
    }
  };

  /** Job-step refine: rewrite the system prompt from name + description. */
  const handleRefine = async () => {
    if (refining) return;
    setRefining(true);
    try {
      const result = await refineSystemPrompt({
        description: formData.description || formData.botProfile?.tagline || "",
        displayName: formData.botProfile?.displayName || undefined,
        currentSystemPrompt: formData.systemPrompt || undefined,
      });
      if (result?.systemPrompt) {
        setFormData((prev) => ({ ...prev, systemPrompt: result.systemPrompt! }));
      }
    } catch {
      // Silent by contract.
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

  const gotoStep = (index: number) => {
    if (index === step) return;
    if (!canNavigateTo(index, formData)) return;
    setStep(index);
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
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[var(--bg-primary)] text-[var(--text-primary)]">
      {/* Header — A:// brand mark, serif like the Bot Hub header */}
      <header className="flex shrink-0 items-center justify-between border-b border-[var(--border-subtle)] px-6 py-4">
        <div className="flex items-baseline gap-3">
          <span className="text-[15px] font-semibold text-[var(--accent-primary)]">
            {WIZARD_COPY.header.brandMark}
          </span>
          <h1
            className="text-2xl font-medium tracking-tight text-[var(--text-primary)]"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            {WIZARD_COPY.header.title}
          </h1>
          <span className="text-[13px] text-[var(--text-muted)]">
            {WIZARD_COPY.footer.stepCounter(step + 1, WIZARD_STEPS.length)}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          aria-label={WIZARD_COPY.header.closeLabel}
          className="size-8 inline-flex items-center justify-center rounded-lg border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] transition-colors disabled:opacity-50"
        >
          <X size={14} weight="bold" />
        </button>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Left step rail */}
        <nav className="hidden lg:flex w-60 shrink-0 flex-col border-r border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4">
          <ul className="space-y-1">
            {WIZARD_STEPS.map((s, idx) => {
              const selected = idx === step;
              const reachable = canNavigateTo(idx, formData);
              const satisfied = idx < step || stepGateMet(s.id, formData);
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => gotoStep(idx)}
                    disabled={!reachable}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
                      selected
                        ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/10"
                        : "border-transparent",
                      reachable ? "hover:border-[var(--border-hover)]" : "opacity-50 cursor-not-allowed",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold",
                        satisfied
                          ? "bg-[var(--accent-primary)] text-[var(--ui-text-inverse,#fff)]"
                          : "border border-[var(--border-subtle)] text-[var(--text-muted)]",
                      )}
                    >
                      {satisfied && !selected ? <Check size={12} weight="bold" /> : idx + 1}
                    </span>
                    <span className="min-w-0">
                      <span
                        className={cn(
                          "block text-[13px] font-medium",
                          selected ? "text-[var(--text-primary)]" : "text-[var(--text-secondary)]",
                        )}
                      >
                        {s.label}
                      </span>
                      <span className="block text-[11px] text-[var(--text-muted)] truncate">
                        {s.railHint}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Center content */}
        <main className="flex flex-1 flex-col min-w-0 min-h-0">
          <AnimatePresence>
            {(error || submit.error) && !showProvisioning && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="mx-6 mt-4 flex items-center gap-2 rounded-lg border border-[var(--status-error)]/30 bg-[var(--status-error)]/10 px-4 py-3 text-[13px] text-[var(--status-error)]"
              >
                <Warning size={16} weight="fill" />
                {error || submit.error}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex-1 overflow-auto px-6 py-6">
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
                  className="mx-auto max-w-3xl pb-8"
                >
                  {stepId === "start" && (
                    <StartStep
                      selectedTemplateId={selectedTemplateId}
                      onSelectTemplate={applyTemplate}
                      describing={describing}
                      onDescribe={handleDescribe}
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
                </motion.div>
              </AnimatePresence>
            )}
          </div>

          {/* Footer — Back/Next on steps 1–3, Create bot only on step 4 */}
          {!showProvisioning && (
            <footer className="shrink-0 flex items-center justify-between border-t border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-6 py-4">
              <Button
                variant="outline"
                onClick={step === 0 ? onClose : handleBack}
                disabled={busy}
                className="gap-1.5"
              >
                {step === 0 ? (
                  WIZARD_COPY.footer.cancel
                ) : (
                  <>
                    <ArrowLeft size={14} />
                    {WIZARD_COPY.footer.back}
                  </>
                )}
              </Button>

              <div className="flex items-center gap-2">
                {step < WIZARD_STEPS.length - 1 ? (
                  <Button
                    onClick={handleNext}
                    disabled={!stepGateMet(stepId, formData)}
                    className="gap-1.5"
                  >
                    {WIZARD_COPY.footer.next}
                    <ArrowRight size={14} />
                  </Button>
                ) : (
                  <Button
                    onClick={() => void submit.submit()}
                    disabled={!checklist.isValid || busy}
                    title={checklist.isValid ? undefined : WIZARD_COPY.steps.computer.createDisabledHint}
                    className="gap-1.5 bg-[var(--accent-primary)] text-[var(--ui-text-inverse,#fff)] border-none hover:opacity-90"
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
                  </Button>
                )}
              </div>
            </footer>
          )}
        </main>

        {/* Right live preview rail */}
        <aside className="hidden xl:block w-[320px] shrink-0 overflow-auto border-l border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-5">
          <WizardPreview formData={formData} avatar={buildAvatarConfig()} />
        </aside>
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
          "flex size-16 items-center justify-center rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)]",
        )}
      >
        {failed ? (
          <Warning size={28} weight="fill" className="text-[var(--status-error)]" />
        ) : (
          <CircleNotch size={28} className="animate-spin text-[var(--accent-primary)]" />
        )}
      </div>

      <h2 className="mt-6 text-xl font-semibold text-[var(--text-primary)]">{title}</h2>
      <p className="mt-2 text-[14px] text-[var(--text-secondary)]">
        {failed ? displayName : copy.description}
      </p>

      {!failed && phase === "provisioning" && (
        <div className="mt-6 flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--bg-card)] px-4 py-2 text-[12px] text-[var(--text-secondary)]">
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
          <Button onClick={onRetry} className="gap-1.5">
            <CircleNotch size={14} />
            {copy.retry}
          </Button>
          <Button variant="outline" onClick={onDismiss}>
            {copy.openHome}
          </Button>
        </div>
      )}
    </motion.div>
  );
}
