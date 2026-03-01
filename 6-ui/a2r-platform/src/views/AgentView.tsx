"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAgentStore, useUnreadMailCount, usePendingReviewCount } from "@/lib/agents/agent.store";
import { AGENT_CAPABILITIES, AGENT_MODELS, AGENT_TYPES } from "@/lib/agents/agent.types";
import type {
  Agent,
  CreateAgentInput,
  TaskStatus,
  AgentType,
  VoiceConfig,
  VoicePreset,
  AgentRun,
  AgentTask,
  Checkpoint as AgentCheckpoint,
  Commit as AgentCommit,
  AgentMailMessage,
} from "@/lib/agents/agent.types";
import { useUnifiedStore } from "@/lib/agents/unified.store";
import { railsApi } from "@/lib/agents/rails.service";
import * as voiceService from "@/lib/agents/voice.service";
import { api } from "@/integration/api-client";
import { useMonitorData, useMonitorShare, buildMonitorLink } from "./mail-monitor/monitor.helpers";
import { MailMonitorPanel } from "./mail-monitor/MailMonitorPanel";
import { CharacterLayerPanel } from "./agent-character/CharacterLayerPanel";
import { CapsuleFrame } from "@/components/CapsuleFrame";
import { formatRelativeTime } from "@/lib/time";

// UI Components
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { A2RLogo, A2ROrb, BrandBadge } from "@/components/A2RLogo";

// AI Elements
import { Task } from "@/components/ai-elements/task";
import { Checkpoint } from "@/components/ai-elements/checkpoint";
import { Commit } from "@/components/ai-elements/commit";
import { Queue } from "@/components/ai-elements/queue";
import {
  Attachments,
  Attachment,
  AttachmentPreview,
  AttachmentRemove,
} from "@/components/ai-elements/attachments";
import { VoicePresence } from "@/components/ai-elements/voice-presence";
import {
  CHARACTER_SETUPS,
  computeCharacterStats,
  getDefaultCharacterLayer,
  CHARACTER_SPECIALTY_OPTIONS,
  getSetupStatDefinitions,
  getSpecialtyOptions,
  parseCharacterBlueprint,
} from "@/lib/agents/character.service";
import type {
  AgentSetup,
  CharacterStats,
  CharacterTelemetryEvent,
  HardBanCategory,
  RoleHardBan,
} from "@/lib/agents/character.types";

// Icons
import {
  Bot,
  Play,
  Pause,
  Square,
  RotateCcw,
  Plus,
  Trash2,
  Settings,
  Activity,
  CheckCircle,
  Circle,
  Clock,
  AlertCircle,
  GitCommit,
  Save,
  Loader2,
  Paperclip,
  Mic,
  Network,
  Cog,
  Volume2,
  VolumeX,
  Sparkles,
  Headphones,
  Mail,
  Send,
  Inbox,
  MessageSquare,
  Bell,
  CheckCheck,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ThumbsUp,
  ThumbsDown,
  Gavel,
  AppWindow
} from "lucide-react";

// ============================================================================
// Agent View - Production Implementation
// ============================================================================

interface AgentViewProps {
  context?: any;
}

export function AgentView({ context }: AgentViewProps) {
  // Debug: Check if component renders at all
  console.log('[AgentView] Component executing', context);
  
  const {
    agents,
    selectedAgentId,
    viewMode,
    isLoadingAgents,
    isCreating,
    isEditing,
    error,
    eventStreamConnected,
    fetchAgents,
    selectAgent,
    setIsCreating,
    setIsEditing,
    clearError,
    connectEventStream,
  } = useAgentStore();

  // Fetch agents on mount
  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  // Connect to event stream when agent is selected
  useEffect(() => {
    if (!selectedAgentId) return;
    const cleanup = connectEventStream(selectedAgentId);
    return cleanup;
  }, [selectedAgentId, connectEventStream]);

  // Global forge animation state - persists across view mode changes
  const [globalForgeVisible, setGlobalForgeVisible] = useState(false);
  const [globalForgeAgentName, setGlobalForgeAgentName] = useState('');

  // Render based on view mode
  if (viewMode === 'create') {
    return (
      <>
        <CreateAgentForm 
          onCancel={() => setIsCreating(false)}
          onShowForge={(name) => {
            console.log('[AgentView] Showing global forge animation for:', name);
            setGlobalForgeAgentName(name);
            setGlobalForgeVisible(true);
          }}
        />
        {globalForgeVisible && (
          <div 
            className="fixed inset-0 z-[100] flex items-center justify-center"
            style={{ backgroundColor: 'rgba(15, 23, 42, 0.98)' }}
          >
            <CreationProgressAnimation 
              onComplete={() => {
                setGlobalForgeVisible(false);
              }}
              agentName={globalForgeAgentName}
            />
          </div>
        )}
      </>
    );
  }

  if (viewMode === 'edit' && selectedAgentId) {
    const agent = agents.find(a => a.id === selectedAgentId);
    if (!agent) {
      return (
        <div className="flex h-full items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Loading agent...</p>
          </div>
        </div>
      );
    }
    return <EditAgentForm agent={agent} onCancel={() => setIsEditing(null)} />;
  }

  if (viewMode === 'detail' && selectedAgentId) {
    return <AgentDetailView agentId={selectedAgentId} />;
  }

  // Default: Agent List View
  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header - Fixed with a2r branding (dark theme) */}
      <div className="relative flex items-center justify-between p-6 border-b border-[rgba(255,255,255,0.08)] bg-gradient-to-r from-[#2A211A] to-[#1A1612] shrink-0">
        {/* Decorative orb */}
        <div className="absolute -right-8 -top-8 opacity-20 pointer-events-none">
          <A2ROrb className="w-32 h-32" />
        </div>
        
        <div className="relative z-10">
          <A2RLogo size="lg" variant="horizontal" showText={true} />
          <p className="text-[#9B9B9B] text-sm mt-1.5 font-medium">
            Create, manage, and orchestrate autonomous AI agents
          </p>
        </div>
        
        <Button 
          onClick={() => setIsCreating(true)} 
          size="sm"
          className="relative z-10 bg-gradient-to-r from-[#D4B08C] to-[#B08D6E] hover:from-[#C49A6C] hover:to-[#9A7B5A] text-[#1A1612] font-semibold border-0 shadow-md"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Agent
        </Button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-auto p-4">
        {error && error !== 'API_OFFLINE' && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {error === 'API_OFFLINE' && (
          <Alert className="mb-4 bg-amber-50 border-amber-200">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800">
              API service is offline. Start it with: <code className="bg-amber-100 px-1 rounded">cd 6-apps/api && cargo run</code>
            </AlertDescription>
          </Alert>
        )}

        {isLoadingAgents ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : agents.length === 0 ? (
          <EmptyAgentState onCreate={() => setIsCreating(true)} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {agents.map(agent => (
              <AgentCard 
                key={agent.id} 
                agent={agent} 
                onClick={() => selectAgent(agent.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Agent Card Component
// ============================================================================

function AgentCard({ agent, onClick }: { agent: Agent; onClick: () => void }) {
  const statusColor = getStatusColor(agent.status);
  const blueprint = parseCharacterBlueprint(agent.config);
  const setupId = blueprint?.setup || "generalist";
  const setupMeta =
    CHARACTER_SETUPS.find((setup) => setup.id === setupId) || null;
  const agentCharacterStats = useAgentStore((state) => state.characterStats[agent.id]);
  const loadCharacterLayer = useAgentStore((state) => state.loadCharacterLayer);

  useEffect(() => {
    if (!agentCharacterStats) {
      void loadCharacterLayer(agent.id);
    }
  }, [agent.id, agentCharacterStats, loadCharacterLayer]);
  
  // Get type icon
  const getTypeIcon = () => {
    switch (agent.type) {
      case 'orchestrator': return <Network className="w-3.5 h-3.5" />;
      case 'worker': return <Cog className="w-3.5 h-3.5" />;
      default: return <Bot className="w-3.5 h-3.5" />;
    }
  };
  
  // Get type label
  const getTypeLabel = () => {
    switch (agent.type) {
      case 'orchestrator': return 'Orchestrator';
      case 'sub-agent': return 'Sub-Agent';
      case 'worker': return 'Worker';
      default: return 'Agent';
    }
  };

  const previewStatDefinitions = getSetupStatDefinitions(setupId)
    .filter((definition) => agentCharacterStats?.relevantStats.includes(definition.key))
    .slice(0, 2);
  
  return (
    <Card
      className="cursor-pointer hover:border-[#D4B08C]/40 transition-all duration-300 bg-gradient-to-br from-[#2A211A] via-[#2A211A] to-[rgba(212,176,140,0.08)] hover:shadow-lg hover:shadow-[rgba(212,176,140,0.1)] group"
      onClick={onClick}
    >
      <CardHeader className="p-4 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {/* Branded avatar with orb effect */}
            <div className="relative w-10 h-10 rounded-full bg-gradient-to-br from-[#D4B08C]/10 to-[#B08D6E]/10 flex items-center justify-center shrink-0 group-hover:from-[#D4B08C]/15 group-hover:to-[#B08D6E]/15 transition-all">
              <Bot className="w-5 h-5 text-[#D4B08C]" />
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-gradient-to-br from-[#D97757] to-[#B08D6E] border-2 border-[#2A211A]" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-base font-semibold text-[#ECECEC] truncate group-hover:text-[#D4B08C] transition-colors">{agent.name}</CardTitle>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                <BrandBadge 
                  variant="default" 
                  size="sm"
                  icon={getTypeIcon()}
                >
                  {getTypeLabel()}
                </BrandBadge>
                {setupMeta && (
                  <BrandBadge variant="secondary" size="sm">
                    {setupMeta.label}
                  </BrandBadge>
                )}
                {agentCharacterStats && (
                  <>
                    <BrandBadge variant="primary" size="sm">
                      Lv{agentCharacterStats.level}
                    </BrandBadge>
                    <BrandBadge variant="default" size="sm" className="hidden sm:inline-flex">
                      {agentCharacterStats.class}
                    </BrandBadge>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {agent.voice?.enabled && (
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-[#B08D6E]/15">
                <Volume2 className="w-3 h-3 text-[#D4B08C]" />
              </div>
            )}
            <div className={`w-2.5 h-2.5 rounded-full ${statusColor} ring-2 ring-[#2A211A] shadow-sm`} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <p className="text-sm text-[#9B9B9B] line-clamp-2 leading-relaxed">
          {agent.description}
        </p>
        {blueprint && (
          <div className="mt-3 rounded-lg border border-[rgba(255,255,255,0.08)] bg-gradient-to-br from-[#362B22]/50 to-[#2A211A]/30 p-2.5">
            <div className="flex flex-wrap gap-1.5">
              {blueprint.specialtySkills.slice(0, 2).map((skill) => (
                <BrandBadge key={skill} variant="default" size="sm">
                  {skill}
                  {typeof agentCharacterStats?.specialtyScores?.[skill] === "number" && (
                    <span className="ml-0.5 text-[#9B9B9B]/70">
                      {agentCharacterStats.specialtyScores[skill]}
                    </span>
                  )}
                </BrandBadge>
              ))}
              {blueprint.specialtySkills.length > 2 && (
                <BrandBadge variant="default" size="sm">
                  +{blueprint.specialtySkills.length - 2}
                </BrandBadge>
              )}
            </div>
          </div>
        )}
        {agentCharacterStats && previewStatDefinitions.length > 0 && (
          <div className="mt-3 space-y-2">
            {previewStatDefinitions.map((definition) => (
              <div key={definition.key} className="rounded-lg border border-[rgba(255,255,255,0.06)] bg-[#1A1612]/50 px-2.5 py-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#9B9B9B] font-medium">{definition.label}</span>
                  <span className="font-semibold text-[#ECECEC]">
                    {agentCharacterStats.stats[definition.key] ?? 0}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-1.5 mt-4">
          {agent.capabilities.slice(0, 3).map(cap => (
            <Badge 
              key={cap} 
              variant="secondary" 
              className="text-xs bg-[#362B22]/50 text-[#9B9B9B] hover:bg-[#362B22]/70 border border-[rgba(255,255,255,0.06)]"
            >
              {cap}
            </Badge>
          ))}
          {agent.capabilities.length > 3 && (
            <Badge 
              variant="outline" 
              className="text-xs bg-transparent text-[#9B9B9B] border-[rgba(255,255,255,0.12)]"
            >
              +{agent.capabilities.length - 3}
            </Badge>
          )}
        </div>
      </CardContent>
      <CardFooter className="pt-0 text-xs text-[#6E6E6E] font-medium">
        <div className="flex items-center gap-1.5">
          <Clock className="w-3 h-3" />
          Last run: {agent.lastRunAt ? formatRelativeTime(agent.lastRunAt) : 'Never'}
        </div>
      </CardFooter>
    </Card>
  );
}

// ============================================================================
// Empty State with a2r branding (dark theme)
// ============================================================================

function EmptyAgentState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-[400px] border-2 border-dashed rounded-2xl border-[rgba(255,255,255,0.08)] bg-gradient-to-br from-[#2A211A]/50 to-[#1A1612]/30">
      {/* Animated orb illustration */}
      <div className="relative mb-6">
        <A2ROrb className="w-24 h-24" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Bot className="w-10 h-10 text-[#D4B08C]" />
        </div>
      </div>
      
      <h3 className="text-xl font-bold text-[#ECECEC] mb-2">No Agents Yet</h3>
      <p className="text-[#9B9B9B] text-center max-w-md mb-6 leading-relaxed">
        Create your first AI agent to start automating tasks with custom configurations, 
        character layers, and autonomous capabilities.
      </p>
      <Button 
        onClick={onCreate}
        className="bg-gradient-to-r from-[#D4B08C] to-[#B08D6E] hover:from-[#C49A6C] hover:to-[#9A7B5A] text-[#1A1612] font-semibold border-0 shadow-lg hover:shadow-xl transition-all"
      >
        <Plus className="w-4 h-4 mr-2" />
        Create Your First Agent
      </Button>
    </div>
  );
}

// ============================================================================
// Create Agent Form
// ============================================================================

type CreationTemperament = "precision" | "exploratory" | "systemic" | "balanced";

interface CreationBlueprintState {
  setup: AgentSetup;
  specialtySkills: string[];
  temperament: CreationTemperament;
}

interface CreationCardSeedState {
  domainFocus: string;
  definitionOfDone: string;
  escalationRules: string;
  voiceStyle: string;
  voiceRules: string;
  voiceMicroBans: string;
  hardBanCategories: HardBanCategory[];
}

const FORGING_STEPS = [
  "Compiling role card",
  "Binding hard bans",
  "Calibrating voice",
  "Indexing specialties",
  "Sealing character layer",
] as const;

const FORGING_STAGE_DETAILS = [
  "Building deterministic ownership contracts and completion criteria.",
  "Wiring ban categories to enforceable runtime gates.",
  "Applying voice directives and micro-ban language constraints.",
  "Projecting setup + specialty skill scores from telemetry signals.",
  "Writing final character config for Runner and Shell UI surfaces.",
] as const;

const SETUP_CAPABILITY_PRESETS: Record<AgentSetup, string[]> = {
  coding: ["code-generation", "file-operations", "terminal", "planning", "reasoning"],
  creative: ["planning", "reasoning", "memory", "web-search", "api-integration"],
  research: ["web-search", "memory", "reasoning", "planning", "api-integration"],
  operations: ["terminal", "file-operations", "planning", "reasoning", "database"],
  generalist: ["planning", "reasoning", "memory", "web-search"],
};

const CREATE_FLOW_STEPS = [
  {
    id: "welcome",
    label: "Welcome",
    description: "Get started with agent creation.",
  },
  {
    id: "identity",
    label: "Identity",
    description: "Name, type, and ownership.",
  },
  {
    id: "personality",
    label: "Personality",
    description: "Creativity and verbosity settings.",
  },
  {
    id: "character",
    label: "Character",
    description: "Setup, specialties, and policy card.",
  },
  {
    id: "runtime",
    label: "Runtime",
    description: "Model, voice, capabilities, prompt.",
  },
  {
    id: "review",
    label: "Review",
    description: "Validate measurable profile before forge.",
  },
] as const;

type CreateFlowStepId = (typeof CREATE_FLOW_STEPS)[number]["id"];

interface SetupTelemetryPreset {
  missions: number;
  success: number;
  stepStarted: number;
  stepCompleted: number;
  memoryWritten: number;
  banTriggered: number;
  escalations: number;
  challengeInteractions: number;
  handoffInteractions: number;
}

type SetupTelemetryDelta = Partial<SetupTelemetryPreset>;

const SETUP_TELEMETRY_BASELINE: Record<AgentSetup, SetupTelemetryPreset> = {
  coding: {
    missions: 10,
    success: 7,
    stepStarted: 64,
    stepCompleted: 52,
    memoryWritten: 16,
    banTriggered: 1,
    escalations: 2,
    challengeInteractions: 6,
    handoffInteractions: 8,
  },
  creative: {
    missions: 10,
    success: 6,
    stepStarted: 52,
    stepCompleted: 41,
    memoryWritten: 23,
    banTriggered: 1,
    escalations: 3,
    challengeInteractions: 8,
    handoffInteractions: 7,
  },
  research: {
    missions: 10,
    success: 7,
    stepStarted: 58,
    stepCompleted: 46,
    memoryWritten: 26,
    banTriggered: 1,
    escalations: 2,
    challengeInteractions: 9,
    handoffInteractions: 8,
  },
  operations: {
    missions: 10,
    success: 8,
    stepStarted: 60,
    stepCompleted: 51,
    memoryWritten: 14,
    banTriggered: 0,
    escalations: 2,
    challengeInteractions: 5,
    handoffInteractions: 9,
  },
  generalist: {
    missions: 10,
    success: 7,
    stepStarted: 56,
    stepCompleted: 45,
    memoryWritten: 18,
    banTriggered: 1,
    escalations: 2,
    challengeInteractions: 7,
    handoffInteractions: 8,
  },
};

const SPECIALTY_TELEMETRY_RULES: Array<{
  pattern: RegExp;
  delta: SetupTelemetryDelta;
}> = [
  {
    pattern: /test|debug|quality|reliability|refactor|regression/i,
    delta: { success: 1, stepCompleted: 4, challengeInteractions: 1 },
  },
  {
    pattern: /security|hardening|policy|safe|compliance/i,
    delta: { escalations: 1, banTriggered: -1, success: 1 },
  },
  {
    pattern: /performance|latency|speed|throughput|optimization/i,
    delta: { stepStarted: 4, stepCompleted: 3, handoffInteractions: 1 },
  },
  {
    pattern: /api|architecture|design|typescript/i,
    delta: { stepStarted: 3, stepCompleted: 2, success: 1 },
  },
  {
    pattern: /story|brand|campaign|copy|visual|creative|community/i,
    delta: { memoryWritten: 3, challengeInteractions: 2, handoffInteractions: 2 },
  },
  {
    pattern: /research|analysis|source|synthesis|risk|memo|data/i,
    delta: { memoryWritten: 3, challengeInteractions: 1, escalations: -1, success: 1 },
  },
  {
    pattern: /incident|runbook|operations|deployment|cost/i,
    delta: { success: 1, handoffInteractions: 2, banTriggered: -1, escalations: 1 },
  },
];

const TEMPERAMENT_TELEMETRY_DELTA: Record<CreationTemperament, SetupTelemetryDelta> = {
  precision: { success: 1, escalations: 1, banTriggered: -1, stepCompleted: 2 },
  exploratory: { memoryWritten: 2, challengeInteractions: 2, success: -1, stepStarted: 2 },
  systemic: { handoffInteractions: 2, escalations: -1, stepCompleted: 2 },
  balanced: { success: 0, handoffInteractions: 1, challengeInteractions: 1 },
};

function applyTelemetryDelta(target: SetupTelemetryPreset, delta: SetupTelemetryDelta): SetupTelemetryPreset {
  const next = { ...target };
  const keys = Object.keys(delta) as Array<keyof SetupTelemetryPreset>;
  for (const key of keys) {
    const value = delta[key];
    if (typeof value !== "number") continue;
    next[key] = (next[key] || 0) + value;
  }
  return next;
}

function setupSeedDefaults(setup: AgentSetup): Omit<CreationCardSeedState, "hardBanCategories"> & { hardBanCategories: HardBanCategory[] } {
  switch (setup) {
    case "coding":
      return {
        domainFocus: "software implementation and regression-safe delivery",
        definitionOfDone: "Change compiles and passes checks.\nRollback path is documented.",
        escalationRules: "Production-impacting changes\nSecurity-sensitive operations",
        voiceStyle: "Technical, explicit, terse.",
        voiceRules: "Every response includes one concrete fact and one next action.\nState uncertainty before proposing risky actions.",
        voiceMicroBans: "No filler acknowledgements.\nNo fabricated metrics.",
        hardBanCategories: ["deploy", "data_exfil", "file_delete"],
      };
    case "creative":
      return {
        domainFocus: "creative campaigns and audience-facing narratives",
        definitionOfDone: "At least two viable directions are produced.\nRecommendation maps to objective + audience.",
        escalationRules: "Brand-sensitive claims\nExternal publishing actions",
        voiceStyle: "Expressive, concrete, and directional.",
        voiceRules: "Every response includes one concrete audience fact and one action.\nDefend one point of view with rationale.",
        voiceMicroBans: "No bland consensus language.\nNo unverifiable numeric claims.",
        hardBanCategories: ["publishing", "data_exfil"],
      };
    case "research":
      return {
        domainFocus: "evidence-backed research and decision support",
        definitionOfDone: "Claims are traceable to sources.\nTradeoffs and confidence are explicit.",
        escalationRules: "Low confidence conclusions\nConflicting critical evidence",
        voiceStyle: "Analytical, source-conscious, uncertainty-aware.",
        voiceRules: "Each response cites one concrete signal and one recommendation.\nExplicitly label confidence level.",
        voiceMicroBans: "No unsourced definitive statements.\nNo vague confidence language.",
        hardBanCategories: ["data_exfil"],
      };
    case "operations":
      return {
        domainFocus: "operational reliability, risk control, and safe execution",
        definitionOfDone: "Operational steps are explicit and reversible.\nSafety checks and rollback path are documented.",
        escalationRules: "Destructive operations\nSecurity or compliance impact",
        voiceStyle: "Operational, risk-aware, procedural.",
        voiceRules: "Include one operational signal and one concrete mitigation/action.\nSurface rollback options for risky actions.",
        voiceMicroBans: "No implicit assumptions about production safety.\nNo skipping guardrails.",
        hardBanCategories: ["deploy", "file_delete", "payments", "data_exfil"],
      };
    case "generalist":
    default:
      return {
        domainFocus: "cross-functional execution and team coordination",
        definitionOfDone: "Objective is complete with validation.\nRisks and handoff details are documented.",
        escalationRules: "Unclear requirements\nHigh-risk operations",
        voiceStyle: "Clear, pragmatic, balanced.",
        voiceRules: "Every response contains one fact and one action.\nEscalate when requirements are ambiguous.",
        voiceMicroBans: "No filler approvals.\nNo invented metrics.",
        hardBanCategories: ["publishing", "data_exfil"],
      };
  }
}

const BAN_CATEGORY_OPTIONS: Array<{
  category: HardBanCategory;
  label: string;
  description: string;
}> = [
  { category: "deploy", label: "Deploy", description: "No direct production deploys." },
  { category: "publishing", label: "Publishing", description: "No direct posting or publishing." },
  { category: "data_exfil", label: "Data Exfiltration", description: "No secret/data export outside policy." },
  { category: "file_delete", label: "Destructive Delete", description: "No destructive delete actions." },
  { category: "payments", label: "Payments", description: "No financial transaction actions." },
  { category: "email_send", label: "Email Send", description: "No outbound email sends." },
];

const BAN_CATEGORY_TEMPLATES: Record<
  HardBanCategory,
  Pick<RoleHardBan, "label" | "description" | "triggerPhrases" | "severity" | "enforcement">
> = {
  deploy: {
    label: "No direct production deploy",
    description: "Deploy actions require human approval.",
    triggerPhrases: ["deploy", "ship to prod", "rollout production"],
    severity: "critical",
    enforcement: "tool-block",
  },
  publishing: {
    label: "No direct publishing",
    description: "External publishing requires human sign-off.",
    triggerPhrases: ["publish", "post", "announce", "tweet"],
    severity: "critical",
    enforcement: "tool-block",
  },
  data_exfil: {
    label: "No data exfiltration",
    description: "Do not export sensitive datasets or secrets.",
    triggerPhrases: ["export all", "dump db", "exfiltrate", "leak"],
    severity: "critical",
    enforcement: "tool-block",
  },
  file_delete: {
    label: "No destructive file deletion",
    description: "Do not run destructive delete commands.",
    triggerPhrases: ["rm -rf", "truncate", "delete all"],
    severity: "critical",
    enforcement: "tool-block",
  },
  payments: {
    label: "No payment execution",
    description: "Payments require explicit human authorization.",
    triggerPhrases: ["pay", "wire", "invoice", "charge"],
    severity: "critical",
    enforcement: "tool-block",
  },
  email_send: {
    label: "No direct email send",
    description: "Outbound email requires review before send.",
    triggerPhrases: ["send email", "mail merge", "email blast"],
    severity: "critical",
    enforcement: "tool-block",
  },
  other: {
    label: "Restricted action",
    description: "Restricted behavior requiring escalation.",
    triggerPhrases: [],
    severity: "warning",
    enforcement: "prompt-only",
  },
};

function splitLines(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function buildHardBanSeeds(categories: HardBanCategory[]): RoleHardBan[] {
  return categories.map((category) => {
    const template = BAN_CATEGORY_TEMPLATES[category];
    return {
      id: `seed-${category}`,
      category,
      label: template.label,
      description: template.description,
      severity: template.severity,
      enforcement: template.enforcement,
      triggerPhrases: template.triggerPhrases,
    };
  });
}

function buildSeedTelemetryEvents(blueprint: CreationBlueprintState): CharacterTelemetryEvent[] {
  let base = { ...SETUP_TELEMETRY_BASELINE[blueprint.setup] };
  const specialtyCount = Math.max(1, blueprint.specialtySkills.length);

  base = applyTelemetryDelta(base, {
    stepStarted: specialtyCount * 2,
    stepCompleted: specialtyCount * 2,
    handoffInteractions: specialtyCount,
    challengeInteractions: Math.max(0, specialtyCount - 1),
    memoryWritten: Math.ceil(specialtyCount / 2),
  });

  for (const skill of blueprint.specialtySkills) {
    for (const rule of SPECIALTY_TELEMETRY_RULES) {
      if (rule.pattern.test(skill)) {
        base = applyTelemetryDelta(base, rule.delta);
      }
    }
  }

  base = applyTelemetryDelta(base, TEMPERAMENT_TELEMETRY_DELTA[blueprint.temperament]);

  const missions = Math.max(4, base.missions);
  const success = Math.min(missions, Math.max(1, base.success));
  const failures = Math.max(0, missions - success);
  const stepStarted = Math.max(1, base.stepStarted);
  const stepCompleted = Math.min(stepStarted, Math.max(1, base.stepCompleted));
  const memoryWritten = Math.max(0, base.memoryWritten);
  const banTriggered = Math.max(0, base.banTriggered);
  const escalations = Math.max(0, base.escalations);
  const challengeInteractions = Math.max(0, base.challengeInteractions);
  const handoffInteractions = Math.max(0, base.handoffInteractions);

  const events: CharacterTelemetryEvent[] = [];
  let offset = 0;
  const now = Date.now();
  const push = (
    type: CharacterTelemetryEvent["type"],
    payload: CharacterTelemetryEvent["payload"] = {},
  ) => {
    offset += 1;
    events.push({
      id: `seed-${offset}`,
      type,
      payload,
      timestamp: now - (10_000 - offset * 50),
    });
  };

  for (let i = 0; i < missions; i += 1) {
    push("mission_created", { source: "character_seed" });
  }
  for (let i = 0; i < success; i += 1) {
    push("mission_completed", { source: "character_seed" });
  }
  for (let i = 0; i < failures; i += 1) {
    push("mission_failed", { source: "character_seed" });
  }
  for (let i = 0; i < stepStarted; i += 1) {
    push("step_started", { source: "character_seed" });
  }
  for (let i = 0; i < stepCompleted; i += 1) {
    push("step_completed", { source: "character_seed" });
  }
  for (let i = 0; i < memoryWritten; i += 1) {
    push("memory_written", {
      source: "character_seed",
      memory_type: "lesson",
      confidence: 0.7,
    });
  }
  for (let i = 0; i < banTriggered; i += 1) {
    push("ban_triggered", {
      source: "character_seed",
      category: "other",
    });
  }
  for (let i = 0; i < escalations; i += 1) {
    push("escalation_requested", {
      source: "character_seed",
      reason: "seed-risk-check",
    });
  }
  for (let i = 0; i < challengeInteractions; i += 1) {
    push("interaction", {
      source: "character_seed",
      interaction_type: "challenge",
    });
  }
  for (let i = 0; i < handoffInteractions; i += 1) {
    push("interaction", {
      source: "character_seed",
      interaction_type: "handoff_success",
    });
  }

  return events;
}

function CreateAgentForm({ 
  onCancel, 
  onShowForge 
}: { 
  onCancel: () => void;
  onShowForge?: (agentName: string) => void;
}) {
  const { createAgent, isCreating, error, clearError, agents, recordCharacterTelemetry } = useAgentStore();
  
  // Reset error and isCreating when form mounts
  useEffect(() => {
    clearError();
    const store = useAgentStore.getState();
    if (store.isCreating) {
      useAgentStore.setState({ isCreating: false });
    }
  }, [clearError]);
  
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

  // Voice presets state
  const [voices, setVoices] = useState<VoicePreset[]>([]);
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [previewAudio, setPreviewAudio] = useState<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

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
    
    // SAFETY: Only proceed if on review step
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
    
    // SAFETY: Check we're ready and not already creating
    if (!isReadyForCreate) {
      console.log('[CreateAgentForm] Not ready for creation');
      return;
    }
    
    // SAFETY: Check if animation already showing
    if (!onShowForge) {
      console.error('[CreateAgentForm] onShowForge not provided');
      return;
    }

    const definitionOfDone = splitLines(cardSeed.definitionOfDone);
    const escalation = splitLines(cardSeed.escalationRules);
    const voiceRules = splitLines(cardSeed.voiceRules);
    const voiceMicroBans = splitLines(cardSeed.voiceMicroBans);
    const domainFocus = cardSeed.domainFocus.trim();

    const characterSeed = {
      roleCard: {
        domain: domainFocus
          ? `${formData.name || "Agent"} owns ${domainFocus}.`
          : undefined,
        definitionOfDone,
        escalation,
        hardBans: buildHardBanSeeds(cardSeed.hardBanCategories),
      },
      voice: {
        style: cardSeed.voiceStyle.trim(),
        rules: voiceRules,
        microBans: voiceMicroBans,
      },
    };

    const payload: CreateAgentInput = {
      ...formData,
      config: {
        ...(formData.config || {}),
        characterBlueprint: blueprint,
        characterSeed,
      },
    };
    // Show forge animation FIRST, then create agent after animation completes
    console.log('[CreateAgentForm] Showing forge animation, activeStep:', activeStep);
    if (onShowForge) {
      onShowForge(formData.name || 'Your Agent');
    } else {
      console.error('[CreateAgentForm] onShowForge callback missing!');
    }
    
    // Delay agent creation to let animation play (6 seconds)
    window.setTimeout(async () => {
      try {
      const createdAgent = await createAgent(payload);
      const seededTelemetry = buildSeedTelemetryEvents(blueprint);
      for (const event of seededTelemetry) {
        recordCharacterTelemetry(createdAgent.id, {
          type: event.type,
          runId: event.runId,
          payload: event.payload,
        });
      }
      } catch {
        // Error handled by store
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
  const projectedFormulaByKey = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(previewCharacterConfig.progression.stats).map(([key, rule]) => [key, rule.formula]),
      ) as Record<string, string>,
    [previewCharacterConfig],
  );
  const projectedStatEntries = useMemo(() => {
    return projectedStats.relevantStats
      .map((key) => ({
        key,
        value: projectedStats.stats[key] ?? 0,
        definition: setupStatDefinitions.find((definition) => definition.key === key) || null,
      }))
      .filter((entry) => entry.definition);
  }, [projectedStats, setupStatDefinitions]);
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
  
  const stepValidation: Record<CreateFlowStepId, boolean> = {
    welcome: true,
    identity: identityComplete,
    personality: personalityComplete,
    character: characterComplete,
    runtime: runtimeComplete,
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
      case 'orchestrator': return <Network className="w-5 h-5" />;
      case 'worker': return <Cog className="w-5 h-5" />;
      default: return <Bot className="w-5 h-5" />;
    }
  };

  return (
    <div className="flex h-full flex-col p-6 overflow-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Create New Agent</h1>
          <p className="text-muted-foreground">Configure your AI agent with voice, type, and capabilities</p>
        </div>
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="max-w-4xl space-y-8">
        <section className="rounded-lg border bg-muted/20 p-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
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
                  className={`rounded-md border p-3 text-left transition-colors ${
                    selected
                      ? "border-primary bg-primary/10"
                      : completed
                      ? "border-primary/40 bg-primary/5"
                      : "border-border bg-background"
                  } ${!unlocked ? "opacity-50 cursor-not-allowed" : "hover:border-primary/40"}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{step.label}</span>
                    {selected || completed ? (
                      <CheckCircle className="h-4 w-4 text-primary" />
                    ) : (
                      <Circle className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{step.description}</p>
                </button>
              );
            })}
          </div>
          <div className="mt-3 rounded border border-border/60 bg-background px-3 py-2 text-xs text-muted-foreground">
            Step {activeStepIndex + 1} of {CREATE_FLOW_STEPS.length}: {currentStepDescription}
          </div>
        </section>

        <AnimatePresence mode="wait">
          <motion.div
            key={activeStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
        {activeStep === "welcome" && (
          <section className="space-y-8 py-8 relative overflow-hidden">
            {/* Animated Background Particles */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {[...Array(6)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-2 h-2 rounded-full bg-primary/20"
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
                  style={{
                    left: `${20 + i * 15}%`,
                    top: `${60 + (i % 3) * 10}%`,
                  }}
                />
              ))}
            </div>

            <div className="text-center space-y-6 relative z-10">
              {/* Animated Icon with Orbiting Elements */}
              <div className="relative w-32 h-32 mx-auto">
                {/* Orbiting dots */}
                <motion.div
                  className="absolute inset-0"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                >
                  <div className="absolute top-0 left-1/2 w-3 h-3 bg-blue-500 rounded-full shadow-[0_0_10px_rgba(59,130,246,0.8)]" />
                </motion.div>
                <motion.div
                  className="absolute inset-2"
                  animate={{ rotate: -360 }}
                  transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
                >
                  <div className="absolute bottom-0 left-1/2 w-2 h-2 bg-purple-500 rounded-full shadow-[0_0_10px_rgba(139,92,246,0.8)]" />
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
                  className="w-24 h-24 mx-auto rounded-full bg-gradient-to-br from-blue-500 via-purple-500 to-green-500 flex items-center justify-center shadow-[0_0_60px_rgba(59,130,246,0.4)]"
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
                    <Bot className="w-12 h-12 text-white" />
                  </motion.div>
                </motion.div>
              </div>

              {/* Title with staggered animation */}
              <div className="space-y-3">
                <motion.h2 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.5 }}
                  className="text-4xl font-bold"
                >
                  <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-green-400 bg-clip-text text-transparent">
                    Create Your AI Agent
                  </span>
                </motion.h2>
                <motion.p 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4, duration: 0.5 }}
                  className="text-muted-foreground max-w-lg mx-auto text-lg"
                >
                  Build intelligent agents that automate tasks, make decisions, and collaborate with your team.
                </motion.p>
              </div>
            </div>

            {/* Feature Cards with Stagger Animation */}
            <motion.div 
              className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto relative z-10"
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
                  icon: Sparkles, 
                  color: "blue", 
                  title: "Define Personality", 
                  desc: "Configure creativity, verbosity, and temperament to match your workflow." 
                },
                { 
                  icon: Settings, 
                  color: "purple", 
                  title: "Equip Tools", 
                  desc: "Grant capabilities like code generation, web search, and file operations." 
                },
                { 
                  icon: Network, 
                  color: "green", 
                  title: "Deploy & Monitor", 
                  desc: "Launch your agent and track progress through checkpoints and telemetry." 
                }
              ].map((feature, i) => (
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
                    scale: 1.05, 
                    y: -5,
                    transition: { duration: 0.2 }
                  }}
                  className="p-6 rounded-xl border bg-muted/20 space-y-3 cursor-pointer group hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10 transition-all"
                >
                  <motion.div 
                    className={`w-12 h-12 rounded-full bg-${feature.color}-500/10 flex items-center justify-center group-hover:bg-${feature.color}-500/20 transition-colors`}
                    whileHover={{ rotate: 360 }}
                    transition={{ duration: 0.5 }}
                  >
                    <feature.icon className={`w-6 h-6 text-${feature.color}-500`} />
                  </motion.div>
                  <h3 className="font-semibold text-lg">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {feature.desc}
                  </p>
                </motion.div>
              ))}
            </motion.div>

            {/* CTA Button with enhanced animation */}
            <motion.div 
              className="flex justify-center relative z-10"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.2, duration: 0.5 }}
            >
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Button size="lg" onClick={goToNextStep} className="px-10 py-6 text-lg shadow-lg shadow-primary/25">
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
                    className="ml-3"
                  >
                    →
                  </motion.span>
                </Button>
              </motion.div>
            </motion.div>

            {/* Progress indicator */}
            <motion.div 
              className="flex justify-center gap-2 relative z-10"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.5 }}
            >
              {[...Array(6)].map((_, i) => (
                <motion.div
                  key={i}
                  className="w-2 h-2 rounded-full bg-primary/30"
                  animate={{ 
                    scale: i === 0 ? [1, 1.3, 1] : 1,
                    backgroundColor: i === 0 ? 'rgba(59, 130, 246, 0.8)' : 'rgba(59, 130, 246, 0.3)'
                  }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.1 }}
                />
              ))}
            </motion.div>
          </section>
        )}

        {activeStep === "identity" && (
          <section className="space-y-6 animate-in fade-in slide-in-from-right-3 duration-300">
            <div className="space-y-2">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                Agent Identity
              </h2>
              <p className="text-sm text-muted-foreground">
                Define the ownership boundary and runtime role for this agent.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Agent Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Code Review Sentinel"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="What this agent owns and what it should deliver."
                required
              />
            </div>

            <Separator />

            <div className="space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Network className="w-5 h-5 text-primary" />
                Agent Type
              </h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                {AGENT_TYPES.map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    className={`rounded-lg border p-4 text-left transition-all ${
                      formData.type === type.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        type: type.id,
                        parentAgentId: type.id === "sub-agent" ? prev.parentAgentId : undefined,
                      }))
                    }
                  >
                    <div className="mb-2 flex items-center gap-2">
                      {getTypeIcon(type.id)}
                      <span className="font-medium">{type.name}</span>
                      {formData.type === type.id && (
                        <CheckCircle className="ml-auto h-4 w-4 text-primary" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{type.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {formData.type === "sub-agent" && (
              <div className="space-y-2">
                <Label htmlFor="parentAgent">Parent Orchestrator</Label>
                <Select
                  value={formData.parentAgentId || ""}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, parentAgentId: value || undefined }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        orchestrators.length === 0
                          ? "No orchestrators available"
                          : "Select parent orchestrator"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
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
                  <p className="text-xs text-amber-600">
                    You need an orchestrator before creating a sub-agent.
                  </p>
                )}
              </div>
            )}
          </section>
        )}

        {activeStep === "personality" && (
          <section className="space-y-6 animate-in fade-in slide-in-from-right-3 duration-300">
            <div className="space-y-2">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                Personality Settings
              </h2>
              <p className="text-sm text-muted-foreground">
                Fine-tune how your agent thinks and communicates.
              </p>
            </div>

            <div className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Creativity: {((formData.config as { personality?: { creativity?: number; verbosity?: number } })?.personality?.creativity ?? 50)}%</Label>
                  <span className="text-xs text-muted-foreground">
                    {(((formData.config as { personality?: { creativity?: number; verbosity?: number } })?.personality?.creativity ?? 50) < 30) 
                      ? "Conservative" 
                      : (((formData.config as { personality?: { creativity?: number; verbosity?: number } })?.personality?.creativity ?? 50) > 70) 
                        ? "Innovative" 
                        : "Balanced"}
                  </span>
                </div>
                <Slider
                  value={[((formData.config as { personality?: { creativity?: number; verbosity?: number } })?.personality?.creativity ?? 50)]}
                  onValueChange={([value]) =>
                    setFormData((prev) => {
                      const prevConfig = (prev.config as { personality?: { creativity?: number; verbosity?: number } }) || {};
                      const prevPersonality = prevConfig.personality || {};
                      return {
                        ...prev,
                        config: {
                          ...prevConfig,
                          personality: {
                            ...prevPersonality,
                            creativity: value,
                            verbosity: prevPersonality.verbosity ?? 50,
                          },
                        },
                      };
                    })
                  }
                  min={0}
                  max={100}
                  step={1}
                />
                <p className="text-xs text-muted-foreground">
                  Lower values produce more predictable responses. Higher values encourage creative problem-solving.
                </p>
              </div>

              <Separator />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label>Verbosity: {((formData.config as { personality?: { creativity?: number; verbosity?: number } })?.personality?.verbosity ?? 50)}%</Label>
                  <span className="text-xs text-muted-foreground">
                    {(((formData.config as { personality?: { creativity?: number; verbosity?: number } })?.personality?.verbosity ?? 50) < 30) 
                      ? "Concise" 
                      : (((formData.config as { personality?: { creativity?: number; verbosity?: number } })?.personality?.verbosity ?? 50) > 70) 
                        ? "Detailed" 
                        : "Balanced"}
                  </span>
                </div>
                <Slider
                  value={[((formData.config as { personality?: { creativity?: number; verbosity?: number } })?.personality?.verbosity ?? 50)]}
                  onValueChange={([value]) =>
                    setFormData((prev) => {
                      const prevConfig = (prev.config as { personality?: { creativity?: number; verbosity?: number } }) || {};
                      const prevPersonality = prevConfig.personality || {};
                      return {
                        ...prev,
                        config: {
                          ...prevConfig,
                          personality: {
                            ...prevPersonality,
                            creativity: prevPersonality.creativity ?? 50,
                            verbosity: value,
                          },
                        },
                      };
                    })
                  }
                  min={0}
                  max={100}
                  step={1}
                />
                <p className="text-xs text-muted-foreground">
                  Controls response length. Lower values for brief answers, higher values for thorough explanations.
                </p>
              </div>
            </div>
          </section>
        )}

        {activeStep === "character" && (
          <section className="space-y-6 animate-in fade-in slide-in-from-right-3 duration-300">
            <div className="space-y-2">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                Character Profile
              </h2>
              <p className="text-sm text-muted-foreground">
                Choose setup and specialties. Stats and level are projected from measurable telemetry signals.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {CHARACTER_SETUPS.map((setup) => (
                <button
                  key={setup.id}
                  type="button"
                  className={`text-left p-4 rounded-lg border transition-all ${
                    blueprint.setup === setup.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                  onClick={() => applySetupDefaults(setup.id)}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{setup.label}</span>
                    {blueprint.setup === setup.id && <CheckCircle className="h-4 w-4 text-primary" />}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{setup.description}</p>
                  <Badge variant="outline" className="mt-2 text-[10px]">
                    class: {setup.className}
                  </Badge>
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
              <Card className="lg:col-span-3">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Specialty Skills</CardTitle>
                  <CardDescription>Select up to 4 specialties.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Specialties</Label>
                    <Badge variant="secondary">{blueprint.specialtySkills.length}/4 selected</Badge>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {getSpecialtyOptions(blueprint.setup).map((skill) => {
                      const selected = blueprint.specialtySkills.includes(skill);
                      return (
                        <Badge
                          key={skill}
                          variant={selected ? "default" : "outline"}
                          className="cursor-pointer py-1.5 px-3"
                          onClick={() => toggleSpecialty(skill)}
                        >
                          {selected && <CheckCircle className="w-3 h-3 mr-1" />}
                          {skill}
                        </Badge>
                      );
                    })}
                  </div>
                  {blueprint.specialtySkills.length === 0 && (
                    <p className="text-xs text-amber-600">
                      Select at least one specialty to project measurable skills.
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Projected Level</CardTitle>
                  <CardDescription>Based on setup baseline + specialties.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Class</span>
                    <Badge variant="outline">{projectedStats.class}</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Level</span>
                    <span className="text-lg font-semibold">Lv {projectedStats.level}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">XP</span>
                    <span className="text-sm font-medium">{projectedStats.xp.toFixed(2)}</span>
                  </div>
                  <div className="space-y-2">
                    {blueprint.specialtySkills.slice(0, 3).map((skill) => (
                      <div key={skill} className="flex items-center justify-between rounded border px-2 py-1 text-xs">
                        <span className="text-muted-foreground">{skill}</span>
                        <span className="font-medium">{projectedStats.specialtyScores[skill] ?? 0}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="space-y-2">
              <Label>Measured Setup Stats</Label>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {setupStatDefinitions.map((definition) => {
                  const value = projectedStats.stats[definition.key] ?? 0;
                  return (
                    <div key={definition.key} className="rounded-md border p-3">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">{definition.label}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px]">
                            {definition.key}
                          </Badge>
                          <span className="text-xs font-semibold">{value}</span>
                        </div>
                      </div>
                      <div className="mt-2 h-1.5 rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${Math.max(4, value)}%` }}
                        />
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">{definition.description}</p>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        Signals: {definition.signals.join(", ")}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-1 font-mono break-all">
                        Formula: {projectedFormulaByKey[definition.key] || "n/a"}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Temperament</Label>
                <Select
                  value={blueprint.temperament}
                  onValueChange={(value) =>
                    setBlueprint((prev) => ({ ...prev, temperament: value as CreationTemperament }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="precision">precision</SelectItem>
                    <SelectItem value="exploratory">exploratory</SelectItem>
                    <SelectItem value="systemic">systemic</SelectItem>
                    <SelectItem value="balanced">balanced</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Setup Capabilities</Label>
                <div className="rounded-md border p-3 text-sm text-muted-foreground">
                  {SETUP_CAPABILITY_PRESETS[blueprint.setup].join(", ")}
                </div>
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Role Domain Focus</Label>
                <Input
                  value={cardSeed.domainFocus}
                  onChange={(e) => setCardSeed((prev) => ({ ...prev, domainFocus: e.target.value }))}
                  placeholder="Domain ownership boundary"
                />
              </div>
              <div className="space-y-2">
                <Label>Voice Style</Label>
                <Input
                  value={cardSeed.voiceStyle}
                  onChange={(e) => setCardSeed((prev) => ({ ...prev, voiceStyle: e.target.value }))}
                  placeholder="Technical, direct, skeptical..."
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Definition of Done (one per line)</Label>
                <Textarea
                  value={cardSeed.definitionOfDone}
                  onChange={(e) => setCardSeed((prev) => ({ ...prev, definitionOfDone: e.target.value }))}
                  rows={4}
                />
              </div>
              <div className="space-y-2">
                <Label>Escalation Triggers (one per line)</Label>
                <Textarea
                  value={cardSeed.escalationRules}
                  onChange={(e) => setCardSeed((prev) => ({ ...prev, escalationRules: e.target.value }))}
                  rows={4}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Voice Rules (one per line)</Label>
                <Textarea
                  value={cardSeed.voiceRules}
                  onChange={(e) => setCardSeed((prev) => ({ ...prev, voiceRules: e.target.value }))}
                  rows={4}
                />
              </div>
              <div className="space-y-2">
                <Label>Voice Micro-Bans (one per line)</Label>
                <Textarea
                  value={cardSeed.voiceMicroBans}
                  onChange={(e) => setCardSeed((prev) => ({ ...prev, voiceMicroBans: e.target.value }))}
                  rows={4}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Hard Ban Categories</Label>
                <Badge variant="secondary">{cardSeed.hardBanCategories.length} selected</Badge>
              </div>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                {BAN_CATEGORY_OPTIONS.map((option) => {
                  const selected = cardSeed.hardBanCategories.includes(option.category);
                  return (
                    <button
                      key={option.category}
                      type="button"
                      className={`rounded border p-3 text-left transition-colors ${
                        selected ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
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
                        <span className="font-medium text-sm">{option.label}</span>
                        {selected && <CheckCircle className="w-4 h-4 text-primary" />}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{option.description}</p>
                    </button>
                  );
                })}
              </div>
              {cardSeed.hardBanCategories.length === 0 && (
                <p className="text-xs text-amber-600">
                  Select at least one hard-ban category so tool blocking is enforceable.
                </p>
              )}
            </div>
          </section>
        )}

        {activeStep === "runtime" && (
          <section className="space-y-6 animate-in fade-in slide-in-from-right-3 duration-300">
            <div className="space-y-2">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Settings className="w-5 h-5 text-primary" />
                Runtime Configuration
              </h2>
              <p className="text-sm text-muted-foreground">
                Configure model, tooling, and runtime behaviors.
              </p>
            </div>

            <section className="space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Bot className="w-5 h-5 text-primary" />
                Model Configuration
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="model">Model</Label>
                  <Select
                    value={formData.model}
                    onValueChange={(value) => setFormData((prev) => ({ ...prev, model: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AGENT_MODELS.map((model) => (
                        <SelectItem key={model.id} value={model.id}>
                          {model.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="provider">Provider</Label>
                  <Select
                    value={formData.provider}
                    onValueChange={(value) =>
                      setFormData((prev) => ({
                        ...prev,
                        provider: value as CreateAgentInput["provider"],
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="openai">OpenAI</SelectItem>
                      <SelectItem value="anthropic">Anthropic</SelectItem>
                      <SelectItem value="local">Local</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Max Iterations: {formData.maxIterations}</Label>
                  <Slider
                    value={[formData.maxIterations || 10]}
                    onValueChange={([value]) => setFormData((prev) => ({ ...prev, maxIterations: value }))}
                    min={1}
                    max={50}
                    step={1}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Temperature: {formData.temperature}</Label>
                  <Slider
                    value={[formData.temperature || 0.7]}
                    onValueChange={([value]) => setFormData((prev) => ({ ...prev, temperature: value }))}
                    min={0}
                    max={2}
                    step={0.1}
                  />
                </div>
              </div>
            </section>

            <Separator />

            <section className="space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Headphones className="w-5 h-5 text-primary" />
                Voice Settings
              </h3>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="flex items-center gap-3">
                  {formData.voice?.enabled ? (
                    <Volume2 className="w-5 h-5 text-green-500" />
                  ) : (
                    <VolumeX className="w-5 h-5 text-muted-foreground" />
                  )}
                  <div>
                    <div className="font-medium">Enable Voice</div>
                    <div className="text-sm text-muted-foreground">
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
                <div className="space-y-4 border-l-2 border-primary/20 pl-4">
                  <div className="space-y-2">
                    <Label>Voice</Label>
                    <div className="flex gap-2">
                      <Select
                        value={formData.voice?.voiceId || "default"}
                        onValueChange={(value) =>
                          setFormData((prev) => ({
                            ...prev,
                            voice: { enabled: true, voiceId: value, ...prev.voice },
                          }))
                        }
                        disabled={voiceLoading}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {voices.map((voice) => (
                            <SelectItem key={voice.id} value={voice.id}>
                              <span className="flex items-center gap-2">
                                <span
                                  className={`h-2 w-2 rounded-full ${
                                    voice.engine === "chatterbox"
                                      ? "bg-blue-500"
                                      : voice.engine === "xtts_v2"
                                      ? "bg-purple-500"
                                      : "bg-green-500"
                                  }`}
                                />
                                {voice.label}
                                {!voice.assetReady && " (download required)"}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={handleVoicePreview}
                        disabled={!formData.voice?.enabled || isPlaying}
                      >
                        {isPlaying ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Play className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-sm">
                        <div className="font-medium">Auto-Speak Responses</div>
                        <div className="text-muted-foreground">
                          Automatically speak all agent responses.
                        </div>
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

                    <div className="flex items-center justify-between">
                      <div className="text-sm">
                        <div className="font-medium">Speak on Checkpoint</div>
                        <div className="text-muted-foreground">
                          Voice summary when reaching checkpoints.
                        </div>
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
            </section>

            <Separator />

            <section className="space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Settings className="w-5 h-5 text-primary" />
                Capabilities
              </h3>
              <div className="flex flex-wrap gap-2">
                {AGENT_CAPABILITIES.map((cap) => (
                  <Badge
                    key={cap.id}
                    variant={formData.capabilities?.includes(cap.id) ? "default" : "outline"}
                    className="cursor-pointer py-1.5 px-3"
                    onClick={() => toggleCapability(cap.id)}
                  >
                    {formData.capabilities?.includes(cap.id) && (
                      <CheckCircle className="w-3 h-3 mr-1" />
                    )}
                    {cap.name}
                  </Badge>
                ))}
              </div>
            </section>

            <Separator />

            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold flex items-center gap-2">
                  <Bot className="w-5 h-5 text-primary" />
                  System Prompt
                </h3>
                <div className="flex gap-2">
                  <input
                    type="file"
                    id="prompt-file"
                    accept=".txt,.md,.prompt"
                    className="hidden"
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
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => document.getElementById('prompt-file')?.click()}
                  >
                    <Paperclip className="w-4 h-4 mr-2" />
                    Load from File
                  </Button>
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
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Load Template" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="coding">Coding Assistant</SelectItem>
                      <SelectItem value="creative">Creative Writer</SelectItem>
                      <SelectItem value="research">Research Analyst</SelectItem>
                      <SelectItem value="support">Support Agent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Textarea
                  id="systemPrompt"
                  value={formData.systemPrompt}
                  onChange={(e) => setFormData((prev) => ({ ...prev, systemPrompt: e.target.value }))}
                  placeholder="Instructions for the agent..."
                  rows={6}
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Define behavior constraints and runtime expectations. Load from file or choose a template to get started.
                </p>
              </div>
            </section>
          </section>
        )}

        {activeStep === "review" && (
          <section className="space-y-6 animate-in fade-in slide-in-from-right-3 duration-300">
            <div className="space-y-2">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-primary" />
                Review and Forge
              </h2>
              <p className="text-sm text-muted-foreground">
                Final validation before creation. This summary is what gets compiled into the Character Layer.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{formData.name || "Unnamed Agent"}</CardTitle>
                  <CardDescription>{formData.description || "No description yet."}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">
                      {selectedTypeMeta?.name || formData.type}
                    </Badge>
                    {setupMeta && <Badge variant="secondary">{setupMeta.label}</Badge>}
                    <Badge variant="outline">{projectedStats.class}</Badge>
                    <Badge variant="outline">Lv {projectedStats.level}</Badge>
                  </div>
                  
                  {(() => {
                    const personality = (formData.config as { personality?: { creativity?: number; verbosity?: number } })?.personality;
                    if (!personality || (personality.creativity === undefined && personality.verbosity === undefined)) return null;
                    return (
                      <div className="space-y-2">
                        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Personality</Label>
                        <div className="flex flex-wrap gap-2">
                          {personality.creativity !== undefined && (
                            <Badge variant="outline">Creativity: {personality.creativity}%</Badge>
                          )}
                          {personality.verbosity !== undefined && (
                            <Badge variant="outline">Verbosity: {personality.verbosity}%</Badge>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">Specialties</Label>
                    <div className="flex flex-wrap gap-2">
                      {blueprint.specialtySkills.map((skill) => (
                        <Badge key={skill} variant="outline">
                          {skill} {projectedStats.specialtyScores[skill] ?? 0}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">Hard Bans</Label>
                    <div className="flex flex-wrap gap-2">
                      {cardSeed.hardBanCategories.map((category) => (
                        <Badge key={category} variant="destructive">
                          {category}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Projected Stats</CardTitle>
                  <CardDescription>Derived from setup telemetry model.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {projectedStatEntries.map((entry) => (
                    <div key={entry.key} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">
                          {entry.definition?.label || entry.key} ({entry.key})
                        </span>
                        <span className="font-medium">{entry.value}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${Math.max(4, entry.value)}%` }}
                        />
                      </div>
                      <div className="text-[10px] text-muted-foreground font-mono break-all">
                        {projectedFormulaByKey[entry.key] || ""}
                      </div>
                    </div>
                  ))}
                  <div className="rounded border bg-muted/30 px-2 py-1.5 text-xs text-muted-foreground">
                    XP {projectedStats.xp.toFixed(2)} from setup baseline + selected specialties + temperament.
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>
        )}
          </motion.div>
        </AnimatePresence>

        <div className="sticky bottom-0 z-10 flex items-center justify-between rounded-lg border bg-background/95 p-4 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="text-xs text-muted-foreground">
            {!stepValidation[activeStep]
              ? "Complete required fields in this step to continue."
              : activeStep === "review"
              ? "All checks passed. Forge will animate and compile the character layer."
              : "Step complete. Continue to the next stage."}
          </div>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={goToPreviousStep}
              disabled={activeStepIndex <= 0 || isCreating}
            >
              Back
            </Button>
            {activeStep !== "review" ? (
              <Button
                type="button"
                onClick={goToNextStep}
                disabled={!stepValidation[activeStep] || isCreating}
              >
                Next: {CREATE_FLOW_STEPS[activeStepIndex + 1]?.label || "Review"}
              </Button>
            ) : (
              <Button type="submit" size="lg" disabled={isCreating || !isReadyForCreate}>
                {isCreating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Bot className="w-4 h-4 mr-2" />
                    Create Agent
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}

// ============================================================================
// Orbital Animation Component for Agent Creation
// ============================================================================

function CreationProgressAnimation({ 
  onComplete, 
  agentName 
}: { 
  onComplete: () => void; 
  agentName: string;
}) {
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  
  const stages = [
    { percent: 0, message: 'Initializing agent creation...' },
    { percent: 15, message: 'Creating configuration...' },
    { percent: 30, message: 'Setting up personality matrix...' },
    { percent: 45, message: 'Configuring tool integrations...' },
    { percent: 60, message: 'Establishing channel connections...' },
    { percent: 75, message: 'Optimizing parameters...' },
    { percent: 90, message: 'Finalizing agent setup...' },
    { percent: 100, message: 'Agent creation complete!' },
  ];
  
  useEffect(() => {
    console.log('[CreationProgressAnimation] Component mounted, starting animation');
    let currentStage = 0;
    
    const runStage = () => {
      if (currentStage >= stages.length) {
        setIsComplete(true);
        setTimeout(onComplete, 1500);
        return;
      }
      
      const s = stages[currentStage];
      setProgress(s.percent);
      setStage(currentStage);
      currentStage++;
      
      const delay = currentStage === stages.length ? 500 : 600 + Math.random() * 300;
      setTimeout(runStage, delay);
    };
    
    runStage();
  }, []);
  
  return (
    <div className="relative flex flex-col items-center justify-center p-12">
      {/* Orbital Rings */}
      <div className="relative w-64 h-64 mb-8">
        {/* Outer Ring */}
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-blue-500/30"
          animate={{ rotate: 360 }}
          transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
        >
          <div className="absolute -top-1.5 left-1/2 w-3 h-3 bg-blue-500 rounded-full shadow-[0_0_20px_rgba(59,130,246,0.8)]" />
        </motion.div>
        
        {/* Middle Ring */}
        <motion.div
          className="absolute inset-8 rounded-full border-2 border-purple-500/30"
          animate={{ rotate: -360 }}
          transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
        >
          <div className="absolute -top-1 left-1/2 w-2.5 h-2.5 bg-purple-500 rounded-full shadow-[0_0_15px_rgba(139,92,246,0.8)]" />
        </motion.div>
        
        {/* Inner Ring */}
        <motion.div
          className="absolute inset-16 rounded-full border-2 border-green-500/30"
          animate={{ rotate: 360 }}
          transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
        >
          <div className="absolute -top-0.5 left-1/2 w-2 h-2 bg-green-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.8)]" />
        </motion.div>
        
        {/* Center Progress */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-5xl font-bold text-white font-mono">
            {progress}%
          </span>
        </div>
      </div>
      
      {/* Stage Message */}
      <AnimatePresence mode="wait">
        <motion.div
          key={stage}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="text-xl text-white/90 mb-6"
        >
          {stages[stage]?.message}
        </motion.div>
      </AnimatePresence>
      
      {/* Progress Bar */}
      <div className="w-80 h-2 bg-white/10 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-green-500"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>
      
      {/* Success Celebration */}
      <AnimatePresence>
        {isComplete && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="absolute inset-0 flex flex-col items-center justify-center"
            style={{ backgroundColor: 'rgba(15, 23, 42, 0.98)' }}
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
              className="w-32 h-32 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center mb-6 shadow-[0_0_60px_rgba(16,185,129,0.5)]"
            >
              <CheckCircle className="w-16 h-16 text-white" />
            </motion.div>
            <h2 className="text-3xl font-bold bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
              Agent Created!
            </h2>
            <p className="text-white/60 mt-2">{agentName || 'Your agent'} is ready</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// Edit Agent Form
// ============================================================================

function EditAgentForm({ agent, onCancel }: { agent: Agent; onCancel: () => void }) {
  const { updateAgent, isCreating, error, agents } = useAgentStore();
  const [formData, setFormData] = useState<Partial<CreateAgentInput>>({
    name: agent.name,
    description: agent.description,
    type: agent.type || 'worker',
    parentAgentId: agent.parentAgentId,
    model: agent.model,
    provider: agent.provider,
    capabilities: agent.capabilities,
    systemPrompt: agent.systemPrompt,
    maxIterations: agent.maxIterations,
    temperature: agent.temperature,
    voice: agent.voice || { voiceId: 'default', enabled: false },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateAgent(agent.id, formData);
    } catch {
      // Error handled by store
    }
  };

  const toggleCapability = (capId: string) => {
    setFormData(prev => ({
      ...prev,
      capabilities: prev.capabilities?.includes(capId)
        ? prev.capabilities.filter(c => c !== capId)
        : [...(prev.capabilities || []), capId]
    }));
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header - Fixed */}
      <div className="flex items-center justify-between p-4 border-b bg-background/95 backdrop-blur z-10 shrink-0">
        <h1 className="text-xl font-bold">Edit Agent</h1>
        <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-auto p-4">
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-6 pb-12">
        <div className="space-y-2">
          <Label htmlFor="name">Agent Name</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
            required
          />
        </div>

        <div className="space-y-2">
          <Label>Agent Type</Label>
          <div className="grid grid-cols-3 gap-2">
            {AGENT_TYPES.map(type => (
              <div
                key={type.id}
                className={`p-3 border rounded-lg cursor-pointer text-center transition-all ${
                  formData.type === type.id 
                    ? 'border-primary bg-primary/5' 
                    : 'border-border hover:border-primary/50'
                }`}
                onClick={() => setFormData(prev => ({ ...prev, type: type.id }))}
              >
                <div className="font-medium text-sm">{type.name}</div>
              </div>
            ))}
          </div>
        </div>

        {formData.type === 'sub-agent' && (
          <div className="space-y-2">
            <Label htmlFor="parentAgent">Parent Orchestrator</Label>
            <Select
              value={formData.parentAgentId || ''}
              onValueChange={value => setFormData(prev => ({ ...prev, parentAgentId: value || undefined }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select parent" />
              </SelectTrigger>
              <SelectContent>
                {agents.filter(a => a.type === 'orchestrator' && a.id !== agent.id).map(orch => (
                  <SelectItem key={orch.id} value={orch.id}>
                    {orch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="model">Model</Label>
            <Select
              value={formData.model}
              onValueChange={value => setFormData(prev => ({ ...prev, model: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AGENT_MODELS.map(model => (
                  <SelectItem key={model.id} value={model.id}>
                    {model.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="provider">Provider</Label>
            <Select
              value={formData.provider}
              onValueChange={value => setFormData(prev => ({ 
                ...prev, 
                provider: value as CreateAgentInput['provider']
              }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="openai">OpenAI</SelectItem>
                <SelectItem value="anthropic">Anthropic</SelectItem>
                <SelectItem value="local">Local</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Capabilities</Label>
          <div className="flex flex-wrap gap-2">
            {AGENT_CAPABILITIES.map(cap => (
              <Badge
                key={cap.id}
                variant={formData.capabilities?.includes(cap.id) ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => toggleCapability(cap.id)}
              >
                {cap.name}
              </Badge>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="systemPrompt">System Prompt</Label>
          <Textarea
            id="systemPrompt"
            value={formData.systemPrompt}
            onChange={e => setFormData(prev => ({ ...prev, systemPrompt: e.target.value }))}
            rows={4}
          />
        </div>

        <div className="space-y-3">
          <Label>Voice Settings</Label>
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center gap-2">
              {formData.voice?.enabled ? (
                <Volume2 className="w-4 h-4 text-green-500" />
              ) : (
                <VolumeX className="w-4 h-4 text-muted-foreground" />
              )}
              <span className="text-sm">Enable Voice</span>
            </div>
            <Switch
              checked={formData.voice?.enabled || false}
              onCheckedChange={checked => setFormData(prev => ({
                ...prev,
                voice: { ...(prev.voice || {}), enabled: checked }
              }))}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Max Iterations: {formData.maxIterations}</Label>
            <Slider
              value={[formData.maxIterations || 10]}
              onValueChange={([value]) => setFormData(prev => ({ ...prev, maxIterations: value }))}
              min={1}
              max={50}
              step={1}
            />
          </div>

          <div className="space-y-2">
            <Label>Temperature: {formData.temperature}</Label>
            <Slider
              value={[formData.temperature || 0.7]}
              onValueChange={([value]) => setFormData(prev => ({ ...prev, temperature: value }))}
              min={0}
              max={2}
              step={0.1}
            />
          </div>
        </div>

        <div className="flex gap-4 pt-4 border-t">
          <Button type="submit" disabled={isCreating} size="lg">
            {isCreating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
          <Button type="button" variant="outline" onClick={onCancel} size="lg">
            Cancel
          </Button>
        </div>
      </form>
      </div>
    </div>
  );
}

// ============================================================================
// Agent Detail View
// ============================================================================

function AgentDetailView({ agentId }: { agentId: string }) {
  const {
    agents,
    runs,
    tasks,
    checkpoints,
    commits,
    queue,
    activeRunId,
    activeRunOutput,
    isLoadingRuns,
    isLoadingTasks,
    isExecuting,
    eventStreamConnected,
    selectAgent,
    setIsEditing,
    deleteAgent,
    startRun,
    cancelRun,
    selectRun,
    fetchRuns,
    fetchTasks,
    fetchCheckpoints,
    fetchCommits,
    fetchQueue,
    characterStats,
  } = useAgentStore();

  const agent = agents.find(a => a.id === agentId);
  const agentRuns = runs[agentId] || [];
  const agentTasks = tasks[agentId] || [];
  const agentCheckpoints = checkpoints[agentId] || [];
  const agentCommits = commits[agentId] || [];
  const activeRun = agentRuns.find(r => r.id === activeRunId);
  const agentCharacterStats = characterStats[agentId];
  const unreadMailCount = useUnreadMailCount(agentId);
  const pendingReviewCount = usePendingReviewCount(agentId);

  const [executionInput, setExecutionInput] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  // Voice state managed by VoiceProvider

  useEffect(() => {
    if (agentId) {
      fetchRuns(agentId);
      fetchTasks(agentId);
      fetchCheckpoints(agentId);
      fetchCommits(agentId);
      fetchQueue(agentId);
    }
  }, [agentId, fetchRuns, fetchTasks, fetchCheckpoints, fetchCommits, fetchQueue]);

  if (!agent) return null;

  const handleStartRun = async () => {
    if (!executionInput.trim()) return;
    try {
      await startRun(agentId, executionInput);
      setExecutionInput('');
    } catch {
      // Error handled by store
    }
  };

  const handleDelete = async () => {
    try {
      await deleteAgent(agentId);
      setShowDeleteConfirm(false);
    } catch {
      // Error handled by store
    }
  };

  return (
    <div className="flex h-full">
      {/* Left Sidebar - Agent Info */}
      <div className="w-80 border-r p-4 space-y-4 overflow-auto">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => selectAgent(null)}>
            ← Back
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Bot className="w-6 h-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">{agent.name}</CardTitle>
                <div className="flex items-center gap-2 mt-1">
                  <div className={`w-2 h-2 rounded-full ${getStatusColor(agent.status)}`} />
                  <span className="text-xs text-muted-foreground capitalize">
                    {agent.status}
                  </span>
                  {eventStreamConnected && (
                    <Badge variant="outline" className="text-xs">
                      ● Live
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {agent.description}
            </p>

            <div className="space-y-2">
              <Label className="text-xs">Type</Label>
              <div className="flex items-center gap-2">
                {agent.type === 'orchestrator' && <Network className="w-4 h-4" />}
                {agent.type === 'sub-agent' && <Bot className="w-4 h-4" />}
                {agent.type === 'worker' && <Cog className="w-4 h-4" />}
                <span className="text-sm capitalize">{agent.type || 'worker'}</span>
              </div>
              {agent.parentAgentId && (
                <div className="text-xs text-muted-foreground">
                  Parent: {agents.find(a => a.id === agent.parentAgentId)?.name || agent.parentAgentId}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Model</Label>
              <div className="text-sm">{agent.model}</div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Temperature</Label>
              <div className="text-sm">{agent.temperature}</div>
            </div>

            {agent.voice?.enabled && (
              <div className="space-y-2">
                <Label className="text-xs flex items-center gap-1">
                  <Volume2 className="w-3 h-3" />
                  Voice
                </Label>
                <div className="text-sm">{agent.voice.voiceLabel || agent.voice.voiceId}</div>
                <div className="flex flex-wrap gap-1">
                  {agent.voice.autoSpeak && (
                    <Badge variant="outline" className="text-[10px]">Auto-speak</Badge>
                  )}
                  {agent.voice.speakOnCheckpoint && (
                    <Badge variant="outline" className="text-[10px]">Checkpoint alerts</Badge>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-xs">Capabilities</Label>
              <div className="flex flex-wrap gap-1">
                {agent.capabilities.map(cap => (
                  <Badge key={cap} variant="secondary" className="text-xs">
                    {cap}
                  </Badge>
                ))}
              </div>
            </div>

            <Separator />

            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1"
                onClick={() => setIsEditing(agentId)}
              >
                <Settings className="w-4 h-4 mr-1" />
                Edit
              </Button>
              <Button 
                variant="destructive" 
                size="sm"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Statistics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total Runs</span>
              <span>{agentRuns.length}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Checkpoints</span>
              <span>{agentCheckpoints.length}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Commits</span>
              <span>{agentCommits.length}</span>
            </div>
            {agentCharacterStats && (
              <>
                <Separator />
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Class</span>
                  <span>{agentCharacterStats.class}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Level</span>
                  <span>{agentCharacterStats.level}</span>
                </div>
                <div className="space-y-1 pt-1">
                  {agentCharacterStats.relevantStats.slice(0, 4).map((statKey) => {
                    const definition = agentCharacterStats.statDefinitions.find((item) => item.key === statKey);
                    return (
                      <div key={statKey} className="rounded border px-2 py-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-muted-foreground">{definition?.label || statKey}</span>
                          <span className="font-medium">{agentCharacterStats.stats[statKey] ?? 0}</span>
                        </div>
                        {definition && (
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            {definition.signals.join(", ")}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="flex flex-wrap gap-1 pt-1">
                  {Object.entries(agentCharacterStats.specialtyScores)
                    .slice(0, 3)
                    .map(([skill, value]) => (
                      <Badge key={skill} variant="outline" className="text-[10px]">
                        {skill}: {value}
                      </Badge>
                    ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Execution Area - Runner Style */}
        <div className="border-b p-4">
          {!activeRunId || activeRun?.status !== 'running' ? (
            // Initial Input State
            <div className="flex gap-2">
              <div className="flex-1">
                <Textarea
                  value={executionInput}
                  onChange={e => setExecutionInput(e.target.value)}
                  placeholder="Enter task for the agent..."
                  className="min-h-[80px]"
                  disabled={isExecuting}
                />
                <div style={{ marginTop: 8 }}>
                  <VoicePresence compact />
                </div>
              </div>
              
              <div className="flex flex-col gap-2">
                <Button 
                  onClick={handleStartRun}
                  disabled={isExecuting || !executionInput.trim()}
                  className="flex-1"
                >
                  {isExecuting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Play className="w-4 h-4 mr-1" />
                      Run
                    </>
                  )}
                </Button>
              </div>
            </div>
          ) : (
            // Active Run State - Runner Style
            <div className="flex gap-4 h-[300px]">
              {/* Main Output */}
              <div className="flex-1 flex flex-col min-w-0">
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm font-medium">Task</div>
                  <div className="flex items-center gap-2">
                    <Badge variant={activeRun?.status === 'running' ? 'default' : 'secondary'}>
                      {activeRun?.status === 'running' && <Loader2 className="w-3 h-3 mr-1 animate-spin inline" />}
                      {activeRun?.status}
                    </Badge>
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={() => activeRun && cancelRun(agentId, activeRun.id)}
                    >
                      <Square className="w-3 h-3 mr-1" />
                      Stop
                    </Button>
                  </div>
                </div>
                
                <div className="p-3 rounded-lg border bg-muted/30 mb-2">
                  <div className="text-sm">{activeRun?.input}</div>
                </div>
                
                <div className="flex-1 overflow-auto">
                  <pre className="whitespace-pre-wrap font-mono text-sm p-3 rounded-lg border bg-muted/50 min-h-[100px]">
                    {activeRunOutput || '(streaming output...)'}
                  </pre>
                </div>
              </div>
              
              {/* Trace Sidebar */}
              <AgentTraceSidebar agentId={agentId} />
            </div>
          )}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="runs" className="flex-1 flex flex-col">
          <TabsList className="mx-4 mt-4">
            <TabsTrigger value="runs">
              <Activity className="w-4 h-4 mr-1" />
              Runs
            </TabsTrigger>
            <TabsTrigger value="tasks">
              <CheckCircle className="w-4 h-4 mr-1" />
              Tasks
            </TabsTrigger>
            <TabsTrigger value="checkpoints">
              <Save className="w-4 h-4 mr-1" />
              Checkpoints
            </TabsTrigger>
            <TabsTrigger value="commits">
              <GitCommit className="w-4 h-4 mr-1" />
              Commits
            </TabsTrigger>
            <TabsTrigger value="queue">
              <Clock className="w-4 h-4 mr-1" />
              Queue
            </TabsTrigger>
            <TabsTrigger value="character">
              <Sparkles className="w-4 h-4 mr-1" />
              Character
            </TabsTrigger>
            <TabsTrigger value="attachments">
              <Paperclip className="w-4 h-4 mr-1" />
              Attachments
            </TabsTrigger>
            <TabsTrigger value="mail">
              <Mail className="w-4 h-4 mr-1" />
              Mail
              {unreadMailCount > 0 && (
                <Badge variant="destructive" className="ml-1 text-[10px] px-1 py-0 h-4 min-w-[16px]">
                  {unreadMailCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="reviews">
              <Shield className="w-4 h-4 mr-1" />
              Reviews
              {pendingReviewCount > 0 && (
                <Badge variant="destructive" className="ml-1 text-[10px] px-1 py-0 h-4 min-w-[16px]">
                  {pendingReviewCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="capsule">
              <AppWindow className="w-4 h-4 mr-1" />
              Capsule
            </TabsTrigger>
          </TabsList>

          <TabsContent value="runs" className="flex-1 p-4 m-0">
            {isLoadingRuns ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : agentRuns.length === 0 ? (
              <EmptyTabState message="No runs yet. Start the agent to see execution history." />
            ) : (
              <div className="space-y-2">
                {agentRuns.map(run => (
                  <RunCard 
                    key={run.id} 
                    run={run} 
                    isActive={run.id === activeRunId}
                    onClick={() => selectRun(run.id === activeRunId ? null : run.id)}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="tasks" className="flex-1 p-4 m-0">
            {isLoadingTasks ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : agentTasks.length === 0 ? (
              <EmptyTabState message="No tasks yet. Tasks appear during agent execution." />
            ) : (
              <div className="space-y-2">
                {agentTasks.map(task => (
                  <TaskCard key={task.id} task={task} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="checkpoints" className="flex-1 p-4 m-0">
            {agentCheckpoints.length === 0 ? (
              <EmptyTabState message="No checkpoints yet. Save progress during execution." />
            ) : (
              <div className="space-y-2">
                {agentCheckpoints.map(cp => (
                  <CheckpointCard key={cp.id} checkpoint={cp} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="commits" className="flex-1 p-4 m-0">
            {agentCommits.length === 0 ? (
              <EmptyTabState message="No commits yet. Version changes to track progress." />
            ) : (
              <div className="space-y-2">
                {agentCommits.map(commit => (
                  <CommitCard key={commit.id} commit={commit} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="queue" className="flex-1 p-4 m-0">
            {queue.length === 0 ? (
              <EmptyTabState message="Queue is empty. Add tasks to process." />
            ) : (
              <Card>
                <CardContent className="p-4">
                  <Queue>
                    <ul className="space-y-2">
                      {queue.map(item => (
                        <li key={item.id} className="flex items-center gap-2">
                          <Badge variant={item.priority <= 2 ? "destructive" : "secondary"}>
                            P{item.priority}
                          </Badge>
                          <span className="text-sm">{item.content}</span>
                          <Badge variant="outline" className="ml-auto">
                            {item.status}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  </Queue>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="character" className="flex-1 p-0 m-0">
            <CharacterLayerPanel agentId={agentId} />
          </TabsContent>

          <TabsContent value="attachments" className="flex-1 p-4 m-0">
            <Card>
              <CardContent className="p-4">
                <Attachments variant="list">
                  <Attachment data={{ id: "1", type: "file", filename: "requirements.pdf", mediaType: "application/pdf", url: "#" }}>
                    <AttachmentPreview />
                    <AttachmentRemove />
                  </Attachment>
                  <Attachment data={{ id: "2", type: "file", filename: "data.csv", mediaType: "text/csv", url: "#" }}>
                    <AttachmentPreview />
                    <AttachmentRemove />
                  </Attachment>
                  <Attachment data={{ id: "3", type: "file", filename: "image.png", mediaType: "image/png", url: "#" }}>
                    <AttachmentPreview />
                    <AttachmentRemove />
                  </Attachment>
                </Attachments>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="mail" className="flex-1 p-4 m-0">
            <AgentMailView agentId={agentId} />
          </TabsContent>

          <TabsContent value="reviews" className="flex-1 p-4 m-0">
            <AgentReviewsView agentId={agentId} />
          </TabsContent>

          <TabsContent value="capsule" className="flex-1 p-4 m-0">
            <AgentCapsuleView agentId={agentId} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Agent</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{agent.name}&quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function RunCard({ run, isActive, onClick }: { 
  run: AgentRun;
  isActive: boolean;
  onClick: () => void;
}) {
  const statusIcon = {
    running: <Loader2 className="w-4 h-4 animate-spin text-yellow-500" />,
    completed: <CheckCircle className="w-4 h-4 text-green-500" />,
    failed: <AlertCircle className="w-4 h-4 text-red-500" />,
    cancelled: <Square className="w-4 h-4 text-[var(--text-tertiary)]" />,
  }[run.status];

  return (
    <Card 
      className={`cursor-pointer transition-colors ${isActive ? 'border-primary' : 'hover:border-primary/50'}`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          {statusIcon}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium truncate">{run.input.slice(0, 50)}...</span>
              <Badge variant="outline" className="text-xs capitalize">
                {run.status}
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {formatRelativeTime(run.startedAt)} • {run.checkpointCount} checkpoints
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TaskCard({ task }: { task: AgentTask }) {
  const statusColors: Record<TaskStatus, string> = {
    pending: 'bg-white/30',
    'in-progress': 'bg-yellow-500',
    completed: 'bg-green-500',
    failed: 'bg-red-500',
    cancelled: 'bg-white/25',
  };

  return (
    <Task>
      <Card className="border-0 shadow-none">
        <CardContent className="p-3">
          <div className="flex items-start gap-3">
            <div className={`w-2 h-2 rounded-full mt-2 ${statusColors[task.status]}`} />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">{task.title}</span>
                <Badge variant="outline" className="text-xs capitalize">
                  {task.status}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {task.description}
              </p>
              {task.result && (
                <div className="mt-2 p-2 bg-muted rounded text-sm">
                  {task.result}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Task>
  );
}

function CheckpointCard({ checkpoint }: { checkpoint: AgentCheckpoint }) {
  return (
    <Checkpoint>
      <Card className="border-0 shadow-none">
        <CardContent className="p-3">
          <div className="flex items-center gap-3">
            <Save className="w-4 h-4 text-green-500" />
            <div className="flex-1">
              <div className="font-medium">{checkpoint.label}</div>
              {checkpoint.description && (
                <p className="text-sm text-muted-foreground">
                  {checkpoint.description}
                </p>
              )}
              <div className="text-xs text-muted-foreground mt-1">
                {formatRelativeTime(checkpoint.timestamp)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Checkpoint>
  );
}

function CommitCard({ commit }: { commit: AgentCommit }) {
  return (
    <Commit>
      <Card className="border-0 shadow-none">
        <CardContent className="p-3">
          <div className="flex items-start gap-3">
            <GitCommit className="w-4 h-4 text-blue-500" />
            <div className="flex-1">
              <div className="font-medium">{commit.message}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {commit.author} • {formatRelativeTime(commit.timestamp)}
              </div>
              {commit.changes.length > 0 && (
                <div className="text-xs text-muted-foreground mt-1">
                  {commit.changes.length} changes
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Commit>
  );
}

// ============================================================================
// Agent Reviews/Gate View Component
// ============================================================================

function AgentReviewsView({ agentId }: { agentId: string }) {
  const {
    reviews,
    isLoadingReviews,
    selectedReviewId,
    fetchReviews,
    submitReviewDecision,
    selectReview,
  } = useAgentStore();

  const [reviewNote, setReviewNote] = useState('');
  const [showDecisionConfirm, setShowDecisionConfirm] = useState<'approve' | 'reject' | null>(null);

  const agentReviews = reviews[agentId] || [];
  const pendingReviews = agentReviews.filter(r => r.status === 'pending');
  const selectedReview = agentReviews.find(r => r.id === selectedReviewId);

  useEffect(() => {
    fetchReviews(agentId);
  }, [agentId, fetchReviews]);

  const handleDecision = async (approved: boolean) => {
    if (!selectedReview) return;
    await submitReviewDecision(selectedReview.id, approved, reviewNote);
    setShowDecisionConfirm(null);
    setReviewNote('');
    selectReview(null);
  };

  if (isLoadingReviews) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-full gap-4">
      {/* Review List */}
      <div className="w-80 border-r pr-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium flex items-center gap-2">
            <ShieldAlert className="w-4 h-4" />
            Pending Reviews
          </h3>
          <Badge variant={pendingReviews.length > 0 ? 'destructive' : 'secondary'}>
            {pendingReviews.length}
          </Badge>
        </div>

        {pendingReviews.length === 0 ? (
          <EmptyTabState message="No pending reviews. Agent actions are within policy." />
        ) : (
          <div className="space-y-2">
            {pendingReviews.map(review => (
              <div
                key={review.id}
                className={`p-3 rounded-lg cursor-pointer transition-colors border ${
                  selectedReviewId === review.id
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
                onClick={() => selectReview(review.id)}
              >
                <div className="flex items-start gap-2">
                  {review.severity === 'critical' && <ShieldAlert className="w-4 h-4 text-red-500 mt-0.5" />}
                  {review.severity === 'warning' && <Shield className="w-4 h-4 text-orange-500 mt-0.5" />}
                  {review.severity === 'info' && <ShieldCheck className="w-4 h-4 text-blue-500 mt-0.5" />}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{review.title}</div>
                    <div className="text-xs text-muted-foreground mt-1">{review.type}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatRelativeTime(review.createdAt)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Review Detail */}
      <div className="flex-1">
        {!selectedReview ? (
          <EmptyTabState message="Select a review to view details and make a decision." />
        ) : (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Gavel className="w-4 h-4" />
                  Review Details
                </CardTitle>
                <Badge 
                  variant={selectedReview.severity === 'critical' ? 'destructive' : 
                          selectedReview.severity === 'warning' ? 'default' : 'secondary'}
                >
                  {selectedReview.severity}
                </Badge>
              </div>
              <CardDescription>
                {selectedReview.title}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Description</Label>
                <div className="p-3 rounded-lg border bg-muted/30 text-sm">
                  {selectedReview.description}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Proposed Action</Label>
                <div className="p-3 rounded-lg border bg-muted/30 text-sm font-mono">
                  {selectedReview.proposedAction}
                </div>
              </div>

              {selectedReview.context && (
                <div className="space-y-2">
                  <Label>Context</Label>
                  <pre className="p-3 rounded-lg border bg-muted/30 text-xs overflow-auto max-h-40">
                    {JSON.stringify(selectedReview.context, null, 2)}
                  </pre>
                </div>
              )}

              <Separator />

              <div className="space-y-2">
                <Label>Review Note (optional)</Label>
                <Textarea
                  value={reviewNote}
                  onChange={e => setReviewNote(e.target.value)}
                  placeholder="Add notes about your decision..."
                  rows={3}
                />
              </div>

              <div className="flex gap-2">
                <Button 
                  variant="default" 
                  onClick={() => setShowDecisionConfirm('approve')}
                  className="flex-1"
                >
                  <ThumbsUp className="w-4 h-4 mr-2" />
                  Approve
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={() => setShowDecisionConfirm('reject')}
                  className="flex-1"
                >
                  <ThumbsDown className="w-4 h-4 mr-2" />
                  Reject
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Decision Confirmation Dialog */}
      <Dialog open={!!showDecisionConfirm} onOpenChange={() => setShowDecisionConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {showDecisionConfirm === 'approve' ? 'Approve Action' : 'Reject Action'}
            </DialogTitle>
            <DialogDescription>
              {showDecisionConfirm === 'approve' 
                ? 'This will allow the agent to proceed with the proposed action.'
                : 'This will block the agent from proceeding with the proposed action.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDecisionConfirm(null)}>
              Cancel
            </Button>
            <Button 
              variant={showDecisionConfirm === 'approve' ? 'default' : 'destructive'}
              onClick={() => handleDecision(showDecisionConfirm === 'approve')}
            >
              {showDecisionConfirm === 'approve' ? 'Approve' : 'Reject'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ============================================================================
// Agent Mail View Component
// ============================================================================

function AgentMailView({ agentId }: { agentId: string }) {
  const {
    mail,
    mailThreads,
    isLoadingMail,
    selectedThreadId,
    fetchMail,
    fetchMailThreads,
    sendMail,
    acknowledgeMail,
    selectThread,
    agents,
  } = useAgentStore();

  const fetchUnifiedMailThreads = useUnifiedStore((state) => state.fetchMailThreads);
  const fetchUnifiedMailMessages = useUnifiedStore((state) => state.fetchMailMessages);
  const getSessionAnalytics = useUnifiedStore((state) => state.getSessionAnalytics);

  const [showCompose, setShowCompose] = useState(false);
  const [composeTo, setComposeTo] = useState('');
  const [composeSubject, setComposeSubject] = useState('');
  const [composeBody, setComposeBody] = useState('');

  const agentMail = mail[agentId] || [];
  const agentThreads = mailThreads[agentId] || [];
  const [monitorOpen, setMonitorOpen] = useState(false);
  const [monitorThreadId, setMonitorThreadId] = useState<string | null>(null);
  const analytics = selectedThreadId ? getSessionAnalytics(selectedThreadId) : null;

  useEffect(() => {
    fetchMail(agentId);
    fetchMailThreads(agentId);
  }, [agentId, fetchMail, fetchMailThreads]);

  useEffect(() => {
    fetchUnifiedMailThreads();
  }, [fetchUnifiedMailThreads]);

  useEffect(() => {
    if (selectedThreadId) {
      fetchUnifiedMailMessages(selectedThreadId);
    }
  }, [selectedThreadId, fetchUnifiedMailMessages]);

  const openMonitor = (threadId: string) => {
    fetchUnifiedMailMessages(threadId);
    setMonitorThreadId(threadId);
    setMonitorOpen(true);
  };

  const closeMonitor = () => {
    setMonitorOpen(false);
    setMonitorThreadId(null);
  };

  const handleSend = async () => {
    if (!composeTo || !composeSubject || !composeBody) return;
    await sendMail(agentId, composeTo, composeSubject, composeBody);
    setShowCompose(false);
    setComposeTo('');
    setComposeSubject('');
    setComposeBody('');
  };

  const handleAck = async (messageId: string) => {
    await acknowledgeMail(agentId, messageId);
  };

  if (isLoadingMail) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <>
      <div className="flex h-full gap-4">
      {/* Thread List */}
      <div className="w-64 border-r pr-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium flex items-center gap-2">
            <Inbox className="w-4 h-4" />
            Threads
          </h3>
          <Button size="sm" variant="ghost" onClick={() => setShowCompose(true)}>
            <Send className="w-4 h-4" />
          </Button>
        </div>

        {agentThreads.length === 0 ? (
          <EmptyTabState message="No messages yet." />
        ) : (
          <div className="space-y-2">
            {agentThreads.map(thread => (
              <div
                key={thread.id}
                className={`p-3 rounded-lg cursor-pointer transition-colors ${
                  selectedThreadId === thread.id
                    ? 'bg-primary/10 border border-primary/30'
                    : 'hover:bg-muted border border-transparent'
                }`}
                onClick={() => selectThread(thread.id)}
              >
                <div className="flex items-start gap-2">
                  <MessageSquare className="w-4 h-4 mt-0.5 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{thread.subject}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {thread.messageCount} messages
                    </div>
                    {thread.unreadCount > 0 && (
                      <Badge variant="destructive" className="mt-2 text-[10px]">
                        {thread.unreadCount} unread
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Message List */}
      <div className="flex-1">
        {showCompose ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Send className="w-4 h-4" />
                Compose Message
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>To Agent</Label>
                <Select value={composeTo} onValueChange={setComposeTo}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select recipient" />
                  </SelectTrigger>
                  <SelectContent>
                    {agents.filter(a => a.id !== agentId).map(agent => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.name} ({agent.type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Subject</Label>
                <Input
                  value={composeSubject}
                  onChange={e => setComposeSubject(e.target.value)}
                  placeholder="Message subject"
                />
              </div>
              <div className="space-y-2">
                <Label>Message</Label>
                <Textarea
                  value={composeBody}
                  onChange={e => setComposeBody(e.target.value)}
                  placeholder="Enter your message..."
                  rows={5}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSend}>
                  <Send className="w-4 h-4 mr-2" />
                  Send
                </Button>
                <Button variant="outline" onClick={() => setShowCompose(false)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : agentMail.length === 0 ? (
          <EmptyTabState message="No messages in inbox." />
        ) : (
          <div className="space-y-3">
            {selectedThreadId && analytics && (
              <div className="flex items-center justify-between bg-muted/20 px-3 py-2 rounded-lg text-xs text-muted-foreground">
                <div>
                  <p className="font-semibold text-[11px] text-muted-foreground">
                    Participants: {analytics.participants.length ? analytics.participants.join(", ") : "System"}
                  </p>
                  <p className="text-[11px]">
                    {analytics.totalMessages} messages · {analytics.ledgerEventCount} ledger events
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => openMonitor(selectedThreadId)}>
                  <MessageSquare className="w-4 h-4" />
                  Live Monitor
                </Button>
              </div>
            )}
            {agentMail
              .filter(msg => !selectedThreadId || msg.threadId === selectedThreadId)
              .map(message => (
                <MailMessageCard
                  key={message.id}
                  message={message}
                  onAck={() => handleAck(message.id)}
                />
              ))}
          </div>
        )}
      </div>
      </div>
      <MailMonitorDialog
        threadId={monitorThreadId}
        open={monitorOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeMonitor();
          }
        }}
      />
    </>
  );
}

function MailMessageCard({
  message,
  onAck,
}: {
  message: AgentMailMessage;
  onAck: () => void;
}) {
  const isUnread = message.status === 'unread';
  const priorityColors: Record<string, string> = {
    low: 'bg-white/30',
    normal: 'bg-blue-400',
    high: 'bg-orange-400',
    urgent: 'bg-red-500',
  };

  return (
    <Card className={isUnread ? 'border-primary/50 bg-primary/5' : ''}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={`w-2 h-2 rounded-full mt-2 ${priorityColors[message.priority]}`} />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium">{message.subject}</span>
              {isUnread && <Badge variant="default" className="text-[10px]">New</Badge>}
              {message.requiresAck && message.status !== 'acknowledged' && (
                <Badge variant="destructive" className="text-[10px]">Ack Required</Badge>
              )}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              From: {message.fromAgentName || message.fromAgentId}
            </div>
            <p className="text-sm mt-2">{message.body}</p>
            <div className="flex items-center gap-2 mt-3">
              <span className="text-xs text-muted-foreground">
                {formatRelativeTime(message.timestamp)}
              </span>
              {message.requiresAck && message.status !== 'acknowledged' && (
                <Button size="sm" variant="outline" onClick={onAck}>
                  <CheckCheck className="w-3 h-3 mr-1" />
                  Acknowledge
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface MailMonitorDialogProps {
  threadId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function MailMonitorDialog({ threadId, open, onOpenChange }: MailMonitorDialogProps) {
  const fetchReceipts = useUnifiedStore((state) => state.fetchReceipts);
  const { analytics, messages, relevantEvents, relevantLogs } = useMonitorData(threadId);
  const { shareId, isSharing, shareMonitor } = useMonitorShare(threadId);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    if (threadId) {
      fetchReceipts({ limit: 50 });
    }
  }, [threadId, fetchReceipts]);

  const handleCopyShare = useCallback(async () => {
    if (!threadId) return;
    let finalShareId = shareId;
    if (!finalShareId) {
      finalShareId = await shareMonitor();
    }
    const link = buildMonitorLink(threadId, finalShareId);
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    window.setTimeout(() => setCopiedLink(false), 1800);
  }, [threadId, shareId, shareMonitor]);

  if (!threadId) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card rounded-3xl p-0 max-w-5xl w-full h-[80vh]">
        <div className="flex flex-col h-full">
          <DialogHeader>
            <DialogTitle>Live Monitor</DialogTitle>
            <DialogDescription>
              Observing thread {threadId}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-hidden px-6 pb-6 pt-0">
            <MailMonitorPanel
              threadId={threadId}
              messages={messages}
              analytics={analytics}
              relevantEvents={relevantEvents}
              relevantLogs={relevantLogs}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyShare}
              disabled={isSharing}
            >
              {isSharing
                ? "Sharing…"
                : copiedLink
                  ? "Link copied"
                  : "Copy monitor link"}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}


function EmptyTabState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
      <Circle className="w-8 h-8 mb-2" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

// ============================================================================
// Agent Trace Sidebar (Runner Integration)
// ============================================================================

function AgentTraceSidebar({ agentId }: { agentId: string }) {
  const { activeRunTrace } = useAgentStore();
  const hasTrace = activeRunTrace.length > 0;

  const statusColors: Record<string, string> = {
    running: '#f59e0b',
    success: '#22c55e',
    error: '#ef4444',
    pending: '#6b7280',
  };

  const kindIcons: Record<string, string> = {
    info: 'ℹ️',
    tool: '🔧',
    error: '❌',
    thought: '💭',
    plan: '📋',
    checkpoint: '💾',
  };

  return (
    <div className="w-64 shrink-0 flex flex-col gap-3 p-3 rounded-xl border bg-card/50 h-full">
      <div className="flex justify-between items-center">
        <div className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
          Thought Trace
        </div>
        <div className="text-[11px] text-muted-foreground">
          RUNNING
        </div>
      </div>

      {!hasTrace && (
        <div className="text-xs text-muted-foreground italic">
          Waiting for trace events…
        </div>
      )}

      <div className="flex-1 overflow-y-auto flex flex-col gap-2.5 min-h-0">
        {activeRunTrace.map((entry) => (
          <div 
            key={entry.id} 
            className="p-3 rounded-xl border bg-card/70 flex flex-col gap-1.5"
          >
            <div className="flex justify-between text-[11px] text-muted-foreground">
              <span className="uppercase tracking-wide">{kindIcons[entry.kind] || '•'} {entry.kind}</span>
              <span>{new Date(entry.timestamp).toLocaleTimeString()}</span>
            </div>
            <div className="text-sm font-semibold">{entry.title}</div>
            {entry.detail && (
              <div className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-3">
                {entry.detail}
              </div>
            )}
            {entry.status && (
              <div 
                className="text-[11px] font-bold" 
                style={{ color: statusColors[entry.status] || 'var(--text-tertiary)' }}
              >
                {entry.status.toUpperCase()}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Agent Capsule View - Interactive Capsule Integration
// ============================================================================

import type { ToolUISurface } from '@a2r/mcp-apps-adapter';
import type { CapsuleEvent } from '@/components/CapsuleFrame';

function AgentCapsuleView({ agentId }: { agentId: string }) {
  const [capsuleId, setCapsuleId] = useState<string | null>(null);
  const [surface, setSurface] = useState<ToolUISurface | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  // Create capsule when component mounts
  useEffect(() => {
    const createCapsule = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // Call API to create capsule
        const response = await fetch('/api/mcp-apps/capsules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agentId,
            surface: {
              type: 'custom',
              html: `
                <div class="capsule-container">
                  <h2>Agent Interactive Capsule</h2>
                  <p>Agent ID: ${agentId}</p>
                  <div class="actions">
                    <button onclick="a2r.emitEvent('ping', { time: Date.now() })">Send Ping</button>
                    <button onclick="testTool()">Test Tool</button>
                  </div>
                  <div id="output"></div>
                </div>
              `,
              css: `
                .capsule-container {
                  padding: 20px;
                  font-family: system-ui, sans-serif;
                }
                h2 { color: var(--text-primary); margin-bottom: 10px; }
                .actions {
                  display: flex;
                  gap: 10px;
                  margin: 15px 0;
                }
                button {
                  padding: 8px 16px;
                  background: #007acc;
                  color: white;
                  border: none;
                  border-radius: 4px;
                  cursor: pointer;
                }
                button:hover {
                  background: #005fa3;
                }
                #output {
                  padding: 10px;
                  background: #f5f5f5;
                  border-radius: 4px;
                  min-height: 100px;
                  white-space: pre-wrap;
                }
              `,
              js: `
                function testTool() {
                  a2r.invokeTool('agent.status', { agentId: '${agentId}' })
                    .then(result => {
                      document.getElementById('output').textContent = 
                        'Tool result: ' + JSON.stringify(result, null, 2);
                    })
                    .catch(err => {
                      document.getElementById('output').textContent = 
                        'Error: ' + err.message;
                    });
                }
                
                // Subscribe to state updates
                a2r.subscribe((state) => {
                  console.log('State updated:', state);
                });
                
                document.getElementById('output').textContent = 
                  'Capsule initialized. Agent ID: ${agentId}';
              `,
              props: {
                agentId,
              },
            },
            permissions: ['agent:read', 'agent:write'],
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to create capsule: ${response.status}`);
        }

        const data = await response.json();
        setCapsuleId(data.capsuleId);
        setSurface(data.surface);
        addLog(`Capsule created: ${data.capsuleId}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create capsule');
        addLog(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
      } finally {
        setIsLoading(false);
      }
    };

    createCapsule();

    // Cleanup: delete capsule on unmount
    return () => {
      if (capsuleId) {
        fetch(`/api/mcp-apps/capsules/${capsuleId}`, { method: 'DELETE' })
          .then(() => addLog(`Capsule deleted: ${capsuleId}`))
          .catch(err => addLog(`Delete error: ${err.message}`));
      }
    };
  }, [agentId]);

  const addLog = (message: string) => {
    setLogs(prev => [...prev.slice(-49), `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  const handleEvent = (event: CapsuleEvent) => {
    addLog(`Event: ${event.type} - ${JSON.stringify(event.payload)}`);
  };

  const handleToolInvoke = async (toolName: string, params: unknown) => {
    addLog(`Tool invoked: ${toolName}(${JSON.stringify(params)})`);
    
    // Simulate tool invocation - in production this would call the actual tool
    switch (toolName) {
      case 'agent.status':
        return { status: 'active', agentId };
      case 'agent.execute':
        return { success: true, result: 'Task executed' };
      default:
        return { error: `Unknown tool: ${toolName}` };
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2">Initializing capsule...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <Alert variant="destructive">
          <AlertCircle className="w-4 h-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex h-full gap-4">
      {/* Capsule Frame */}
      <div className="flex-1 min-w-0">
        {capsuleId && surface ? (
          <CapsuleFrame
            capsuleId={capsuleId}
            surface={surface}
            onEvent={handleEvent}
            onToolInvoke={handleToolInvoke}
            className="h-full"
          />
        ) : (
          <EmptyTabState message="No capsule active. Create one to start interacting." />
        )}
      </div>

      {/* Debug Panel */}
      <div className="w-80 border-l p-4 space-y-4">
        <h3 className="font-medium flex items-center gap-2">
          <Activity className="w-4 h-4" />
          Event Log
        </h3>
        <ScrollArea className="h-[400px] border rounded p-2">
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No events yet...</p>
          ) : (
            <div className="space-y-1">
              {logs.map((log, i) => (
                <div key={i} className="text-xs font-mono text-muted-foreground">
                  {log}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Capsule Info</h4>
          <div className="text-xs text-muted-foreground space-y-1">
            <div>ID: {capsuleId || 'N/A'}</div>
            <div>Agent: {agentId}</div>
          </div>
        </div>
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => setLogs([])}
          className="w-full"
        >
          Clear Logs
        </Button>
      </div>
    </div>
  );
}

// ============================================================================
// Utilities
// ============================================================================

function getStatusColor(status: string): string {
  switch (status) {
    case 'running':
      return 'bg-yellow-500';
    case 'completed':
      return 'bg-green-500';
    case 'failed':
    case 'error':
      return 'bg-red-500';
    case 'paused':
      return 'bg-orange-500';
    case 'idle':
    case 'pending':
      return 'bg-white/30';
    default:
      return 'bg-white/20';
  }
}
