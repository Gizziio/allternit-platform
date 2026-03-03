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
import { AgentAvatar } from "@/components/avatar";
import type { AvatarConfig } from "@/lib/agents/character.types";
import { createDefaultAvatarConfig } from "@/lib/agents/character.types";
import { AvatarCreatorStep } from "./agent-creation/AvatarCreatorStep";
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
  AppWindow,
  Search,
  Terminal
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
      <div className="h-full w-full">
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
      </div>
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
    return (
      <div className="h-full w-full">
        <EditAgentForm agent={agent} onCancel={() => setIsEditing(null)} />
      </div>
    );
  }

  if (viewMode === 'detail' && selectedAgentId) {
    return (
      <div className="h-full w-full">
        <AgentDetailView agentId={selectedAgentId} />
      </div>
    );
  }

  // Default: Agent List View
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      width: '100%',
      background: STUDIO_THEME.bg,
      overflow: 'hidden',
      position: 'relative'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 24px',
        borderBottom: `1px solid ${STUDIO_THEME.borderSubtle}`,
        background: STUDIO_THEME.bg,
        flexShrink: 0
      }}>
        <div>
          <h1 style={{
            fontSize: '20px',
            fontWeight: 600,
            color: STUDIO_THEME.textPrimary,
            margin: 0,
            fontFamily: 'Georgia, serif'
          }}>
            Agent Studio
          </h1>
          <p style={{
            fontSize: '13px',
            color: STUDIO_THEME.textSecondary,
            margin: '4px 0 0 0'
          }}>
            Create, manage, and orchestrate autonomous AI agents
          </p>
        </div>
        
        <button 
          onClick={() => setIsCreating(true)}
          style={{
            padding: '8px 16px',
            borderRadius: '6px',
            background: `linear-gradient(to right, ${STUDIO_THEME.accent}, #B08D6E)`,
            color: '#1A1612',
            fontSize: '14px',
            fontWeight: 600,
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <Plus style={{ width: 16, height: 16 }} />
          Create Agent
        </button>
      </div>

      {/* Scrollable Content */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        overflowX: 'hidden',
        minHeight: 0,
        position: 'relative'
      }}>
        {error && error !== 'API_OFFLINE' && (
          <Alert variant="destructive" className="mb-4 bg-red-900/50 border-red-500/50">
            <AlertCircle className="h-4 w-4 text-red-400" />
            <AlertDescription className="text-red-200">{error}</AlertDescription>
          </Alert>
        )}

        {error === 'API_OFFLINE' && (
          <Alert className="mb-4 bg-amber-900/30 border-amber-500/30">
            <AlertCircle className="h-4 w-4 text-amber-400" />
            <AlertDescription className="text-amber-200">
              API service is offline. Start it with: <code className="bg-amber-900/50 px-2 py-0.5 rounded text-amber-300">cd 6-apps/api && cargo run</code>
            </AlertDescription>
          </Alert>
        )}

        {isLoadingAgents ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
          </div>
        ) : agents.length === 0 ? (
          <EmptyAgentState 
            onCreate={() => setIsCreating(true)} 
            onCreateFromTemplate={(template) => {
              // Store template in session storage for the create form to pick up
              sessionStorage.setItem('agentTemplate', JSON.stringify(template));
              setIsCreating(true);
            }}
          />
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
            gap: '16px',
            padding: '8px'
          }}>
            {agents.map((agent, index) => (
              <motion.div
                key={agent.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05, duration: 0.3 }}
              >
                <AgentCard 
                  agent={agent} 
                  onClick={() => selectAgent(agent.id)}
                />
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Agent Card Component - Polished with inline styles
// ============================================================================

function AgentCard({ agent, onClick }: { agent: Agent; onClick: () => void }) {
  const [isHovered, setIsHovered] = useState(false);
  const statusColor = getStatusColor(agent.status);
  const blueprint = parseCharacterBlueprint(agent.config);
  const setupId = blueprint?.setup || "generalist";
  const setupMeta = CHARACTER_SETUPS.find((setup) => setup.id === setupId) || null;
  const agentCharacterStats = useAgentStore((state) => state.characterStats[agent.id]);
  const loadCharacterLayer = useAgentStore((state) => state.loadCharacterLayer);

  // Get avatar config from agent config or use default
  const avatarConfig = (agent.config?.avatar as AvatarConfig) || createDefaultAvatarConfig(setupId);

  useEffect(() => {
    if (!agentCharacterStats) {
      void loadCharacterLayer(agent.id);
    }
  }, [agent.id, agentCharacterStats, loadCharacterLayer]);
  
  const getTypeIcon = () => {
    switch (agent.type) {
      case 'orchestrator': return <Network style={{ width: 14, height: 14 }} />;
      case 'worker': return <Cog style={{ width: 14, height: 14 }} />;
      default: return <Bot style={{ width: 14, height: 14 }} />;
    }
  };
  
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

  const statusColors: Record<string, string> = {
    'online': '#22c55e',
    'offline': '#6b7280',
    'busy': '#f59e0b',
    'error': '#ef4444'
  };
  
  return (
    <motion.div
      onClick={onClick}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      style={{
        cursor: 'pointer',
        borderRadius: '12px',
        border: `1px solid ${isHovered ? `${STUDIO_THEME.accent}50` : STUDIO_THEME.borderSubtle}`,
        background: STUDIO_THEME.bgCard,
        overflow: 'hidden',
        boxShadow: isHovered ? '0 8px 24px rgba(0,0,0,0.3)' : '0 2px 8px rgba(0,0,0,0.1)',
        transition: 'all 0.3s ease'
      }}
    >
      <div style={{ padding: '16px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
            {/* Avatar */}
            <div style={{
              width: '44px',
              height: '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              position: 'relative'
            }}>
              <AgentAvatar 
                config={avatarConfig}
                size={44}
                emotion="steady"
                isAnimating={isHovered}
              />
              {/* Status indicator */}
              <div style={{
                position: 'absolute',
                bottom: '-2px',
                right: '-2px',
                width: '14px',
                height: '14px',
                borderRadius: '50%',
                background: statusColors[agent.status] || '#6b7280',
                border: `2px solid ${STUDIO_THEME.bgCard}`
              }} />
            </div>
            
            {/* Name & Type */}
            <div style={{ minWidth: 0, flex: 1 }}>
              <h3 style={{
                fontSize: '16px',
                fontWeight: 600,
                color: isHovered ? STUDIO_THEME.accent : STUDIO_THEME.textPrimary,
                margin: '0 0 6px 0',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                transition: 'color 0.2s ease'
              }}>
                {agent.name}
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 8px',
                  borderRadius: '999px',
                  background: `${STUDIO_THEME.accent}15`,
                  color: STUDIO_THEME.accent,
                  fontSize: '11px',
                  fontWeight: 500,
                  border: `1px solid ${STUDIO_THEME.accent}25`
                }}>
                  {getTypeIcon()}
                  {getTypeLabel()}
                </span>
                {setupMeta && (
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: '999px',
                    background: 'rgba(255,255,255,0.06)',
                    color: STUDIO_THEME.textSecondary,
                    fontSize: '11px',
                    fontWeight: 500
                  }}>
                    {setupMeta.label}
                  </span>
                )}
                {agentCharacterStats && (
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: '999px',
                    background: 'rgba(59, 130, 246, 0.15)',
                    color: '#60a5fa',
                    fontSize: '11px',
                    fontWeight: 500
                  }}>
                    Lv{agentCharacterStats.level}
                  </span>
                )}
              </div>
            </div>
          </div>
          
          {/* Voice indicator */}
          {agent.voice?.enabled && (
            <div style={{
              padding: '4px 8px',
              borderRadius: '999px',
              background: `${STUDIO_THEME.accent}15`,
              border: `1px solid ${STUDIO_THEME.accent}25`,
              display: 'flex',
              alignItems: 'center'
            }}>
              <Volume2 style={{ width: 14, height: 14, color: STUDIO_THEME.accent }} />
            </div>
          )}
        </div>
        
        {/* Description */}
        <p style={{
          fontSize: '14px',
          color: STUDIO_THEME.textSecondary,
          margin: '12px 0 0 0',
          lineHeight: 1.5,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden'
        }}>
          {agent.description || "No description provided"}
        </p>
        
        {/* Skills */}
        {blueprint && blueprint.specialtySkills.length > 0 && (
          <div style={{
            marginTop: '12px',
            padding: '10px',
            borderRadius: '8px',
            background: 'rgba(0,0,0,0.2)',
            border: `1px solid ${STUDIO_THEME.borderSubtle}`
          }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {blueprint.specialtySkills.slice(0, 3).map((skill) => (
                <span key={skill} style={{
                  padding: '3px 10px',
                  borderRadius: '6px',
                  background: `${STUDIO_THEME.accent}15`,
                  color: STUDIO_THEME.accent,
                  fontSize: '12px',
                  fontWeight: 500
                }}>
                  {skill}
                  {typeof agentCharacterStats?.specialtyScores?.[skill] === "number" && (
                    <span style={{ marginLeft: '4px', opacity: 0.7 }}>
                      {agentCharacterStats.specialtyScores[skill]}
                    </span>
                  )}
                </span>
              ))}
              {blueprint.specialtySkills.length > 3 && (
                <span style={{
                  padding: '3px 10px',
                  borderRadius: '6px',
                  background: 'rgba(255,255,255,0.06)',
                  color: STUDIO_THEME.textMuted,
                  fontSize: '12px'
                }}>
                  +{blueprint.specialtySkills.length - 3}
                </span>
              )}
            </div>
          </div>
        )}
        
        {/* Stats */}
        {agentCharacterStats && previewStatDefinitions.length > 0 && (
          <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {previewStatDefinitions.map((definition) => (
              <div key={definition.key} style={{
                padding: '8px 10px',
                borderRadius: '6px',
                background: 'rgba(0,0,0,0.2)',
                border: `1px solid ${STUDIO_THEME.borderSubtle}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <span style={{ fontSize: '12px', color: STUDIO_THEME.textSecondary }}>
                  {definition.label}
                </span>
                <span style={{ fontSize: '12px', fontWeight: 600, color: STUDIO_THEME.textPrimary }}>
                  {agentCharacterStats.stats[definition.key] ?? 0}
                </span>
              </div>
            ))}
          </div>
        )}
        
        {/* Capabilities */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '12px' }}>
          {agent.capabilities.slice(0, 3).map(cap => (
            <span key={cap} style={{
              padding: '3px 10px',
              borderRadius: '6px',
              background: 'rgba(255,255,255,0.06)',
              color: STUDIO_THEME.textSecondary,
              fontSize: '12px',
              border: `1px solid ${STUDIO_THEME.borderSubtle}`
            }}>
              {cap}
            </span>
          ))}
          {agent.capabilities.length > 3 && (
            <span style={{
              padding: '3px 10px',
              borderRadius: '6px',
              background: 'transparent',
              color: STUDIO_THEME.textMuted,
              fontSize: '12px',
              border: `1px solid ${STUDIO_THEME.borderSubtle}`
            }}>
              +{agent.capabilities.length - 3}
            </span>
          )}
        </div>
      </div>
      
      {/* Footer */}
      <div style={{
        padding: '12px 16px',
        borderTop: `1px solid ${STUDIO_THEME.borderSubtle}`,
        background: 'rgba(0,0,0,0.15)'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '12px',
          color: STUDIO_THEME.textMuted
        }}>
          <Clock style={{ width: 14, height: 14 }} />
          Last run: {agent.lastRunAt ? formatRelativeTime(agent.lastRunAt) : 'Never'}
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================================
// Agent Template Types
// ============================================================================

interface AgentTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  setup: AgentSetup;
  capabilities: string[];
  systemPrompt: string;
  color: string;
}

const AGENT_TEMPLATES: AgentTemplate[] = [
  {
    id: 'code-assistant',
    name: 'Code Assistant',
    description: 'Expert in software development, code review, and debugging',
    icon: <Terminal className="w-6 h-6" />,
    setup: 'coding',
    capabilities: ['code-generation', 'file-operations', 'terminal', 'planning', 'reasoning'],
    systemPrompt: 'You are an expert software developer. Help users write, review, and debug code. Always follow best practices and provide clear explanations.',
    color: '#3B82F6',
  },
  {
    id: 'research-analyst',
    name: 'Research Analyst',
    description: 'Gathers information, analyzes data, and synthesizes reports',
    icon: <Search className="w-6 h-6" />,
    setup: 'research',
    capabilities: ['web-search', 'memory', 'reasoning', 'planning', 'api-integration'],
    systemPrompt: 'You are a thorough research analyst. Help users gather information, analyze data, and create comprehensive reports with proper citations.',
    color: '#10B981',
  },
  {
    id: 'creative-writer',
    name: 'Creative Writer',
    description: 'Creates engaging content, stories, and marketing copy',
    icon: <Sparkles className="w-6 h-6" />,
    setup: 'creative',
    capabilities: ['planning', 'reasoning', 'memory', 'web-search'],
    systemPrompt: 'You are a creative writer. Help users craft engaging content, stories, and copy. Be imaginative while maintaining clarity and purpose.',
    color: '#F59E0B',
  },
  {
    id: 'operations-manager',
    name: 'Ops Manager',
    description: 'Handles deployments, monitoring, and infrastructure tasks',
    icon: <Settings className="w-6 h-6" />,
    setup: 'operations',
    capabilities: ['terminal', 'file-operations', 'planning', 'reasoning', 'database'],
    systemPrompt: 'You are an operations manager. Help users with deployments, monitoring, and infrastructure. Prioritize safety and always confirm before making changes.',
    color: '#EF4444',
  },
];

// ============================================================================
// Empty State - Matching ChatView Style
// ============================================================================

export const STUDIO_THEME = {
  bg: '#2B2520',
  bgCard: '#352F29',
  textPrimary: '#ECECEC',
  textSecondary: '#9B9B9B',
  textMuted: '#6B6B6B',
  accent: '#D4956A',
  borderSubtle: 'rgba(255,255,255,0.06)',
};

interface EmptyAgentStateProps {
  onCreate: () => void;
  onCreateFromTemplate?: (template: AgentTemplate) => void;
}

function EmptyAgentState({ onCreate, onCreateFromTemplate }: EmptyAgentStateProps) {
  const [showTemplates, setShowTemplates] = useState(false);

  const handleTemplateClick = (template: AgentTemplate) => {
    if (onCreateFromTemplate) {
      onCreateFromTemplate(template);
    } else {
      sessionStorage.setItem('agentTemplate', JSON.stringify(template));
      onCreate();
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      width: '100%',
      maxWidth: '640px',
      minHeight: 'calc(100vh - 200px)',
      padding: '48px 24px',
      boxSizing: 'border-box',
      margin: '0 auto'
    }}>
      {/* Logo/Icon Section */}
      <div style={{ marginBottom: '48px', textAlign: 'center' }}>
        <div style={{
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          background: `linear-gradient(135deg, ${STUDIO_THEME.accent}20, ${STUDIO_THEME.accent}10)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 24px auto',
          border: `1px solid ${STUDIO_THEME.accent}30`
        }}>
          <Bot style={{ width: 40, height: 40, color: STUDIO_THEME.accent }} />
        </div>
        
        <h1 style={{
          fontSize: '42px',
          fontWeight: 500,
          color: STUDIO_THEME.textPrimary,
          margin: '0 0 16px 0',
          fontFamily: 'Georgia, serif',
          letterSpacing: '-0.02em'
        }}>
          Agent Studio
        </h1>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', justifyContent: 'center', marginBottom: '32px' }}>
          <div style={{ height: '1px', width: '32px', background: STUDIO_THEME.borderSubtle }} />
          <p style={{
            fontSize: '14px',
            color: STUDIO_THEME.textSecondary,
            margin: 0,
            textTransform: 'uppercase',
            letterSpacing: '0.15em'
          }}>
            Create & Manage AI Agents
          </p>
          <div style={{ height: '1px', width: '32px', background: STUDIO_THEME.borderSubtle }} />
        </div>
        
        <p style={{
          fontSize: '16px',
          color: STUDIO_THEME.textSecondary,
          textAlign: 'center',
          maxWidth: '480px',
          lineHeight: 1.6,
          margin: '0 auto'
        }}>
          Create AI agents to automate tasks, assist with coding, conduct research, and more.
        </p>
      </div>

      {/* Primary Actions */}
      <div style={{
        display: 'flex',
        flexDirection: 'row',
        gap: '12px',
        marginBottom: '48px',
        justifyContent: 'center'
      }}>
        <button 
          onClick={onCreate}
          style={{
            padding: '12px 24px',
            borderRadius: '8px',
            background: `linear-gradient(to right, ${STUDIO_THEME.accent}, #B08D6E)`,
            color: '#1A1612',
            fontSize: '15px',
            fontWeight: 600,
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
          }}
        >
          <Plus style={{ width: 18, height: 18 }} />
          Create Custom Agent
        </button>
        
        <button 
          onClick={() => setShowTemplates(!showTemplates)}
          style={{
            padding: '12px 24px',
            borderRadius: '8px',
            background: 'transparent',
            color: STUDIO_THEME.textPrimary,
            fontSize: '15px',
            fontWeight: 500,
            border: `1px solid ${STUDIO_THEME.borderSubtle}`,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Sparkles style={{ width: 18, height: 18 }} />
          {showTemplates ? 'Hide Templates' : 'Quick Start'}
        </button>
      </div>

      {/* Templates Section */}
      {showTemplates && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ width: '100%', marginBottom: '48px' }}
        >
          <h4 style={{
            fontSize: '18px',
            fontWeight: 600,
            color: STUDIO_THEME.textPrimary,
            marginBottom: '8px',
            textAlign: 'center'
          }}>
            Choose a Template
          </h4>
          <p style={{
            fontSize: '14px',
            color: STUDIO_THEME.textSecondary,
            textAlign: 'center',
            marginBottom: '24px'
          }}>
            Start with a pre-configured agent
          </p>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '12px'
          }}>
            {AGENT_TEMPLATES.map((template) => (
              <button
                key={template.id}
                onClick={() => handleTemplateClick(template)}
                style={{
                  padding: '16px',
                  borderRadius: '12px',
                  background: STUDIO_THEME.bgCard,
                  border: `1px solid ${STUDIO_THEME.borderSubtle}`,
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}
              >
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '8px',
                  backgroundColor: `${template.color}20`,
                  color: template.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  {template.icon}
                </div>
                <div>
                  <h5 style={{
                    fontSize: '15px',
                    fontWeight: 600,
                    color: STUDIO_THEME.textPrimary,
                    margin: '0 0 4px 0'
                  }}>
                    {template.name}
                  </h5>
                  <p style={{
                    fontSize: '13px',
                    color: STUDIO_THEME.textSecondary,
                    margin: 0,
                    lineHeight: 1.4
                  }}>
                    {template.description}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Features */}
      <div style={{
        width: '100%',
        borderTop: `1px solid ${STUDIO_THEME.borderSubtle}`,
        paddingTop: '32px'
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'row',
          gap: '24px',
          justifyContent: 'center'
        }}>
          {[
            { icon: <Cog style={{ width: 16, height: 16, color: STUDIO_THEME.accent }} />, title: 'Customizable', desc: 'Configure capabilities' },
            { icon: <Network style={{ width: 16, height: 16, color: STUDIO_THEME.accent }} />, title: 'Multi-Agent', desc: 'Orchestrator support' },
            { icon: <Shield style={{ width: 16, height: 16, color: STUDIO_THEME.accent }} />, title: 'Secure', desc: 'Built-in guardrails' },
          ].map((feature, i) => (
            <div key={i} style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              flex: 1
            }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: `${STUDIO_THEME.accent}15`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                {feature.icon}
              </div>
              <div>
                <h6 style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  color: STUDIO_THEME.textPrimary,
                  margin: '0 0 2px 0'
                }}>
                  {feature.title}
                </h6>
                <p style={{
                  fontSize: '12px',
                  color: STUDIO_THEME.textMuted,
                  margin: 0
                }}>
                  {feature.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
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
    id: "avatar",
    label: "Avatar",
    description: "Visual appearance and style.",
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
  
  // Avatar state
  const [avatarConfig, setAvatarConfig] = useState<AvatarConfig>(() => 
    createDefaultAvatarConfig(blueprint.setup)
  );
  
  // Update avatar when setup changes
  useEffect(() => {
    setAvatarConfig(createDefaultAvatarConfig(blueprint.setup));
  }, [blueprint.setup]);

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
        avatar: avatarConfig,
      },
      avatar: avatarConfig,
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
      case 'orchestrator': return <Network style={{ width: 20, height: 20, color: STUDIO_THEME.textPrimary }} />;
      case 'worker': return <Cog style={{ width: 20, height: 20, color: STUDIO_THEME.textPrimary }} />;
      default: return <Bot style={{ width: 20, height: 20, color: STUDIO_THEME.textPrimary }} />;
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
    background: STUDIO_THEME.bg,
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '24px',
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

  const badgeStyle = (isSelected: boolean): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '6px 12px',
    borderRadius: '16px',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    border: `1px solid ${isSelected ? STUDIO_THEME.accent : STUDIO_THEME.borderSubtle}`,
    background: isSelected ? `${STUDIO_THEME.accent}20` : 'transparent',
    color: isSelected ? STUDIO_THEME.accent : STUDIO_THEME.textSecondary,
    transition: 'all 0.2s ease',
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

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <div>
          <h1 style={titleStyle}>Create New Agent</h1>
          <p style={subtitleStyle}>Configure your AI agent with voice, type, and capabilities</p>
        </div>
        <button onClick={onCancel} style={secondaryButtonStyle}>Cancel</button>
      </div>

      {error && (
        <div style={alertErrorStyle}>
          <AlertCircle style={{ width: 16, height: 16 }} />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ maxWidth: '900px', flex: 1, minHeight: 0 }}>
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
                  <p style={stepDescriptionStyle}>{step.description}</p>
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
                  key={i}
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
                    <Bot style={{ width: 48, height: 48, color: '#fff' }} />
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
                  icon: Sparkles, 
                  title: "Define Personality", 
                  desc: "Configure creativity, verbosity, and temperament to match your workflow." 
                },
                { 
                  icon: Settings, 
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
              {[...Array(6)].map((_, i) => (
                <motion.div
                  key={i}
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
                <Sparkles style={{ width: 20, height: 20, color: STUDIO_THEME.accent }} />
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
                <Sparkles style={{ width: 20, height: 20, color: STUDIO_THEME.accent }} />
                Personality Settings
              </h2>
              <p style={sectionSubtitleStyle}>
                Fine-tune how your agent thinks and communicates.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <Label style={{ color: STUDIO_THEME.textPrimary }}>
                    Creativity: {((formData.config as { personality?: { creativity?: number; verbosity?: number } })?.personality?.creativity ?? 50)}%
                  </Label>
                  <span style={{ fontSize: '12px', color: STUDIO_THEME.textSecondary }}>
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
                <p style={{ fontSize: '12px', color: STUDIO_THEME.textMuted, marginTop: '8px' }}>
                  Lower values produce more predictable responses. Higher values encourage creative problem-solving.
                </p>
              </div>

              <div style={{ height: 1, background: STUDIO_THEME.borderSubtle }} />

              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <Label style={{ color: STUDIO_THEME.textPrimary }}>
                    Verbosity: {((formData.config as { personality?: { creativity?: number; verbosity?: number } })?.personality?.verbosity ?? 50)}%
                  </Label>
                  <span style={{ fontSize: '12px', color: STUDIO_THEME.textSecondary }}>
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
                <p style={{ fontSize: '12px', color: STUDIO_THEME.textMuted, marginTop: '8px' }}>
                  Controls response length. Lower values for brief answers, higher values for thorough explanations.
                </p>
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
                  <Sparkles style={{ width: 20, height: 20, color: STUDIO_THEME.accent }} />
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

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
              <div style={formSectionStyle}>
                <h3 style={{ fontSize: '16px', fontWeight: 600, color: STUDIO_THEME.textPrimary, margin: '0 0 16px 0' }}>Specialty Skills</h3>
                <p style={{ fontSize: '13px', color: STUDIO_THEME.textSecondary, margin: '0 0 12px 0' }}>Select up to 4 specialties.</p>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <Label style={{ color: STUDIO_THEME.textPrimary }}>Specialties</Label>
                  <span style={{
                    fontSize: '11px',
                    padding: '2px 8px',
                    borderRadius: '10px',
                    background: STUDIO_THEME.bg,
                    color: STUDIO_THEME.textSecondary,
                  }}>
                    {blueprint.specialtySkills.length}/4 selected
                  </span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                  {getSpecialtyOptions(blueprint.setup).map((skill) => {
                    const selected = blueprint.specialtySkills.includes(skill);
                    return (
                      <span
                        key={skill}
                        style={badgeStyle(selected)}
                        onClick={() => toggleSpecialty(skill)}
                      >
                        {selected && <CheckCircle style={{ width: 12, height: 12 }} />}
                        {skill}
                      </span>
                    );
                  })}
                </div>
                {blueprint.specialtySkills.length === 0 && (
                  <p style={{ fontSize: '12px', color: '#f59e0b' }}>
                    Select at least one specialty to project measurable skills.
                  </p>
                )}
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
          <section style={{ minHeight: 0 }}>
            <div style={{ marginBottom: '24px' }}>
              <h2 style={sectionTitleStyle}>
                <Sparkles style={{ width: 20, height: 20, color: STUDIO_THEME.accent }} />
                Avatar Customization
              </h2>
              <p style={sectionSubtitleStyle}>
                Design your agent's visual appearance and personality.
              </p>
            </div>
            
            <div style={{ height: '600px', minHeight: '500px' }}>
              <AvatarCreatorStep
                agentSetup={blueprint.setup}
                agentTemperament={blueprint.temperament}
                onAvatarChange={(config) => setAvatarConfig(config as AvatarConfig)}
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
                  <Settings style={{ width: 20, height: 20, color: STUDIO_THEME.accent }} />
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
                  <Bot style={{ width: 18, height: 18, color: STUDIO_THEME.accent }} />
                  Model Configuration
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '20px' }}>
                  <div>
                    <label style={inputLabelStyle}>Model</label>
                    <Select
                      value={formData.model}
                      onValueChange={(value) => setFormData((prev) => ({ ...prev, model: value }))}
                    >
                      <SelectTrigger style={{
                        background: STUDIO_THEME.bg,
                        border: `1px solid ${STUDIO_THEME.borderSubtle}`,
                        color: STUDIO_THEME.textPrimary,
                      }}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent style={{ background: STUDIO_THEME.bgCard, border: `1px solid ${STUDIO_THEME.borderSubtle}` }}>
                        {AGENT_MODELS.map((model) => (
                          <SelectItem key={model.id} value={model.id}>
                            {model.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                      }}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent style={{ background: STUDIO_THEME.bgCard, border: `1px solid ${STUDIO_THEME.borderSubtle}` }}>
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
                      <Volume2 style={{ width: 20, height: 20, color: '#22c55e' }} />
                    ) : (
                      <VolumeX style={{ width: 20, height: 20, color: STUDIO_THEME.textMuted }} />
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
                          disabled={voiceLoading}
                        >
                          <SelectTrigger style={{
                            flex: 1,
                            background: STUDIO_THEME.bg,
                            border: `1px solid ${STUDIO_THEME.borderSubtle}`,
                            color: STUDIO_THEME.textPrimary,
                          }}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent style={{ background: STUDIO_THEME.bgCard, border: `1px solid ${STUDIO_THEME.borderSubtle}` }}>
                            {voices.map((voice) => (
                              <SelectItem key={voice.id} value={voice.id}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span
                                    style={{
                                      width: 8,
                                      height: 8,
                                      borderRadius: '50%',
                                      background: voice.engine === "chatterbox"
                                        ? "#3b82f6"
                                        : voice.engine === "xtts_v2"
                                        ? "#a855f7"
                                        : "#22c55e",
                                    }}
                                  />
                                  {voice.label}
                                  {!voice.assetReady && " (download required)"}
                                </span>
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
                            <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} />
                          ) : (
                            <Play style={{ width: 16, height: 16 }} />
                          )}
                        </button>
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
                  <Settings style={{ width: 18, height: 18, color: STUDIO_THEME.accent }} />
                  Capabilities
                </h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {AGENT_CAPABILITIES.map((cap) => (
                    <span
                      key={cap.id}
                      style={badgeStyle(formData.capabilities?.includes(cap.id) || false)}
                      onClick={() => toggleCapability(cap.id)}
                    >
                      {formData.capabilities?.includes(cap.id) && (
                        <CheckCircle style={{ width: 12, height: 12 }} />
                      )}
                      {cap.name}
                    </span>
                  ))}
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
                    <Bot style={{ width: 18, height: 18, color: STUDIO_THEME.accent }} />
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
                <Textarea
                  id="systemPrompt"
                  value={formData.systemPrompt}
                  onChange={(e) => setFormData((prev) => ({ ...prev, systemPrompt: e.target.value }))}
                  placeholder="Instructions for the agent..."
                  rows={6}
                  style={{
                    background: STUDIO_THEME.bg,
                    border: `1px solid ${STUDIO_THEME.borderSubtle}`,
                    color: STUDIO_THEME.textPrimary,
                    fontFamily: 'monospace',
                    fontSize: '13px',
                  }}
                />
                <p style={{ fontSize: '12px', color: STUDIO_THEME.textMuted, marginTop: '8px' }}>
                  Define behavior constraints and runtime expectations. Load from file or choose a template to get started.
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
                  
                  {(() => {
                    const personality = (formData.config as { personality?: { creativity?: number; verbosity?: number } })?.personality;
                    if (!personality || (personality.creativity === undefined && personality.verbosity === undefined)) return null;
                    return (
                      <div style={{ marginBottom: '16px' }}>
                        <label style={{
                          fontSize: '11px',
                          textTransform: 'uppercase',
                          letterSpacing: '0.05em',
                          color: STUDIO_THEME.textMuted,
                          marginBottom: '8px',
                          display: 'block',
                        }}>Personality</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                          {personality.creativity !== undefined && (
                            <span style={{
                              fontSize: '11px',
                              padding: '4px 10px',
                              borderRadius: '10px',
                              border: `1px solid ${STUDIO_THEME.borderSubtle}`,
                              color: STUDIO_THEME.textSecondary,
                            }}>
                              Creativity: {personality.creativity}%
                            </span>
                          )}
                          {personality.verbosity !== undefined && (
                            <span style={{
                              fontSize: '11px',
                              padding: '4px 10px',
                              borderRadius: '10px',
                              border: `1px solid ${STUDIO_THEME.borderSubtle}`,
                              color: STUDIO_THEME.textSecondary,
                            }}>
                              Verbosity: {personality.verbosity}%
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })()}

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
                      {cardSeed.hardBanCategories.map((category) => (
                        <span key={category} style={{
                          fontSize: '11px',
                          padding: '4px 10px',
                          borderRadius: '10px',
                          background: 'rgba(239, 68, 68, 0.15)',
                          color: '#ef4444',
                        }}>
                          {category}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div style={{
                  padding: '20px',
                  borderRadius: '12px',
                  border: `1px solid ${STUDIO_THEME.borderSubtle}`,
                  background: STUDIO_THEME.bg,
                }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, color: STUDIO_THEME.textPrimary, margin: '0 0 8px 0' }}>Projected Stats</h3>
                  <p style={{ fontSize: '13px', color: STUDIO_THEME.textSecondary, margin: '0 0 16px 0' }}>Derived from setup telemetry model.</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {projectedStatEntries.map((entry) => (
                      <div key={entry.key}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ fontSize: '12px', color: STUDIO_THEME.textSecondary }}>
                            {entry.definition?.label || entry.key} ({entry.key})
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
                        <div style={{ fontSize: '10px', color: STUDIO_THEME.textMuted, marginTop: '2px', fontFamily: 'monospace' }}>
                          {projectedFormulaByKey[entry.key] || ""}
                        </div>
                      </div>
                    ))}
                    <div style={{
                      padding: '10px',
                      borderRadius: '6px',
                      border: `1px solid ${STUDIO_THEME.borderSubtle}`,
                      background: STUDIO_THEME.bgCard,
                      fontSize: '12px',
                      color: STUDIO_THEME.textSecondary,
                    }}>
                      XP {projectedStats.xp.toFixed(2)} from setup baseline + selected specialties + temperament.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}
          </motion.div>
        </AnimatePresence>

        {/* Sticky Footer */}
        <div style={stickyFooterStyle}>
          <div style={{ fontSize: '12px', color: STUDIO_THEME.textSecondary }}>
            {!stepValidation[activeStep]
              ? "Complete required fields in this step to continue."
              : activeStep === "review"
              ? "All checks passed. Forge will animate and compile the character layer."
              : "Step complete. Continue to the next stage."}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              type="button"
              onClick={goToPreviousStep}
              disabled={activeStepIndex <= 0 || isCreating}
              style={{
                ...secondaryButtonStyle,
                opacity: activeStepIndex <= 0 || isCreating ? 0.5 : 1,
                cursor: activeStepIndex <= 0 || isCreating ? 'not-allowed' : 'pointer',
              }}
            >
              Back
            </button>
            {activeStep !== "review" ? (
              <button
                type="button"
                onClick={goToNextStep}
                disabled={!stepValidation[activeStep] || isCreating}
                style={{
                  ...primaryButtonStyle,
                  opacity: !stepValidation[activeStep] || isCreating ? 0.5 : 1,
                  cursor: !stepValidation[activeStep] || isCreating ? 'not-allowed' : 'pointer',
                }}
              >
                Next: {CREATE_FLOW_STEPS[activeStepIndex + 1]?.label || "Review"}
              </button>
            ) : (
              <button
                type="submit"
                disabled={isCreating || !isReadyForCreate}
                style={{
                  ...primaryButtonStyle,
                  padding: '12px 24px',
                  opacity: isCreating || !isReadyForCreate ? 0.5 : 1,
                  cursor: isCreating || !isReadyForCreate ? 'not-allowed' : 'pointer',
                }}
              >
                {isCreating ? (
                  <>
                    <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} />
                    Creating...
                  </>
                ) : (
                  <>
                    <Bot style={{ width: 16, height: 16 }} />
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
// Agent Detail View - STUDIO_THEME Styling
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
  
  // Get avatar config
  const blueprint = parseCharacterBlueprint(agent?.config);
  const setupId = blueprint?.setup || "generalist";
  const avatarConfig = (agent?.config?.avatar as AvatarConfig) || createDefaultAvatarConfig(setupId);
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

  const statusColors: Record<string, string> = {
    'online': '#22c55e',
    'offline': '#6b7280',
    'busy': '#f59e0b',
    'error': '#ef4444',
    'running': '#f59e0b',
    'completed': '#22c55e',
    'failed': '#ef4444',
    'idle': '#9B9B9B',
    'pending': '#9B9B9B',
  };

  return (
    <div style={{ display: 'flex', height: '100%', background: STUDIO_THEME.bg }}>
      {/* Left Sidebar - Agent Info */}
      <div style={{
        width: '320px',
        borderRight: `1px solid ${STUDIO_THEME.borderSubtle}`,
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        overflow: 'auto',
        background: STUDIO_THEME.bg,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => selectAgent(null)}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              background: 'transparent',
              border: `1px solid ${STUDIO_THEME.borderSubtle}`,
              color: STUDIO_THEME.textSecondary,
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            ← Back
          </button>
        </div>

        {/* Agent Info Card */}
        <div style={{
          borderRadius: '12px',
          border: `1px solid ${STUDIO_THEME.borderSubtle}`,
          background: STUDIO_THEME.bgCard,
          overflow: 'hidden',
        }}>
          <div style={{ padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{
                width: '56px',
                height: '56px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
              }}>
                <AgentAvatar 
                  config={avatarConfig}
                  size={56}
                  emotion={agent.status === 'running' ? 'focused' : agent.status === 'error' ? 'skeptical' : 'steady'}
                  isAnimating={true}
                />
                <div style={{
                  position: 'absolute',
                  bottom: '0px',
                  right: '0px',
                  width: '14px',
                  height: '14px',
                  borderRadius: '50%',
                  background: statusColors[agent.status] || '#6b7280',
                  border: `2px solid ${STUDIO_THEME.bgCard}`,
                }} />
              </div>
              <div>
                <h3 style={{
                  fontSize: '16px',
                  fontWeight: 600,
                  color: STUDIO_THEME.textPrimary,
                  margin: '0 0 4px 0',
                  fontFamily: 'Georgia, serif',
                }}>
                  {agent.name}
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: statusColors[agent.status] || '#6b7280',
                  }} />
                  <span style={{
                    fontSize: '12px',
                    color: STUDIO_THEME.textSecondary,
                    textTransform: 'capitalize',
                  }}>
                    {agent.status}
                  </span>
                  {eventStreamConnected && (
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: '999px',
                      border: `1px solid ${STUDIO_THEME.accent}40`,
                      color: STUDIO_THEME.accent,
                      fontSize: '10px',
                      fontWeight: 500,
                    }}>
                      ● Live
                    </span>
                  )}
                </div>
              </div>
            </div>

            <p style={{
              fontSize: '13px',
              color: STUDIO_THEME.textSecondary,
              lineHeight: 1.5,
              marginBottom: '16px',
            }}>
              {agent.description}
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{
                  fontSize: '11px',
                  color: STUDIO_THEME.textMuted,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  display: 'block',
                  marginBottom: '4px',
                }}>
                  Type
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {agent.type === 'orchestrator' && <Network style={{ width: 16, height: 16, color: STUDIO_THEME.textSecondary }} />}
                  {agent.type === 'sub-agent' && <Bot style={{ width: 16, height: 16, color: STUDIO_THEME.textSecondary }} />}
                  {agent.type === 'worker' && <Cog style={{ width: 16, height: 16, color: STUDIO_THEME.textSecondary }} />}
                  <span style={{
                    fontSize: '13px',
                    color: STUDIO_THEME.textPrimary,
                    textTransform: 'capitalize',
                  }}>
                    {agent.type || 'worker'}
                  </span>
                </div>
                {agent.parentAgentId && (
                  <div style={{
                    fontSize: '11px',
                    color: STUDIO_THEME.textMuted,
                    marginTop: '4px',
                  }}>
                    Parent: {agents.find(a => a.id === agent.parentAgentId)?.name || agent.parentAgentId}
                  </div>
                )}
              </div>

              <div>
                <label style={{
                  fontSize: '11px',
                  color: STUDIO_THEME.textMuted,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  display: 'block',
                  marginBottom: '4px',
                }}>
                  Model
                </label>
                <div style={{ fontSize: '13px', color: STUDIO_THEME.textPrimary }}>{agent.model}</div>
              </div>

              <div>
                <label style={{
                  fontSize: '11px',
                  color: STUDIO_THEME.textMuted,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  display: 'block',
                  marginBottom: '4px',
                }}>
                  Temperature
                </label>
                <div style={{ fontSize: '13px', color: STUDIO_THEME.textPrimary }}>{agent.temperature}</div>
              </div>

              {agent.voice?.enabled && (
                <div>
                  <label style={{
                    fontSize: '11px',
                    color: STUDIO_THEME.textMuted,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    marginBottom: '4px',
                  }}>
                    <Volume2 style={{ width: 12, height: 12 }} />
                    Voice
                  </label>
                  <div style={{ fontSize: '13px', color: STUDIO_THEME.textPrimary, marginBottom: '8px' }}>
                    {agent.voice.voiceLabel || agent.voice.voiceId}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {agent.voice.autoSpeak && (
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '999px',
                        border: `1px solid ${STUDIO_THEME.borderSubtle}`,
                        color: STUDIO_THEME.textSecondary,
                        fontSize: '10px',
                      }}>
                        Auto-speak
                      </span>
                    )}
                    {agent.voice.speakOnCheckpoint && (
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '999px',
                        border: `1px solid ${STUDIO_THEME.borderSubtle}`,
                        color: STUDIO_THEME.textSecondary,
                        fontSize: '10px',
                      }}>
                        Checkpoint alerts
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div>
                <label style={{
                  fontSize: '11px',
                  color: STUDIO_THEME.textMuted,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  display: 'block',
                  marginBottom: '8px',
                }}>
                  Capabilities
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {agent.capabilities.map(cap => (
                    <span key={cap} style={{
                      padding: '3px 10px',
                      borderRadius: '999px',
                      background: `${STUDIO_THEME.accent}15`,
                      color: STUDIO_THEME.accent,
                      fontSize: '11px',
                      fontWeight: 500,
                    }}>
                      {cap}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div style={{
              height: '1px',
              background: STUDIO_THEME.borderSubtle,
              margin: '16px 0',
            }} />

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setIsEditing(agentId)}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  borderRadius: '8px',
                  background: 'transparent',
                  border: `1px solid ${STUDIO_THEME.borderSubtle}`,
                  color: STUDIO_THEME.textPrimary,
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                <Settings style={{ width: 16, height: 16 }} />
                Edit
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                style={{
                  padding: '10px 16px',
                  borderRadius: '8px',
                  background: '#dc2626',
                  border: 'none',
                  color: 'white',
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Trash2 style={{ width: 16, height: 16 }} />
              </button>
            </div>
          </div>
        </div>

        {/* Quick Stats Card */}
        <div style={{
          borderRadius: '12px',
          border: `1px solid ${STUDIO_THEME.borderSubtle}`,
          background: STUDIO_THEME.bgCard,
          overflow: 'hidden',
        }}>
          <div style={{ padding: '16px' }}>
            <h4 style={{
              fontSize: '14px',
              fontWeight: 600,
              color: STUDIO_THEME.textPrimary,
              margin: '0 0 12px 0',
              fontFamily: 'Georgia, serif',
            }}>
              Statistics
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: STUDIO_THEME.textSecondary }}>Total Runs</span>
                <span style={{ fontSize: '13px', color: STUDIO_THEME.textPrimary, fontWeight: 500 }}>{agentRuns.length}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: STUDIO_THEME.textSecondary }}>Checkpoints</span>
                <span style={{ fontSize: '13px', color: STUDIO_THEME.textPrimary, fontWeight: 500 }}>{agentCheckpoints.length}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', color: STUDIO_THEME.textSecondary }}>Commits</span>
                <span style={{ fontSize: '13px', color: STUDIO_THEME.textPrimary, fontWeight: 500 }}>{agentCommits.length}</span>
              </div>
              {agentCharacterStats && (
                <>
                  <div style={{
                    height: '1px',
                    background: STUDIO_THEME.borderSubtle,
                    margin: '8px 0',
                  }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', color: STUDIO_THEME.textSecondary }}>Class</span>
                    <span style={{ fontSize: '13px', color: STUDIO_THEME.textPrimary, fontWeight: 500 }}>{agentCharacterStats.class}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', color: STUDIO_THEME.textSecondary }}>Level</span>
                    <span style={{ fontSize: '13px', color: STUDIO_THEME.accent, fontWeight: 600 }}>{agentCharacterStats.level}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                    {agentCharacterStats.relevantStats.slice(0, 4).map((statKey) => {
                      const definition = agentCharacterStats.statDefinitions.find((item) => item.key === statKey);
                      return (
                        <div key={statKey} style={{
                          borderRadius: '6px',
                          border: `1px solid ${STUDIO_THEME.borderSubtle}`,
                          padding: '8px 10px',
                          background: `${STUDIO_THEME.bg}80`,
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '11px', color: STUDIO_THEME.textMuted }}>{definition?.label || statKey}</span>
                            <span style={{ fontSize: '12px', color: STUDIO_THEME.textPrimary, fontWeight: 500 }}>{agentCharacterStats.stats[statKey] ?? 0}</span>
                          </div>
                          {definition && (
                            <div style={{ fontSize: '10px', color: STUDIO_THEME.textMuted, marginTop: '2px' }}>
                              {definition.signals.join(", ")}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '8px' }}>
                    {Object.entries(agentCharacterStats.specialtyScores)
                      .slice(0, 3)
                      .map(([skill, value]) => (
                        <span key={skill} style={{
                          padding: '2px 8px',
                          borderRadius: '999px',
                          border: `1px solid ${STUDIO_THEME.borderSubtle}`,
                          color: STUDIO_THEME.textSecondary,
                          fontSize: '10px',
                        }}>
                          {skill}: {value}
                        </span>
                      ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, background: STUDIO_THEME.bg }}>
        {/* Execution Area - Runner Style */}
        <div style={{
          borderBottom: `1px solid ${STUDIO_THEME.borderSubtle}`,
          padding: '16px',
          background: STUDIO_THEME.bg,
        }}>
          {!activeRunId || activeRun?.status !== 'running' ? (
            // Initial Input State
            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ flex: 1 }}>
                <Textarea
                  value={executionInput}
                  onChange={e => setExecutionInput(e.target.value)}
                  placeholder="Enter task for the agent..."
                  disabled={isExecuting}
                  style={{
                    minHeight: '80px',
                    background: STUDIO_THEME.bgCard,
                    border: `1px solid ${STUDIO_THEME.borderSubtle}`,
                    borderRadius: '8px',
                    padding: '12px',
                    color: STUDIO_THEME.textPrimary,
                    fontSize: '14px',
                    resize: 'vertical',
                    width: '100%',
                  }}
                />
                <div style={{ marginTop: '8px' }}>
                  <VoicePresence compact />
                </div>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button
                  onClick={handleStartRun}
                  disabled={isExecuting || !executionInput.trim()}
                  style={{
                    flex: 1,
                    padding: '12px 20px',
                    borderRadius: '8px',
                    background: isExecuting || !executionInput.trim() ? `${STUDIO_THEME.accent}60` : `linear-gradient(to right, ${STUDIO_THEME.accent}, #B08D6E)`,
                    border: 'none',
                    color: '#1A1612',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: isExecuting || !executionInput.trim() ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                  }}
                >
                  {isExecuting ? (
                    <Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} />
                  ) : (
                    <>
                      <Play style={{ width: 16, height: 16 }} />
                      Run
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            // Active Run State - Runner Style
            <div style={{ display: 'flex', gap: '16px', height: '300px' }}>
              {/* Main Output */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: STUDIO_THEME.textPrimary, fontFamily: 'Georgia, serif' }}>Task</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      padding: '4px 10px',
                      borderRadius: '999px',
                      background: activeRun?.status === 'running' ? `${STUDIO_THEME.accent}20` : STUDIO_THEME.bgCard,
                      color: activeRun?.status === 'running' ? STUDIO_THEME.accent : STUDIO_THEME.textSecondary,
                      fontSize: '12px',
                      fontWeight: 500,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}>
                      {activeRun?.status === 'running' && <Loader2 style={{ width: 12, height: 12, animation: 'spin 1s linear infinite' }} />}
                      {activeRun?.status}
                    </span>
                    <button
                      onClick={() => activeRun && cancelRun(agentId, activeRun.id)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: '6px',
                        background: '#dc2626',
                        border: 'none',
                        color: 'white',
                        fontSize: '12px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                      }}
                    >
                      <Square style={{ width: 12, height: 12 }} />
                      Stop
                    </button>
                  </div>
                </div>
                
                <div style={{
                  padding: '12px',
                  borderRadius: '8px',
                  border: `1px solid ${STUDIO_THEME.borderSubtle}`,
                  background: `${STUDIO_THEME.bgCard}80`,
                  marginBottom: '8px',
                }}>
                  <div style={{ fontSize: '14px', color: STUDIO_THEME.textPrimary }}>{activeRun?.input}</div>
                </div>
                
                <div style={{ flex: 1, overflow: 'auto' }}>
                  <pre style={{
                    whiteSpace: 'pre-wrap',
                    fontFamily: 'monospace',
                    fontSize: '13px',
                    padding: '12px',
                    borderRadius: '8px',
                    border: `1px solid ${STUDIO_THEME.borderSubtle}`,
                    background: STUDIO_THEME.bgCard,
                    minHeight: '100px',
                    color: STUDIO_THEME.textPrimary,
                    margin: 0,
                  }}>
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
        <Tabs defaultValue="runs" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <TabsList style={{
            margin: '16px 16px 0 16px',
            background: STUDIO_THEME.bgCard,
            border: `1px solid ${STUDIO_THEME.borderSubtle}`,
            borderRadius: '8px',
            padding: '4px',
          }}>
            <TabsTrigger value="runs" style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '8px 12px',
              fontSize: '13px',
            }}>
              <Activity style={{ width: 16, height: 16 }} />
              Runs
            </TabsTrigger>
            <TabsTrigger value="tasks" style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '8px 12px',
              fontSize: '13px',
            }}>
              <CheckCircle style={{ width: 16, height: 16 }} />
              Tasks
            </TabsTrigger>
            <TabsTrigger value="checkpoints" style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '8px 12px',
              fontSize: '13px',
            }}>
              <Save style={{ width: 16, height: 16 }} />
              Checkpoints
            </TabsTrigger>
            <TabsTrigger value="commits" style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '8px 12px',
              fontSize: '13px',
            }}>
              <GitCommit style={{ width: 16, height: 16 }} />
              Commits
            </TabsTrigger>
            <TabsTrigger value="queue" style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '8px 12px',
              fontSize: '13px',
            }}>
              <Clock style={{ width: 16, height: 16 }} />
              Queue
            </TabsTrigger>
            <TabsTrigger value="character" style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '8px 12px',
              fontSize: '13px',
            }}>
              <Sparkles style={{ width: 16, height: 16 }} />
              Character
            </TabsTrigger>
            <TabsTrigger value="attachments" style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '8px 12px',
              fontSize: '13px',
            }}>
              <Paperclip style={{ width: 16, height: 16 }} />
              Attachments
            </TabsTrigger>
            <TabsTrigger value="mail" style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '8px 12px',
              fontSize: '13px',
            }}>
              <Mail style={{ width: 16, height: 16 }} />
              Mail
              {unreadMailCount > 0 && (
                <span style={{
                  marginLeft: '4px',
                  padding: '2px 6px',
                  borderRadius: '999px',
                  background: '#dc2626',
                  color: 'white',
                  fontSize: '10px',
                  fontWeight: 600,
                  minWidth: '16px',
                  textAlign: 'center',
                }}>
                  {unreadMailCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="reviews" style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '8px 12px',
              fontSize: '13px',
            }}>
              <Shield style={{ width: 16, height: 16 }} />
              Reviews
              {pendingReviewCount > 0 && (
                <span style={{
                  marginLeft: '4px',
                  padding: '2px 6px',
                  borderRadius: '999px',
                  background: '#dc2626',
                  color: 'white',
                  fontSize: '10px',
                  fontWeight: 600,
                  minWidth: '16px',
                  textAlign: 'center',
                }}>
                  {pendingReviewCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="capsule" style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '8px 12px',
              fontSize: '13px',
            }}>
              <AppWindow style={{ width: 16, height: 16 }} />
              Capsule
            </TabsTrigger>
          </TabsList>

          <TabsContent value="runs" style={{ flex: 1, padding: '16px', margin: 0 }}>
            {isLoadingRuns ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '128px' }}>
                <Loader2 style={{ width: 24, height: 24, animation: 'spin 1s linear infinite', color: STUDIO_THEME.accent }} />
              </div>
            ) : agentRuns.length === 0 ? (
              <EmptyTabState message="No runs yet. Start the agent to see execution history." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
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

          <TabsContent value="tasks" style={{ flex: 1, padding: '16px', margin: 0 }}>
            {isLoadingTasks ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '128px' }}>
                <Loader2 style={{ width: 24, height: 24, animation: 'spin 1s linear infinite', color: STUDIO_THEME.accent }} />
              </div>
            ) : agentTasks.length === 0 ? (
              <EmptyTabState message="No tasks yet. Tasks appear during agent execution." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {agentTasks.map(task => (
                  <TaskCard key={task.id} task={task} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="checkpoints" style={{ flex: 1, padding: '16px', margin: 0 }}>
            {agentCheckpoints.length === 0 ? (
              <EmptyTabState message="No checkpoints yet. Save progress during execution." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {agentCheckpoints.map(cp => (
                  <CheckpointCard key={cp.id} checkpoint={cp} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="commits" style={{ flex: 1, padding: '16px', margin: 0 }}>
            {agentCommits.length === 0 ? (
              <EmptyTabState message="No commits yet. Version changes to track progress." />
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {agentCommits.map(commit => (
                  <CommitCard key={commit.id} commit={commit} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="queue" style={{ flex: 1, padding: '16px', margin: 0 }}>
            {queue.length === 0 ? (
              <EmptyTabState message="Queue is empty. Add tasks to process." />
            ) : (
              <div style={{
                borderRadius: '12px',
                border: `1px solid ${STUDIO_THEME.borderSubtle}`,
                background: STUDIO_THEME.bgCard,
                overflow: 'hidden',
              }}>
                <div style={{ padding: '16px' }}>
                  <Queue>
                    <ul style={{ display: 'flex', flexDirection: 'column', gap: '8px', margin: 0, padding: 0, listStyle: 'none' }}>
                      {queue.map(item => (
                        <li key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: '999px',
                            background: item.priority <= 2 ? '#dc2626' : STUDIO_THEME.bg,
                            color: item.priority <= 2 ? 'white' : STUDIO_THEME.textSecondary,
                            fontSize: '11px',
                            fontWeight: 500,
                          }}>
                            P{item.priority}
                          </span>
                          <span style={{ fontSize: '13px', color: STUDIO_THEME.textPrimary, flex: 1 }}>{item.content}</span>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: '999px',
                            border: `1px solid ${STUDIO_THEME.borderSubtle}`,
                            color: STUDIO_THEME.textSecondary,
                            fontSize: '11px',
                          }}>
                            {item.status}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </Queue>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="character" style={{ flex: 1, padding: 0, margin: 0 }}>
            <CharacterLayerPanel agentId={agentId} />
          </TabsContent>

          <TabsContent value="attachments" style={{ flex: 1, padding: '16px', margin: 0 }}>
            <div style={{
              borderRadius: '12px',
              border: `1px solid ${STUDIO_THEME.borderSubtle}`,
              background: STUDIO_THEME.bgCard,
              overflow: 'hidden',
            }}>
              <div style={{ padding: '16px' }}>
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
              </div>
            </div>
          </TabsContent>

          <TabsContent value="mail" style={{ flex: 1, padding: '16px', margin: 0 }}>
            <AgentMailView agentId={agentId} />
          </TabsContent>

          <TabsContent value="reviews" style={{ flex: 1, padding: '16px', margin: 0 }}>
            <AgentReviewsView agentId={agentId} />
          </TabsContent>

          <TabsContent value="capsule" style={{ flex: 1, padding: '16px', margin: 0 }}>
            <AgentCapsuleView agentId={agentId} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent style={{
          background: STUDIO_THEME.bgCard,
          border: `1px solid ${STUDIO_THEME.borderSubtle}`,
          borderRadius: '12px',
        }}>
          <DialogHeader>
            <DialogTitle style={{
              fontFamily: 'Georgia, serif',
              color: STUDIO_THEME.textPrimary,
              fontSize: '18px',
            }}>
              Delete Agent
            </DialogTitle>
            <DialogDescription style={{
              color: STUDIO_THEME.textSecondary,
              fontSize: '14px',
            }}>
              Are you sure you want to delete &quot;{agent.name}&quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              style={{
                padding: '10px 16px',
                borderRadius: '8px',
                background: 'transparent',
                border: `1px solid ${STUDIO_THEME.borderSubtle}`,
                color: STUDIO_THEME.textPrimary,
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              style={{
                padding: '10px 16px',
                borderRadius: '8px',
                background: '#dc2626',
                border: 'none',
                color: 'white',
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              Delete
            </button>
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
