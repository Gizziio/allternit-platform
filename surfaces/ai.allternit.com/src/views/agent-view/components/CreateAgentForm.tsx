// @ts-nocheck
import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Robot,
  Palette,
  GearSix,
  CaretRight,
  CheckCircle,
  Warning,
  CircleNotch,
  ArrowRight,
  SpeakerHigh,
  SpeakerSlash,
  Play,
  MagnifyingGlass,
  Plus,
  Circle,
  Pencil,
  Trash,
  Network,
  SquaresFour,
  Headphones,
  Sparkle,
} from "@phosphor-icons/react";
import { useAgentStore } from "@/lib/agents/agent.store";
import { useThemeStore, resolveTheme } from "@/design/ThemeStore";
import { 
  AGENT_TYPES, 
  AGENT_MODELS, 
  DEFAULT_AGENT_NAME, 
  DEFAULT_AGENT_DESCRIPTION,
  CHARACTER_SETUPS,
  SETUP_CAPABILITY_PRESETS,
  ENHANCED_HARD_BAN_CATEGORIES,
  BAN_CATEGORY_OPTIONS,
  STUDIO_THEME,
} from "../AgentView.constants";
import type { 
  Agent, 
  CreateAgentInput, 
  AgentCharacterSetup,
  CreationTemperament,
  AgentVoiceConfig,
  WorkspaceLayerConfig,
  HarnessConfig,
  AppMode,
  CharacterLayerConfig,
  MascotTemplate,
} from "@/lib/agents/agent.types";
import { 
  getSpecialtyOptions, 
  getSetupStatDefinitions,
  detectPluginConflicts,
  generateEnhancedWorkspaceDocuments,
  validateAgentCreationChecklist,
} from "@/lib/agents";
import { voiceService, type Voice } from "@/lib/agents/voice.service";
import type { HardBanCategory } from "@/lib/agents/character.types";
import { 
  Input, 
  Textarea, 
  Select, 
  SelectTrigger, 
  SelectValue, 
  SelectContent, 
  SelectItem,
  Slider,
  Switch,
  Label,
  Skeleton,
  Alert,
  AlertDescription,
} from "@/components/ui";
import { TagInput } from "@/components/ui/tag-input";
import { AgentAvatarPicker } from "./AgentAvatarPicker";
import { MascotPreview } from "../../agent-elements/MascotPreview";
import { api } from "@/integration/api-client";
import { useStudioTheme } from "../useStudioTheme";
import { BrowserCompatibilityWarningComponent } from "./BrowserCompatibilityWarning";
import { detectBrowserCompatibility } from "@/components/agents/AgentCreationWizard.validations";

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
  shared: true,
  private: true,
  temporary: false,
  persistent: true,
  kernel: false,
};

function calculateProjectedStats(
  setup: AgentCharacterSetup,
  specialtySkills: string[],
) {
  const statDefinitions = getSetupStatDefinitions(setup);
  const stats = Object.fromEntries(
    statDefinitions.map((definition, index) => {
      const specialtyBoost = specialtySkills.some((skill) =>
        definition.signals.some((signal) =>
          skill.toLowerCase().includes(signal.toLowerCase()),
        ),
      )
        ? 10
        : 0;
      const baseValue = 52 + Math.min(index * 6, 18) + specialtyBoost;
      return [definition.key, Math.min(99, baseValue)];
    }),
  );

  const specialtyScores = Object.fromEntries(
    specialtySkills.map((skill, index) => [skill, Math.min(99, 65 + index * 7)]),
  );

  return {
    class: setup.charAt(0).toUpperCase() + setup.slice(1),
    level: Math.max(1, specialtySkills.length + 1),
    xp: Number((specialtySkills.length * 0.75).toFixed(2)),
    stats,
    specialtyScores,
  };
}

const splitLines = (text: string) => text.split('\n').map(l => l.trim()).filter(Boolean);

function buildCharacterLayer(
  formData: Partial<CreateAgentInput>,
  blueprint: { setup: AgentCharacterSetup; specialtySkills: string[]; temperament: CreationTemperament },
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
  const { createAgent, orchestrators, isCreating } = useAgentStore();
  const [activeStep, setActiveStep] = useState<string>("identity");
  const [error, setError] = useState<string | null>(null);
  const [workspaceWarning, setWorkspaceWarning] = useState<string | null>(null);
  const [isForgeQueued, setIsForgeQueued] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  
  // Local state for draft/preview
  const [formData, setFormData] = useState<Partial<CreateAgentInput>>({
    name: "",
    description: "",
    type: "worker",
    model: "gpt-4o",
    provider: "openai",
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
    setup: 'coding' as AgentCharacterSetup,
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

  const [avatarConfig, setAvatarConfig] = useState({
    primary: STUDIO_THEME.accent,
    secondary: STUDIO_THEME.bg,
    pattern: 'circuit',
  });

  const [avatarPickerConfig, setAvatarPickerConfig] = useState({
    bgColor: STUDIO_THEME.accent,
    textColor: STUDIO_THEME.bg,
    iconId: 'Robot',
  });

  const [voices, setVoices] = useState<Voice[]>([]);
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [previewAudio, setPreviewAudio] = useState<HTMLAudioElement | null>(null);
  const [browserCompatibility, setBrowserCompatibility] = useState(detectBrowserCompatibility());

  const activeStepIndex = CREATE_FLOW_STEPS.findIndex((s) => s.id === activeStep);
  const currentStepDescription = CREATE_FLOW_STEPS[activeStepIndex]?.description;

  // Derived calculations
  const projectedStats = useMemo(() => 
    calculateProjectedStats(blueprint.setup, blueprint.specialtySkills), 
  [blueprint.setup, blueprint.specialtySkills]);
  const setupStatDefinitions = useMemo(
    () => getSetupStatDefinitions(blueprint.setup),
    [blueprint.setup],
  );

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

  const isReadyForCreate = useMemo(() => {
    return (
      formData.name && 
      formData.name.length >= 3 &&
      formData.description && 
      formData.description.length >= 10 &&
      blueprint.setup &&
      blueprint.specialtySkills.length >= 1
    );
  }, [formData.name, formData.description, blueprint]);

  const stepValidation = useMemo(() => ({
    identity: !!(formData.name && formData.name.length >= 3 && formData.description && formData.description.length >= 10),
    character: !!(blueprint.setup && blueprint.specialtySkills.length >= 1),
    avatar: true,
    runtime: true,
    harness: Boolean(formData.harness?.mode) && (formData.allowedSurfaces || []).length > 0,
    review: isReadyForCreate,
  }), [formData.name, formData.description, blueprint, formData.harness, formData.allowedSurfaces, isReadyForCreate]);

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

  const applySetupDefaults = (setupId: AgentCharacterSetup) => {
    setBlueprint(prev => ({
      ...prev,
      setup: setupId,
      specialtySkills: [], // Reset specialties when changing setup
    }));
    setFormData(prev => ({
      ...prev,
      capabilities: SETUP_CAPABILITY_PRESETS[setupId],
    }));
  };

  const toggleSpecialty = (skill: string) => {
    setBlueprint(prev => {
      const current = prev.specialtySkills;
      if (current.includes(skill)) {
        return { ...prev, specialtySkills: current.filter(s => s !== skill) };
      }
      if (current.length >= 4) return prev;
      return { ...prev, specialtySkills: [...current, skill] };
    });
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
      const audio = await voiceService.previewVoice(voiceId, "Hello, I am your new AI agent. I am ready to assist you.");
      setPreviewAudio(audio);
      audio.onended = () => setIsPlaying(false);
      audio.play();
    } catch (err) {
      logger.error({ err: err }, 'Voice preview failed:');
      setIsPlaying(false);
    }
  };

  // Forge logic simulation
  const [isForging, setIsForging] = useState(false);
  
  // Fetch models
  const [apiModels, setApiModels] = useState<any[]>([]);
  const [isModelsLoading, setIsModelsLoading] = useState(false);
  const [isCapabilitiesLoading, setIsCapabilitiesLoading] = useState(false);

  useEffect(() => {
  async function fetchData() {
    setIsModelsLoading(true);
    setIsCapabilitiesLoading(true);
    try {
      const models = await api.get('/api/v1/models') as any[];
      if (Array.isArray(models)) {
        setApiModels(models);
      }
    } catch (err) {
      logger.error({ err: err }, 'Failed to fetch models:');
    } finally {
      setIsModelsLoading(false);
      setIsCapabilitiesLoading(false);
    }
  }
  fetchData();
  }, []);

  // Workspace layer configuration
  const [workspaceLayers, setWorkspaceLayers] = useState<WorkspaceLayerConfig>(DEFAULT_LAYER_CONFIG);

  // Fetch voices on mount
  useEffect(() => {
    setVoiceLoading(true);
    voiceService
      .listVoices()
      .then((v) => setVoices(v))
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
      console.warn('[CreateAgentForm] Submission blocked: plugin conflicts detected', pluginConflicts.conflicts);
      setSubmitStatus({ type: 'error', message: `Plugin conflicts detected: ${pluginConflicts.conflicts.join(', ')}` });
      return;
    }

    const definitionOfDone = splitLines(cardSeed.definitionOfDone as string);
    const escalation = splitLines(cardSeed.escalationRules as string);
    const voiceRules = splitLines(cardSeed.voiceRules as string);
    const voiceMicroBans = splitLines(cardSeed.voiceMicroBans as string);
    const domainFocus = (cardSeed.domainFocus as string || '').trim();

    const payload: CreateAgentInput = {
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
    };
    
    // Creating agent with enhanced payload
    
    // Create agent immediately — no artificial delay
    setWorkspaceWarning(null);
    setSubmitStatus(null);
    setIsForgeQueued(false);
    
    (async () => {
      let createdAgent: Agent | null = null;
      let workspaceCreated = false;
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
          });

          const workspaceResponse = await api.post(`/api/v1/agents/${createdAgent.id}/workspace/initialize`, {
            documents: workspaceDocs,
          }) as any;

          if (!workspaceResponse.ok) {
            console.warn('[CreateAgentForm] Workspace initialization via API failed:', workspaceResponse.error);
          }
          workspaceCreated = true;
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

  // Get icon for agent type
  const getTypeIcon = (typeId: string) => {
    switch (typeId) {
      case 'orchestrator': return <Network size={20} className="text-[var(--text-primary)]" />;
      case 'worker': return <GearSix size={20} className="text-[var(--text-primary)]" />;
      default: return <Robot size={20} className="text-[var(--text-primary)]" />;
    }
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

      <div className="relative flex items-center justify-center mb-6">
        {/* Theme Toggle — Left */}
        <ThemeToggle />

        {/* Centered Title */}
        <div className="text-center flex-1">
          <h1 className="m-0 text-2xl font-medium font-research text-[var(--text-primary)]">Create New Agent</h1>
          <p className="m-0 mt-1 text-sm text-[var(--text-secondary)]">Configure your AI agent with voice, type, and capabilities</p>
        </div>

        {/* Spacer to balance layout */}
        <div className="w-10" />
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
          onDismiss={() => {}} 
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
          >
        {/* IDENTITY STEP */}
        {activeStep === "identity" && (
          <section className="rounded-xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 mb-6">
            <div className="mb-6">
              <h2 className="text-[18px] font-semibold text-[var(--text-primary)] m-0 mb-4 font-research flex items-center gap-2">
                <Sparkle size={20} className="text-[var(--accent-primary)]" />
                Agent Identity
              </h2>
              <p className="text-[14px] text-[var(--text-secondary)] m-0 mb-5">
                Define the ownership boundary and runtime role for this agent.
              </p>
            </div>

            <div className="h-px bg-[var(--border-subtle)] my-6" />

            <div className="mb-5">
              <div className="text-[14px] font-medium text-[var(--text-primary)] mb-2 block">Agent Name</div>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Code Review Sentinel"
                required
                className="bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)] text-[var(--text-primary)]"
              />
            </div>

            <div className="mb-5">
              <div className="text-[14px] font-medium text-[var(--text-primary)] mb-2 block">Description</div>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="What this agent owns and what it should deliver."
                required
                className="bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)] text-[var(--text-primary)] min-h-[80px]"
              />
            </div>

            <div className="h-px bg-[var(--border-subtle)] my-6" />

            <div className="mb-5">
              <h3 className="text-[16px] font-semibold text-[var(--text-primary)] m-0 mb-4 flex items-center gap-2">
                <Network size={18} className="text-[var(--accent-primary)]" />
                Agent Type
              </h3>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-3">
                {AGENT_TYPES.map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    className={`rounded-[10px] border border-solid p-4 text-left transition-all duration-200 cursor-pointer ${
                      formData.type === type.id ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10' : 'border-[var(--border-subtle)] bg-transparent'
                    }`}
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        type: type.id,
                        parentAgentId: type.id === "sub-agent" ? prev.parentAgentId : undefined,
                      }))
                    }
                  >
                    <div className="flex items-center gap-2 mb-2">
                      {getTypeIcon(type.id)}
                      <span className="font-medium text-[var(--text-primary)]">{type.name}</span>
                      {formData.type === type.id && (
                        <CheckCircle size={16} className="text-[var(--accent-primary)] ml-auto" />
                      )}
                    </div>
                    <p className="text-[12px] text-[var(--text-secondary)] m-0">{type.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {formData.type === "sub-agent" && (
              <div className="mt-5">
                <div className="text-[14px] font-medium text-[var(--text-primary)] mb-2 block">Parent Orchestrator</div>
                <Select
                  value={formData.parentAgentId || ""}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, parentAgentId: value || undefined }))
                  }
                >
                  <SelectTrigger className="bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)] text-[var(--text-primary)]">
                    <SelectValue
                      placeholder={
                        orchestrators.length === 0
                          ? "No orchestrators available"
                          : "Select parent orchestrator"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent className="bg-[var(--bg-card)] border border-solid border-[var(--border-subtle)]">
                    {orchestrators.map((orch) => (
                      <SelectItem key={orch.id} value={orch.id}>
                        {orch.name}
                      </SelectItem>
                    ))}
                    {orchestrators.length === 0 && (
                      <SelectItem value="none" disabled>
                        Create an orchestrator first
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                {orchestrators.length === 0 && (
                  <p className="text-[12px] text-[var(--status-warning)] mt-2">
                    You need an orchestrator before creating a sub-agent.
                  </p>
                )}
              </div>
            )}

            <div className="h-px bg-[var(--border-subtle)] my-6" />

            <div className="mb-5">
              <h3 className="text-[16px] font-semibold text-[var(--text-primary)] m-0 mb-4 flex items-center gap-2">
                <Sparkle size={18} className="text-[var(--accent-primary)]" />
                Personality & Style
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                {[
                  { id: 'openness', label: 'Openness', low: 'Conventional', high: 'Inventive' },
                  { id: 'conscientiousness', label: 'Conscientiousness', low: 'Spontaneous', high: 'Organized' },
                  { id: 'extraversion', label: 'Extraversion', low: 'Reserved', high: 'Outgoing' },
                  { id: 'agreeableness', label: 'Agreeableness', low: 'Critical', high: 'Cooperative' }
                ].map((trait) => (
                  <div key={trait.id} className="bg-[var(--bg-primary)] p-3 rounded-xl border border-solid border-[var(--border-subtle)]">
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-[var(--text-primary)] text-[13px]">{trait.label}</Label>
                      <span className="text-[13px] font-bold text-[var(--accent-primary)] bg-[var(--accent-primary)]/20 px-2 py-0.5 rounded-md">
                        {personality[trait.id as keyof typeof personality] as number}%
                      </span>
                    </div>
                    <Slider
                      value={[personality[trait.id as keyof typeof personality] as number]}
                      onValueChange={([value]) => setPersonality(prev => ({ ...prev, [trait.id]: value }))}
                      min={0}
                      max={100}
                      step={1}
                    />
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-[12px] text-[var(--text-muted)]">{trait.low}</span>
                      <span className="text-[12px] text-[var(--text-muted)]">{trait.high}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-5">
                <div className="flex flex-col gap-2">
                  <Label className="text-[var(--text-primary)] text-[13px]">Communication Style</Label>
                  <Select
                    value={personality.communicationStyle}
                    onValueChange={(value: any) => setPersonality(prev => ({ ...prev, communicationStyle: value }))}
                  >
                    <SelectTrigger className="bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)] text-[var(--text-primary)] h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[var(--bg-card)] border border-solid border-[var(--border-subtle)]">
                      <SelectItem value="direct">Direct & Concise</SelectItem>
                      <SelectItem value="analytical">Analytical & Detailed</SelectItem>
                      <SelectItem value="collaborative">Cooperative & Supportive</SelectItem>
                      <SelectItem value="creative">Expressive & Imaginative</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-2">
                  <Label className="text-[var(--text-primary)] text-[13px]">Work Style</Label>
                  <Select
                    value={personality.workStyle}
                    onValueChange={(value: any) => setPersonality(prev => ({ ...prev, workStyle: value }))}
                  >
                    <SelectTrigger className="bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)] text-[var(--text-primary)] h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[var(--bg-card)] border border-solid border-[var(--border-subtle)]">
                      <SelectItem value="independent">Independent Autonomous</SelectItem>
                      <SelectItem value="collaborative">Team-Oriented</SelectItem>
                      <SelectItem value="guided">Requires Supervision</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-2">
                  <Label className="text-[var(--text-primary)] text-[13px]">Decision Making</Label>
                  <Select
                    value={personality.decisionMaking}
                    onValueChange={(value: any) => setPersonality(prev => ({ ...prev, decisionMaking: value }))}
                  >
                    <SelectTrigger className="bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)] text-[var(--text-primary)] h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[var(--bg-card)] border border-solid border-[var(--border-subtle)]">
                      <SelectItem value="data-driven">Data-Driven & Logical</SelectItem>
                      <SelectItem value="intuitive">Intuitive & Fast</SelectItem>
                      <SelectItem value="consensus">Consensus-Based</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex flex-col gap-2 mb-4">
                <Label className="text-[var(--text-primary)] text-[13px]">Personality Traits</Label>
                <TagInput
                  value={(formData.config as any)?.personalityTraits || []}
                  onChange={(tags: string[]) => setFormData(prev => ({ ...prev, config: { ...(prev.config || {}), personalityTraits: tags } }))}
                  placeholder="Add traits (e.g. Stoic, Sarcastic, Highly Technical)…"
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label className="text-[var(--text-primary)] text-[13px]">Backstory & Context</Label>
                <Textarea
                  value={(formData.config as any)?.backstory || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, config: { ...(prev.config || {}), backstory: e.target.value } }))}
                  placeholder="Provide background context that shapes this agent's behavior…"
                  rows={4}
                  className="bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)] text-[var(--text-primary)]"
                />
              </div>
            </div>
          </section>
        )}

        {/* CHARACTER STEP */}
        {activeStep === "character" && (
          <section className="flex flex-col gap-6">
            <div className="rounded-xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 mb-6">
              <div className="mb-6">
                <h2 className="text-[18px] font-semibold text-[var(--text-primary)] m-0 mb-4 font-research flex items-center gap-2">
                  <Sparkle size={20} className="text-[var(--accent-primary)]" />
                  Character Profile
                </h2>
                <p className="text-[14px] text-[var(--text-secondary)] m-0 mb-5">
                  Choose setup and specialties. Stats and level are projected from measurable telemetry signals.
                </p>
              </div>

              <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-3">
                {CHARACTER_SETUPS.map((setup) => (
                  <button
                    key={setup.id}
                    type="button"
                    className={`rounded-[10px] border border-solid p-4 text-left transition-all duration-200 cursor-pointer ${
                      blueprint.setup === setup.id ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10' : 'border-[var(--border-subtle)] bg-[var(--bg-card)]'
                    }`}
                    onClick={() => applySetupDefaults(setup.id)}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-[var(--text-primary)]">{setup.label}</span>
                      {blueprint.setup === setup.id && <CheckCircle size={16} className="text-[var(--accent-primary)]" />}
                    </div>
                    <p className="text-[12px] text-[var(--text-secondary)] m-0 mb-2">{setup.description}</p>
                    <span className="text-[12px] px-2 py-0.5 rounded bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]">
                      class: {setup.className}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 mb-6">
              <h3 className="text-[16px] font-semibold text-[var(--text-primary)] m-0 mb-4">Operational Boundaries (Hard Bans)</h3>
              <p className="text-[13px] text-[var(--text-secondary)] m-0 mb-4">Define critical restrictions for this agent.</p>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-3">
                {Object.entries(ENHANCED_HARD_BAN_CATEGORIES).map(([key, ban]) => {
                  const isSelected = (formData.config as any)?.hardBans?.some((b: any) => b.category === key);
                  const Icon = (ban as any).icon || Warning;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setFormData(prev => {
                          const config = (prev.config as any) || {};
                          const hardBans = config.hardBans || [];
                          const exists = hardBans.find((b: any) => b.category === key);
                          const nextBans = exists 
                            ? hardBans.filter((b: any) => b.category !== key)
                            : [...hardBans, { category: key, severity: (ban as any).severity }];
                          return { ...prev, config: { ...config, hardBans: nextBans } };
                        });
                      }}
                      className={`flex items-start gap-3 p-4 rounded-xl text-left transition-all duration-200 border border-solid ${
                        isSelected ? 'bg-red-500/10 border-red-500' : 'bg-[var(--bg-primary)] border-[var(--border-subtle)]'
                      }`}
                    >
                      <div className={`p-2 rounded-lg ${isSelected ? 'bg-red-500/20' : 'bg-[var(--surface-hover)]'}`}>
                        <Icon size={18} className={isSelected ? 'text-red-500' : 'text-[var(--text-secondary)]'} />
                      </div>
                      <div>
                        <div className={`font-medium text-[14px] ${isSelected ? 'text-red-500' : 'text-[var(--text-primary)]'}`}>{(ban as any).label}</div>
                        <div className="text-[12px] text-[var(--text-muted)] mt-0.5">{(ban as any).description}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-4">
              <div className="rounded-xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 mb-6">
                <h3 className="text-[16px] font-semibold text-[var(--text-primary)] m-0 mb-4">Specialties & Domain</h3>
                <div className="flex flex-col gap-4">
                  <div>
                    <Label className="text-[var(--text-primary)] mb-2 block">Domain Focus</Label>
                    <Input
                      value={cardSeed.domainFocus}
                      onChange={(e) => setCardSeed(prev => ({ ...prev, domainFocus: e.target.value }))}
                      placeholder="e.g. Frontend Architecture, Security Audit"
                      className="bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)] text-[var(--text-primary)]"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label className="text-[var(--text-primary)]">Specialty Skills</Label>
                      <span className="text-[12px] text-[var(--text-muted)]">{(blueprint.specialtySkills ?? []).length}/4</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {getSpecialtyOptions(blueprint.setup).map((skill) => {
                        const selected = (blueprint.specialtySkills ?? []).includes(skill);
                        return (
                          <button
                            key={skill}
                            type="button"
                            onClick={() => toggleSpecialty(skill)}
                            className={`px-2.5 py-1 rounded-md text-[12px] border border-solid transition-all duration-200 ${
                              selected ? 'bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] border-[var(--accent-primary)]' : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] border-[var(--border-subtle)]'
                            }`}
                          >
                            {skill}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <Label className="text-[var(--text-primary)] mb-2 block">Escalation Triggers</Label>
                    <TagInput
                      value={splitLines(cardSeed.escalationRules)}
                      onChange={(tags: string[]) => setCardSeed(prev => ({ ...prev, escalationRules: tags.join('\n') }))}
                      placeholder="Add triggers…"
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 mb-6">
                <h3 className="text-[16px] font-semibold text-[var(--text-primary)] m-0 mb-4">Projected Level</h3>
                <p className="text-[13px] text-[var(--text-secondary)] m-0 mb-3">Based on setup baseline + specialties.</p>
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] text-[var(--text-secondary)]">Class</span>
                    <span className="text-[12px] px-2 py-0.5 rounded-full border border-solid border-[var(--border-subtle)] text-[var(--text-primary)]">
                      {projectedStats.class}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] text-[var(--text-secondary)]">Level</span>
                    <span className="text-[18px] font-semibold text-[var(--text-primary)]">Lv {projectedStats.level}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] text-[var(--text-secondary)]">XP</span>
                    <span className="text-[13px] font-medium text-[var(--text-primary)]">{projectedStats.xp.toFixed(2)}</span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {(blueprint.specialtySkills ?? []).slice(0, 3).map((skill) => (
                      <div key={skill} className="flex items-center justify-between p-1.5 px-2.5 rounded-md border border-solid border-[var(--border-subtle)] text-[12px]">
                        <span className="text-[var(--text-secondary)]">{skill}</span>
                        <span className="text-[var(--text-primary)] font-medium">{projectedStats.specialtyScores[skill] ?? 0}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 mb-6">
              <h3 className="text-[16px] font-semibold text-[var(--text-primary)] m-0 mb-4">Measured Setup Stats</h3>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-3">
                {setupStatDefinitions.map((definition) => {
                  const value = projectedStats.stats[definition.key] ?? 0;
                  return (
                    <div key={definition.key} className="p-4 rounded-lg border border-solid border-[var(--border-subtle)] bg-[var(--bg-primary)]">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-[14px] text-[var(--text-primary)]">{definition.label}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[12px] px-1.5 py-0.5 rounded border border-solid border-[var(--border-subtle)] text-[var(--text-secondary)]">
                            {definition.key}
                          </span>
                          <span className="text-[13px] font-bold text-[var(--accent-primary)]">{value}</span>
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full bg-[var(--bg-card)] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[var(--accent-primary)] to-[#B08D6E] transition-[width] duration-300 ease-out"
                          style={{ width: `${Math.max(4, value)}%` }}
                        />
                      </div>
                      <p className="text-[12px] text-[var(--text-secondary)] m-0 mt-2">{definition.description}</p>
                      <p className="text-[12px] text-[var(--text-muted)] m-0 mt-1">
                        Signals: {definition.signals.join(", ")}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-4">
              <div className="rounded-xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 mb-6">
                <div className="text-[14px] font-medium text-[var(--text-primary)] mb-2 block">Temperament</div>
                <Select
                  value={blueprint.temperament}
                  onValueChange={(value) =>
                    setBlueprint((prev) => ({ ...prev, temperament: value as CreationTemperament }))
                  }
                >
                  <SelectTrigger className="bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)] text-[var(--text-primary)]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[var(--bg-card)] border border-solid border-[var(--border-subtle)]">
                    <SelectItem value="precision">precision</SelectItem>
                    <SelectItem value="exploratory">exploratory</SelectItem>
                    <SelectItem value="systemic">systemic</SelectItem>
                    <SelectItem value="balanced">balanced</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="rounded-xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 mb-6">
                <div className="text-[14px] font-medium text-[var(--text-primary)] mb-2 block">Setup Capabilities</div>
                <div className="p-3 rounded-lg border border-solid border-[var(--border-subtle)] text-[13px] text-[var(--text-secondary)] bg-[var(--bg-primary)]">
                  {SETUP_CAPABILITY_PRESETS[blueprint.setup].join(", ")}
                </div>
              </div>
            </div>

            <div className="h-px bg-[var(--border-subtle)]" />

            <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-4">
              <div>
                <div className="text-[14px] font-medium text-[var(--text-primary)] mb-2 block">Role Domain Focus</div>
                <Input
                  value={cardSeed.domainFocus}
                  onChange={(e) => setCardSeed((prev) => ({ ...prev, domainFocus: e.target.value }))}
                  placeholder="Domain ownership boundary"
                  className="bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)] text-[var(--text-primary)]"
                />
              </div>
              <div>
                <div className="text-[14px] font-medium text-[var(--text-primary)] mb-2 block">Voice Style</div>
                <Input
                  value={cardSeed.voiceStyle}
                  onChange={(e) => setCardSeed((prev) => ({ ...prev, voiceStyle: e.target.value }))}
                  placeholder="Technical, direct, skeptical…"
                  className="bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)] text-[var(--text-primary)]"
                />
              </div>
            </div>

            <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-4">
              <div>
                <div className="text-[14px] font-medium text-[var(--text-primary)] mb-2 block">Definition of Done (one per line)</div>
                <Textarea
                  value={cardSeed.definitionOfDone}
                  onChange={(e) => setCardSeed((prev) => ({ ...prev, definitionOfDone: e.target.value }))}
                  rows={4}
                  className="bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)] text-[var(--text-primary)]"
                />
              </div>
              <div>
                <div className="text-[14px] font-medium text-[var(--text-primary)] mb-2 block">Escalation Triggers (one per line)</div>
                <Textarea
                  value={cardSeed.escalationRules}
                  onChange={(e) => setCardSeed((prev) => ({ ...prev, escalationRules: e.target.value }))}
                  rows={4}
                  className="bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)] text-[var(--text-primary)]"
                />
              </div>
            </div>

            <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-4">
              <div>
                <div className="text-[14px] font-medium text-[var(--text-primary)] mb-2 block">Voice Rules (one per line)</div>
                <Textarea
                  value={cardSeed.voiceRules}
                  onChange={(e) => setCardSeed((prev) => ({ ...prev, voiceRules: e.target.value }))}
                  rows={4}
                  className="bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)] text-[var(--text-primary)]"
                />
              </div>
              <div>
                <div className="text-[14px] font-medium text-[var(--text-primary)] mb-2 block">Voice Micro-Bans (one per line)</div>
                <Textarea
                  value={cardSeed.voiceMicroBans}
                  onChange={(e) => setCardSeed((prev) => ({ ...prev, voiceMicroBans: e.target.value }))}
                  rows={4}
                  className="bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)] text-[var(--text-primary)]"
                />
              </div>
            </div>

            <div className="rounded-xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 mb-6">
              <div className="flex items-center justify-between mb-3">
                <div className="text-[14px] font-medium text-[var(--text-primary)] m-0">Hard Ban Categories</div>
                <span className="text-[12px] px-2 py-0.5 rounded-full bg-[var(--bg-primary)] text-[var(--text-secondary)]">
                  {cardSeed.hardBanCategories.length} selected
                </span>
              </div>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-3">
                {BAN_CATEGORY_OPTIONS.map((option) => {
                  const selected = cardSeed.hardBanCategories.includes(option.category);
                  return (
                    <button
                      key={option.category}
                      type="button"
                      className={`p-3 rounded-lg border border-solid text-left cursor-pointer transition-all duration-200 ${
                        selected ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10' : 'border-[var(--border-subtle)] bg-transparent'
                      }`}
                      onClick={() =>
                        setCardSeed((prev) => {
                          const exists = prev.hardBanCategories.includes(option.category);
                          return {
                            ...prev,
                            hardBanCategories: exists
                              ? prev.hardBanCategories.filter((category) => category !== option.category)
                              : [...prev.hardBanCategories, option.category],
                          };
                        })
                      }
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-[13px] text-[var(--text-primary)]">{option.label}</span>
                        {selected && <CheckCircle size={16} className="text-[var(--accent-primary)]" />}
                      </div>
                      <p className="text-[12px] text-[var(--text-secondary)] m-0 mt-1">{option.description}</p>
                    </button>
                  );
                })}
              </div>
              {cardSeed.hardBanCategories.length === 0 && (
                <p className="text-[12px] text-[var(--status-warning)] mt-3">
                  Select at least one hard-ban category so tool blocking is enforceable.
                </p>
              )}
            </div>
          </section>
        )}

        {/* AVATAR STEP */}
        {activeStep === "avatar" && (
          <section className="flex flex-col gap-6 flex-1 min-h-0">
            <div className="mb-6">
              <h2 className="text-[18px] font-semibold text-[var(--text-primary)] m-0 mb-4 font-research flex items-center gap-2">
                <Palette size={20} className="text-[var(--accent-primary)]" />
                Avatar
              </h2>
              <p className="text-[14px] text-[var(--text-secondary)] m-0 mb-5">
                Choose a visual identity for your agent.
              </p>
            </div>

            <div className="max-w-[400px]">
              <AgentAvatarPicker
                name={formData.name || 'Agent'}
                config={avatarPickerConfig}
                onChange={(config) => {
                  setAvatarPickerConfig(config);
                  // Sync with legacy avatar config for compatibility
                  setAvatarConfig(prev => ({
                    ...prev,
                    primary: config.bgColor,
                    secondary: config.textColor,
                  }));
                }}
              />
            </div>
          </section>
        )}
        {/* RUNTIME STEP */}
        {activeStep === "runtime" && (
          <section className="flex flex-col gap-6">
            <div className="rounded-xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 mb-6">
              <div className="mb-6">
                <h2 className="text-[18px] font-semibold text-[var(--text-primary)] m-0 mb-4 font-research flex items-center gap-2">
                  <GearSix size={20} className="text-[var(--accent-primary)]" />
                  Runtime Configuration
                </h2>
                <p className="text-[14px] text-[var(--text-secondary)] m-0 mb-5">
                  Configure model, tooling, and runtime behaviors.
                </p>
              </div>

              <div className="mb-6">
                <h3 className="text-[16px] font-semibold text-[var(--text-primary)] m-0 mb-4 flex items-center gap-2">
                  <Robot size={18} className="text-[var(--accent-primary)]" />
                  Model Configuration
                </h3>
                <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4 mb-5">
                  <div>
                    <div className="text-[14px] font-medium text-[var(--text-primary)] mb-2 block">Intelligence Model</div>
                    {isModelsLoading ? (
                      <Skeleton className="h-[42px]" />
                    ) : (
                      <Select
                        value={formData.model}
                        onValueChange={(value) => {
                          setFormData((prev) => {
                            const selectedModel = apiModels.find(m => m.id === value);
                            if (selectedModel) {
                              return { ...prev, model: value, provider: selectedModel.provider as CreateAgentInput["provider"] };
                            }
                            return { ...prev, model: value };
                          });
                        }}
                      >
                        <SelectTrigger className="bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)] text-[var(--text-primary)] h-[42px]">
                          <SelectValue placeholder="Select model" />
                        </SelectTrigger>
                        <SelectContent className="bg-[var(--bg-card)] border border-solid border-[var(--border-subtle)] z-[1000] max-h-[400px] w-[300px]">
                          {(apiModels.length > 0 ? apiModels : AGENT_MODELS).map((model) => (
                            <SelectItem key={model.id} value={model.id}>
                              <div className="flex flex-col gap-0.5 py-1">
                                <div className="flex items-center gap-2">
                                  <div className={`w-2 h-2 rounded-full ${
                                    model.provider === 'openai' ? 'bg-[#10a37f]' : 
                                    model.provider === 'anthropic' ? 'bg-[#d97757]' : 
                                    'bg-[var(--status-info)]'
                                  }`} />
                                  <span className="font-semibold text-[13px]">{model.name}</span>
                                </div>
                                <span className="text-[12px] text-[var(--text-muted)] ml-4">
                                  {model.provider.toUpperCase()} • {model.id}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  <div>
                    <div className="text-[14px] font-medium text-[var(--text-primary)] mb-2 block">Provider</div>
                    <Select
                      value={formData.provider}
                      onValueChange={(value) =>
                        setFormData((prev) => ({
                          ...prev,
                          provider: value as CreateAgentInput["provider"],
                        }))
                      }
                    >
                      <SelectTrigger className="bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)] text-[var(--text-primary)] h-[42px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[var(--bg-card)] border border-solid border-[var(--border-subtle)] z-[1000]">
                        <SelectItem value="openai">OpenAI</SelectItem>
                        <SelectItem value="anthropic">Anthropic</SelectItem>
                        <SelectItem value="local">Local</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
                  <div>
                    <div className="text-[14px] font-medium text-[var(--text-primary)] mb-2 block">Max Iterations: {formData.maxIterations}</div>
                    <Slider
                      value={[formData.maxIterations || 10]}
                      onValueChange={([value]) => setFormData((prev) => ({ ...prev, maxIterations: value }))}
                      min={1}
                      max={50}
                      step={1}
                    />
                  </div>

                  <div>
                    <div className="text-[14px] font-medium text-[var(--text-primary)] mb-2 block">Temperature: {formData.temperature}</div>
                    <Slider
                      value={[formData.temperature || 0.7]}
                      onValueChange={([value]) => setFormData((prev) => ({ ...prev, temperature: value }))}
                      min={0}
                      max={2}
                      step={0.1}
                    />
                  </div>
                </div>
              </div>

              <div className="h-px bg-[var(--border-subtle)] my-6" />

              <div>
                <h3 className="text-[16px] font-semibold text-[var(--text-primary)] m-0 mb-4 flex items-center gap-2">
                  <Headphones size={18} className="text-[var(--accent-primary)]" />
                  Voice Settings
                </h3>
                <div className="flex items-center justify-between p-4 rounded-[10px] border border-solid border-[var(--border-subtle)] mb-4">
                  <div className="flex items-center gap-3">
                    {formData.voice?.enabled ? (
                      <SpeakerHigh size={20} className="text-[var(--status-success)]" />
                    ) : (
                      <SpeakerSlash size={20} className="text-[var(--text-muted)]" />
                    )}
                    <div>
                      <div className="font-medium text-[var(--text-primary)]">Enable Voice</div>
                      <div className="text-[13px] text-[var(--text-secondary)]">
                        Allow this agent to speak responses using text-to-speech.
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
                  <div className="border-l-2 border-solid border-[var(--accent-primary)]/40 pl-4">
                    <div className="mb-4">
                      <div className="text-[14px] font-medium text-[var(--text-primary)] mb-2 block">Voice</div>
                      <div className="flex gap-2">
                        <Select
                          value={formData.voice?.voiceId || "default"}
                          onValueChange={(value) =>
                            setFormData((prev) => ({
                              ...prev,
                              voice: { enabled: true, voiceId: value, ...prev.voice },
                            }))
                          }
                          aria-disabled={voiceLoading}
                        >
                          <SelectTrigger className="flex-1 bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)] text-[var(--text-primary)] h-[42px]">
                            <SelectValue placeholder="Select voice" />
                          </SelectTrigger>
                          <SelectContent className="bg-[var(--bg-card)] border border-solid border-[var(--border-subtle)] z-[1000]">
                            {voices.map((voice) => (
                              <SelectItem key={voice.id} value={voice.id}>
                                <div className="flex items-center gap-2.5 py-0.5">
                                  <div
                                    className={`w-2.5 h-2.5 rounded-full ${
                                      voice.engine === "chatterbox" ? "bg-[#3b82f6] shadow-[0_0_8px_rgba(59,130,246,0.4)]" : 
                                      voice.engine === "xtts_v2" ? "bg-[#a855f7] shadow-[0_0_8px_rgba(168,85,247,0.4)]" : 
                                      "bg-[#22c55e] shadow-[0_0_8px_rgba(34,197,94,0.4)]"
                                    }`}
                                  />
                                  <div className="flex flex-col">
                                    <span className="font-medium">{voice.label}</span>
                                    <span className="text-[12px] text-[var(--text-muted)]">
                                      {voice.engine.toUpperCase()} {!voice.assetReady ? " (Download Required)" : ""}
                                    </span>
                                  </div>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <button
                          type="button"
                          onClick={handleVoicePreview}
                          disabled={!formData.voice?.enabled || isPlaying}
                          className="p-2 px-3 rounded-lg border border-solid border-[var(--border-subtle)] bg-[var(--bg-primary)] text-[var(--text-primary)] cursor-pointer disabled:opacity-50"
                        >
                          {isPlaying ? (
                            <CircleNotch size={16} className="animate-spin" />
                          ) : (
                            <Play size={16} />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-col gap-3">
                      <Label className="text-[12px] text-[var(--text-secondary)]">Voice Tone Modifiers</Label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        {[
                          { id: 'formality', label: 'Formality' },
                          { id: 'enthusiasm', label: 'Enthusiasm' },
                          { id: 'empathy', label: 'Empathy' },
                          { id: 'directness', label: 'Directness' }
                        ].map((tone) => (
                          <div key={tone.id}>
                            <div className="flex justify-between mb-1">
                              <span className="text-[12px] text-[var(--text-muted)]">{tone.label}</span>
                              <span className="text-[12px] text-[var(--accent-primary)]">{((formData.config as any)?.voice?.tone?.[tone.id] ?? 0.5) * 100}%</span>
                            </div>
                            <Slider
                              value={[((formData.config as any)?.voice?.tone?.[tone.id] ?? 0.5) * 100]}
                              onValueChange={([val]) => setFormData(prev => ({
                                ...prev,
                                config: {
                                  ...(prev.config || {}),
                                  voice: {
                                    ...(prev.config as any)?.voice || {},
                                    tone: {
                                      ...((prev.config as any)?.voice?.tone || { formality: 0.5, enthusiasm: 0.5, empathy: 0.5, directness: 0.5 }),
                                      [tone.id]: val / 100
                                    }
                                  }
                                }
                              }))}
                              min={0}
                              max={100}
                              step={1}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-[14px] font-medium text-[var(--text-primary)]">Auto-Speak Responses</div>
                          <div className="text-[13px] text-[var(--text-secondary)]">Automatically speak all agent responses.</div>
                        </div>
                        <Switch
                          checked={formData.config?.voice?.autoSpeak || false}
                          onCheckedChange={(checked) => setFormData(prev => ({
                            ...prev,
                            config: {
                              ...(prev.config || {}),
                              voice: { ...(prev.config as any)?.voice || {}, autoSpeak: checked }
                            }
                          }))}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* HARNESS STEP */}
        {activeStep === "harness" && (
          <section className="flex flex-col gap-6">
            <div className="rounded-xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-card)] p-6 mb-6">
              <div className="mb-6">
                <h2 className="text-[18px] font-semibold text-[var(--text-primary)] m-0 mb-4 font-research flex items-center gap-2">
                  <Network size={20} className="text-[var(--accent-primary)]" />
                  Harness & Routing
                </h2>
                <p className="text-[14px] text-[var(--text-secondary)] m-0 mb-5">
                  Configure how this agent routes AI requests and which surfaces it can use.
                </p>
              </div>

              <div className="mb-6">
                <h3 className="text-[16px] font-semibold text-[var(--text-primary)] m-0 mb-4">Harness Mode</h3>
                <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-3">
                  {(['cloud', 'byok', 'local', 'subprocess'] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      className={`rounded-[10px] border border-solid p-4 text-left transition-all duration-200 cursor-pointer ${
                        formData.harness?.mode === mode ? 'border-[var(--accent-primary)] bg-[var(--accent-primary)]/10' : 'border-[var(--border-subtle)] bg-transparent'
                      }`}
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          harness: { mode } as HarnessConfig,
                        }))
                      }
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-[var(--text-primary)] capitalize">{mode}</span>
                        {formData.harness?.mode === mode && <CheckCircle size={16} className="text-[var(--accent-primary)]" />}
                      </div>
                      <p className="text-[12px] text-[var(--text-secondary)] m-0">
                        {mode === 'cloud' && 'Route requests through the Allternit cloud harness.'}
                        {mode === 'byok' && 'Bring your own API keys for direct provider access.'}
                        {mode === 'local' && 'Connect to a local inference endpoint.'}
                        {mode === 'subprocess' && 'Spawn a local subprocess for execution.'}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {formData.harness?.mode === 'cloud' && (
                <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4 mb-6">
                  <div>
                    <Label className="text-[var(--text-primary)] text-[13px] mb-2 block">Base URL</Label>
                    <Input
                      value={formData.harness.cloud?.baseURL || ''}
                      onChange={(e) => setFormData((prev) => ({
                        ...prev,
                        harness: { ...prev.harness, mode: 'cloud', cloud: { ...(prev.harness?.cloud || {}), baseURL: e.target.value } } as HarnessConfig,
                      }))}
                      placeholder="https://api..."
                      className="bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)] text-[var(--text-primary)]"
                    />
                  </div>
                  <div>
                    <Label className="text-[var(--text-primary)] text-[13px] mb-2 block">Access Token</Label>
                    <Input
                      type="password"
                      value={formData.harness.cloud?.accessToken || ''}
                      onChange={(e) => setFormData((prev) => ({
                        ...prev,
                        harness: { ...prev.harness, mode: 'cloud', cloud: { ...(prev.harness?.cloud || {}), accessToken: e.target.value } } as HarnessConfig,
                      }))}
                      placeholder="Access token"
                      className="bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)] text-[var(--text-primary)]"
                    />
                  </div>
                </div>
              )}

              {formData.harness?.mode === 'byok' && (
                <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4 mb-6">
                  {(['anthropic', 'openai', 'google'] as const).map((provider) => (
                    <div key={provider} className="space-y-3">
                      <Label className="text-[var(--text-primary)] text-[13px] mb-2 block capitalize">
                        {provider} API Key
                      </Label>
                      <Input
                        type="password"
                        value={formData.harness.byok?.[provider]?.apiKey || ''}
                        onChange={(e) => setFormData((prev) => ({
                          ...prev,
                          harness: {
                            ...prev.harness,
                            mode: 'byok',
                            byok: {
                              ...(prev.harness?.byok || {}),
                              [provider]: {
                                ...(prev.harness?.byok?.[provider] || {}),
                                apiKey: e.target.value,
                              },
                            },
                          } as HarnessConfig,
                        }))}
                        placeholder={provider === 'anthropic' ? 'sk-ant-...' : provider === 'openai' ? 'sk-...' : 'AIza...'}
                        className="bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)] text-[var(--text-primary)]"
                      />
                      <Label className="text-[var(--text-secondary)] text-[12px] mb-1 block capitalize">
                        {provider} Base URL (optional)
                      </Label>
                      <Input
                        value={formData.harness.byok?.[provider]?.baseURL || ''}
                        onChange={(e) => setFormData((prev) => ({
                          ...prev,
                          harness: {
                            ...prev.harness,
                            mode: 'byok',
                            byok: {
                              ...(prev.harness?.byok || {}),
                              [provider]: {
                                ...(prev.harness?.byok?.[provider] || {}),
                                baseURL: e.target.value,
                              },
                            },
                          } as HarnessConfig,
                        }))}
                        placeholder={provider === 'anthropic' ? 'https://api.anthropic.com' : provider === 'openai' ? 'https://api.openai.com' : 'https://generativelanguage.googleapis.com'}
                        className="bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)] text-[var(--text-primary)]"
                      />
                    </div>
                  ))}
                </div>
              )}

              {formData.harness?.mode === 'local' && (
                <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4 mb-6">
                  <div>
                    <Label className="text-[var(--text-primary)] text-[13px] mb-2 block">Base URL</Label>
                    <Input
                      value={formData.harness.local?.baseURL || ''}
                      onChange={(e) => setFormData((prev) => ({
                        ...prev,
                        harness: { ...prev.harness, mode: 'local', local: { ...(prev.harness?.local || {}), baseURL: e.target.value } } as HarnessConfig,
                      }))}
                      placeholder="http://localhost:11434"
                      className="bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)] text-[var(--text-primary)]"
                    />
                  </div>
                </div>
              )}

              {formData.harness?.mode === 'subprocess' && (
                <div className="grid grid-cols-1 gap-4 mb-6">
                  <div>
                    <Label className="text-[var(--text-primary)] text-[13px] mb-2 block">Command</Label>
                    <Input
                      value={formData.harness.subprocess?.command || ''}
                      onChange={(e) => setFormData((prev) => ({
                        ...prev,
                        harness: { ...prev.harness, mode: 'subprocess', subprocess: { ...(prev.harness?.subprocess || {}), command: e.target.value } } as HarnessConfig,
                      }))}
                      placeholder="python agent_server.py"
                      className="bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)] text-[var(--text-primary)]"
                    />
                  </div>
                  <div>
                    <Label className="text-[var(--text-primary)] text-[13px] mb-2 block">Working Directory (optional)</Label>
                    <Input
                      value={formData.harness.subprocess?.cwd || ''}
                      onChange={(e) => setFormData((prev) => ({
                        ...prev,
                        harness: { ...prev.harness, mode: 'subprocess', subprocess: { ...(prev.harness?.subprocess || {}), cwd: e.target.value } } as HarnessConfig,
                      }))}
                      placeholder="/path/to/workdir"
                      className="bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)] text-[var(--text-primary)]"
                    />
                  </div>
                  <div>
                    <Label className="text-[var(--text-primary)] text-[13px] mb-2 block">Environment Variables (KEY=value, one per line)</Label>
                    <Textarea
                      value={Object.entries(formData.harness.subprocess?.env || {}).map(([k, v]) => `${k}=${v}`).join('\n')}
                      onChange={(e) => {
                        const env: Record<string, string> = {};
                        e.target.value.split('\n').forEach((line) => {
                          const [k, ...rest] = line.split('=');
                          if (k && rest.length > 0) env[k.trim()] = rest.join('=').trim();
                        });
                        setFormData((prev) => ({
                          ...prev,
                          harness: { ...prev.harness, mode: 'subprocess', subprocess: { ...(prev.harness?.subprocess || {}), env } } as HarnessConfig,
                        }));
                      }}
                      rows={4}
                      className="bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)] text-[var(--text-primary)]"
                    />
                  </div>

                </div>
              )}

              <div className="h-px bg-[var(--border-subtle)] my-6" />

              <div className="mb-6">
                <h3 className="text-[16px] font-semibold text-[var(--text-primary)] m-0 mb-4">Allowed Surfaces</h3>
                <div className="flex flex-wrap gap-3">
                  {(['chat', 'cowork', 'code', 'design', 'browser'] as AppMode[]).map((surface) => (
                    <button
                      key={surface}
                      type="button"
                      onClick={() => {
                        setFormData((prev) => {
                          const current = prev.allowedSurfaces || [];
                          const next = current.includes(surface)
                            ? current.filter((s) => s !== surface)
                            : [...current, surface];
                          return { ...prev, allowedSurfaces: next as AppMode[] };
                        });
                      }}
                      className={`px-3 py-1.5 rounded-md text-[12px] border border-solid transition-all duration-200 ${
                        (formData.allowedSurfaces || []).includes(surface)
                          ? 'bg-[var(--accent-primary)]/20 text-[var(--accent-primary)] border-[var(--accent-primary)]'
                          : 'bg-[var(--bg-primary)] text-[var(--text-secondary)] border-[var(--border-subtle)]'
                      }`}
                    >
                      {surface}
                    </button>
                  ))}
                </div>
              </div>

              <div className="h-px bg-[var(--border-subtle)] my-6" />

              <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-4">
                <div className="flex flex-col gap-2">
                  <Label className="text-[var(--text-primary)] text-[13px]">Trust Tier</Label>
                  <Select
                    value={formData.trustTier}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, trustTier: value as CreateAgentInput['trustTier'] }))}
                  >
                    <SelectTrigger className="bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)] text-[var(--text-primary)] h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[var(--bg-card)] border border-solid border-[var(--border-subtle)]">
                      <SelectItem value="safe">Safe</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="standard">Standard</SelectItem>
                      <SelectItem value="elevated">Elevated</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-2">
                  <Label className="text-[var(--text-primary)] text-[13px]">Write Scope</Label>
                  <Input
                    value={formData.writeScope}
                    onChange={(e) => setFormData((prev) => ({ ...prev, writeScope: e.target.value }))}
                    placeholder="workspace"
                    className="bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)] text-[var(--text-primary)]"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label className="text-[var(--text-primary)] text-[13px]">Data Classification</Label>
                  <Input
                    value={formData.dataClassification}
                    onChange={(e) => setFormData((prev) => ({ ...prev, dataClassification: e.target.value }))}
                    placeholder="internal"
                    className="bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)] text-[var(--text-primary)]"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <Label className="text-[var(--text-primary)] text-[13px]">Category</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, category: value as CreateAgentInput['category'] }))}
                  >
                    <SelectTrigger className="bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)] text-[var(--text-primary)] h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[var(--bg-card)] border border-solid border-[var(--border-subtle)]">
                      <SelectItem value="engineering">Engineering</SelectItem>
                      <SelectItem value="design">Design</SelectItem>
                      <SelectItem value="marketing">Marketing</SelectItem>
                      <SelectItem value="product">Product</SelectItem>
                      <SelectItem value="research">Research</SelectItem>
                      <SelectItem value="operations">Operations</SelectItem>
                      <SelectItem value="creative">Creative</SelectItem>
                      <SelectItem value="general">General</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="mt-6">
                <Label className="text-[var(--text-primary)] text-[13px] mb-2 block">Tags</Label>
                <TagInput
                  value={formData.tags || []}
                  onChange={(tags) => setFormData((prev) => ({ ...prev, tags }))}
                  placeholder="Add tags..."
                />
              </div>

              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-[var(--text-primary)] text-[13px] mb-2 block">Allowed Skills</Label>
                  <TagInput
                    value={formData.allowedSkills || []}
                    onChange={(tags) => setFormData((prev) => ({ ...prev, allowedSkills: tags }))}
                    placeholder="Add allowed skills..."
                  />
                </div>
                <div>
                  <Label className="text-[var(--text-primary)] text-[13px] mb-2 block">Allowed Tools</Label>
                  <TagInput
                    value={formData.allowedTools || []}
                    onChange={(tags) => setFormData((prev) => ({ ...prev, allowedTools: tags }))}
                    placeholder="Add allowed tools..."
                  />
                </div>
              </div>
            </div>
          </section>
        )}

        {/* REVIEW STEP */}
        {activeStep === "review" && (
          <section className="flex flex-col gap-6">
            <div className="rounded-xl border border-solid border-[var(--border-subtle)] bg-[var(--bg-card)] p-6">
              <h2 className="text-[18px] font-semibold text-[var(--text-primary)] m-0 mb-4 font-research flex items-center gap-2">
                <CheckCircle size={20} className="text-[var(--accent-primary)]" />
                Review & Confirm
              </h2>
              <p className="text-[14px] text-[var(--text-secondary)] m-0 mb-5">
                Verify your agent configuration before finalizing creation.
              </p>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)]">
                    <div className="text-[12px] text-[var(--text-muted)] uppercase mb-1">Agent Name</div>
                    <div className="text-[14px] font-semibold text-[var(--text-primary)]">{formData.name}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)]">
                    <div className="text-[12px] text-[var(--text-muted)] uppercase mb-1">Agent Type</div>
                    <div className="text-[14px] font-semibold text-[var(--text-primary)] capitalize">{formData.type}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)]">
                    <div className="text-[12px] text-[var(--text-muted)] uppercase mb-1">Model</div>
                    <div className="text-[14px] font-semibold text-[var(--text-primary)]">{formData.model}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)]">
                    <div className="text-[12px] text-[var(--text-muted)] uppercase mb-1">Provider</div>
                    <div className="text-[14px] font-semibold text-[var(--text-primary)] capitalize">{formData.provider}</div>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)]">
                  <div className="text-[12px] text-[var(--text-muted)] uppercase mb-1">Description</div>
                  <div className="text-[14px] text-[var(--text-primary)]">{formData.description}</div>
                </div>

                <div className="p-4 rounded-xl border border-solid border-[var(--accent-primary)]/20 bg-[var(--accent-primary)]/5">
                  <div className="flex items-center gap-2 mb-3">
                    <Robot size={18} className="text-[var(--accent-primary)]" />
                    <span className="font-semibold text-[14px]">Operational Character</span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                    <div className="flex justify-between">
                      <span className="text-[13px] text-[var(--text-secondary)]">Setup</span>
                      <span className="text-[13px] font-medium text-[var(--text-primary)]">{blueprint.setup}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[13px] text-[var(--text-secondary)]">Level</span>
                      <span className="text-[13px] font-medium text-[var(--text-primary)]">Lv {projectedStats.level}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[13px] text-[var(--text-secondary)]">Temperament</span>
                      <span className="text-[13px] font-medium text-[var(--text-primary)] capitalize">{blueprint.temperament}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[13px] text-[var(--text-secondary)]">Voice Style</span>
                      <span className="text-[13px] font-medium text-[var(--text-primary)] capitalize">{cardSeed.voiceStyle || 'Default'}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-lg bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)]">
                    <div className="text-[12px] text-[var(--text-muted)] uppercase mb-1">Harness Mode</div>
                    <div className="text-[14px] font-semibold text-[var(--text-primary)] capitalize">{formData.harness?.mode}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)]">
                    <div className="text-[12px] text-[var(--text-muted)] uppercase mb-1">Allowed Surfaces</div>
                    <div className="text-[14px] font-semibold text-[var(--text-primary)]">{(formData.allowedSurfaces || []).join(', ') || 'None'}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)]">
                    <div className="text-[12px] text-[var(--text-muted)] uppercase mb-1">Trust Tier</div>
                    <div className="text-[14px] font-semibold text-[var(--text-primary)] capitalize">{formData.trustTier}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)]">
                    <div className="text-[12px] text-[var(--text-muted)] uppercase mb-1">Category</div>
                    <div className="text-[14px] font-semibold text-[var(--text-primary)] capitalize">{formData.category}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)]">
                    <div className="text-[12px] text-[var(--text-muted)] uppercase mb-1">Write Scope</div>
                    <div className="text-[14px] font-semibold text-[var(--text-primary)]">{formData.writeScope}</div>
                  </div>
                  <div className="p-3 rounded-lg bg-[var(--bg-primary)] border border-solid border-[var(--border-subtle)]">
                    <div className="text-[12px] text-[var(--text-muted)] uppercase mb-1">Data Classification</div>
                    <div className="text-[14px] font-semibold text-[var(--text-primary)]">{formData.dataClassification}</div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation Footer */}
        <div className="sticky bottom-0 z-10 flex items-center justify-between p-4 px-5 bg-[var(--bg-card)]/94 backdrop-blur-md rounded-xl border border-solid border-[var(--border-subtle)] mt-6 gap-3 shadow-lg">
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

function ThemeToggle() {
  const { theme, setTheme } = useThemeStore();
  return (
    <button
      type="button"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="size-10  rounded-lg border border-solid border-[var(--border-subtle)] bg-[var(--bg-card)] flex items-center justify-center cursor-pointer hover:bg-[var(--surface-hover)]"
    >
      {theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
    </button>
  );
}

function Moon(props: any) {
  return <Palette {...props} />;
}

function Sun(props: any) {
  return <Sparkle {...props} />;
}
