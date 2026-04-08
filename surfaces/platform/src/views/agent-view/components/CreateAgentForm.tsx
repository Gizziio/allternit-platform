"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Robot, 
  Circle, 
  CheckCircle, 
  Network, 
  GearSix, 
  Sparkle, 
  Palette, 
  Headphones, 
  SpeakerHigh, 
  SpeakerSlash, 
  Play, 
  CircleNotch, 
  Lightning, 
  Paperclip, 
  FileText, 
  ShieldCheck, 
  Warning, 
  Check, 
  Stack,
  Plus
} from "@phosphor-icons/react";
import { useAgentStore } from "@/lib/agents/agent.store";
import type { 
  Agent, 
  CreateAgentInput, 
  AgentTemplate, 
  VoicePreset, 
  AgentSetup, 
  CreationTemperament,
  WorkspaceLayerConfig,
  CreationBlueprintState,
  CreationCardSeedState,
  CreateFlowStepId
} from "@/lib/agents/agent.types";
import { 
  AGENT_TYPES, 
  AGENT_MODELS, 
  CHARACTER_SPECIALTY_OPTIONS, 
  SETUP_CAPABILITY_PRESETS,
  CREATE_FLOW_STEPS,
  DEFAULT_LAYER_CONFIG,
  BAN_CATEGORY_OPTIONS
} from "@/lib/agents/agent.types";
import { 
  setupSeedDefaults, 
  createDefaultAvatarConfig, 
  buildSeedTelemetryEvents,
  splitLines,
  detectPluginConflicts,
  generateEnhancedWorkspaceDocuments,
} from "@/lib/agents/agent.service";
import {
  getDefaultCharacterLayer, 
  computeCharacterStats, 
  getSetupStatDefinitions,
  getSpecialtyOptions
} from "@/lib/agents/character.service";
import { useWizardPersistence } from "@/components/agents/AgentCreationWizard.persistence";
import { useAvatarCreatorStore } from "@/stores/avatar-creator.store";
import { AvatarCreatorStep } from "@/views/agent-creation/AvatarCreatorStep";
import { MascotPreview } from "./AgentMascotPreview";
import { 
  MASCOT_TEMPLATES, 
  CAPABILITY_CATEGORIES, 
  AGENT_CAPABILITIES_ENHANCED, 
  ENHANCED_HARD_BAN_CATEGORIES 
} from "../AgentView.constants";
import * as voiceService from "@/lib/agents/voice.service";
import { api, GATEWAY_URL } from "@/integration/api-client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TagInput } from "@/components/ui/tag-input";
import { WorkspaceLayerConfigurator } from "@/components/WorkspaceLayerConfigurator";
import { AllternitSystemPromptEditor } from "@/components/agents/A2RSystemPromptEditor";
import { BrowserCompatibilityWarning as BrowserCompatibilityWarningComponent } from "@/components/BrowserCompatibilityWarning";
import { DuplicateNameWarning } from "@/components/DuplicateNameWarning";
import { DraftSavedIndicator } from "@/components/agents/AgentCreationWizard.persistence";
import type { AvatarConfig, CharacterStats } from "@/lib/agents/character.types";
import { CHARACTER_SETUPS } from "@/lib/agents/character.service";

const STUDIO_THEME = {
  accent: "#D4956A",
  bg: "#1A1612",
  bgCard: "rgba(26, 22, 18, 0.95)",
  borderSubtle: "rgba(212, 176, 140, 0.1)",
  textPrimary: "#E7E5E4",
  textSecondary: "#A8A29E",
  textMuted: "#78716C"
};

export function CreateAgentForm({ 
  onCancel, 
  onShowForge,
  onComplete,
}: { 
  onCancel: () => void;
  onShowForge?: (agentName: string) => void;
  onComplete?: (createdAgent: Agent, workspaceCreated: boolean) => void;
}) {
  const { createAgent, isCreating, error, clearError, agents, recordCharacterTelemetry, setIsCreating } = useAgentStore();
  
  // Reset error and isCreating when form mounts
  useEffect(() => {
    clearError();
    const store = useAgentStore.getState();
    if (store.isCreating) {
      setIsCreating(false);
    }
  }, [clearError, setIsCreating]);
  
  const [formData, setFormData] = useState<CreateAgentInput>({
    name: '',
    description: '',
    type: 'worker',
    parentAgentId: undefined,
    model: 'gpt-4o',
    provider: 'openai',
    capabilities: [],
    systemPrompt: '',
    tools: [],
    maxIterations: 10,
    temperature: 0.7,
    voice: {
      voiceId: 'default',
      enabled: false,
    },
  });
  const [blueprint, setBlueprint] = useState<CreationBlueprintState>({
    setup: "coding",
    specialtySkills: CHARACTER_SPECIALTY_OPTIONS.coding.slice(0, 2),
    temperament: "precision",
  });
  const [cardSeed, setCardSeed] = useState<CreationCardSeedState>(setupSeedDefaults("coding"));
  const [activeStep, setActiveStep] = useState<CreateFlowStepId>("welcome");

  // Avatar state - Initialize avatar config - MUST be stable to prevent infinite loops
  const [avatarConfig, setAvatarConfig] = useState<AvatarConfig>(() => 
    createDefaultAvatarConfig("coding")
  );

  // UPGRADE: New Personality State
  const [personality, setPersonality] = useState({
  openness: 50,
  conscientiousness: 50,
  extraversion: 50,
  agreeableness: 50,
  communicationStyle: 'direct' as const,
  workStyle: 'independent' as const,
  decisionMaking: 'data-driven' as const,
  });

  // UPGRADE: Wizard Persistence Setup
  const wizardConfig = useMemo(() => ({
  name: formData.name,
  description: formData.description,
  agentType: formData.type,
  model: formData.model,
  provider: formData.provider,
  characterConfig: {
    personality,
    blueprint,
    avatarConfig,
  },
  selectedTools: formData.tools,
  capabilities: formData.capabilities,
  systemPrompt: formData.systemPrompt,
  temperature: formData.temperature,
  maxIterations: formData.maxIterations,
  }), [formData, personality, blueprint, avatarConfig]);

  const {
  loadState,
  saveState,
  clearState,
  hasLocalStorage,
  saveStatus,
  browserCompatibility,
  } = useWizardPersistence(wizardConfig as any, 0, true);

  // Restore state on mount
  useEffect(() => {
  const restoredState = loadState();
  if (restoredState && restoredState.config) {
    const { config } = restoredState;
    setFormData(prev => ({
      ...prev,
      name: config.name || prev.name,
      description: config.description || prev.description,
      type: (config.agentType as any) || prev.type,
      model: config.model || prev.model,
      provider: (config.provider as any) || prev.provider,
      tools: config.selectedTools || prev.tools,
      capabilities: config.capabilities || prev.capabilities,
      systemPrompt: config.systemPrompt || prev.systemPrompt,
      temperature: config.temperature ?? prev.temperature,
      maxIterations: config.maxIterations ?? prev.maxIterations,
    }));
    if (config.characterConfig) {
      const charConfig = config.characterConfig as any;
      if (charConfig.personality) setPersonality(charConfig.personality);
      if (charConfig.blueprint) setBlueprint(charConfig.blueprint);
      if (charConfig.avatarConfig) setAvatarConfig(charConfig.avatarConfig);
    }  }
  }, []);

  // UPGRADE: Template application effect
  useEffect(() => {
    const templateJson = sessionStorage.getItem('agentTemplate');
    if (templateJson) {
      try {
        const template: AgentTemplate = JSON.parse(templateJson);
        sessionStorage.removeItem('agentTemplate');
        
        console.log('[CreateAgentForm] Applying template:', template.id);
        
        // Advance to identity step automatically
        setActiveStep('identity');

        // Update basic form data
        setFormData(prev => ({
          ...prev,
          name: template.name,
          description: template.description,
          type: 'worker',
          setup: template.setup,
          capabilities: template.capabilities,
          systemPrompt: template.systemPrompt,
          color: template.color
        }));
        
        // Update blueprint
        setBlueprint({
          setup: template.setup,
          specialtySkills: template.capabilities.slice(0, 4),
          temperament: 'balanced'
        });
        
        // Update character seed
        setCardSeed(setupSeedDefaults(template.setup));
        
        // Update Avatar Config & Store
        if (template.mascotTemplate) {
          const newAvatarConfig = {
            ...createDefaultAvatarConfig(template.setup),
            mascotTemplate: template.mascotTemplate,
            colors: {
              primary: template.avatarColors?.primary || template.color,
              secondary: template.avatarColors?.secondary || '#60A5FA',
              glow: template.avatarColors?.glow || '#93C5FD',
              outline: 'rgba(0,0,0,0.5)'
            }
          } as any;
          
          setAvatarConfig(newAvatarConfig);
          
          // Force update the avatar store immediately
          const avatarStore = useAvatarCreatorStore.getState();
          avatarStore.setConfig(newAvatarConfig);
          avatarStore.setAgentContext(template.setup, 'balanced');
        }
      } catch (e) {
        console.error('Failed to apply agent template:', e);
      }
    }
  }, []);

  // Use a ref to track if the last change was from the store to avoid loops
  const lastUpdateFromStoreRef = useRef(false);

  // Sync local avatarConfig with Avatar Store
  useEffect(() => {
    if (avatarConfig && !lastUpdateFromStoreRef.current) {
      const store = useAvatarCreatorStore.getState();
      const currentStoreMascot = (store.currentConfig as any).mascotTemplate;
      const localMascot = (avatarConfig as any).mascotTemplate;
      
      if (localMascot !== currentStoreMascot) {
        console.log('[CreateAgentForm] Updating store from local config:', localMascot);
        store.setConfig(avatarConfig);
      }
    }
    lastUpdateFromStoreRef.current = false;
  }, [avatarConfig]);

  // UPGRADE: Enhanced State Variables
  const [isModelsLoading, setIsModelsLoading] = useState(true);
  const [isCapabilitiesLoading, setIsCapabilitiesLoading] = useState(true);
  const [apiModels, setApiModels] = useState<any[]>([]);
  const [apiCapabilities, setApiCapabilities] = useState<any[]>([]);
  const [submitStatus, setSubmitStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [isForgeQueued, setIsForgeQueued] = useState(false);
  const [workspaceWarning, setWorkspaceWarning] = useState<string | null>(null);

  // Voice presets state
  const [voices, setVoices] = useState<VoicePreset[]>([]);
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [previewAudio, setPreviewAudio] = useState<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  // Fetch real models and capabilities
  useEffect(() => {
  async function fetchData() {
    try {
      const [providersRes, capabilitiesRes] = await Promise.all([
        fetch('/api/v1/providers'),
        fetch('/api/v1/capabilities')
      ]);


      if (providersRes.ok) {
        const data = await providersRes.json();
        const allModels: any[] = [];
        if (Array.isArray(data?.all)) {
          data.all.forEach((provider: any) => {
            provider?.models?.forEach((model: any) => {
              allModels.push({
                id: model.id,
                name: model.name || model.id,
                provider: provider.id,
              });
            });
          });
        } else if (data.providers) {
          Object.entries(data.providers).forEach(([pId, p]: [string, any]) => {
            if (p.models) {
              p.models.forEach((m: any) => allModels.push({ id: m.id, name: m.name || m.id, provider: pId }));
            }
          });
        }
        setApiModels(allModels);
      }

      if (capabilitiesRes.ok) {
        const data = await capabilitiesRes.json();
        setApiCapabilities(Array.isArray(data) ? data : (data.capabilities || []));
      }
    } catch (err) {
      console.error('Failed to fetch enhanced data:', err);
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
        console.log('[CreateAgentForm] Step validation failed for:', activeStep);
        return;
      }
      const nextStep = CREATE_FLOW_STEPS[activeStepIndex + 1];
      if (nextStep) {
        console.log('[CreateAgentForm] Advancing to step:', nextStep.id);
        setActiveStep(nextStep.id);
      }
      return;
    }
    
    console.log('[CreateAgentForm] Submitting from review step');
    
    // SAFETY: Check we're ready and not already creating
    if (!isReadyForCreate) {
      console.log('[CreateAgentForm] Not ready for creation');
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

    const definitionOfDone = splitLines(cardSeed.definitionOfDone);
    const escalation = splitLines(cardSeed.escalationRules);
    const voiceRules = splitLines(cardSeed.voiceRules);
    const voiceMicroBans = splitLines(cardSeed.voiceMicroBans);
    const domainFocus = cardSeed.domainFocus.trim();

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
          style: cardSeed.voiceStyle.trim(),
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
    };
    
    console.log('[CreateAgentForm] Creating agent with enhanced payload:', { 
      name: payload.name, 
      type: payload.type,
      activeStep 
    });
    
    // Show forge animation FIRST, then create agent after animation completes
    setWorkspaceWarning(null);
    setSubmitStatus(null);
    setIsForgeQueued(true);
    onShowForge?.(formData.name || 'Your Agent');
    
    // Delay agent creation to let animation play (6 seconds)
    window.setTimeout(async () => {
      let createdAgent: Agent | null = null;
      let workspaceCreated = false;
      try {
        console.log('[CreateAgentForm] Calling createAgent via API...');
        
        // 1. Create the agent in the backend
        const agentResponse = await api.post('/api/v1/agents', {
          name: payload.name,
          description: payload.description,
          agent_type: payload.type,
          model: payload.model,
          provider: payload.provider,
          capabilities: payload.capabilities,
          system_prompt: payload.systemPrompt,
          tools: payload.tools,
          max_iterations: payload.maxIterations,
          temperature: payload.temperature,
          config: payload.config,
        }) as any;

        if (!agentResponse.ok) {
          throw new Error(agentResponse.error || 'Failed to create agent via API');
        }

        createdAgent = {
          id: agentResponse.data.id || `agent-${Date.now()}`,
          ...payload,
          status: 'idle',
          createdAt: Date.now().toString(),
          updatedAt: Date.now().toString(),
        } as unknown as Agent;
        
        // Also update local store for UI purposes if needed
        await createAgent(payload);
        
        // 2. Create agent workspace
        try {
          const workspaceDocs = generateEnhancedWorkspaceDocuments(payload.config, {
            name: payload.name,
            description: payload.description,
            model: payload.model,
            provider: payload.provider
          });
          
          const workspaceResponse = await api.post(`/api/v1/agents/${createdAgent.id}/workspace/initialize`, {
            documents: workspaceDocs,
          }) as any;
          
          if (!workspaceResponse.ok) {
            console.warn('[CreateAgentForm] Workspace initialization via API failed:', workspaceResponse.error);
          }

          await agentWorkspaceService.create({
            ...payload,
            avatar: avatarConfig,
          }, 'allternit-standard', undefined, workspaceLayers);
          workspaceCreated = true;
        } catch (workspaceError) {
          console.error('[CreateAgentForm] Workspace creation failed:', workspaceError);
          setWorkspaceWarning("Agent created, but workspace initialization failed.");
        }
        
        const seededTelemetry = buildSeedTelemetryEvents(blueprint);
        for (const event of seededTelemetry) {
          recordCharacterTelemetry(createdAgent.id, {
            type: event.type,
            runId: event.runId,
            payload: event.payload,
          });
        }
        
        setSubmitStatus({ type: 'success', message: 'Agent created successfully!' });
        setTimeout(() => setSubmitStatus(null), 3000);

        onComplete?.(createdAgent, workspaceCreated);
      } catch (e) {
        console.error('[CreateAgentForm] Failed to create agent:', e);
        const errorMsg = e instanceof Error ? e.message : 'Unknown error';
        setSubmitStatus({ type: 'error', message: `Failed to create agent: ${errorMsg}` });
        setWorkspaceWarning(`Failed to create agent: ${errorMsg}`);
      } finally {
        setIsForgeQueued(false);
      }
    }, 6000);
  };

  const toggleCapability = (capId: string) => {
    setFormData(prev => ({
      ...prev,
      capabilities: prev.capabilities?.includes(capId)
        ? prev.capabilities.filter(c => c !== capId)
        : [...(prev.capabilities || []), capId]
    }));
  };

  const toggleSpecialty = (skill: string) => {
    setBlueprint((prev) => {
      const selected = prev.specialtySkills.includes(skill);
      const nextSkills = selected
        ? prev.specialtySkills.filter((s) => s !== skill)
        : [...prev.specialtySkills, skill].slice(0, 4);
      return {
        ...prev,
        specialtySkills: nextSkills,
      };
    });
  };

  const applySetupDefaults = (setup: AgentSetup) => {
    setBlueprint((prev) => {
      const fallbackTemperament: Record<AgentSetup, CreationTemperament> = {
        coding: "precision",
        creative: "exploratory",
        research: "systemic",
        operations: "precision",
        generalist: "balanced",
      };
      return {
        setup,
        specialtySkills: CHARACTER_SPECIALTY_OPTIONS[setup].slice(0, 2),
        temperament: fallbackTemperament[setup],
      };
    });
    setCardSeed(setupSeedDefaults(setup));
    setFormData((prev) => ({
      ...prev,
      capabilities: SETUP_CAPABILITY_PRESETS[setup],
    }));
  };

  const handleVoicePreview = async () => {
    if (!formData.voice?.voiceId || !formData.voice?.enabled) return;
    
    // Stop any playing audio
    if (previewAudio) {
      previewAudio.pause();
      previewAudio.remove();
    }
    
    const previewText = `Hello, I'm ${formData.name || 'your AI assistant'}. How can I help you today?`;
    const audioUrl = await voiceService.previewVoice(formData.voice.voiceId, previewText);
    
    if (audioUrl) {
      const audio = new Audio(audioUrl);
      audio.onended = () => setIsPlaying(false);
      audio.onerror = () => setIsPlaying(false);
      setPreviewAudio(audio);
      setIsPlaying(true);
      audio.play();
    }
  };

  const orchestrators = agents.filter(a => a.type === 'orchestrator');
  const setupStatDefinitions = useMemo(
    () => getSetupStatDefinitions(blueprint.setup),
    [blueprint.setup],
  );
  const activeStepIndex = useMemo(
    () => CREATE_FLOW_STEPS.findIndex((step) => step.id === activeStep),
    [activeStep],
  );
  const previewCharacterConfig = useMemo(
    () =>
      getDefaultCharacterLayer(
      "preview",
      formData.name.trim() || "Preview Agent",
      blueprint,
    ),
    [blueprint, formData.name],
  );
  const projectedStats = useMemo<CharacterStats>(
    () => computeCharacterStats(previewCharacterConfig, buildSeedTelemetryEvents(blueprint)),
    [blueprint, previewCharacterConfig],
  );
  
  const setupMeta =
    CHARACTER_SETUPS.find((setup) => setup.id === blueprint.setup) || null;
  const selectedTypeMeta = AGENT_TYPES.find((type) => type.id === formData.type) || null;
  const identityComplete = Boolean(
    formData.name.trim() &&
      formData.description.trim() &&
      (formData.type !== "sub-agent" || formData.parentAgentId),
  );
  const characterComplete = Boolean(
    blueprint.specialtySkills.length > 0 &&
      cardSeed.hardBanCategories.length > 0 &&
      cardSeed.domainFocus.trim() &&
      splitLines(cardSeed.definitionOfDone).length > 0 &&
      splitLines(cardSeed.escalationRules).length > 0 &&
      cardSeed.voiceStyle.trim() &&
      splitLines(cardSeed.voiceRules).length > 0,
  );
  const runtimeComplete = Boolean(
    formData.model &&
      formData.provider &&
      (formData.capabilities?.length || 0) > 0 &&
      (formData.maxIterations || 0) > 0,
  );
  const personalityComplete = true; // Personality sliders are optional but shown
  const avatarComplete = true; // Avatar is optional
  const workspaceComplete = true; // Workspace layers always have valid default
  
  const stepValidation: Record<CreateFlowStepId, boolean> = {
    welcome: true,
    identity: identityComplete,
    personality: personalityComplete,
    character: characterComplete,
    avatar: avatarComplete,
    runtime: runtimeComplete,
    workspace: workspaceComplete,
    review: identityComplete && characterComplete && runtimeComplete,
  };
  const isReadyForCreate = stepValidation.review;
  const currentStepDescription =
    CREATE_FLOW_STEPS.find((step) => step.id === activeStep)?.description || "";
  const goToPreviousStep = () => {
    if (activeStepIndex <= 0) return;
    setActiveStep(CREATE_FLOW_STEPS[activeStepIndex - 1].id);
  };
  const goToNextStep = () => {
    if (!stepValidation[activeStep]) return;
    const nextStep = CREATE_FLOW_STEPS[activeStepIndex + 1];
    if (nextStep) {
      setActiveStep(nextStep.id);
    }
  };
  const canJumpToStep = (targetStepId: CreateFlowStepId) => {
    const targetIndex = CREATE_FLOW_STEPS.findIndex((step) => step.id === targetStepId);
    if (targetIndex <= activeStepIndex) return true;
    return CREATE_FLOW_STEPS.slice(0, targetIndex).every((step) => stepValidation[step.id]);
  };

  // Get icon for agent type
  const getTypeIcon = (typeId: string) => {
    switch (typeId) {
      case 'orchestrator': return <Network style={{ width: 20, height: 20, color: STUDIO_THEME.textPrimary }} />;
      case 'worker': return <GearSix style={{ width: 20, height: 20, color: STUDIO_THEME.textPrimary }} />;
      default: return <Robot style={{ width: 20, height: 20, color: STUDIO_THEME.textPrimary }} />;
    }
  };

  // Common styles
  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    maxHeight: '100vh',
    padding: '24px',
    overflow: 'auto',
    background: 'transparent',
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '24px',
    position: 'relative',
  };

  const titleStyle: React.CSSProperties = {
    fontSize: '28px',
    fontWeight: 500,
    color: STUDIO_THEME.textPrimary,
    margin: 0,
    fontFamily: 'Georgia, serif',
  };

  const subtitleStyle: React.CSSProperties = {
    fontSize: '14px',
    color: STUDIO_THEME.textSecondary,
    margin: '4px 0 0 0',
  };

  const sectionStyle = (isSelected: boolean, isCompleted: boolean): React.CSSProperties => ({
    borderRadius: '8px',
    border: `1px solid ${isSelected ? STUDIO_THEME.accent : isCompleted ? `${STUDIO_THEME.accent}60` : STUDIO_THEME.borderSubtle}`,
    padding: '12px',
    textAlign: 'left' as const,
    transition: 'all 0.2s ease',
    background: isSelected ? `${STUDIO_THEME.accent}15` : isCompleted ? `${STUDIO_THEME.accent}08` : STUDIO_THEME.bgCard,
    cursor: 'pointer',
    opacity: 1,
  });

  const stepLabelStyle = (isSelected: boolean): React.CSSProperties => ({
    fontSize: '14px',
    fontWeight: 500,
    color: isSelected ? STUDIO_THEME.textPrimary : STUDIO_THEME.textSecondary,
  });

  const stepDescriptionStyle: React.CSSProperties = {
    fontSize: '12px',
    color: STUDIO_THEME.textMuted,
    marginTop: '4px',
  };

  const formSectionStyle: React.CSSProperties = {
    borderRadius: '12px',
    border: `1px solid ${STUDIO_THEME.borderSubtle}`,
    background: STUDIO_THEME.bgCard,
    padding: '24px',
    marginBottom: '24px',
  };

  const sectionTitleStyle: React.CSSProperties = {
    fontSize: '18px',
    fontWeight: 600,
    color: STUDIO_THEME.textPrimary,
    margin: '0 0 16px 0',
    fontFamily: 'Georgia, serif',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  };

  const sectionSubtitleStyle: React.CSSProperties = {
    fontSize: '14px',
    color: STUDIO_THEME.textSecondary,
    margin: '0 0 20px 0',
  };

  const inputLabelStyle: React.CSSProperties = {
    fontSize: '14px',
    fontWeight: 500,
    color: STUDIO_THEME.textPrimary,
    marginBottom: '8px',
    display: 'block',
  };

  const cardGridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '12px',
  };

  const typeCardStyle = (isSelected: boolean): React.CSSProperties => ({
    borderRadius: '10px',
    border: `1px solid ${isSelected ? STUDIO_THEME.accent : STUDIO_THEME.borderSubtle}`,
    padding: '16px',
    textAlign: 'left' as const,
    transition: 'all 0.2s ease',
    background: isSelected ? `${STUDIO_THEME.accent}10` : 'transparent',
    cursor: 'pointer',
  });

  const stickyFooterStyle: React.CSSProperties = {
    position: 'sticky',
    bottom: 0,
    zIndex: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    background: `${STUDIO_THEME.bg}f0`,
    backdropFilter: 'blur(10px)',
    borderRadius: '12px',
    border: `1px solid ${STUDIO_THEME.borderSubtle}`,
    marginTop: '24px',
    gap: '12px',
  };

  const primaryButtonStyle: React.CSSProperties = {
    padding: '10px 20px',
    borderRadius: '8px',
    background: `linear-gradient(to right, ${STUDIO_THEME.accent}, #B08D6E)`,
    color: '#1A1612',
    fontSize: '14px',
    fontWeight: 600,
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  };

  const secondaryButtonStyle: React.CSSProperties = {
    padding: '10px 20px',
    borderRadius: '8px',
    background: 'transparent',
    color: STUDIO_THEME.textPrimary,
    fontSize: '14px',
    fontWeight: 500,
    border: `1px solid ${STUDIO_THEME.borderSubtle}`,
    cursor: 'pointer',
  };

  const alertErrorStyle: React.CSSProperties = {
    padding: '12px 16px',
    borderRadius: '8px',
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    color: '#ef4444',
    marginBottom: '16px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  };
  const alertWarningStyle: React.CSSProperties = {
    padding: '12px 16px',
    borderRadius: '8px',
    background: 'rgba(245, 158, 11, 0.12)',
    border: '1px solid rgba(245, 158, 11, 0.35)',
    color: '#fbbf24',
    marginBottom: '16px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  };
  const isBusy = isCreating || isForgeQueued;

  // Manual Calculation for review step entries
  const projectedStatEntries = useMemo(() => {
    return projectedStats.relevantStats
      .map((key) => ({
        key,
        value: projectedStats.stats[key] ?? 0,
        definition: setupStatDefinitions.find((definition) => definition.key === key) || null,
      }))
      .filter((entry) => entry.definition);
  }, [projectedStats, setupStatDefinitions]);

  return (
    <div style={containerStyle}>
      {/* Submit Status Overlay */}
      {submitStatus && (
        <div style={{
          position: 'absolute',
          top: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 5000,
          padding: '16px 24px',
          borderRadius: '12px',
          background: submitStatus.type === 'success' ? 'rgba(34, 197, 94, 0.9)' : 'rgba(239, 68, 68, 0.9)',
          backdropFilter: 'blur(8px)',
          border: `1px solid ${submitStatus.type === 'success' ? '#22c55e' : '#ef4444'}`,
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
          animation: 'slideDown 0.3s ease-out'
        }}>
          {submitStatus.type === 'success' ? <CheckCircle style={{ width: 20, height: 20 }} /> : <Warning style={{ width: 20, height: 20 }} />}
          <span style={{ fontWeight: 500 }}>{submitStatus.message}</span>
        </div>
      )}

      <div style={headerStyle}>
        {/* Centered Title */}
        <div style={{ textAlign: 'center' }}>
          <h1 style={titleStyle}>Create New Agent</h1>
          <p style={subtitleStyle}>Configure your AI agent with voice, type, and capabilities</p>
        </div>
      </div>

      {error && (
        <div style={alertErrorStyle}>
          <Warning style={{ width: 16, height: 16 }} />
          <span>{error}</span>
        </div>
      )}
      {workspaceWarning && (
        <div style={alertWarningStyle}>
          <Warning style={{ width: 16, height: 16 }} />
          <span>{workspaceWarning}</span>
        </div>
      )}

      <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <BrowserCompatibilityWarningComponent 
          compatibility={browserCompatibility} 
          onDismiss={() => {}} 
        />
        <DuplicateNameWarning agentName={formData.name} />
      </div>

      <form onSubmit={handleSubmit} style={{ maxWidth: '900px', margin: '0 auto', flex: 1, minHeight: 0 }}>
        {/* Step Navigation */}
        <div style={formSectionStyle}>
          <div style={cardGridStyle}>
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
                  style={{
                    ...sectionStyle(selected, completed),
                    opacity: unlocked ? 1 : 0.5,
                    cursor: unlocked ? 'pointer' : 'not-allowed',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={stepLabelStyle(selected)}>{step.label}</span>
                    {selected || completed ? (
                      <CheckCircle style={{ width: 16, height: 16, color: STUDIO_THEME.accent }} />
                    ) : (
                      <Circle style={{ width: 16, height: 16, color: STUDIO_THEME.textMuted }} />
                    )}
                  </div>
                  <p style={{ fontSize: '12px', color: STUDIO_THEME.textMuted, marginTop: '4px' }}>{step.description}</p>
                </button>
              );
            })}
          </div>
          <div style={{
            marginTop: '12px',
            padding: '10px 14px',
            borderRadius: '6px',
            border: `1px solid ${STUDIO_THEME.borderSubtle}`,
            fontSize: '12px',
            color: STUDIO_THEME.textSecondary,
          }}>
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
        {/* WELCOME STEP */}
        {activeStep === "welcome" && (
          <section style={{ padding: '40px 0', position: 'relative', overflow: 'hidden' }}>
            {/* Animated Background Particles */}
            <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
              {[...Array(6)].map((_, i) => (
                <motion.div
                  key={`particle-${i}`}
                  style={{
                    position: 'absolute',
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: `${STUDIO_THEME.accent}30`,
                    left: `${20 + i * 15}%`,
                    top: `${60 + (i % 3) * 10}%`,
                  }}
                  initial={{ 
                    x: Math.random() * 800 - 400, 
                    y: Math.random() * 600 - 300,
                    opacity: 0 
                  }}
                  animate={{ 
                    y: [null, -100, -200],
                    opacity: [0, 0.6, 0],
                    scale: [0.5, 1.5, 0.5]
                  }}
                  transition={{ 
                    duration: 4 + Math.random() * 2,
                    repeat: Infinity,
                    delay: i * 0.5,
                    ease: "easeOut"
                  }}
                />
              ))}
            </div>

            <div style={{ textAlign: 'center', position: 'relative', zIndex: 10 }}>
              {/* Animated Icon with Orbiting Elements */}
              <div style={{ position: 'relative', width: 128, height: 128, margin: '0 auto 32px' }}>
                {/* Orbiting dots */}
                <motion.div
                  style={{ position: 'absolute', inset: 0 }}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                >
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: '50%',
                    width: 12,
                    height: 12,
                    background: STUDIO_THEME.accent,
                    borderRadius: '50%',
                    boxShadow: `0 0 10px ${STUDIO_THEME.accent}80`,
                  }} />
                </motion.div>
                <motion.div
                  style={{ position: 'absolute', inset: 8 }}
                  animate={{ rotate: -360 }}
                  transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
                >
                  <div style={{
                    position: 'absolute',
                    bottom: 0,
                    left: '50%',
                    width: 8,
                    height: 8,
                    background: '#B08D6E',
                    borderRadius: '50%',
                    boxShadow: '0 0 10px rgba(176, 141, 110, 0.8)',
                  }} />
                </motion.div>
                
                {/* Main Icon */}
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ 
                    type: "spring",
                    stiffness: 200,
                    damping: 15,
                    duration: 0.8 
                  }}
                  style={{
                    width: 96,
                    height: 96,
                    margin: '0 auto',
                    borderRadius: '50%',
                    background: `linear-gradient(135deg, ${STUDIO_THEME.accent}, #B08D6E)`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: `0 0 40px ${STUDIO_THEME.accent}40`,
                  }}
                >
                  <motion.div
                    animate={{ 
                      scale: [1, 1.1, 1],
                      rotate: [0, 5, -5, 0]
                    }}
                    transition={{ 
                      duration: 3,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                  >
                    <Robot style={{ width: 48, height: 48, color: '#fff' }} />
                  </motion.div>
                </motion.div>
              </div>

              {/* Title with staggered animation */}
              <div style={{ marginBottom: '24px' }}>
                <motion.h2 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.5 }}
                  style={{
                    fontSize: '36px',
                    fontWeight: 500,
                    fontFamily: 'Georgia, serif',
                    color: STUDIO_THEME.textPrimary,
                    margin: '0 0 12px 0',
                  }}
                >
                  <span style={{
                    background: `linear-gradient(to right, ${STUDIO_THEME.accent}, #B08D6E)`,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}>
                    Create Your AI Agent
                  </span>
                </motion.h2>
                <motion.p 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4, duration: 0.5 }}
                  style={{
                    fontSize: '16px',
                    color: STUDIO_THEME.textSecondary,
                    maxWidth: '480px',
                    margin: '0 auto',
                    lineHeight: 1.6,
                  }}
                >
                  Build intelligent agents that automate tasks, make decisions, and collaborate with your team.
                </motion.p>
              </div>
            </div>

            {/* Feature Cards with Stagger Animation */}
            <motion.div 
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '16px',
                maxWidth: '800px',
                margin: '0 auto 32px',
                position: 'relative',
                zIndex: 10,
              }}
              initial="hidden"
              animate="visible"
              variants={{
                hidden: {},
                visible: {
                  transition: {
                    staggerChildren: 0.15,
                    delayChildren: 0.6
                  }
                }
              }}
            >
              {[
                { 
                  icon: Sparkle, 
                  title: "Define Personality", 
                  desc: "Configure creativity, verbosity, and temperament to match your workflow." 
                },
                { 
                  icon: GearSix, 
                  title: "Equip Tools", 
                  desc: "Grant capabilities like code generation, web search, and file operations." 
                },
                { 
                  icon: Network, 
                  title: "Deploy & Monitor", 
                  desc: "Launch your agent and track progress through checkpoints and telemetry." 
                }
              ].map((feature) => (
                <motion.div
                  key={feature.title}
                  variants={{
                    hidden: { opacity: 0, y: 30, scale: 0.9 },
                    visible: { 
                      opacity: 1, 
                      y: 0, 
                      scale: 1,
                      transition: { type: "spring", stiffness: 200, damping: 20 }
                    }
                  }}
                  whileHover={{ 
                    scale: 1.03, 
                    y: -5,
                    transition: { duration: 0.2 }
                  }}
                  style={{
                    padding: '24px',
                    borderRadius: '12px',
                    border: `1px solid ${STUDIO_THEME.borderSubtle}`,
                    background: STUDIO_THEME.bgCard,
                    cursor: 'pointer',
                  }}
                >
                  <motion.div 
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: '50%',
                      background: `${STUDIO_THEME.accent}15`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: '12px',
                    }}
                    whileHover={{ rotate: 360 }}
                    transition={{ duration: 0.5 }}
                  >
                    <feature.icon style={{ width: 24, height: 24, color: STUDIO_THEME.accent }} />
                  </motion.div>
                  <h3 style={{
                    fontSize: '16px',
                    fontWeight: 600,
                    color: STUDIO_THEME.textPrimary,
                    margin: '0 0 8px 0',
                  }}>{feature.title}</h3>
                  <p style={{
                    fontSize: '13px',
                    color: STUDIO_THEME.textSecondary,
                    lineHeight: 1.5,
                    margin: 0,
                  }}>
                    {feature.desc}
                  </p>
                </motion.div>
              ))}
            </motion.div>

            {/* CTA Button with enhanced animation */}
            <motion.div 
              style={{ display: 'flex', justifyContent: 'center', position: 'relative', zIndex: 10 }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.2, duration: 0.5 }}
            >
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={goToNextStep}
                style={{
                  ...primaryButtonStyle,
                  padding: '14px 32px',
                  fontSize: '16px',
                }}
              >
                <motion.span
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 1.4 }}
                >
                  Get Started
                </motion.span>
                <motion.span
                  animate={{ x: [0, 6, 0] }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                >
                  →
                </motion.span>
              </motion.button>
            </motion.div>

            {/* Progress indicator */}
            <motion.div 
              style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: '24px', position: 'relative', zIndex: 10 }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.5 }}
            >
              {[...Array(7)].map((_, i) => (
                <motion.div
                  key={`dot-${i}`}
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: i === 0 ? STUDIO_THEME.accent : `${STUDIO_THEME.accent}40`,
                  }}
                  animate={{ 
                    scale: i === 0 ? [1, 1.3, 1] : 1,
                  }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.1 }}
                />
              ))}
            </motion.div>
          </section>
        )}

        {/* IDENTITY STEP */}
        {activeStep === "identity" && (
          <section style={formSectionStyle}>
            <div style={{ marginBottom: '24px' }}>
              <h2 style={sectionTitleStyle}>
                <Sparkle style={{ width: 20, height: 20, color: STUDIO_THEME.accent }} />
                Agent Identity
              </h2>
              <p style={sectionSubtitleStyle}>
                Define the ownership boundary and runtime role for this agent.
              </p>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={inputLabelStyle}>Agent Name</label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Code Review Sentinel"
                required
                style={{
                  background: STUDIO_THEME.bg,
                  border: `1px solid ${STUDIO_THEME.borderSubtle}`,
                  color: STUDIO_THEME.textPrimary,
                }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={inputLabelStyle}>Description</label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="What this agent owns and what it should deliver."
                required
                style={{
                  background: STUDIO_THEME.bg,
                  border: `1px solid ${STUDIO_THEME.borderSubtle}`,
                  color: STUDIO_THEME.textPrimary,
                  minHeight: '80px',
                }}
              />
            </div>

            <div style={{ height: 1, background: STUDIO_THEME.borderSubtle, margin: '24px 0' }} />

            <div style={{ marginBottom: '20px' }}>
              <h3 style={{
                fontSize: '16px',
                fontWeight: 600,
                color: STUDIO_THEME.textPrimary,
                margin: '0 0 16px 0',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                <Network style={{ width: 18, height: 18, color: STUDIO_THEME.accent }} />
                Agent Type
              </h3>
              <div style={cardGridStyle}>
                {AGENT_TYPES.map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    style={typeCardStyle(formData.type === type.id)}
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        type: type.id,
                        parentAgentId: type.id === "sub-agent" ? prev.parentAgentId : undefined,
                      }))
                    }
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      {getTypeIcon(type.id)}
                      <span style={{ fontWeight: 500, color: STUDIO_THEME.textPrimary }}>{type.name}</span>
                      {formData.type === type.id && (
                        <CheckCircle style={{ width: 16, height: 16, color: STUDIO_THEME.accent, marginLeft: 'auto' }} />
                      )}
                    </div>
                    <p style={{ fontSize: '12px', color: STUDIO_THEME.textSecondary, margin: 0 }}>{type.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {formData.type === "sub-agent" && (
              <div style={{ marginTop: '20px' }}>
                <label style={inputLabelStyle}>Parent Orchestrator</label>
                <Select
                  value={formData.parentAgentId || ""}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, parentAgentId: value || undefined }))
                  }
                >
                  <SelectTrigger style={{
                    background: STUDIO_THEME.bg,
                    border: `1px solid ${STUDIO_THEME.borderSubtle}`,
                    color: STUDIO_THEME.textPrimary,
                  }}>
                    <SelectValue
                      placeholder={
                        orchestrators.length === 0
                          ? "No orchestrators available"
                          : "Select parent orchestrator"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent style={{ background: STUDIO_THEME.bgCard, border: `1px solid ${STUDIO_THEME.borderSubtle}` }}>
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
                  <p style={{ fontSize: '12px', color: '#f59e0b', marginTop: '8px' }}>
                    You need an orchestrator before creating a sub-agent.
                  </p>
                )}
              </div>
            )}
          </section>
        )}

        {/* PERSONALITY STEP */}
        {activeStep === "personality" && (
          <section style={formSectionStyle}>
            <div style={{ marginBottom: '24px' }}>
              <h2 style={sectionTitleStyle}>
                <Sparkle style={{ width: 20, height: 20, color: STUDIO_THEME.accent }} />
                Personality Profile
              </h2>
              <p style={sectionSubtitleStyle}>
                Define your agent&apos;s personality and operational style using the Big Five model.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '32px' }}>
              {/* Big Five Sliders */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: STUDIO_THEME.textPrimary, margin: 0 }}>Big Five Traits</h3>
                
                {[
                  { id: 'openness', label: 'Openness', low: 'Conventional', high: 'Inventive' },
                  { id: 'conscientiousness', label: 'Conscientiousness', low: 'Spontaneous', high: 'Organized' },
                  { id: 'extraversion', label: 'Extraversion', low: 'Reserved', high: 'Outgoing' },
                  { id: 'agreeableness', label: 'Agreeableness', low: 'Critical', high: 'Cooperative' }
                ].map((trait) => (
                  <div key={trait.id} style={{ background: STUDIO_THEME.bg, padding: '16px', borderRadius: '12px', border: `1px solid ${STUDIO_THEME.borderSubtle}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <Label style={{ color: STUDIO_THEME.textPrimary }}>{trait.label}</Label>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: STUDIO_THEME.accent, background: `${STUDIO_THEME.accent}20`, padding: '2px 8px', borderRadius: '6px' }}>
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
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '10px' }}>
                      <span style={{ fontSize: '11px', color: STUDIO_THEME.textMuted }}>{trait.low}</span>
                      <span style={{ fontSize: '11px', color: STUDIO_THEME.textMuted }}>{trait.high}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Working Styles */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: STUDIO_THEME.textPrimary, margin: 0 }}>Operational Style</h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <Label style={{ color: STUDIO_THEME.textPrimary }}>Communication Style</Label>
                  <Select
                    value={personality.communicationStyle}
                    onValueChange={(value: any) => setPersonality(prev => ({ ...prev, communicationStyle: value }))}
                  >
                    <SelectTrigger style={{ background: STUDIO_THEME.bg, border: `1px solid ${STUDIO_THEME.borderSubtle}`, color: STUDIO_THEME.textPrimary, height: '44px' }}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent style={{ background: STUDIO_THEME.bgCard, border: `1px solid ${STUDIO_THEME.borderSubtle}` }}>
                      <SelectItem value="direct">Direct & Concise</SelectItem>
                      <SelectItem value="analytical">Analytical & Detailed</SelectItem>
                      <SelectItem value="collaborative">Cooperative & Supportive</SelectItem>
                      <SelectItem value="creative">Expressive & Imaginative</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <Label style={{ color: STUDIO_THEME.textPrimary }}>Work Style</Label>
                  <Select
                    value={personality.workStyle}
                    onValueChange={(value: any) => setPersonality(prev => ({ ...prev, workStyle: value }))}
                  >
                    <SelectTrigger style={{ background: STUDIO_THEME.bg, border: `1px solid ${STUDIO_THEME.borderSubtle}`, color: STUDIO_THEME.textPrimary, height: '44px' }}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent style={{ background: STUDIO_THEME.bgCard, border: `1px solid ${STUDIO_THEME.borderSubtle}` }}>
                      <SelectItem value="independent">Independent Autonomous</SelectItem>
                      <SelectItem value="collaborative">Team-Oriented</SelectItem>
                      <SelectItem value="guided">Requires Supervision</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <Label style={{ color: STUDIO_THEME.textPrimary }}>Decision Making</Label>
                  <Select
                    value={personality.decisionMaking}
                    onValueChange={(value: any) => setPersonality(prev => ({ ...prev, decisionMaking: value }))}
                  >
                    <SelectTrigger style={{ background: STUDIO_THEME.bg, border: `1px solid ${STUDIO_THEME.borderSubtle}`, color: STUDIO_THEME.textPrimary, height: '44px' }}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent style={{ background: STUDIO_THEME.bgCard, border: `1px solid ${STUDIO_THEME.borderSubtle}` }}>
                      <SelectItem value="data-driven">Data-Driven & Logical</SelectItem>
                      <SelectItem value="intuitive">Intuitive & Fast</SelectItem>
                      <SelectItem value="consensus">Consensus-Based</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <Label style={{ color: STUDIO_THEME.textPrimary }}>Personality Traits</Label>
                  <TagInput
                    tags={(formData.config as any)?.personalityTraits || []}
                    onChange={(tags: string[]) => setFormData(prev => ({ ...prev, config: { ...(prev.config || {}), personalityTraits: tags } }))}
                    placeholder="Add traits (e.g. Stoic, Sarcastic, Highly Technical)..."
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <Label style={{ color: STUDIO_THEME.textPrimary }}>Backstory & Context</Label>
                  <Textarea
                    value={(formData.config as any)?.backstory || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, config: { ...(prev.config || {}), backstory: e.target.value } }))}
                    placeholder="Provide background context that shapes this agent's behavior..."
                    rows={4}
                    style={{ background: STUDIO_THEME.bg, border: `1px solid ${STUDIO_THEME.borderSubtle}`, color: STUDIO_THEME.textPrimary }}
                  />
                </div>
              </div>
            </div>
          </section>
        )}

        {/* CHARACTER STEP */}
        {activeStep === "character" && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={formSectionStyle}>
              <div style={{ marginBottom: '24px' }}>
                <h2 style={sectionTitleStyle}>
                  <Sparkle style={{ width: 20, height: 20, color: STUDIO_THEME.accent }} />
                  Character Profile
                </h2>
                <p style={sectionSubtitleStyle}>
                  Choose setup and specialties. Stats and level are projected from measurable telemetry signals.
                </p>
              </div>

              <div style={cardGridStyle}>
                {CHARACTER_SETUPS.map((setup) => (
                  <button
                    key={setup.id}
                    type="button"
                    style={typeCardStyle(blueprint.setup === setup.id)}
                    onClick={() => applySetupDefaults(setup.id)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 500, color: STUDIO_THEME.textPrimary }}>{setup.label}</span>
                      {blueprint.setup === setup.id && <CheckCircle style={{ width: 16, height: 16, color: STUDIO_THEME.accent }} />}
                    </div>
                    <p style={{ fontSize: '12px', color: STUDIO_THEME.textSecondary, margin: '0 0 8px 0' }}>{setup.description}</p>
                    <span style={{
                      fontSize: '10px',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      background: `${STUDIO_THEME.accent}15`,
                      color: STUDIO_THEME.accent,
                    }}>
                      class: {setup.className}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div style={formSectionStyle}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: STUDIO_THEME.textPrimary, margin: '0 0 16px 0' }}>Operational Boundaries (Hard Bans)</h3>
              <p style={{ fontSize: '13px', color: STUDIO_THEME.textSecondary, margin: '0 0 16px 0' }}>Define critical restrictions for this agent.</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '12px' }}>
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
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '12px',
                        padding: '16px',
                        borderRadius: '12px',
                        textAlign: 'left',
                        transition: 'all 0.2s ease',
                        background: isSelected ? 'rgba(239, 68, 68, 0.1)' : STUDIO_THEME.bg,
                        border: `1px solid ${isSelected ? '#ef4444' : STUDIO_THEME.borderSubtle}`,
                      }}
                    >
                      <div style={{ padding: '8px', borderRadius: '8px', background: isSelected ? '#ef444420' : 'rgba(255,255,255,0.05)' }}>
                        <Icon size={18} style={{ color: isSelected ? '#ef4444' : STUDIO_THEME.textSecondary }} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 500, color: isSelected ? '#ef4444' : STUDIO_THEME.textPrimary, fontSize: '14px' }}>{(ban as any).label}</div>
                        <div style={{ fontSize: '11px', color: STUDIO_THEME.textMuted, marginTop: '2px' }}>{(ban as any).description}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
              <div style={formSectionStyle}>
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: STUDIO_THEME.textPrimary, margin: '0 0 16px 0' }}>Specialties & Domain</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div>
                    <Label style={{ color: STUDIO_THEME.textPrimary, marginBottom: '8px', display: 'block' }}>Domain Focus</Label>
                    <Input
                      value={cardSeed.domainFocus}
                      onChange={(e) => setCardSeed(prev => ({ ...prev, domainFocus: e.target.value }))}
                      placeholder="e.g. Frontend Architecture, Security Audit"
                      style={{ background: STUDIO_THEME.bg, borderColor: STUDIO_THEME.borderSubtle, color: STUDIO_THEME.textPrimary }}
                    />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <Label style={{ color: STUDIO_THEME.textPrimary }}>Specialty Skills</Label>
                      <span style={{ fontSize: '11px', color: STUDIO_THEME.textMuted }}>{blueprint.specialtySkills.length}/4</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {getSpecialtyOptions(blueprint.setup).map((skill) => {
                        const selected = blueprint.specialtySkills.includes(skill);
                        return (
                          <button
                            key={skill}
                            type="button"
                            onClick={() => toggleSpecialty(skill)}
                            style={{
                              padding: '4px 10px',
                              borderRadius: '6px',
                              fontSize: '12px',
                              background: selected ? `${STUDIO_THEME.accent}20` : STUDIO_THEME.bg,
                              color: selected ? STUDIO_THEME.accent : STUDIO_THEME.textSecondary,
                              border: `1px solid ${selected ? STUDIO_THEME.accent : STUDIO_THEME.borderSubtle}`,
                            }}
                          >
                            {skill}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div>
                    <Label style={{ color: STUDIO_THEME.textPrimary, marginBottom: '8px', display: 'block' }}>Escalation Triggers</Label>
                    <TagInput
                      tags={splitLines(cardSeed.escalationRules)}
                      onChange={(tags: string[]) => setCardSeed(prev => ({ ...prev, escalationRules: tags.join('\n') }))}
                      placeholder="Add triggers..."
                    />
                  </div>
                </div>
              </div>

              <div style={formSectionStyle}>
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: STUDIO_THEME.textPrimary, margin: '0 0 16px 0' }}>Projected Level</h3>
                <p style={{ fontSize: '13px', color: STUDIO_THEME.textSecondary, margin: '0 0 12px 0' }}>Based on setup baseline + specialties.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '13px', color: STUDIO_THEME.textSecondary }}>Class</span>
                    <span style={{
                      fontSize: '11px',
                      padding: '2px 8px',
                      borderRadius: '10px',
                      border: `1px solid ${STUDIO_THEME.borderSubtle}`,
                      color: STUDIO_THEME.textPrimary,
                    }}>
                      {projectedStats.class}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '13px', color: STUDIO_THEME.textSecondary }}>Level</span>
                    <span style={{ fontSize: '18px', fontWeight: 600, color: STUDIO_THEME.textPrimary }}>Lv {projectedStats.level}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '13px', color: STUDIO_THEME.textSecondary }}>XP</span>
                    <span style={{ fontSize: '13px', fontWeight: 500, color: STUDIO_THEME.textPrimary }}>{projectedStats.xp.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {blueprint.specialtySkills.slice(0, 3).map((skill) => (
                      <div key={skill} style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        border: `1px solid ${STUDIO_THEME.borderSubtle}`,
                        fontSize: '12px',
                      }}>
                        <span style={{ color: STUDIO_THEME.textSecondary }}>{skill}</span>
                        <span style={{ color: STUDIO_THEME.textPrimary, fontWeight: 500 }}>{projectedStats.specialtyScores[skill] ?? 0}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div style={formSectionStyle}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: STUDIO_THEME.textPrimary, margin: '0 0 16px 0' }}>Measured Setup Stats</h3>
              <div style={cardGridStyle}>
                {setupStatDefinitions.map((definition) => {
                  const value = projectedStats.stats[definition.key] ?? 0;
                  return (
                    <div key={definition.key} style={{
                      padding: '16px',
                      borderRadius: '8px',
                      border: `1px solid ${STUDIO_THEME.borderSubtle}`,
                      background: STUDIO_THEME.bg,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                        <span style={{ fontWeight: 500, fontSize: '14px', color: STUDIO_THEME.textPrimary }}>{definition.label}</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{
                            fontSize: '10px',
                            padding: '2px 6px',
                            borderRadius: '4px',
                            border: `1px solid ${STUDIO_THEME.borderSubtle}`,
                            color: STUDIO_THEME.textSecondary,
                          }}>
                            {definition.key}
                          </span>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: STUDIO_THEME.accent }}>{value}</span>
                        </div>
                      </div>
                      <div style={{
                        height: 6,
                        borderRadius: '3px',
                        background: STUDIO_THEME.bgCard,
                        overflow: 'hidden',
                      }}>
                        <div
                          style={{
                            height: '100%',
                            borderRadius: '3px',
                            background: `linear-gradient(to right, ${STUDIO_THEME.accent}, #B08D6E)`,
                            width: `${Math.max(4, value)}%`,
                            transition: 'width 0.3s ease',
                          }}
                        />
                      </div>
                      <p style={{ fontSize: '11px', color: STUDIO_THEME.textSecondary, margin: '8px 0 0 0' }}>{definition.description}</p>
                      <p style={{ fontSize: '10px', color: STUDIO_THEME.textMuted, margin: '4px 0 0 0' }}>
                        Signals: {definition.signals.join(", ")}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
              <div style={formSectionStyle}>
                <label style={inputLabelStyle}>Temperament</label>
                <Select
                  value={blueprint.temperament}
                  onValueChange={(value) =>
                    setBlueprint((prev) => ({ ...prev, temperament: value as CreationTemperament }))
                  }
                >
                  <SelectTrigger style={{
                    background: STUDIO_THEME.bg,
                    border: `1px solid ${STUDIO_THEME.borderSubtle}`,
                    color: STUDIO_THEME.textPrimary,
                  }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent style={{ background: STUDIO_THEME.bgCard, border: `1px solid ${STUDIO_THEME.borderSubtle}` }}>
                    <SelectItem value="precision">precision</SelectItem>
                    <SelectItem value="exploratory">exploratory</SelectItem>
                    <SelectItem value="systemic">systemic</SelectItem>
                    <SelectItem value="balanced">balanced</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div style={formSectionStyle}>
                <label style={inputLabelStyle}>Setup Capabilities</label>
                <div style={{
                  padding: '12px',
                  borderRadius: '8px',
                  border: `1px solid ${STUDIO_THEME.borderSubtle}`,
                  fontSize: '13px',
                  color: STUDIO_THEME.textSecondary,
                  background: STUDIO_THEME.bg,
                }}>
                  {SETUP_CAPABILITY_PRESETS[blueprint.setup].join(", ")}
                </div>
              </div>
            </div>

            <div style={{ height: 1, background: STUDIO_THEME.borderSubtle }} />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
              <div>
                <label style={inputLabelStyle}>Role Domain Focus</label>
                <Input
                  value={cardSeed.domainFocus}
                  onChange={(e) => setCardSeed((prev) => ({ ...prev, domainFocus: e.target.value }))}
                  placeholder="Domain ownership boundary"
                  style={{
                    background: STUDIO_THEME.bg,
                    border: `1px solid ${STUDIO_THEME.borderSubtle}`,
                    color: STUDIO_THEME.textPrimary,
                  }}
                />
              </div>
              <div>
                <label style={inputLabelStyle}>Voice Style</label>
                <Input
                  value={cardSeed.voiceStyle}
                  onChange={(e) => setCardSeed((prev) => ({ ...prev, voiceStyle: e.target.value }))}
                  placeholder="Technical, direct, skeptical..."
                  style={{
                    background: STUDIO_THEME.bg,
                    border: `1px solid ${STUDIO_THEME.borderSubtle}`,
                    color: STUDIO_THEME.textPrimary,
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
              <div>
                <label style={inputLabelStyle}>Definition of Done (one per line)</label>
                <Textarea
                  value={cardSeed.definitionOfDone}
                  onChange={(e) => setCardSeed((prev) => ({ ...prev, definitionOfDone: e.target.value }))}
                  rows={4}
                  style={{
                    background: STUDIO_THEME.bg,
                    border: `1px solid ${STUDIO_THEME.borderSubtle}`,
                    color: STUDIO_THEME.textPrimary,
                  }}
                />
              </div>
              <div>
                <label style={inputLabelStyle}>Escalation Triggers (one per line)</label>
                <Textarea
                  value={cardSeed.escalationRules}
                  onChange={(e) => setCardSeed((prev) => ({ ...prev, escalationRules: e.target.value }))}
                  rows={4}
                  style={{
                    background: STUDIO_THEME.bg,
                    border: `1px solid ${STUDIO_THEME.borderSubtle}`,
                    color: STUDIO_THEME.textPrimary,
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
              <div>
                <label style={inputLabelStyle}>Voice Rules (one per line)</label>
                <Textarea
                  value={cardSeed.voiceRules}
                  onChange={(e) => setCardSeed((prev) => ({ ...prev, voiceRules: e.target.value }))}
                  rows={4}
                  style={{
                    background: STUDIO_THEME.bg,
                    border: `1px solid ${STUDIO_THEME.borderSubtle}`,
                    color: STUDIO_THEME.textPrimary,
                  }}
                />
              </div>
              <div>
                <label style={inputLabelStyle}>Voice Micro-Bans (one per line)</label>
                <Textarea
                  value={cardSeed.voiceMicroBans}
                  onChange={(e) => setCardSeed((prev) => ({ ...prev, voiceMicroBans: e.target.value }))}
                  rows={4}
                  style={{
                    background: STUDIO_THEME.bg,
                    border: `1px solid ${STUDIO_THEME.borderSubtle}`,
                    color: STUDIO_THEME.textPrimary,
                  }}
                />
              </div>
            </div>

            <div style={formSectionStyle}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <label style={inputLabelStyle}>Hard Ban Categories</label>
                <span style={{
                  fontSize: '11px',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  background: STUDIO_THEME.bg,
                  color: STUDIO_THEME.textSecondary,
                }}>
                  {cardSeed.hardBanCategories.length} selected
                </span>
              </div>
              <div style={cardGridStyle}>
                {BAN_CATEGORY_OPTIONS.map((option) => {
                  const selected = cardSeed.hardBanCategories.includes(option.category);
                  return (
                    <button
                      key={option.category}
                      type="button"
                      style={{
                        padding: '12px',
                        borderRadius: '8px',
                        border: `1px solid ${selected ? STUDIO_THEME.accent : STUDIO_THEME.borderSubtle}`,
                        background: selected ? `${STUDIO_THEME.accent}10` : 'transparent',
                        textAlign: 'left' as const,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                      }}
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
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 500, fontSize: '13px', color: STUDIO_THEME.textPrimary }}>{option.label}</span>
                        {selected && <CheckCircle style={{ width: 16, height: 16, color: STUDIO_THEME.accent }} />}
                      </div>
                      <p style={{ fontSize: '11px', color: STUDIO_THEME.textSecondary, margin: '4px 0 0 0' }}>{option.description}</p>
                    </button>
                  );
                })}
              </div>
              {cardSeed.hardBanCategories.length === 0 && (
                <p style={{ fontSize: '12px', color: '#f59e0b', marginTop: '12px' }}>
                  Select at least one hard-ban category so tool blocking is enforceable.
                </p>
              )}
            </div>
          </section>
        )}

        {/* AVATAR STEP */}
        {activeStep === "avatar" && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: '24px', flex: 1, minHeight: 0 }}>
            <div style={{ marginBottom: '24px' }}>
              <h2 style={sectionTitleStyle}>
                <Palette style={{ width: 20, height: 20, color: STUDIO_THEME.accent }} />
                Avatar Customization
              </h2>
              <p style={sectionSubtitleStyle}>
                Fine-tune your agent&apos;s visual identity.
              </p>
            </div>

            <div style={{ flex: 1, minHeight: '600px' }}>
              <AvatarCreatorStep
                agentSetup={blueprint.setup}
                agentTemperament={blueprint.temperament}
                onAvatarChange={(config) => {
                  lastUpdateFromStoreRef.current = true;
                  setAvatarConfig((prev) => {
                    const current = (config as any) || {};
                    return { ...current, mascotTemplate: (prev as any).mascotTemplate };
                  });
                }}
              />
            </div>
          </section>
        )}
        {/* RUNTIME STEP */}
        {activeStep === "runtime" && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={formSectionStyle}>
              <div style={{ marginBottom: '24px' }}>
                <h2 style={sectionTitleStyle}>
                  <GearSix style={{ width: 20, height: 20, color: STUDIO_THEME.accent }} />
                  Runtime Configuration
                </h2>
                <p style={sectionSubtitleStyle}>
                  Configure model, tooling, and runtime behaviors.
                </p>
              </div>

              <div style={{ marginBottom: '24px' }}>
                <h3 style={{
                  fontSize: '16px',
                  fontWeight: 600,
                  color: STUDIO_THEME.textPrimary,
                  margin: '0 0 16px 0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}>
                  <Robot style={{ width: 18, height: 18, color: STUDIO_THEME.accent }} />
                  Model Configuration
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '20px' }}>
                  <div>
                    <label style={inputLabelStyle}>Intelligence Model</label>
                    {isModelsLoading ? (
                      <Skeleton height="42px" borderRadius="8px" />
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
                        <SelectTrigger style={{
                          background: STUDIO_THEME.bg,
                          border: `1px solid ${STUDIO_THEME.borderSubtle}`,
                          color: STUDIO_THEME.textPrimary,
                          height: '42px',
                        }}>
                          <SelectValue placeholder="Select model" />
                        </SelectTrigger>
                        <SelectContent style={{
                          background: STUDIO_THEME.bgCard,
                          border: `1px solid ${STUDIO_THEME.borderSubtle}`,
                          zIndex: 1000,
                          maxHeight: '400px',
                          width: '300px'
                        }}>
                          {(apiModels.length > 0 ? apiModels : AGENT_MODELS).map((model) => (
                            <SelectItem key={model.id} value={model.id}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: '4px 0' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <div style={{
                                    width: '8px',
                                    height: '8px',
                                    borderRadius: '50%',
                                    background: model.provider === 'openai' ? '#10a37f' : model.provider === 'anthropic' ? '#d97757' : '#3b82f6'
                                  }} />
                                  <span style={{ fontWeight: 600, fontSize: '13px' }}>{model.name}</span>
                                </div>
                                <span style={{ fontSize: '10px', color: STUDIO_THEME.textMuted, marginLeft: '16px' }}>
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
                    <label style={inputLabelStyle}>Provider</label>
                    <Select
                      value={formData.provider}
                      onValueChange={(value) =>
                        setFormData((prev) => ({
                          ...prev,
                          provider: value as CreateAgentInput["provider"],
                        }))
                      }
                    >
                      <SelectTrigger style={{
                        background: STUDIO_THEME.bg,
                        border: `1px solid ${STUDIO_THEME.borderSubtle}`,
                        color: STUDIO_THEME.textPrimary,
                        height: '42px',
                      }}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent style={{ background: STUDIO_THEME.bgCard, border: `1px solid ${STUDIO_THEME.borderSubtle}`, zIndex: 1000 }}>
                        <SelectItem value="openai">OpenAI</SelectItem>
                        <SelectItem value="anthropic">Anthropic</SelectItem>
                        <SelectItem value="local">Local</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                  <div>
                    <label style={inputLabelStyle}>Max Iterations: {formData.maxIterations}</label>
                    <Slider
                      value={[formData.maxIterations || 10]}
                      onValueChange={([value]) => setFormData((prev) => ({ ...prev, maxIterations: value }))}
                      min={1}
                      max={50}
                      step={1}
                    />
                  </div>

                  <div>
                    <label style={inputLabelStyle}>Temperature: {formData.temperature}</label>
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

              <div style={{ height: 1, background: STUDIO_THEME.borderSubtle, margin: '24px 0' }} />

              <div>
                <h3 style={{
                  fontSize: '16px',
                  fontWeight: 600,
                  color: STUDIO_THEME.textPrimary,
                  margin: '0 0 16px 0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}>
                  <Headphones style={{ width: 18, height: 18, color: STUDIO_THEME.accent }} />
                  Voice Settings
                </h3>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px',
                  borderRadius: '10px',
                  border: `1px solid ${STUDIO_THEME.borderSubtle}`,
                  marginBottom: '16px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {formData.voice?.enabled ? (
                      <SpeakerHigh style={{ width: 20, height: 20, color: '#22c55e' }} />
                    ) : (
                      <SpeakerSlash style={{ width: 20, height: 20, color: STUDIO_THEME.textMuted }} />
                    )}
                    <div>
                      <div style={{ fontWeight: 500, color: STUDIO_THEME.textPrimary }}>Enable Voice</div>
                      <div style={{ fontSize: '13px', color: STUDIO_THEME.textSecondary }}>
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
                  <div style={{
                    borderLeft: `2px solid ${STUDIO_THEME.accent}40`,
                    paddingLeft: '16px',
                  }}>
                    <div style={{ marginBottom: '16px' }}>
                      <label style={inputLabelStyle}>Voice</label>
                      <div style={{ display: 'flex', gap: '8px' }}>
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
                          <SelectTrigger style={{
                            flex: 1,
                            background: STUDIO_THEME.bg,
                            border: `1px solid ${STUDIO_THEME.borderSubtle}`,
                            color: STUDIO_THEME.textPrimary,
                            height: '42px',
                          }}>
                            <SelectValue placeholder="Select voice" />
                          </SelectTrigger>
                          <SelectContent style={{ background: STUDIO_THEME.bgCard, border: `1px solid ${STUDIO_THEME.borderSubtle}`, zIndex: 1000 }}>
                            {voices.map((voice) => (
                              <SelectItem key={voice.id} value={voice.id}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '2px 0' }}>
                                  <div
                                    style={{
                                      width: '10px',
                                      height: '10px',
                                      borderRadius: '50%',
                                      background: voice.engine === "chatterbox"
                                        ? "#3b82f6"
                                        : voice.engine === "xtts_v2"
                                        ? "#a855f7"
                                        : "#22c55e",
                                      boxShadow: `0 0 8px ${voice.engine === "chatterbox" ? "#3b82f6" : voice.engine === "xtts_v2" ? "#a855f7" : "#22c55e"}40`
                                    }}
                                  />
                                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    <span style={{ fontWeight: 500 }}>{voice.label}</span>
                                    <span style={{ fontSize: '10px', color: STUDIO_THEME.textMuted }}>
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
                          style={{
                            padding: '8px 12px',
                            borderRadius: '8px',
                            border: `1px solid ${STUDIO_THEME.borderSubtle}`,
                            background: STUDIO_THEME.bg,
                            color: STUDIO_THEME.textPrimary,
                            cursor: 'pointer',
                          }}
                        >
                          {isPlaying ? (
                            <CircleNotch style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} />
                          ) : (
                            <Play style={{ width: 16, height: 16 }} />
                          )}
                        </button>
                      </div>
                    </div>

                    <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <Label style={{ fontSize: '12px', color: STUDIO_THEME.textSecondary }}>Voice Tone Modifiers</Label>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                        {[
                          { id: 'formality', label: 'Formality' },
                          { id: 'enthusiasm', label: 'Enthusiasm' },
                          { id: 'empathy', label: 'Empathy' },
                          { id: 'directness', label: 'Directness' }
                        ].map((tone) => (
                          <div key={tone.id}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                              <span style={{ fontSize: '11px', color: STUDIO_THEME.textMuted }}>{tone.label}</span>
                              <span style={{ fontSize: '11px', color: STUDIO_THEME.accent }}>{((formData.config as any)?.voice?.tone?.[tone.id] ?? 0.5) * 100}%</span>
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

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: 500, color: STUDIO_THEME.textPrimary }}>Auto-Speak Responses</div>
                          <div style={{ fontSize: '13px', color: STUDIO_THEME.textSecondary }}>Automatically speak all agent responses.</div>
                        </div>
                        <Switch
                          checked={formData.voice?.autoSpeak || false}
                          onCheckedChange={(checked) =>
                            setFormData((prev) => ({
                              ...prev,
                              voice: { enabled: true, ...prev.voice, autoSpeak: checked },
                            }))
                          }
                        />
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: 500, color: STUDIO_THEME.textPrimary }}>Speak on Checkpoint</div>
                          <div style={{ fontSize: '13px', color: STUDIO_THEME.textSecondary }}>Voice summary when reaching checkpoints.</div>
                        </div>
                        <Switch
                          checked={formData.voice?.speakOnCheckpoint || false}
                          onCheckedChange={(checked) =>
                            setFormData((prev) => ({
                              ...prev,
                              voice: { enabled: true, ...prev.voice, speakOnCheckpoint: checked },
                            }))
                          }
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div style={{ height: 1, background: STUDIO_THEME.borderSubtle, margin: '24px 0' }} />

              <div>
                <h3 style={{
                  fontSize: '16px',
                  fontWeight: 600,
                  color: STUDIO_THEME.textPrimary,
                  margin: '0 0 16px 0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}>
                  <Lightning style={{ width: 18, height: 18, color: STUDIO_THEME.accent }} />
                  Capabilities Marketplace
                </h3>
                <PluginConflictWarning selectedTools={formData.tools || []} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  {isCapabilitiesLoading ? (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                      {Array(6).fill(0).map((_, i) => <Skeleton key={i} height="60px" borderRadius="10px" />)}
                    </div>
                  ) : (
                    CAPABILITY_CATEGORIES.map((cat) => {
                      const catCaps = (apiCapabilities.length > 0 ? apiCapabilities : AGENT_CAPABILITIES_ENHANCED)
                        .filter(cap => (cap as any).category === cat.id || (!cap.category && cat.id === 'core'));
                      
                      if (catCaps.length === 0) return null;
                      
                      const Icon = cat.icon;
                      
                      return (
                        <div key={cat.id} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Icon size={14} style={{ color: STUDIO_THEME.accent }} />
                            <span style={{ fontSize: '12px', fontWeight: 600, color: STUDIO_THEME.textSecondary, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{cat.label}</span>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px' }}>
                            {catCaps.map((cap) => {
                              const isSelected = formData.capabilities?.includes(cap.id);
                              return (
                                <button
                                  key={cap.id}
                                  type="button"
                                  onClick={() => toggleCapability(cap.id)}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    padding: '12px 16px',
                                    borderRadius: '10px',
                                    textAlign: 'left',
                                    transition: 'all 0.2s ease',
                                    background: isSelected ? `${STUDIO_THEME.accent}15` : STUDIO_THEME.bg,
                                    border: `1px solid ${isSelected ? STUDIO_THEME.accent : STUDIO_THEME.borderSubtle}`,
                                  }}
                                >
                                  <div style={{
                                    width: '8px',
                                    height: '8px',
                                    borderRadius: '50%',
                                    background: isSelected ? STUDIO_THEME.accent : STUDIO_THEME.textMuted
                                  }} />
                                  <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 500, color: isSelected ? STUDIO_THEME.textPrimary : STUDIO_THEME.textSecondary, fontSize: '13px' }}>{cap.name}</div>
                                    {cap.description && <div style={{ fontSize: '10px', color: STUDIO_THEME.textMuted, marginTop: '1px' }}>{cap.description}</div>}
                                  </div>
                                  {isSelected && <Check size={14} style={{ color: STUDIO_THEME.accent }} />}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div style={{ marginTop: '8px' }}>
                    <label style={{ fontSize: '12px', color: STUDIO_THEME.textSecondary, marginBottom: '8px', display: 'block' }}>Custom Capabilities</label>
                    <TagInput
                      tags={formData.capabilities?.filter(c => !(apiCapabilities.length > 0 ? apiCapabilities : AGENT_CAPABILITIES_ENHANCED).some(ac => ac.id === c)) || []}
                      onChange={(tags: string[]) => {
                        const coreIds = (apiCapabilities.length > 0 ? apiCapabilities : AGENT_CAPABILITIES_ENHANCED)
                          .filter(ac => formData.capabilities?.includes(ac.id))
                          .map(ac => ac.id);
                        setFormData(prev => ({ ...prev, capabilities: [...coreIds, ...tags] }));
                      }}
                      placeholder="Type a custom capability and press Enter..."
                    />
                  </div>
                </div>
              </div>

              <div style={{ height: 1, background: STUDIO_THEME.borderSubtle, margin: '24px 0' }} />

              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <h3 style={{
                    fontSize: '16px',
                    fontWeight: 600,
                    color: STUDIO_THEME.textPrimary,
                    margin: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}>
                    <Robot style={{ width: 18, height: 18, color: STUDIO_THEME.accent }} />
                    System Prompt
                  </h3>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="file"
                      id="prompt-file"
                      accept=".txt,.md,.prompt"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            const content = event.target?.result as string;
                            setFormData((prev) => ({ ...prev, systemPrompt: content }));
                          };
                          reader.readAsText(file);
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => document.getElementById('prompt-file')?.click()}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        border: `1px solid ${STUDIO_THEME.borderSubtle}`,
                        background: 'transparent',
                        color: STUDIO_THEME.textPrimary,
                        fontSize: '13px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        cursor: 'pointer',
                      }}
                    >
                      <Paperclip style={{ width: 14, height: 14 }} />
                      Load from File
                    </button>
                    <Select
                      value=""
                      onValueChange={(value) => {
                        if (value) {
                          const templates: Record<string, string> = {
                            'coding': `You are a senior software engineer with expertise in multiple programming languages.

## Core Responsibilities:
- Write clean, maintainable, and well-documented code
- Review code for bugs, security issues, and performance optimizations
- Explain complex technical concepts clearly

## Communication Style:
- Be concise but thorough
- Provide code examples when helpful
- Ask clarifying questions when requirements are unclear`,
                            'creative': `You are a creative strategist and content creator.

## Core Responsibilities:
- Generate innovative ideas and concepts
- Craft compelling narratives and messaging
- Provide feedback on creative work

## Communication Style:
- Be imaginative and inspiring
- Use vivid language and metaphors
- Balance creativity with practical constraints`,
                            'research': `You are a research analyst with expertise in data synthesis and evidence-based reasoning.

## Core Responsibilities:
- Analyze information from multiple sources
- Identify patterns and insights
- Provide well-researched recommendations

## Communication Style:
- Be objective and evidence-based
- Cite sources when possible
- Acknowledge uncertainty and limitations`,
                            'support': `You are a helpful customer support agent.

## Core Responsibilities:
- Answer questions accurately and efficiently
- Troubleshoot issues step by step
- Escalate complex problems appropriately

## Communication Style:
- Be friendly and professional
- Use clear, jargon-free language
- Show empathy and patience`,
                          };
                          setFormData((prev) => ({ 
                            ...prev, 
                            systemPrompt: templates[value] || prev.systemPrompt 
                          }));
                        }
                      }}
                    >
                      <SelectTrigger style={{
                        width: '140px',
                        background: STUDIO_THEME.bg,
                        border: `1px solid ${STUDIO_THEME.borderSubtle}`,
                        color: STUDIO_THEME.textPrimary,
                      }}>
                        <SelectValue placeholder="Load Template" />
                      </SelectTrigger>
                      <SelectContent style={{ background: STUDIO_THEME.bgCard, border: `1px solid ${STUDIO_THEME.borderSubtle}` }}>
                        <SelectItem value="coding">Coding Assistant</SelectItem>
                        <SelectItem value="creative">Creative Writer</SelectItem>
                        <SelectItem value="research">Research Analyst</SelectItem>
                        <SelectItem value="support">Support Agent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div style={{ marginTop: '16px' }}>
                  <AllternitSystemPromptEditor
                    value={formData.systemPrompt || ''}
                    onChange={(value) => setFormData((prev) => ({ ...prev, systemPrompt: value }))}
                    modeColors={{
                      bg: STUDIO_THEME.bg,
                      card: STUDIO_THEME.bgCard,
                      border: STUDIO_THEME.borderSubtle,
                      text: STUDIO_THEME.textPrimary,
                      textMuted: STUDIO_THEME.textMuted,
                      accent: STUDIO_THEME.accent,
                      accentSoft: `${STUDIO_THEME.accent}20`,
                    }}
                  />
                </div>
                <p style={{ fontSize: '12px', color: STUDIO_THEME.textMuted, marginTop: '8px' }}>
                  Define behavior constraints and runtime expectations. Load from file or choose a template to get started.
                </p>
              </div>
            </div>
          </section>
        )}

        {/* WORKSPACE STEP */}
        {activeStep === "workspace" && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={formSectionStyle}>
              <div style={{ marginBottom: '24px' }}>
                <h2 style={sectionTitleStyle}>
                  <Stack style={{ width: 20, height: 20, color: STUDIO_THEME.accent }} />
                  Workspace Configuration
                </h2>
                <p style={sectionSubtitleStyle}>
                  Choose which layers to include in your agent&apos;s workspace. Each layer adds markdown files that define how your agent operates.
                </p>
              </div>

              <WorkspaceLayerConfigurator
                config={workspaceLayers}
                onChange={setWorkspaceLayers}
                theme={{
                  textPrimary: STUDIO_THEME.textPrimary,
                  textSecondary: STUDIO_THEME.textSecondary,
                  textMuted: STUDIO_THEME.textMuted,
                  accent: STUDIO_THEME.accent,
                  bgCard: STUDIO_THEME.bgCard,
                  bg: STUDIO_THEME.bg,
                  borderSubtle: STUDIO_THEME.borderSubtle,
                }}
              />

              <div style={{ marginTop: '24px' }}>
                <h3 style={{
                  fontSize: '16px',
                  fontWeight: 600,
                  color: STUDIO_THEME.textPrimary,
                  margin: '0 0 16px 0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}>
                  <FileText style={{ width: 18, height: 18, color: STUDIO_THEME.accent }} />
                  Configuration Preview
                </h3>
                <div style={{
                  background: STUDIO_THEME.bg,
                  border: `1px solid ${STUDIO_THEME.borderSubtle}`,
                  borderRadius: '12px',
                  padding: '20px',
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  color: STUDIO_THEME.textSecondary,
                  maxHeight: '300px',
                  overflow: 'auto',
                  position: 'relative'
                }}>
                  <div style={{ position: 'absolute', top: '12px', right: '12px', background: `${STUDIO_THEME.accent}20`, color: STUDIO_THEME.accent, padding: '2px 8px', borderRadius: '4px', fontSize: '10px' }}>
                    identity.yaml
                  </div>
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>
                    {`# Agent Identity Layer
name: ${formData.name || 'Agent'}
type: ${formData.type}
model: ${formData.model}
provider: ${formData.provider}

# Character Profile
personality:
  openness: ${personality.openness}
  conscientiousness: ${personality.conscientiousness}
  extraversion: ${personality.extraversion}
  agreeableness: ${personality.agreeableness}
  
style:
  communication: ${personality.communicationStyle}
  work: ${personality.workStyle}
  decision_making: ${personality.decisionMaking}

# Layers Enabled
${Object.entries(workspaceLayers).filter(([_, enabled]) => enabled).map(([key]) => `- ${key}`).join('\n')}
`}
                  </pre>
                </div>
                <p style={{ fontSize: '12px', color: STUDIO_THEME.textMuted, marginTop: '8px' }}>
                  These configuration files will be automatically generated and committed to your agent's capsule repository upon creation.
                </p>
              </div>
            </div>
          </section>
        )}

        {/* REVIEW STEP */}
        {activeStep === "review" && (
          <section style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={formSectionStyle}>
              <div style={{ marginBottom: '24px' }}>
                <h2 style={sectionTitleStyle}>
                  <ShieldCheck style={{ width: 20, height: 20, color: STUDIO_THEME.accent }} />
                  Review and Forge
                </h2>
                <p style={sectionSubtitleStyle}>
                  Final validation before creation. This summary is what gets compiled into the Character Layer.
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
                <div style={{
                  padding: '20px',
                  borderRadius: '12px',
                  border: `1px solid ${STUDIO_THEME.borderSubtle}`,
                  background: STUDIO_THEME.bg,
                }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, color: STUDIO_THEME.textPrimary, margin: '0 0 8px 0' }}>
                    {formData.name || "Unnamed Agent"}
                  </h3>
                  <p style={{ fontSize: '13px', color: STUDIO_THEME.textSecondary, margin: '0 0 16px 0' }}>
                    {formData.description || "No description yet."}
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
                    <span style={{
                      fontSize: '11px',
                      padding: '4px 10px',
                      borderRadius: '10px',
                      border: `1px solid ${STUDIO_THEME.borderSubtle}`,
                      color: STUDIO_THEME.textSecondary,
                    }}>
                      {selectedTypeMeta?.name || formData.type}
                    </span>
                    {setupMeta && (
                      <span style={{
                        fontSize: '11px',
                        padding: '4px 10px',
                        borderRadius: '10px',
                        background: `${STUDIO_THEME.accent}15`,
                        color: STUDIO_THEME.accent,
                      }}>
                        {setupMeta.label}
                      </span>
                    )}
                    <span style={{
                      fontSize: '11px',
                      padding: '4px 10px',
                      borderRadius: '10px',
                      border: `1px solid ${STUDIO_THEME.borderSubtle}`,
                      color: STUDIO_THEME.textSecondary,
                    }}>
                      {projectedStats.class}
                    </span>
                    <span style={{
                      fontSize: '11px',
                      padding: '4px 10px',
                      borderRadius: '10px',
                      border: `1px solid ${STUDIO_THEME.borderSubtle}`,
                      color: STUDIO_THEME.textSecondary,
                    }}>
                      Lv {projectedStats.level}
                    </span>
                  </div>
                  
                  <div style={{ marginBottom: '16px' }}>
                    <label style={{
                      fontSize: '11px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: STUDIO_THEME.textMuted,
                      marginBottom: '8px',
                      display: 'block',
                    }}>Operational Style</label>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                        <span style={{ color: STUDIO_THEME.textSecondary }}>Communication</span>
                        <span style={{ color: STUDIO_THEME.textPrimary, textTransform: 'capitalize' }}>{personality.communicationStyle}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                        <span style={{ color: STUDIO_THEME.textSecondary }}>Work Style</span>
                        <span style={{ color: STUDIO_THEME.textPrimary, textTransform: 'capitalize' }}>{personality.workStyle}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                        <span style={{ color: STUDIO_THEME.textSecondary }}>Decision</span>
                        <span style={{ color: STUDIO_THEME.textPrimary, textTransform: 'capitalize' }}>{personality.decisionMaking.replace('-', ' ')}</span>
                      </div>
                    </div>
                  </div>

                  {(() => {
                    const bigFive = Object.entries(personality).filter(([k]) => ['openness', 'conscientiousness', 'extraversion', 'agreeableness'].includes(k));
                    const customTraits = (formData.config as any)?.personalityTraits || [];
                    return (
                      <div style={{ marginBottom: '16px' }}>
                        <label style={{
                          fontSize: '11px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          color: STUDIO_THEME.textMuted,
                          marginBottom: '8px',
                          display: 'block',
                        }}>Personality & Style</label>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: customTraits.length > 0 ? '12px' : 0 }}>
                          {bigFive.map(([key, val]) => (
                            <div key={key} style={{ display: 'flex', flexDirection: 'column' }}>
                              <span style={{ fontSize: '9px', color: STUDIO_THEME.textMuted, textTransform: 'uppercase' }}>{key}</span>
                              <span style={{ fontSize: '11px', fontWeight: 600, color: STUDIO_THEME.accent }}>{val}%</span>
                            </div>
                          ))}
                        </div>
                        {customTraits.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                            {customTraits.map((t: string) => (
                              <span key={t} style={{ fontSize: '10px', background: `${STUDIO_THEME.accent}10`, color: STUDIO_THEME.accent, padding: '2px 6px', borderRadius: '4px' }}>{t}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {(formData.config as any)?.backstory && (
                    <div style={{ marginBottom: '16px' }}>
                      <label style={{
                        fontSize: '11px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        color: STUDIO_THEME.textMuted,
                        marginBottom: '4px',
                        display: 'block',
                      }}>Backstory</label>
                      <p style={{ fontSize: '12px', color: STUDIO_THEME.textSecondary, margin: 0, lineClamp: 3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
                        {(formData.config as any).backstory}
                      </p>
                    </div>
                  )}

                  <div style={{ marginBottom: '16px' }}>
                    <label style={{
                      fontSize: '11px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: STUDIO_THEME.textMuted,
                      marginBottom: '8px',
                      display: 'block',
                    }}>Specialties</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {blueprint.specialtySkills.map((skill) => (
                        <span key={skill} style={{
                          fontSize: '11px',
                          padding: '4px 10px',
                          borderRadius: '10px',
                          border: `1px solid ${STUDIO_THEME.borderSubtle}`,
                          color: STUDIO_THEME.textSecondary,
                        }}>
                          {skill} {projectedStats.specialtyScores[skill] ?? 0}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label style={{
                      fontSize: '11px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: STUDIO_THEME.textMuted,
                      marginBottom: '8px',
                      display: 'block',
                    }}>Hard Bans</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {((formData.config as any)?.hardBans || []).map((b: any) => (
                        <span key={b.category} style={{
                          fontSize: '11px',
                          padding: '4px 10px',
                          borderRadius: '10px',
                          background: 'rgba(239, 68, 68, 0.15)',
                          color: '#ef4444',
                        }}>
                          {b.category}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px'
                }}>
                  <div style={{
                    padding: '20px',
                    borderRadius: '12px',
                    border: `1px solid ${STUDIO_THEME.borderSubtle}`,
                    background: STUDIO_THEME.bg,
                  }}>
                    <h3 style={{ fontSize: '16px', fontWeight: 600, color: STUDIO_THEME.textPrimary, margin: '0 0 8px 0' }}>Professional Effectiveness Metrics</h3>
                    <p style={{ fontSize: '13px', color: STUDIO_THEME.textSecondary, margin: '0 0 16px 0' }}>Derived from setup telemetry model.</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {projectedStatEntries.map((entry) => (
                        <div key={entry.key}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <span style={{ fontSize: '12px', color: STUDIO_THEME.textSecondary }}>
                              {entry.definition?.label || entry.key}
                            </span>
                            <span style={{ fontSize: '13px', fontWeight: 500, color: STUDIO_THEME.textPrimary }}>{entry.value}</span>
                          </div>
                          <div style={{
                            height: 6,
                            borderRadius: '3px',
                            background: STUDIO_THEME.bgCard,
                            overflow: 'hidden',
                          }}>
                            <div
                              style={{
                                height: '100%',
                                borderRadius: '3px',
                                background: `linear-gradient(to right, ${STUDIO_THEME.accent}, #B08D6E)`,
                                width: `${Math.max(4, entry.value)}%`,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {((avatarConfig as any).mascotTemplate || (avatarConfig as any).type === 'mascot') && (
                    <div style={{
                      padding: '20px',
                      borderRadius: '12px',
                      border: `1px solid ${STUDIO_THEME.borderSubtle}`,
                      background: STUDIO_THEME.bg,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flex: 1,
                      minHeight: '200px'
                    }}>
                      <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <h3 style={{ fontSize: '14px', fontWeight: 600, color: STUDIO_THEME.textPrimary, margin: 0 }}>Visual Identity</h3>
                        <span style={{ fontSize: '10px', background: `${STUDIO_THEME.accent}20`, color: STUDIO_THEME.accent, padding: '2px 6px', borderRadius: '4px' }}>
                          {(avatarConfig as any).mascotTemplate || 'Custom'}
                        </span>
                      </div>
                      <div className="transform scale-110 my-2">
                        <MascotPreview 
                          config={{ 
                            type: 'mascot', 
                            style: { 
                              primaryColor: avatarConfig.colors?.primary || '#3B82F6',
                              accentColor: avatarConfig.colors?.glow || '#93C5FD' 
                            }, 
                            mascot: { 
                              template: (avatarConfig as any).mascotTemplate || 'gizzi' 
                            } 
                          } as any} 
                          name={formData.name || 'Agent'} 
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}
          </motion.div>
        </AnimatePresence>

        {/* Sticky Footer */}
        <div style={stickyFooterStyle}>
          {/* Cancel Button - Left */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button 
              type="button"
              onClick={onCancel}
              disabled={isBusy}
              style={{
                ...secondaryButtonStyle,
                opacity: isBusy ? 0.5 : 1,
                cursor: isBusy ? 'not-allowed' : 'pointer',
              }}
            >
              Cancel
            </button>
            {hasLocalStorage && <DraftSavedIndicator saveStatus={saveStatus} />}
          </div>

          {/* Status Message - Center */}
          <div style={{ fontSize: '12px', color: STUDIO_THEME.textSecondary, flex: 1, textAlign: 'center' }}>
            {!stepValidation[activeStep]
              ? "Complete required fields in this step to continue."
              : isForgeQueued
              ? "Preparing forge sequence..."
              : activeStep === "review"
              ? "All checks passed. Forge will animate and compile the character layer."
              : "Step complete. Continue to the next stage."}
          </div>

          {/* Back/Next Buttons - Right */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              type="button"
              onClick={goToPreviousStep}
              disabled={activeStepIndex <= 0 || isBusy}
              style={{
                ...secondaryButtonStyle,
                opacity: activeStepIndex <= 0 || isBusy ? 0.5 : 1,
                cursor: activeStepIndex <= 0 || isBusy ? 'not-allowed' : 'pointer',
              }}
            >
              Back
            </button>
            {activeStep !== "review" ? (
              <button
                type="button"
                onClick={goToNextStep}
                disabled={!stepValidation[activeStep] || isBusy}
                style={{
                  ...primaryButtonStyle,
                  opacity: !stepValidation[activeStep] || isBusy ? 0.5 : 1,
                  cursor: !stepValidation[activeStep] || isBusy ? 'not-allowed' : 'pointer',
                }}
              >
                Next: {CREATE_FLOW_STEPS[activeStepIndex + 1]?.label || "Review"}
              </button>
            ) : (
              <button
                type="submit"
                disabled={isBusy || !isReadyForCreate}
                style={{
                  ...primaryButtonStyle,
                  padding: '12px 24px',
                  opacity: isBusy || !isReadyForCreate ? 0.5 : 1,
                  cursor: isBusy || !isReadyForCreate ? 'not-allowed' : 'pointer',
                }}
              >
                {isBusy ? (
                  <>
                    <CircleNotch style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} />
                    {isForgeQueued ? "Preparing..." : "Creating..."}
                  </>
                ) : (
                  <>
                    <Robot style={{ width: 16, height: 16 }} />
                    Create Agent
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}

export function CreationProgressAnimation({ 
  onComplete, 
  agentName 
}: { 
  onComplete: () => void; 
  agentName: string 
}) {
  const [stage, setStage] = useState(0);
  const stages = [
    "Initializing neural pathways...",
    "Calibrating character layer...",
    "Allocating workspace resources...",
    "Establishing event stream bridge...",
    "Compiling identity protocol...",
    "Forge sequence complete."
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setStage(prev => (prev < stages.length - 1 ? prev + 1 : prev));
    }, 1000);
    
    const completeTimer = setTimeout(() => {
      onComplete();
    }, 6500);

    return () => {
      clearInterval(timer);
      clearTimeout(completeTimer);
    };
  }, [onComplete, stages.length]);

  return (
    <div className="flex flex-col items-center justify-center gap-8 text-white p-12">
      <div className="relative w-48 h-48">
        <motion.div
          className="absolute inset-0 border-4 border-t-transparent border-primary rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        />
        <motion.div
          className="absolute inset-4 border-4 border-b-transparent border-amber-500 rounded-full"
          animate={{ rotate: -360 }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <Robot size={64} className="text-primary animate-pulse" />
        </div>
      </div>
      <div className="text-center">
        <h2 className="text-2xl font-serif mb-2">Forging {agentName}</h2>
        <p className="text-muted-foreground font-mono h-6">{stages[stage]}</p>
      </div>
    </div>
  );
}

// Internal Helper functions moved from AgentView.service if needed
// (These were likely local in AgentView.tsx)

function PluginConflictWarning({ selectedTools }: { selectedTools: string[] }) {
  const conflicts = detectPluginConflicts(selectedTools);
  if (!conflicts.hasConflict) return null;

  return (
    <div style={{
      padding: '12px 16px',
      borderRadius: '8px',
      background: conflicts.severity === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(245, 158, 11, 0.1)',
      border: `1px solid ${conflicts.severity === 'error' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(245, 158, 11, 0.2)'}`,
      color: conflicts.severity === 'error' ? '#ef4444' : '#f59e0b',
      fontSize: '13px',
      marginBottom: '16px',
      display: 'flex',
      gap: '10px'
    }}>
      <Warning size={18} style={{ flexShrink: 0 }} />
      <div>
        <div style={{ fontWeight: 600 }}>Tool Conflict Detected</div>
        <p style={{ margin: '4px 0 0 0', opacity: 0.9 }}>{conflicts.message}</p>
      </div>
    </div>
  );
}

function DuplicateNameWarning({ agentName }: { agentName: string }) {
  const { agents } = useAgentStore();
  const exists = useMemo(() => 
    agents.some(a => a.name.toLowerCase() === agentName.trim().toLowerCase()),
    [agents, agentName]
  );

  if (!exists || !agentName.trim()) return null;

  return (
    <div style={{
      padding: '8px 12px',
      borderRadius: '6px',
      background: 'rgba(245, 158, 11, 0.1)',
      border: '1px solid rgba(245, 158, 11, 0.2)',
      color: '#f59e0b',
      fontSize: '12px',
      display: 'flex',
      alignItems: 'center',
      gap: '8px'
    }}>
      <Warning size={14} />
      An agent with this name already exists. Using it might cause confusion.
    </div>
  );
}
