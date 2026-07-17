import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle,
  Warning,
  CircleNotch,
  ArrowRight,
  Circle,
} from "@phosphor-icons/react";
import { useAgentStore } from "@/lib/agents/agent.store";
import { getDefaultAgentModel } from "@/lib/agents/agent-models";
import { STUDIO_THEME, SETUP_CAPABILITY_PRESETS } from "../AgentView.constants";
import type { 
  Agent, 
  CreateAgentInput, 
  AgentSetup,
  CreationTemperament,
  WorkspaceLayerConfig,
  CharacterLayerConfig,
  MascotTemplate,
} from "@/lib/agents/agent.types";
import { 
  getSetupStatDefinitions,
  detectPluginConflicts,
  generateEnhancedWorkspaceDocuments,
  validateAgentCreationChecklist,
} from "@/lib/agents";
import { voiceService, type Voice } from "@/lib/agents/voice.service";
import type { HardBanCategory } from "@/lib/agents/character.types";
import { api } from "@/integration/api-client";
import { BrowserCompatibilityWarningComponent } from "./BrowserCompatibilityWarning";
import { detectBrowserCompatibility } from "@/components/agents/AgentCreationWizard.validations";
import { IdentityStep } from "../steps/IdentityStep";
import { CharacterStep } from "../steps/CharacterStep";
import { AvatarStep } from "../steps/AvatarStep";
import { RuntimeStep } from "../steps/RuntimeStep";
import { HarnessStep } from "../steps/HarnessStep";
import { ReviewStep } from "../steps/ReviewStep";
import type { AvatarPickerConfig } from "./AgentAvatarPicker";

import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('CreateAgentForm');

interface CreateAgentFormProps {
  onClose: () => void;
  onSuccess?: (agent: Agent) => void;
}

interface StepInfo {
  id: string;
  label: string;
  description: string;
}

export function CreationProgressAnimation({
  agentName,
  onComplete,
}: {
  agentName: string;
  onComplete?: () => void;
}) {
  useEffect(() => {
    if (!onComplete) return;
    const timeout = window.setTimeout(() => onComplete(), 2200);
    return () => window.clearTimeout(timeout);
  }, [onComplete]);

  return (
    <div className="flex flex-col items-center justify-center gap-4 text-center text-[var(--text-primary)]">
      <div className="flex size-16 items-center justify-center rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-card)]">
        <CircleNotch size={28} className="animate-spin text-[var(--accent-primary)]" />
      </div>
      <div>
        <div className="text-lg font-semibold">Forging agent</div>
        <div className="mt-1 text-sm text-[var(--text-secondary)]">
          {agentName ? `${agentName} is being prepared.` : 'Preparing your agent workspace.'}
        </div>
      </div>
    </div>
  );
}

const CREATE_FLOW_STEPS: StepInfo[] = [
  { id: "identity", label: "Identity", description: "Name, type, and backstory" },
  { id: "character", label: "Character", description: "Traits, stats, and specialties" },
  { id: "avatar", label: "Avatar", description: "Visual representation" },
  { id: "runtime", label: "Runtime", description: "Model and voice settings" },
  { id: "harness", label: "Harness", description: "AI routing and mode surfaces" },
  { id: "review", label: "Review", description: "Final confirmation" },
];

const DEFAULT_LAYER_CONFIG: WorkspaceLayerConfig = {
  cognitive: true,
  identity: true,
  governance: true,
  skills: true,
  business: false,
};

const splitLines = (text: string) => text.split('\n').map(l => l.trim()).filter(Boolean);

function calculateProjectedStats(
  setup: AgentSetup,
  specialtySkills: string[],
) {
  const statDefinitions = getSetupStatDefinitions(setup);
  const stats: Record<string, number> = {};
  statDefinitions.forEach((definition, index) => {
    const specialtyBoost = specialtySkills.some((skill) =>
      definition.signals.some((signal) =>
        skill.toLowerCase().includes(signal.toLowerCase()),
      ),
    )
      ? 10
      : 0;
    const baseValue = 52 + Math.min(index * 6, 18) + specialtyBoost;
    stats[definition.key] = Math.min(99, baseValue);
  });

  const specialtyScores: Record<string, number> = {};
  specialtySkills.forEach((skill, index) => {
    specialtyScores[skill] = Math.min(99, 65 + index * 7);
  });

  return {
    class: setup.charAt(0).toUpperCase() + setup.slice(1),
    level: Math.max(1, specialtySkills.length + 1),
    xp: Number((specialtySkills.length * 0.75).toFixed(2)),
    stats,
    specialtyScores,
  };
}

function buildCharacterLayer(
  formData: Partial<CreateAgentInput>,
  blueprint: { setup: AgentSetup; specialtySkills: string[]; temperament: CreationTemperament },
  cardSeed: {
    domainFocus: string;
    voiceStyle: string;
    definitionOfDone: string;
    escalationRules: string;
    voiceRules: string;
    voiceMicroBans: string;
    hardBanCategories: string[];
  },
  avatarConfig: { primary: string; secondary: string; pattern: string },
  projectedStats: ReturnType<typeof calculateProjectedStats>,
): CharacterLayerConfig {
  const config = (formData.config || {}) as Record<string, unknown>;
  const voice = (config.voice || {}) as Record<string, unknown>;
  const tone = (voice.tone || {}) as Record<string, number>;
  const configHardBans = (config.hardBans || []) as Array<{ category: string; severity?: string; description?: string }>;

  return {
    identity: {
      setup: blueprint.setup as any,
      className: projectedStats.class,
      specialtySkills: blueprint.specialtySkills,
      temperament: blueprint.temperament as any,
      personalityTraits: (config.personalityTraits as string[]) || [],
      backstory: (config.backstory as string) || '',
    },
    roleCard: {
      domain: cardSeed.domainFocus || blueprint.setup || 'general',
      inputs: [],
      outputs: [],
      definitionOfDone: splitLines(cardSeed.definitionOfDone),
      hardBans: cardSeed.hardBanCategories.length > 0
        ? cardSeed.hardBanCategories.map((category) => ({
            category: category as HardBanCategory,
            severity: 'fatal' as const,
            description: '',
          }))
        : configHardBans.map((b) => ({
            category: b.category as HardBanCategory,
            severity: (b.severity as 'fatal' | 'warning' | 'info') || 'fatal',
            description: b.description || '',
          })),
      escalation: splitLines(cardSeed.escalationRules),
      metrics: [],
    },
    voice: {
      style: cardSeed.voiceStyle || '',
      rules: splitLines(cardSeed.voiceRules),
      microBans: splitLines(cardSeed.voiceMicroBans),
      tone: {
        formality: tone.formality ?? 0.5,
        enthusiasm: tone.enthusiasm ?? 0.5,
        empathy: tone.empathy ?? 0.5,
        directness: tone.directness ?? 0.5,
      },
    },
    progression: {
      class: projectedStats.class,
      relevantStats: Object.keys(projectedStats.stats),
      level: {
        maxLevel: 99,
        xpFormula: 'linear',
      },
    },
    avatar: {
      type: 'mascot' as const,
      mascot: {
        template: 'bot' as MascotTemplate,
      },
      style: {
        primaryColor: avatarConfig.primary,
        accentColor: avatarConfig.secondary,
      },
    },
  };
}

export function CreateAgentForm({ onClose, onSuccess }: CreateAgentFormProps) {
  const { createAgent, agents, isCreating, draftAgent, clearDraftAgent } = useAgentStore();
  const orchestrators = agents.filter((a) => a.type === 'orchestrator');
  const [activeStep, setActiveStep] = useState<string>("identity");
  const [error, setError] = useState<string | null>(null);
  const [workspaceWarning, setWorkspaceWarning] = useState<string | null>(null);
  const [browserWarningDismissed, setBrowserWarningDismissed] = useState(false);
  const [isForgeQueued, setIsForgeQueued] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  
  // Local state for draft/preview
  const [formData, setFormData] = useState<Partial<CreateAgentInput>>({
    name: "",
    description: "",
    type: "worker",
    model: getDefaultAgentModel().id,
    provider: getDefaultAgentModel().provider,
    capabilities: [],
    tools: [],
    maxIterations: 10,
    temperature: 0.7,
    trustTier: 'standard',
    writeScope: 'workspace',
    dataClassification: 'internal',
    allowedSurfaces: ['chat'],
    allowedSkills: [],
    allowedTools: [],
    category: 'general',
    tags: [],
    harness: { mode: 'cloud' },
  });

  const [blueprint, setBlueprint] = useState({
    setup: 'coding' as AgentSetup,
    specialtySkills: [] as string[],
    temperament: 'balanced' as CreationTemperament,
  });

  const [personality, setPersonality] = useState({
    openness: 50,
    conscientiousness: 50,
    extraversion: 50,
    agreeableness: 50,
    communicationStyle: 'direct',
    workStyle: 'independent',
    decisionMaking: 'data-driven',
  });

  const [cardSeed, setCardSeed] = useState({
    domainFocus: '',
    voiceStyle: '',
    definitionOfDone: '',
    escalationRules: '',
    voiceRules: '',
    voiceMicroBans: '',
    hardBanCategories: [] as string[],
  });

  const [avatarConfig, setAvatarConfig] = useState<any>({
    primary: STUDIO_THEME.accent,
    secondary: STUDIO_THEME.bg,
    pattern: 'circuit',
  });

  const [avatarPickerConfig, setAvatarPickerConfig] = useState<AvatarPickerConfig>({
    initial: '',
    bgColor: STUDIO_THEME.accent,
    textColor: STUDIO_THEME.bg,
    shape: 'rounded',
  });

  const [voices, setVoices] = useState<Voice[]>([]);
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [previewAudio, setPreviewAudio] = useState<HTMLAudioElement | null>(null);
  const browserCompatibility = detectBrowserCompatibility();

  // Prefill from draft agent (template/duplicate flow) on mount
  useEffect(() => {
    if (!draftAgent) return;
    setFormData((prev) => ({
      ...prev,
      ...draftAgent,
      // Preserve arrays/objects that may be missing in the draft
      capabilities: draftAgent.capabilities ?? prev.capabilities,
      tools: draftAgent.tools ?? prev.tools,
      allowedSurfaces: draftAgent.allowedSurfaces ?? prev.allowedSurfaces,
      allowedSkills: draftAgent.allowedSkills ?? prev.allowedSkills,
      allowedTools: draftAgent.allowedTools ?? prev.allowedTools,
      tags: draftAgent.tags ?? prev.tags,
      harness: draftAgent.harness ?? prev.harness,
    }));
    clearDraftAgent();
  }, []);

  const activeStepIndex = CREATE_FLOW_STEPS.findIndex((s) => s.id === activeStep);
  const currentStepDescription = CREATE_FLOW_STEPS[activeStepIndex]?.description;

  // Derived calculations
  const projectedStats = useMemo(() => 
    calculateProjectedStats(blueprint.setup, blueprint.specialtySkills), 
  [blueprint.setup, blueprint.specialtySkills]);

  const characterLayer = useMemo(
    () => buildCharacterLayer(formData, blueprint, cardSeed, avatarConfig, projectedStats),
    [formData, blueprint, cardSeed, avatarConfig, projectedStats],
  );

  const checklist = useMemo(() => {
    const input: Partial<CreateAgentInput> = {
      ...formData,
      characterLayer,
      temperature: formData.temperature ?? 0.7,
      maxIterations: formData.maxIterations ?? 10,
    };
    return validateAgentCreationChecklist(input);
  }, [formData, characterLayer]);

  const isReadyForCreate = useMemo(() => checklist.isValid, [checklist.isValid]);

  const stepValidation = useMemo(() => ({
    identity: !!(formData.name && formData.name.length >= 3 && formData.description && formData.description.length >= 10),
    character: !!(blueprint.setup && blueprint.specialtySkills.length >= 1),
    avatar: true,
    runtime: true,
    harness: Boolean(formData.harness?.mode) && (formData.allowedSurfaces || []).length > 0,
    review: isReadyForCreate,
  }) as Record<string, boolean>, [formData.name, formData.description, blueprint, formData.harness, formData.allowedSurfaces, isReadyForCreate]);

  // Methods
  const canJumpToStep = (stepId: string) => {
    const idx = CREATE_FLOW_STEPS.findIndex(s => s.id === stepId);
    if (idx === 0) return true;
    // Can jump if all previous steps are valid
    for (let i = 0; i < idx; i++) {
      if (!stepValidation[CREATE_FLOW_STEPS[i].id as keyof typeof stepValidation]) return false;
    }
    return true;
  };

  const handleVoicePreview = async () => {
    if (isPlaying && previewAudio) {
      previewAudio.pause();
      setIsPlaying(false);
      return;
    }

    const voiceId = formData.voice?.voiceId || "default";
    setIsPlaying(true);
    try {
      const audioUrl = await voiceService.previewVoice(voiceId, "Hello, I am your new AI agent. I am ready to assist you.");
      const audio = new Audio(audioUrl);
      setPreviewAudio(audio);
      audio.onended = () => setIsPlaying(false);
      audio.play();
    } catch (err) {
      logger.error({ err: err }, 'Voice preview failed:');
      setIsPlaying(false);
    }
  };

  // Fetch models
  const [apiModels, setApiModels] = useState<any[]>([]);
  const [isModelsLoading, setIsModelsLoading] = useState(false);

  useEffect(() => {
    async function fetchData() {
      setIsModelsLoading(true);
      try {
        const models = await api.get('/api/v1/models') as any[];
        if (Array.isArray(models)) {
          setApiModels(models);
        }
      } catch (err) {
        // 501 means the runtime API doesn't implement /api/v1/models — the
        // RuntimeStep falls back to the static AGENT_MODELS list, so this is
        // informational only; anything else is a genuine fetch failure.
        const status = (err as { statusCode?: number; status?: number })?.statusCode
          ?? (err as { status?: number })?.status;
        if (status === 501) {
          logger.debug('Models endpoint unavailable (501); using built-in model list');
        } else {
          logger.error({ err: err }, 'Failed to fetch models:');
        }
      } finally {
        setIsModelsLoading(false);
      }
    }
    fetchData();
  }, []);

  // Workspace layer configuration
  const workspaceLayers: WorkspaceLayerConfig = DEFAULT_LAYER_CONFIG;

  // Fetch voices on mount
  useEffect(() => {
    setVoiceLoading(true);
    voiceService
      .listVoices()
      .then((v) => setVoices(v))
      .catch((err) => {
        // Voice service is optional (501 when the runtime API doesn't
        // implement it) — keep the wizard usable with an empty voice list.
        logger.debug({ err: err }, 'Voice service unavailable; continuing without voices');
        setVoices([]);
      })
      .finally(() => setVoiceLoading(false));
  }, []);

  useEffect(() => {
    return () => {
      if (previewAudio) {
        previewAudio.pause();
        previewAudio.remove();
      }
    };
  }, [previewAudio]);

  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      capabilities: SETUP_CAPABILITY_PRESETS[blueprint.setup],
    }));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // If not on review step, just go to next step (form submit acts as "Next")
    if (activeStep !== "review") {
      if (!stepValidation[activeStep]) {
        return;
      }
      const nextStep = CREATE_FLOW_STEPS[activeStepIndex + 1];
      if (nextStep) {
        setActiveStep(nextStep.id);
      }
      return;
    }
    
    if (!isReadyForCreate) {
      return;
    }

    if (isForgeQueued || isCreating) {
      return;
    }

    // Check for plugin conflicts
    const pluginConflicts = detectPluginConflicts(formData.tools || []);
    if (pluginConflicts.hasConflict && pluginConflicts.severity === 'error') {
      logger.warn({ conflicts: pluginConflicts.conflicts }, '[CreateAgentForm] Submission blocked: plugin conflicts detected');
      setSubmitStatus({ type: 'error', message: `Plugin conflicts detected: ${pluginConflicts.conflicts.join(', ')}` });
      return;
    }

    const definitionOfDone = splitLines(cardSeed.definitionOfDone as string);
    const escalation = splitLines(cardSeed.escalationRules as string);
    const voiceRules = splitLines(cardSeed.voiceRules as string);
    const voiceMicroBans = splitLines(cardSeed.voiceMicroBans as string);
    const domainFocus = (cardSeed.domainFocus as string || '').trim();

    const payload = {
      ...formData,
      config: {
        ...(formData.config || {}),
        personality,
        character: {
          setup: blueprint.setup,
          specialtySkills: blueprint.specialtySkills,
          temperament: blueprint.temperament,
          hardBans: (formData.config as any)?.hardBans || [],
          domain: domainFocus,
          definitionOfDone,
          escalation,
        },
        voice: {
          style: (cardSeed.voiceStyle as string || '').trim(),
          rules: voiceRules,
          microBans: voiceMicroBans,
          tone: {
            formality: 0.5,
            enthusiasm: 0.5,
            empathy: 0.5,
            directness: 0.5
          }
        },
        workspaceLayers,
      },
      avatar: avatarConfig,
      characterLayer,
      trustTier: formData.trustTier,
      writeScope: formData.writeScope,
      dataClassification: formData.dataClassification,
      allowedSurfaces: formData.allowedSurfaces,
      allowedSkills: formData.allowedSkills,
      allowedTools: formData.allowedTools,
      category: formData.category,
      tags: formData.tags,
      harness: formData.harness,
    } as CreateAgentInput;
    
    // Creating agent with enhanced payload
    
    // Create agent immediately — no artificial delay
    setWorkspaceWarning(null);
    setSubmitStatus(null);
    setIsForgeQueued(false);
    
    (async () => {
      let createdAgent: Agent | null = null;
      try {
        // 1. Create the agent via store (single source of truth — hits API + updates UI)
        createdAgent = await createAgent(payload);

        // 2. Initialize workspace on backend
        try {
          const workspaceDocs = generateEnhancedWorkspaceDocuments(payload.config, {
            name: payload.name,
            description: payload.description,
            model: payload.model,
            provider: payload.provider,
            type: payload.type,
            trustTier: payload.trustTier,
            writeScope: payload.writeScope,
            dataClassification: payload.dataClassification,
            allowedSurfaces: payload.allowedSurfaces,
            allowedSkills: payload.allowedSkills,
            allowedTools: payload.allowedTools,
            harness: payload.harness as unknown as Record<string, unknown>,
            category: payload.category,
            tags: payload.tags,
            tools: payload.tools,
            capabilities: payload.capabilities,
            layers: workspaceLayers,
          });

          const workspaceResponse = await api.post(`/api/v1/agents/${createdAgent.id}/workspace/initialize`, {
            documents: workspaceDocs,
          }) as any;

          if (!workspaceResponse.ok) {
            logger.warn({ error: workspaceResponse.error }, '[CreateAgentForm] Workspace initialization via API failed');
          }
        } catch (workspaceError) {
          logger.error({ err: workspaceError }, 'Workspace creation failed');
          setWorkspaceWarning("Agent created, but workspace initialization failed.");
        }

        setSubmitStatus({ type: 'success', message: 'Agent created successfully!' });
        
        if (onSuccess && createdAgent) {
          setTimeout(() => {
            onSuccess(createdAgent!);
          }, 1500);
        }
      } catch (err: any) {
        logger.error({ err: err }, 'Agent creation failed:');
        setError(err.message || "Failed to create agent. Please check the network and try again.");
        setSubmitStatus({ type: 'error', message: 'Failed to create agent' });
      }
    })();
  };

  const isBusy = isCreating || isForgeQueued;

  return (
    <div className="flex h-full max-h-screen p-6 overflow-auto bg-transparent gap-6">
      <div className="flex flex-col flex-1 min-h-0 max-w-[900px]">
      {/* Submit Status Overlay */}
      {submitStatus && (
        <div className={`absolute top-6 left-1/2 -translate-x-1/2 z-[5000] px-6 py-4 rounded-xl backdrop-blur-md border border-solid flex items-center gap-3 shadow-lg animate-in slide-in-from-top duration-300 ${
          submitStatus.type === 'success' ? 'bg-green-500/90 border-[var(--status-success)]' : 'bg-red-500/90 border-[var(--status-error)]'
        } text-white`}>
          {submitStatus.type === 'success' ? <CheckCircle size={20} /> : <Warning size={20} />}
          <span className="font-medium">{submitStatus.message}</span>
        </div>
      )}

      <div className="text-center mb-6">
        <h1 className="m-0 text-2xl font-medium font-research text-[var(--text-primary)]">Create New Agent</h1>
        <p className="m-0 mt-1 text-sm text-[var(--text-secondary)]">Configure your AI agent with voice, type, and capabilities</p>
      </div>

      {error && (
        <div className="p-3 px-4 rounded-lg bg-red-500/10 border border-solid border-red-500/30 text-[var(--status-error)] mb-4 flex items-center gap-2">
          <Warning size={16} />
          <span>{error}</span>
        </div>
      )}
      {workspaceWarning && (
        <div className="p-3 px-4 rounded-lg bg-amber-500/12 border border-solid border-amber-500/35 text-[var(--status-warning)] mb-4 flex items-center gap-2">
          <Warning size={16} />
          <span>{workspaceWarning}</span>
        </div>
      )}

      <div className="mb-4 flex flex-col gap-2">
        <BrowserCompatibilityWarningComponent
          compatibility={browserCompatibility}
          dismissed={browserWarningDismissed}
          onDismiss={() => setBrowserWarningDismissed(true)}
        />
        <DuplicateNameWarning agentName={formData.name} />
      </div>

      <form onSubmit={handleSubmit} className="flex-1 min-h-0">
        {/* Step Navigation */}
        <div className="rounded-xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 mb-6">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-3">
            {CREATE_FLOW_STEPS.map((step, idx) => {
              const selected = step.id === activeStep;
              const completed = idx < activeStepIndex && stepValidation[step.id];
              const unlocked = canJumpToStep(step.id);
              return (
                <button
                  key={step.id}
                  type="button"
                  disabled={!unlocked}
                  onClick={() => {
                    if (unlocked) setActiveStep(step.id);
                  }}
                  className={`text-left transition-all ease-in-out duration-200 p-3 rounded-lg border border-solid ${
                    selected ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10' : 
                    completed ? 'border-[var(--accent-primary)]/40 bg-[var(--accent-primary)]/5' : 
                    'border-[var(--border-subtle)] bg-[var(--bg-card)]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-medium ${selected ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>{step.label}</span>
                    {selected || completed ? (
                      <CheckCircle size={16} className="text-[var(--accent-primary)]" />
                    ) : (
                      <Circle size={16} className="text-[var(--text-muted)]" />
                    )}
                  </div>
                  <p className="text-[12px] text-[var(--text-muted)] mt-1 mb-0">{step.description}</p>
                </button>
              );
            })}
          </div>
          <div className="mt-3 p-2.5 px-3.5 rounded-md border border-solid border-[var(--border-subtle)] text-[12px] text-[var(--text-secondary)]">
            Step {activeStepIndex + 1} of {CREATE_FLOW_STEPS.length}: {currentStepDescription}
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="pb-24"
          >
            {activeStep === "identity" && (
              <IdentityStep
                formData={formData}
                setFormData={setFormData}
                personality={personality}
                setPersonality={setPersonality}
                orchestrators={orchestrators}
              />
            )}
            {activeStep === "character" && (
              <CharacterStep
                formData={formData}
                setFormData={setFormData}
                blueprint={blueprint}
                setBlueprint={setBlueprint}
                cardSeed={cardSeed}
                setCardSeed={setCardSeed}
                projectedStats={projectedStats}
              />
            )}
            {activeStep === "avatar" && (
              <AvatarStep
                name={formData.name}
                avatarPickerConfig={avatarPickerConfig}
                setAvatarPickerConfig={setAvatarPickerConfig}
                setAvatarConfig={setAvatarConfig}
              />
            )}
            {activeStep === "runtime" && (
              <RuntimeStep
                formData={formData}
                setFormData={setFormData}
                apiModels={apiModels}
                isModelsLoading={isModelsLoading}
                voices={voices}
                voiceLoading={voiceLoading}
                isPlaying={isPlaying}
                handleVoicePreview={handleVoicePreview}
              />
            )}
            {activeStep === "harness" && (
              <HarnessStep
                formData={formData}
                setFormData={setFormData}
              />
            )}
            {activeStep === "review" && (
              <ReviewStep
                formData={formData}
                blueprint={blueprint}
                cardSeed={cardSeed}
                projectedStats={projectedStats}
              />
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation Footer */}
        <div className="sticky bottom-0 z-10 flex items-center justify-between p-4 px-5 bg-[var(--bg-card)] rounded-xl border border-solid border-[var(--border-subtle)] mt-6 gap-3 shadow-lg">
          <button
            type="button"
            onClick={activeStepIndex === 0 ? onClose : () => setActiveStep(CREATE_FLOW_STEPS[activeStepIndex - 1].id)}
            className="px-5 py-2.5 rounded-lg bg-transparent text-[var(--text-primary)] text-[14px] font-medium border border-solid border-[var(--border-subtle)] cursor-pointer hover:bg-[var(--surface-hover)] transition-colors"
          >
            {activeStepIndex === 0 ? "Cancel" : "Previous"}
          </button>
          
          <div className="flex gap-3">
            {activeStepIndex < CREATE_FLOW_STEPS.length - 1 ? (
              <button
                type="submit"
                disabled={!stepValidation[activeStep]}
                className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-[var(--accent-primary)] to-[#B08D6E] text-[var(--ui-text-inverse)] text-[14px] font-semibold border-none cursor-pointer flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
              >
                Next
                <ArrowRight size={16} />
              </button>
            ) : (
              <button
                type="submit"
                disabled={isBusy || !isReadyForCreate || !checklist.isValid}
                className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-[var(--accent-primary)] to-[#B08D6E] text-[var(--ui-text-inverse)] text-[14px] font-semibold border-none cursor-pointer flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
              >
                {isBusy ? (
                  <>
                    <CircleNotch size={16} className="animate-spin" />
                    {isForgeQueued ? "Queuing..." : "Creating..."}
                  </>
                ) : (
                  <>
                    <CheckCircle size={16} />
                    Finalize & Launch
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </form>
      </div>
      <aside className="w-[280px] shrink-0 hidden xl:block">
        <div className="sticky top-6 rounded-xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-card)] p-5">
          <h3 className="text-[14px] font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
            <CheckCircle size={16} className="text-[var(--accent-primary)]" />
            Creation Checklist
          </h3>
          <div className="mb-4">
            <div className="flex items-center justify-between text-[12px] text-[var(--text-secondary)] mb-1">
              <span>Required</span>
              <span className="font-medium text-[var(--text-primary)]">{checklist.requiredSatisfied}/{checklist.requiredTotal}</span>
            </div>
            <div className="h-1.5 rounded-full bg-[var(--bg-primary)] overflow-hidden">
              <div
                className="h-full rounded-full bg-[var(--accent-primary)] transition-[width] duration-300 ease-out"
                style={{ width: `${checklist.requiredTotal ? (checklist.requiredSatisfied / checklist.requiredTotal) * 100 : 0}%` }}
              />
            </div>
          </div>
          <ul className="space-y-2">
            {checklist.items.map((item) => (
              <li key={item.id} className={`flex items-start gap-2 text-[13px] ${item.satisfied ? 'text-[var(--text-secondary)]' : item.required ? 'text-[var(--status-warning)]' : 'text-[var(--text-muted)]'}`}>
                {item.satisfied ? (
                  <CheckCircle size={14} className="text-[var(--status-success)] shrink-0 mt-0.5" />
                ) : (
                  <Circle size={14} className="text-[var(--text-muted)] shrink-0 mt-0.5" />
                )}
                <span>{item.label}</span>
              </li>
            ))}
          </ul>
          {!checklist.isValid && (
            <p className="text-[12px] text-[var(--status-warning)] mt-4">
              Complete all required items before finalizing.
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}

// Sub-components
function DuplicateNameWarning({ agentName }: { agentName?: string }) {
  const { agents } = useAgentStore();
  const isDuplicate = agents.some(a => a.name.toLowerCase() === agentName?.toLowerCase());
  if (!isDuplicate || !agentName) return null;
  return (
    <div className="p-2 px-3 rounded-lg bg-amber-500/10 border border-solid border-amber-500/20 text-[var(--status-warning)] text-[12px] flex items-center gap-2">
      <Warning size={14} />
      <span>An agent with this name already exists. Consider adding a qualifier.</span>
    </div>
  );
}


