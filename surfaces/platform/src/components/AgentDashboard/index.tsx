"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  SquaresFour,
  Play,
  CheckSquare,
  GitCommit,
  Wrench,
  EnvelopeSimple,
  ChartBar,
  Cube,
  Users,
  UserCircle,
  GearSix,
  X,
  CaretLeft,
  Plus,
  Pause,
  ArrowClockwise,
  Terminal,
  Trash,
  PencilSimple,
  Clock,
  Warning,
  CheckCircle,
  Funnel,
  MagnifyingGlass,
  ArrowsClockwise,
  PaperPlaneTilt,
  Tray,
  Chat,
  Pulse as Activity,
  Cpu,
  Globe,
  FileCode,
  FolderOpen,
  Lightning,
  Shield,
  Lock,
  LockOpen,
  Eye,
  CaretDown,
  CaretRight,
  Copy,
  Check,
  TrendUp,
  CurrencyDollar,
  HardDrives,
  HardDrive,
  GitBranch,
  ChatCircle,
  ThumbsUp,
  ThumbsDown,
  Archive,
  XCircle,
  CircleNotch,
  DownloadSimple,
  UploadSimple,
  PlugsConnected,
  Stack,
  Sparkle,
  Code,
  Database,
  FileText,
  ShareNetwork,
  Bookmark,
  DotsThreeVertical,
  FloppyDisk,
  Package,
} from '@phosphor-icons/react';

// Stores
import { useAgentStore } from '@/lib/agents/agent.store';
import { useToolRegistryStore } from '@/lib/agents/tool-registry.store';
import { useUnifiedStore } from '@/lib/agents/unified.store';
import { skillInstallerApi } from '@/services/SkillInstallerApiService';
import { useToast } from '@/hooks/use-toast';
import { useTelemetrySnapshot } from '@/lib/telemetry/useTelemetrySnapshot';
import { agentWorkspaceService } from '@/lib/agents/agent-workspace.service';
import { SkillBuilderWizard, HeartbeatScheduler, PackageManager } from '@/components/agent-workspace';
import { WorkspaceTab } from './WorkspaceTab';
import { CharacterLayerPanel } from '@/views/agent-character/CharacterLayerPanel';

// Character service
import { 
  CHARACTER_SETUPS, 
  getSpecialtyOptions, 
  getSetupStatDefinitions,
  loadCharacterLayer,
  saveCharacterLayer,
  computeCharacterStats,
  parseCharacterBlueprint 
} from '@/lib/agents/character.service';

// Types
import type { Agent, AgentRun, AgentTask, Checkpoint, AgentMailMessage, AgentMailThread } from '@/lib/agents/agent.types';
import type { CharacterStats, CharacterLayerConfig, AvatarConfig } from '@/lib/agents/character.types';
import type { Skill } from '@/services/SkillInstallerApiService';
import type { McpConnector } from '@/lib/db/schema';

// UI Components
import { AgentAvatar } from '@/components/Avatar/AgentAvatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

// Registry
import { FEATURE_PLUGIN_REGISTRY } from '@/plugins/feature.registry';
import { useFeaturePlugins } from '@/plugins/useFeaturePlugins';

// Theme
const STUDIO_THEME = {
  bg: '#2B2520',
  bgCard: '#352F29',
  textPrimary: '#ECECEC',
  textSecondary: '#9B9B9B',
  textMuted: '#6B6B6B',
  accent: '#D4956A',
  borderSubtle: 'rgba(255,255,255,0.06)',
};

type TabId = 'overview' | 'runs' | 'tasks' | 'checkpoints' | 'tools' | 'comms' | 'monitoring' | 'environment' | 'swarm' | 'character' | 'workspace' | 'settings';

interface AgentDashboardProps {
  agentId: string;
  onClose?: () => void;
}

// =============================================================================
// MAIN DASHBOARD
// =============================================================================

export function AgentDashboard({ agentId, onClose }: AgentDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const { agents, characterStats } = useAgentStore();
  const agent = agents.find(a => a.id === agentId);
  const stats = characterStats[agentId];
  
  if (!agent) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 20 }}
      transition={{ duration: 0.2 }}
      style={{
        maxWidth: '1100px',
        width: '100%',
        maxHeight: '90vh',
        marginTop: '5vh',
        borderRadius: '16px',
        border: `1px solid ${STUDIO_THEME.borderSubtle}`,
        background: STUDIO_THEME.bgCard,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <DashboardHeader agent={agent} stats={stats} onClose={onClose} activeTab={activeTab} />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <SidebarNavigation activeTab={activeTab} onTabChange={setActiveTab} />
        <div style={{ flex: 1, overflow: 'auto', background: STUDIO_THEME.bg }}>
          <TabContent tabId={activeTab} agent={agent} stats={stats} />
        </div>
      </div>
    </motion.div>
  );
}

// =============================================================================
// HEADER
// =============================================================================

function DashboardHeader({ agent, stats, onClose, activeTab }: { 
  agent: Agent; 
  stats?: CharacterStats; 
  onClose?: () => void;
  activeTab: TabId;
}) {
  const tabLabels: Record<TabId, string> = {
    overview: 'Overview', runs: 'Runs', tasks: 'Tasks', checkpoints: 'Checkpoints',
    tools: 'Tools', comms: 'Comms', monitoring: 'Monitoring', environment: 'Environment',
    swarm: 'Swarm', character: 'Character', workspace: 'Workspace', settings: 'Settings',
  };

  return (
    <div style={{
      padding: '16px 20px',
      borderBottom: `1px solid ${STUDIO_THEME.borderSubtle}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      background: STUDIO_THEME.bgCard,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button onClick={onClose} style={{
          padding: '8px', borderRadius: '8px', background: 'transparent', border: 'none',
          color: STUDIO_THEME.textSecondary, cursor: 'pointer',
        }}>
          <CaretLeft style={{ width: 20, height: 20 }} />
        </button>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, overflow: 'hidden', border: `1px solid ${STUDIO_THEME.borderSubtle}` }}>
            <AgentAvatar config={agent.config?.avatar as any} size={40} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: STUDIO_THEME.textPrimary, fontFamily: 'Georgia, serif' }}>
              {agent.name}
            </h3>
            <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: STUDIO_THEME.textMuted }}>
              {stats?.class || 'Agent'} • Level {stats?.level || 1}
            </p>
          </div>
        </div>

        <div style={{ width: 1, height: 24, background: STUDIO_THEME.borderSubtle, margin: '0 8px' }} />

        <span style={{ fontSize: '13px', fontWeight: 500, color: STUDIO_THEME.textSecondary, textTransform: 'capitalize' }}>
          {tabLabels[activeTab]}
        </span>
      </div>

      <button onClick={onClose} style={{
        padding: '8px', borderRadius: '8px', background: 'transparent', border: 'none',
        color: STUDIO_THEME.textSecondary, cursor: 'pointer',
      }}>
        <X style={{ width: 18, height: 18 }} />
      </button>
    </div>
  );
}

// =============================================================================
// SIDEBAR
// =============================================================================

function SidebarNavigation({ activeTab, onTabChange }: { activeTab: TabId; onTabChange: (tab: TabId) => void }) {
  const tabs: { id: TabId; icon: React.ElementType; label: string }[] = [
    { id: 'overview', icon: SquaresFour, label: 'Overview' },
    { id: 'runs', icon: Play, label: 'Runs' },
    { id: 'tasks', icon: CheckSquare, label: 'Tasks' },
    { id: 'checkpoints', icon: GitCommit, label: 'Checkpoints' },
    { id: 'tools', icon: Wrench, label: 'Tools' },
    { id: 'comms', icon: EnvelopeSimple, label: 'Comms' },
    { id: 'monitoring', icon: ChartBar, label: 'Monitor' },
    { id: 'environment', icon: Cube, label: 'Env' },
    { id: 'swarm', icon: Users, label: 'Swarm' },
    { id: 'character', icon: UserCircle, label: 'Character' },
    { id: 'workspace', icon: FolderOpen, label: 'Workspace' },
    { id: 'settings', icon: GearSix, label: 'Settings' },
  ];

  return (
    <div style={{
      width: '160px', borderRight: `1px solid ${STUDIO_THEME.borderSubtle}`,
      padding: '12px', display: 'flex', flexDirection: 'column', gap: '2px',
      overflow: 'auto', background: STUDIO_THEME.bgCard,
    }}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '10px 12px', borderRadius: '8px', border: 'none',
              backgroundColor: isActive ? `${STUDIO_THEME.accent}15` : 'transparent',
              color: isActive ? STUDIO_THEME.accent : STUDIO_THEME.textSecondary,
              cursor: 'pointer', transition: 'all 0.15s',
              fontSize: '13px', fontWeight: 500, textAlign: 'left',
            }}
          >
            <Icon style={{ width: 16, height: 16 }} />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// =============================================================================
// TAB CONTENT SWITCHER
// =============================================================================

function TabContent({ tabId, agent, stats }: { tabId: TabId; agent: Agent; stats?: CharacterStats }) {
  switch (tabId) {
    case 'overview': return <OverviewTab agent={agent} stats={stats} />;
    case 'runs': return <RunsTab agent={agent} />;
    case 'tasks': return <TasksTab agent={agent} />;
    case 'checkpoints': return <CheckpointsTab agent={agent} />;
    case 'tools': return <ToolsTab agent={agent} />;
    case 'comms': return <CommsTab agent={agent} />;
    case 'monitoring': return <MonitoringTab agent={agent} />;
    case 'environment': return <EnvironmentTab agent={agent} />;
    case 'swarm': return <SwarmTab agent={agent} />;
    case 'character': return <CharacterLayerPanel agentId={agent.id} />;
    case 'workspace': return <WorkspaceTab agent={agent} />;
    case 'settings': return <SettingsTab agent={agent} />;
    default: return null;
  }
}

// [Rest of the tabs will be implemented below...]
// Due to length, I'll implement the key tabs that need fixing

// =============================================================================
// RUNS TAB - Fixed font color
// =============================================================================

function RunsTab({ agent }: { agent: Agent }) {
  const { runs, startRun, cancelRun, fetchRuns } = useAgentStore();
  const agentRuns = runs[agent.id] || [];
  const [isStarting, setIsStarting] = useState(false);
  const [filter, setFilter] = useState<'all' | 'running' | 'completed' | 'failed'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => { fetchRuns(agent.id); }, [agent.id, fetchRuns]);

  const filteredRuns = useMemo(() => {
    let filtered = agentRuns;
    if (filter !== 'all') filtered = filtered.filter(r => r.status === filter);
    if (searchQuery) filtered = filtered.filter(r => r.input?.toLowerCase().includes(searchQuery.toLowerCase()));
    return filtered.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  }, [agentRuns, filter, searchQuery]);

  const handleStartRun = async () => {
    setIsStarting(true);
    try { await startRun(agent.id, 'New run from dashboard'); } finally { setIsStarting(false); }
  };

  return (
    <ScrollArea style={{ height: '100%', padding: '20px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <Button onClick={handleStartRun} disabled={isStarting} style={{ background: STUDIO_THEME.accent, color: STUDIO_THEME.bg }}>
            <Play style={{ width: 16, height: 16, marginRight: 8 }} />
            {isStarting ? 'Starting...' : 'Start New Run'}
          </Button>
          <div style={{ flex: 1 }} />
          <Input placeholder="Search runs..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ width: 200 }} />
          <Select value={filter} onValueChange={v => setFilter(v as any)}>
            <SelectTrigger style={{ width: 140 }}><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Runs</SelectItem>
              <SelectItem value="running">Running</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Section title={`Run History (${filteredRuns.length})`} icon={Play}>
          {filteredRuns.length === 0 ? (
            <EmptyMessage>No runs match your criteria</EmptyMessage>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {filteredRuns.map(run => (
                <RunListItem key={run.id} run={run} onCancel={run.status === 'running' ? () => cancelRun(agent.id, run.id) : undefined} />
              ))}
            </div>
          )}
        </Section>
      </div>
    </ScrollArea>
  );
}

// =============================================================================
// TOOLS TAB - With MCP, Plugins, Skills, and Add functionality
// =============================================================================

function ToolsTab({ agent }: { agent: Agent }) {
  const { tools, toggleToolForSession, registerTool } = useToolRegistryStore();
  const { enabledIds, toggle } = useFeaturePlugins();
  const { addToast } = useToast();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [installingSkillId, setInstallingSkillId] = useState<string | null>(null);
  const [mcpConnectors, setMcpConnectors] = useState<McpConnector[]>([]);
  const [mcpTestStatus, setMcpTestStatus] = useState<Record<string, { status: 'testing' | 'connected' | 'error' | 'authorizing'; message?: string }>>({});
  const [activeSection, setActiveSection] = useState<'tools' | 'skills' | 'mcp' | 'plugins'>('tools');
  const [showAddTool, setShowAddTool] = useState(false);
  const [showAddMcp, setShowAddMcp] = useState(false);
  const [deleteConfirmConnector, setDeleteConfirmConnector] = useState<McpConnector | null>(null);
  const [isDeletingMcp, setIsDeletingMcp] = useState(false);

  // Test MCP connection via API route
  const testMcpConnection = async (connector: McpConnector) => {
    setMcpTestStatus(prev => ({ ...prev, [connector.id]: { status: 'testing' } }));
    
    try {
      const response = await fetch('/api/mcp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: connector.id,
          name: connector.name,
          url: connector.url,
          type: connector.type || 'http',
        }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.needsAuth) {
        setMcpTestStatus(prev => ({ 
          ...prev, 
          [connector.id]: { 
            status: 'authorizing', 
            message: 'OAuth authorization required' 
          } 
        }));
      } else if (result.status === 'connected') {
        setMcpTestStatus(prev => ({ 
          ...prev, 
          [connector.id]: { 
            status: 'connected', 
            message: 'Connection successful' 
          } 
        }));
      } else {
        setMcpTestStatus(prev => ({ 
          ...prev, 
          [connector.id]: { 
            status: 'error', 
            message: result.error || 'Connection failed' 
          } 
        }));
      }
    } catch (error) {
      setMcpTestStatus(prev => ({ 
        ...prev, 
        [connector.id]: { 
          status: 'error', 
          message: error instanceof Error ? error.message : 'Unknown error' 
        } 
      }));
    }
  };

  // Load data
  useEffect(() => {
    skillInstallerApi.listSkills({}).then(res => setSkills(res.skills));
    // Load MCP connectors via API instead of direct DB access
    fetch('/api/mcp/connectors')
      .then(r => r.json())
      .then(data => setMcpConnectors(data.connectors || []))
      .catch(() => setMcpConnectors([]));
  }, []);

  const agentTools = useMemo(() => Object.values(tools).filter(t => 
    t.allowedSessions.includes(agent.id) || t.allowedSessions.length === 0
  ), [tools, agent.id]);

  const handleAddTool = async (toolData: any) => {
    await registerTool({
      ...toolData,
      source: 'custom',
      allowedSessions: [agent.id],
    });
    setShowAddTool(false);
  };

  return (
    <ScrollArea style={{ height: '100%', padding: '20px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Section Tabs */}
        <div style={{ display: 'flex', gap: '8px', padding: '4px', borderRadius: '8px', background: STUDIO_THEME.bgCard, border: `1px solid ${STUDIO_THEME.borderSubtle}` }}>
          {[
            { id: 'tools', label: 'Tools', icon: Wrench },
            { id: 'skills', label: 'Skills', icon: Lightning },
            { id: 'mcp', label: 'MCP', icon: PlugsConnected },
            { id: 'plugins', label: 'Plugins', icon: Stack },
          ].map((s: any) => (
            <button key={s.id} onClick={() => setActiveSection(s.id)} style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              padding: '10px', borderRadius: '6px', border: 'none',
              backgroundColor: activeSection === s.id ? STUDIO_THEME.bg : 'transparent',
              color: activeSection === s.id ? STUDIO_THEME.textPrimary : STUDIO_THEME.textMuted,
              fontSize: '13px', fontWeight: 500, cursor: 'pointer',
            }}>
              <s.icon style={{ width: 16, height: 16 }} />{s.label}
            </button>
          ))}
        </div>

        {/* Add Button */}
        <div style={{ display: 'flex', gap: '12px' }}>
          {activeSection === 'tools' && (
            <Button onClick={() => setShowAddTool(true)} style={{ background: STUDIO_THEME.accent, color: STUDIO_THEME.bg }}>
              <Plus style={{ width: 16, height: 16, marginRight: 8 }} />Add Custom Tool
            </Button>
          )}
          {activeSection === 'mcp' && (
            <Button onClick={() => setShowAddMcp(true)} style={{ background: STUDIO_THEME.accent, color: STUDIO_THEME.bg }}>
              <Plus style={{ width: 16, height: 16, marginRight: 8 }} />Add MCP Connector
            </Button>
          )}
          {activeSection === 'skills' && (
            <Button 
              onClick={() => {
                // Navigate to Agent Hub with memory tab (Skills Registry)
                window.dispatchEvent(new CustomEvent('a2r:navigate', { 
                  detail: { view: 'agents', tab: 'memory' } 
                }));
              }} 
              style={{ background: STUDIO_THEME.accent, color: STUDIO_THEME.bg }}
            >
              <DownloadSimple style={{ width: 16, height: 16, marginRight: 8 }} />Browse Skill Registry
            </Button>
          )}
        </div>

        {/* Tools Section */}
        {activeSection === 'tools' && (
          <Section title={`Available Tools (${agentTools.length})`} icon={Wrench}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {agentTools.map(tool => (
                <div key={tool.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderRadius: '10px', border: `1px solid ${STUDIO_THEME.borderSubtle}`, background: STUDIO_THEME.bgCard }}>
                  <div>
                    <div style={{ color: STUDIO_THEME.textPrimary, fontSize: '14px', fontWeight: 500 }}>{tool.name}</div>
                    <div style={{ color: STUDIO_THEME.textMuted, fontSize: '12px' }}>{tool.description}</div>
                    <div style={{ display: 'flex', gap: '4px', marginTop: 4 }}>
                      <Badge variant="outline" style={{ fontSize: '10px' }}>{tool.source}</Badge>
                      {tool.category && <Badge variant="outline" style={{ fontSize: '10px' }}>{tool.category}</Badge>}
                    </div>
                  </div>
                  <Switch checked={tool.allowedSessions.includes(agent.id)} onCheckedChange={checked => toggleToolForSession(tool.id, agent.id, checked)} />
                </div>
              ))}
              {agentTools.length === 0 && <EmptyMessage>No tools registered for this agent</EmptyMessage>}
            </div>
          </Section>
        )}

        {/* Skills Section */}
        {activeSection === 'skills' && (
          <Section title={`Available Skills (${skills.length})`} icon={Lightning}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {skills.map(skill => (
                <div key={skill.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderRadius: '10px', border: `1px solid ${STUDIO_THEME.borderSubtle}`, background: STUDIO_THEME.bgCard }}>
                  <div>
                    <div style={{ color: STUDIO_THEME.textPrimary, fontSize: '14px', fontWeight: 500 }}>{skill.name}</div>
                    <div style={{ color: STUDIO_THEME.textMuted, fontSize: '12px' }}>{skill.description}</div>
                    <div style={{ display: 'flex', gap: '4px', marginTop: 4 }}>
                      {skill.tags?.map((tag, i) => <Badge key={i} variant="outline" style={{ fontSize: '10px' }}>{tag}</Badge>)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <Badge variant={skill.status === 'installed' ? 'default' : 'secondary'}>{skill.status}</Badge>
                    {skill.status !== 'installed' && (
                      <Button 
                        size="sm" 
                        onClick={async () => {
                          setInstallingSkillId(skill.id);
                          try {
                            await skillInstallerApi.installSkill({ skillId: skill.id });
                            addToast({
                              title: 'Skill Installed',
                              description: `${skill.name} has been installed successfully.`,
                              type: 'success',
                            });
                            // Refresh skills list
                            const res = await skillInstallerApi.listSkills({});
                            setSkills(res.skills);
                          } catch (error) {
                            addToast({
                              title: 'Installation Failed',
                              description: error instanceof Error ? error.message : 'Failed to install skill',
                              type: 'error',
                            });
                          } finally {
                            setInstallingSkillId(null);
                          }
                        }}
                        disabled={installingSkillId === skill.id}
                      >
                        {installingSkillId === skill.id ? (
                          <CircleNotch style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} />
                        ) : (
                          'Install'
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* MCP Section */}
        {activeSection === 'mcp' && (
          <Section title={`MCP Connectors (${mcpConnectors.length})`} icon={PlugsConnected}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {mcpConnectors.map(connector => {
                const testStatus = mcpTestStatus[connector.id];
                return (
                  <div key={connector.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderRadius: '10px', border: `1px solid ${STUDIO_THEME.borderSubtle}`, background: STUDIO_THEME.bgCard }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: 36, height: 36, borderRadius: 8, background: STUDIO_THEME.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <PlugsConnected style={{ width: 18, height: 18, color: STUDIO_THEME.accent }} />
                      </div>
                      <div>
                        <div style={{ color: STUDIO_THEME.textPrimary, fontSize: '14px', fontWeight: 500 }}>{connector.name}</div>
                        <div style={{ color: STUDIO_THEME.textMuted, fontSize: '12px' }}>{connector.url}</div>
                        <div style={{ fontSize: '11px', color: STUDIO_THEME.textMuted }}>Type: {connector.type}</div>
                        {testStatus && (
                          <div style={{ 
                            fontSize: '11px', 
                            color: testStatus.status === 'connected' ? '#22c55e' : 
                                   testStatus.status === 'error' ? '#ef4444' : 
                                   testStatus.status === 'authorizing' ? '#f59e0b' : STUDIO_THEME.textMuted,
                            marginTop: 4 
                          }}>
                            {testStatus.status === 'testing' ? 'Testing...' : testStatus.message}
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <Badge variant={connector.enabled ? 'default' : 'secondary'}>{connector.enabled ? 'Enabled' : 'Disabled'}</Badge>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => testMcpConnection(connector)}
                        disabled={testStatus?.status === 'testing'}
                      >
                        {testStatus?.status === 'testing' ? (
                          <ArrowsClockwise style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} />
                        ) : (
                          <Activity style={{ width: 14, height: 14 }} />
                        )}
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setDeleteConfirmConnector(connector)}
                        disabled={isDeletingMcp}
                      >
                        <Trash style={{ width: 14, height: 14 }} />
                      </Button>
                    </div>
                  </div>
                );
              })}
              {mcpConnectors.length === 0 && <EmptyMessage>No MCP connectors configured</EmptyMessage>}
            </div>
          </Section>
        )}

        {/* Plugins Section */}
        {activeSection === 'plugins' && (
          <Section title="Feature Plugins" icon={Stack}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {FEATURE_PLUGIN_REGISTRY.map(plugin => (
                <div key={plugin.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderRadius: '10px', border: `1px solid ${STUDIO_THEME.borderSubtle}`, background: STUDIO_THEME.bgCard }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: enabledIds.has(plugin.id) ? `${STUDIO_THEME.accent}20` : STUDIO_THEME.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Stack style={{ width: 18, height: 18, color: enabledIds.has(plugin.id) ? STUDIO_THEME.accent : STUDIO_THEME.textMuted }} />
                    </div>
                    <div>
                      <div style={{ color: STUDIO_THEME.textPrimary, fontSize: '14px', fontWeight: 500 }}>{plugin.name}</div>
                      <div style={{ color: STUDIO_THEME.textMuted, fontSize: '12px' }}>{plugin.description}</div>
                      <div style={{ fontSize: '11px', color: STUDIO_THEME.textMuted }}>{plugin.category} • {plugin.views.length} views</div>
                    </div>
                  </div>
                  <Switch checked={enabledIds.has(plugin.id)} onCheckedChange={() => toggle(plugin.id)} />
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Add Tool Dialog */}
        {showAddTool && (
          <AddToolDialog onClose={() => setShowAddTool(false)} onAdd={handleAddTool} />
        )}

        {/* Add MCP Dialog */}
        {showAddMcp && (
          <AddMcpDialog onClose={() => setShowAddMcp(false)} onAdd={() => {}} />
        )}

        {/* Delete MCP Confirmation Dialog */}
        {deleteConfirmConnector && (
          <Dialog open onOpenChange={() => setDeleteConfirmConnector(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete MCP Connector?</DialogTitle>
                <DialogDescription>
                  This will permanently delete <strong>{deleteConfirmConnector.name}</strong>.
                  This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setDeleteConfirmConnector(null)} disabled={isDeletingMcp}>
                  Cancel
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={async () => {
                    setIsDeletingMcp(true);
                    try {
                      const response = await fetch(`/api/mcp/connectors/${deleteConfirmConnector.id}`, {
                        method: 'DELETE',
                      });
                      if (!response.ok) throw new Error('Failed to delete connector');
                      
                      addToast({
                        title: 'Connector Deleted',
                        description: `${deleteConfirmConnector.name} has been deleted.`,
                        type: 'success',
                      });
                      
                      // Refresh connectors list
                      const res = await fetch('/api/mcp/connectors');
                      const data = await res.json();
                      setMcpConnectors(data.connectors || []);
                    } catch (error) {
                      addToast({
                        title: 'Delete Failed',
                        description: error instanceof Error ? error.message : 'Failed to delete connector',
                        type: 'error',
                      });
                    } finally {
                      setIsDeletingMcp(false);
                      setDeleteConfirmConnector(null);
                    }
                  }}
                  disabled={isDeletingMcp}
                >
                  {isDeletingMcp ? 'Deleting...' : 'Delete'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </ScrollArea>
  );
}

// =============================================================================
// COMMS TAB - Full Rails Mail System
// =============================================================================

function CommsTab({ agent }: { agent: Agent }) {
  const { mail, mailThreads, fetchMail, fetchMailThreads, sendMail, acknowledgeMail } = useAgentStore();
  const unified = useUnifiedStore();
  const { addToast } = useToast();
  const agentMail = mail[agent.id] || [];
  const agentThreads = mailThreads[agent.id] || [];
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [toAgent, setToAgent] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [wihId, setWihId] = useState('');
  const [diffRef, setDiffRef] = useState('');

  useEffect(() => { 
    fetchMail(agent.id); 
    fetchMailThreads(agent.id);
    unified.fetchMailThreads();
  }, [agent.id]);

  const unreadCount = agentMail.filter(m => m.status === 'unread').length;
  const currentThreadMessages = agentMail.filter(m => m.threadId === selectedThread);
  const selectedThreadData = agentThreads.find(t => t.id === selectedThread);

  const handleSend = async () => {
    if (!toAgent || !subject || !body) return;
    await sendMail(agent.id, toAgent, subject, body);
    setComposeOpen(false);
    setToAgent(''); setSubject(''); setBody('');
  };

  const handleRequestReview = async () => {
    if (!selectedThread || !wihId) return;
    await unified.requestReview(selectedThread, wihId, diffRef);
    setReviewOpen(false);
    setWihId(''); setDiffRef('');
  };

  const handleDecideReview = async (approve: boolean) => {
    if (!selectedThread) return;
    await unified.decideReview(selectedThread, approve, 'Decision made from dashboard');
  };

  const handleAck = async (messageId: string) => {
    await acknowledgeMail(agent.id, messageId);
  };

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      {/* Thread List */}
      <div style={{ width: 280, borderRight: `1px solid ${STUDIO_THEME.borderSubtle}`, background: STUDIO_THEME.bgCard, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '16px', borderBottom: `1px solid ${STUDIO_THEME.borderSubtle}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: STUDIO_THEME.textPrimary }}>
            Inbox {unreadCount > 0 && <Badge style={{ marginLeft: 8 }}>{unreadCount}</Badge>}
          </h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button size="sm" variant="ghost" onClick={() => { fetchMail(agent.id); fetchMailThreads(agent.id); }}>
              <ArrowsClockwise style={{ width: 14, height: 14 }} />
            </Button>
            <Button size="sm" onClick={() => setComposeOpen(true)}><Plus style={{ width: 14, height: 14 }} /></Button>
          </div>
        </div>
        <ScrollArea style={{ flex: 1 }}>
          {agentThreads.map(thread => (
            <div key={thread.id} onClick={() => setSelectedThread(thread.id)} style={{
              padding: '12px 16px', cursor: 'pointer',
              background: selectedThread === thread.id ? 'rgba(255,255,255,0.05)' : 'transparent',
              borderLeft: selectedThread === thread.id ? `3px solid ${STUDIO_THEME.accent}` : '3px solid transparent',
            }}>
              <div style={{ fontSize: '13px', fontWeight: 500, color: STUDIO_THEME.textPrimary }}>{thread.subject}</div>
              <div style={{ fontSize: '11px', color: STUDIO_THEME.textMuted, marginTop: 2 }}>
                {thread.participants.join(', ')} • {thread.unreadCount} unread • {thread.messageCount} msgs
              </div>
            </div>
          ))}
        </ScrollArea>
      </div>

      {/* Message View */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {selectedThread ? (
          <>
            <div style={{ padding: '16px', borderBottom: `1px solid ${STUDIO_THEME.borderSubtle}`, background: STUDIO_THEME.bgCard, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '14px', color: STUDIO_THEME.textPrimary }}>{selectedThreadData?.subject}</h3>
                <div style={{ fontSize: '12px', color: STUDIO_THEME.textMuted }}>{selectedThreadData?.participants.join(', ')}</div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <Button size="sm" variant="outline" onClick={() => setReviewOpen(true)}>
                  <Shield style={{ width: 14, height: 14, marginRight: 6 }} />Request Review
                </Button>
                <Button size="sm" variant="outline" onClick={() => {
                  const link = `${window.location.origin}/agent/${agent.id}/thread/${selectedThread}`;
                  setShareLink(link);
                  setShareOpen(true);
                }}>
                  <ShareNetwork style={{ width: 14, height: 14, marginRight: 6 }} />Share
                </Button>
              </div>
            </div>
            <ScrollArea style={{ flex: 1, padding: '16px' }}>
              {currentThreadMessages.map(msg => (
                <div key={msg.id} style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', alignItems: msg.fromAgentId === agent.id ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    maxWidth: '70%', padding: '12px 16px', borderRadius: '12px',
                    background: msg.fromAgentId === agent.id ? STUDIO_THEME.accent : STUDIO_THEME.bgCard,
                    color: msg.fromAgentId === agent.id ? STUDIO_THEME.bg : STUDIO_THEME.textPrimary,
                  }}>
                    <div style={{ fontSize: '13px' }}>{msg.body}</div>
                    <div style={{ fontSize: '11px', opacity: 0.7, marginTop: 4, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {new Date(msg.timestamp).toLocaleTimeString()}
                      {msg.status === 'unread' && msg.fromAgentId !== agent.id && (
                        <button onClick={() => handleAck(msg.id)} style={{ fontSize: '11px', background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', textDecoration: 'underline' }}>Ack</button>
                      )}
                      {msg.status === 'acknowledged' && <Check style={{ width: 12, height: 12 }} />}
                    </div>
                  </div>
                  {msg.requiresAck && msg.status !== 'acknowledged' && msg.fromAgentId !== agent.id && (
                    <div style={{ marginTop: 4, padding: '4px 8px', background: 'rgba(245,158,11,0.2)', borderRadius: 4, fontSize: '11px', color: '#f59e0b' }}>
                      Acknowledgment Required
                    </div>
                  )}
                </div>
              ))}
            </ScrollArea>
            <div style={{ padding: '16px', borderTop: `1px solid ${STUDIO_THEME.borderSubtle}`, background: STUDIO_THEME.bgCard }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <Input placeholder="Type a message..." style={{ flex: 1 }} onKeyDown={e => { if (e.key === 'Enter') { unified.sendMail(selectedThread, (e.target as HTMLInputElement).value); (e.target as HTMLInputElement).value = ''; } }} />
                <Button size="sm"><PaperPlaneTilt style={{ width: 16, height: 16 }} /></Button>
              </div>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: STUDIO_THEME.textMuted }}>
            Select a thread to view messages
          </div>
        )}
      </div>

      {/* Compose Dialog */}
      {composeOpen && (
        <Dialog open={composeOpen} onOpenChange={setComposeOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Message</DialogTitle>
              <DialogDescription>Send a message to another agent</DialogDescription>
            </DialogHeader>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Input placeholder="To Agent ID..." value={toAgent} onChange={e => setToAgent(e.target.value)} />
              <Input placeholder="Subject..." value={subject} onChange={e => setSubject(e.target.value)} />
              <Textarea placeholder="Message..." value={body} onChange={e => setBody(e.target.value)} style={{ minHeight: 120 }} />
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setComposeOpen(false)}>Cancel</Button>
              <Button onClick={handleSend} disabled={!toAgent || !subject || !body} style={{ background: STUDIO_THEME.accent, color: STUDIO_THEME.bg }}>Send</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Review Request Dialog */}
      {reviewOpen && (
        <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Request Review</DialogTitle>
              <DialogDescription>Request a review decision from the agent</DialogDescription>
            </DialogHeader>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Input placeholder="WIH ID (Work Item ID)..." value={wihId} onChange={e => setWihId(e.target.value)} />
              <Input placeholder="Diff Reference (optional)..." value={diffRef} onChange={e => setDiffRef(e.target.value)} />
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setReviewOpen(false)}>Cancel</Button>
              <Button onClick={handleRequestReview} disabled={!wihId} style={{ background: STUDIO_THEME.accent, color: STUDIO_THEME.bg }}>Request</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Share Dialog */}
      {shareOpen && (
        <Dialog open={shareOpen} onOpenChange={setShareOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Share Thread</DialogTitle>
              <DialogDescription>Copy the link below to share this conversation</DialogDescription>
            </DialogHeader>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <Input value={shareLink} readOnly style={{ flex: 1 }} />
                <Button 
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(shareLink);
                      setCopied(true);
                      addToast({
                        title: 'Copied!',
                        description: 'Link copied to clipboard',
                        type: 'success',
                      });
                      setTimeout(() => setCopied(false), 2000);
                    } catch {
                      addToast({
                        title: 'Copy Failed',
                        description: 'Failed to copy link to clipboard',
                        type: 'error',
                      });
                    }
                  }}
                >
                  {copied ? <Check style={{ width: 16, height: 16 }} /> : <Copy style={{ width: 16, height: 16 }} />}
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setShareOpen(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// =============================================================================
// MONITORING TAB - Properly Wired Token Usage
// =============================================================================

function MonitoringTab({ agent }: { agent: Agent }) {
  const { runs, reviews, activeRunId } = useAgentStore();
  const unified = useUnifiedStore();
  const { addToast } = useToast();
  const agentRuns = runs[agent.id] || [];
  const agentReviews = reviews[agent.id] || [];
  const { snapshot, loading } = useTelemetrySnapshot(activeRunId);
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);
  const [processingReviewId, setProcessingReviewId] = useState<string | null>(null);

  // Calculate metrics
  const totalRuns = agentRuns.length;
  const completedRuns = agentRuns.filter(r => r.status === 'completed').length;
  const failedRuns = agentRuns.filter(r => r.status === 'failed').length;
  const successRate = totalRuns > 0 ? Math.round((completedRuns / totalRuns) * 100) : 0;
  const pendingReviews = agentReviews.filter(r => r.status === 'pending').length;

  // Real token usage from telemetry
  const tokenUsage = snapshot?.tokenUsage || { input: 0, output: 0, total: 0 };
  const cost = snapshot?.cost || 0;

  return (
    <ScrollArea style={{ height: '100%', padding: '20px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Metric Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
          <MetricCard label="Total Runs" value={totalRuns} icon={Activity} onClick={() => setSelectedMetric('runs')} />
          <MetricCard label="Success Rate" value={`${successRate}%`} icon={CheckCircle} color="#22c55e" onClick={() => setSelectedMetric('runs')} />
          <MetricCard label="Failed" value={failedRuns} icon={XCircle} color="#ef4444" onClick={() => setSelectedMetric('failed')} />
          <MetricCard label="Pending Reviews" value={pendingReviews} icon={Shield} color="#f59e0b" onClick={() => setSelectedMetric('reviews')} />
        </div>

        {/* Token Usage - REAL DATA */}
        <Section title="Token Usage" icon={TrendUp}>
          <div style={{ padding: '20px', borderRadius: '10px', border: `1px solid ${STUDIO_THEME.borderSubtle}`, background: STUDIO_THEME.bgCard }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '20px', color: STUDIO_THEME.textMuted }}>Loading telemetry...</div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <div>
                    <div style={{ fontSize: '24px', fontWeight: 600, color: STUDIO_THEME.textPrimary }}>{tokenUsage.total.toLocaleString()}</div>
                    <div style={{ fontSize: '12px', color: STUDIO_THEME.textMuted }}>Total tokens</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '18px', fontWeight: 600, color: STUDIO_THEME.accent }}>${cost.toFixed(4)}</div>
                    <div style={{ fontSize: '12px', color: STUDIO_THEME.textMuted }}>Estimated cost</div>
                  </div>
                </div>
                <div style={{ height: 8, background: STUDIO_THEME.bg, borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${Math.min((tokenUsage.input / (tokenUsage.total || 1)) * 100, 100)}%`, height: '100%', background: STUDIO_THEME.accent, borderRadius: 4, float: 'left' }} />
                  <div style={{ width: `${Math.min((tokenUsage.output / (tokenUsage.total || 1)) * 100, 100)}%`, height: '100%', background: '#22c55e', borderRadius: 4, float: 'left' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: '12px' }}>
                  <span style={{ color: STUDIO_THEME.accent }}>Input: {tokenUsage.input.toLocaleString()}</span>
                  <span style={{ color: '#22c55e' }}>Output: {tokenUsage.output.toLocaleString()}</span>
                </div>
              </>
            )}
          </div>
        </Section>

        {/* Model Usage */}
        {snapshot?.modelUsage && Object.keys(snapshot.modelUsage).length > 0 && (
          <Section title="Model Usage" icon={Cpu}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {Object.entries(snapshot.modelUsage).map(([model, usage]: [string, any]) => (
                <div key={model} style={{ padding: '14px 16px', borderRadius: '10px', border: `1px solid ${STUDIO_THEME.borderSubtle}`, background: STUDIO_THEME.bgCard }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: STUDIO_THEME.textPrimary, fontWeight: 500 }}>{model}</span>
                    <span style={{ color: STUDIO_THEME.textMuted, fontSize: '12px' }}>{usage.messages} messages</span>
                  </div>
                  <div style={{ display: 'flex', gap: '16px', marginTop: 8, fontSize: '12px', color: STUDIO_THEME.textMuted }}>
                    <span>Tool calls: {usage.toolCalls}</span>
                    <span>Latency: {usage.latency}ms</span>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Recent Runs */}
        <Section title="Recent Execution Activity" icon={Terminal}>
          {agentRuns.slice(0, 5).map(run => (
            <div key={run.id} onClick={() => setSelectedMetric(`run-${run.id}`)} style={{ cursor: 'pointer', padding: '14px 16px', borderRadius: '10px', border: `1px solid ${STUDIO_THEME.borderSubtle}`, background: STUDIO_THEME.bgCard, marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Terminal style={{ width: 18, height: 18, color: STUDIO_THEME.accent }} />
                  <div>
                    <div style={{ color: STUDIO_THEME.textPrimary, fontSize: '14px' }}>Run {run.id.slice(0, 8)}</div>
                    <div style={{ color: STUDIO_THEME.textMuted, fontSize: '12px' }}>{run.runnerTrace?.length || 0} trace entries • {Math.round((run.elapsed || 0) / 1000)}s</div>
                  </div>
                </div>
                <StatusBadge status={run.status} />
              </div>
            </div>
          ))}
        </Section>

        {/* Telemetry Timeline */}
        {snapshot?.timeline && snapshot.timeline.length > 0 && (
          <Section title="Telemetry Timeline" icon={Clock}>
            <div style={{ padding: '16px', borderRadius: '10px', border: `1px solid ${STUDIO_THEME.borderSubtle}`, background: STUDIO_THEME.bgCard }}>
              {snapshot.timeline.map((entry: any, i: number) => (
                <div key={i} style={{ display: 'flex', gap: '12px', padding: '8px 0', borderBottom: i < (snapshot.timeline?.length ?? 0) - 1 ? `1px solid ${STUDIO_THEME.borderSubtle}` : 'none' }}>
                  <div style={{ color: STUDIO_THEME.textMuted, fontSize: '12px', minWidth: 60 }}>
                    {new Date(entry.timestamp).toLocaleTimeString()}
                  </div>
                  <div style={{ color: STUDIO_THEME.textPrimary, fontSize: '13px' }}>{entry.event}</div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Detail Overlay */}
        {selectedMetric && (
          <DetailOverlay 
            title={selectedMetric === 'runs' ? 'All Runs' : selectedMetric === 'failed' ? 'Failed Runs' : selectedMetric === 'reviews' ? 'Pending Reviews' : 'Details'}
            onClose={() => setSelectedMetric(null)}
          >
            {selectedMetric === 'runs' && agentRuns.map(run => (
              <div key={run.id} style={{ padding: '12px', borderBottom: `1px solid ${STUDIO_THEME.borderSubtle}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: STUDIO_THEME.textPrimary }}>Run {run.id.slice(0, 8)}</span>
                  <StatusBadge status={run.status} />
                </div>
                <div style={{ color: STUDIO_THEME.textMuted, fontSize: '12px' }}>{new Date(run.startedAt).toLocaleString()}</div>
              </div>
            ))}
            {selectedMetric === 'failed' && agentRuns.filter(r => r.status === 'failed').map(run => (
              <div key={run.id} style={{ padding: '12px', borderBottom: `1px solid ${STUDIO_THEME.borderSubtle}` }}>
                <div style={{ color: STUDIO_THEME.textPrimary }}>Run {run.id.slice(0, 8)}</div>
                <div style={{ color: '#ef4444', fontSize: '12px' }}>{(run.metadata?.error as string) || 'Unknown error'}</div>
              </div>
            ))}
            {selectedMetric === 'reviews' && agentReviews.filter(r => r.status === 'pending').map(review => (
              <div key={review.id} style={{ padding: '12px', borderBottom: `1px solid ${STUDIO_THEME.borderSubtle}` }}>
                <div style={{ color: STUDIO_THEME.textPrimary }}>{review.title}</div>
                <div style={{ color: STUDIO_THEME.textMuted, fontSize: '12px' }}>{review.description}</div>
                <div style={{ display: 'flex', gap: '8px', marginTop: 8 }}>
                  <Button 
                    size="sm" 
                    onClick={async () => {
                      setProcessingReviewId(review.id);
                      try {
                        await unified.decideReview(review.id, true, 'Approved from monitoring dashboard');
                        addToast({
                          title: 'Review Approved',
                          description: `Approved: ${review.title}`,
                          type: 'success',
                        });
                      } catch (error) {
                        addToast({
                          title: 'Approval Failed',
                          description: error instanceof Error ? error.message : 'Failed to approve review',
                          type: 'error',
                        });
                      } finally {
                        setProcessingReviewId(null);
                      }
                    }}
                    disabled={processingReviewId === review.id}
                  >
                    {processingReviewId === review.id ? (
                      <CircleNotch style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} />
                    ) : (
                      <ThumbsUp style={{ width: 14, height: 14 }} />
                    )}
                  </Button>
                  <Button 
                    size="sm" 
                    variant="destructive" 
                    onClick={async () => {
                      setProcessingReviewId(review.id);
                      try {
                        await unified.decideReview(review.id, false, 'Rejected from monitoring dashboard');
                        addToast({
                          title: 'Review Rejected',
                          description: `Rejected: ${review.title}`,
                          type: 'success',
                        });
                      } catch (error) {
                        addToast({
                          title: 'Rejection Failed',
                          description: error instanceof Error ? error.message : 'Failed to reject review',
                          type: 'error',
                        });
                      } finally {
                        setProcessingReviewId(null);
                      }
                    }}
                    disabled={processingReviewId === review.id}
                  >
                    {processingReviewId === review.id ? (
                      <CircleNotch style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} />
                    ) : (
                      <ThumbsDown style={{ width: 14, height: 14 }} />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </DetailOverlay>
        )}
      </div>
    </ScrollArea>
  );
}

// =============================================================================
// ENVIRONMENT TAB - With 8-cloud templates
// =============================================================================

function EnvironmentTab({ agent }: { agent: Agent }) {
  const { updateAgent } = useAgentStore();
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  
  // Load settings from agent config or use defaults
  const envConfig = (agent.config?.environment as Record<string, unknown>) || {};
  const [sandboxEnabled, setSandboxEnabled] = useState(envConfig.sandboxEnabled as boolean || false);
  const [cpuLimit, setCpuLimit] = useState(envConfig.cpuLimit as number || 2);
  const [memoryLimit, setMemoryLimit] = useState(envConfig.memoryLimit as number || 2048);
  const [image, setImage] = useState(envConfig.image as string || 'alpine:latest');
  const [envTemplate, setEnvTemplate] = useState<'minimal' | 'nodejs' | 'python' | 'rust' | 'chrome'>((envConfig.template as 'minimal' | 'nodejs' | 'python' | 'rust' | 'chrome') || 'minimal');
  const [readOnlyRoot, setReadOnlyRoot] = useState(envConfig.readOnlyRoot as boolean || false);
  const [dropCapabilities, setDropCapabilities] = useState(envConfig.dropCapabilities as boolean || false);
  const [noNewPrivileges, setNoNewPrivileges] = useState(envConfig.noNewPrivileges as boolean || false);

  const templates = {
    minimal: { name: 'Minimal (Alpine)', image: 'alpine:latest', cpu: 1, memory: 512 },
    nodejs: { name: 'Node.js 20', image: 'node:20-alpine', cpu: 2, memory: 2048 },
    python: { name: 'Python 3.11', image: 'python:3.11-alpine', cpu: 2, memory: 2048 },
    rust: { name: 'Rust Development', image: 'rust:1.75-alpine', cpu: 4, memory: 4096 },
    chrome: { name: 'Chrome Streaming', image: 'chrome-stream:latest', cpu: 4, memory: 8192 },
  };

  const applyTemplate = (template: keyof typeof templates) => {
    const t = templates[template];
    setImage(t.image);
    setCpuLimit(t.cpu);
    setMemoryLimit(t.memory);
    setEnvTemplate(template);
  };
  
  const handleSave = async () => {
    setIsSaving(true);
    setSaveMessage(null);
    try {
      await updateAgent(agent.id, {
        config: {
          ...agent.config,
          environment: {
            sandboxEnabled,
            cpuLimit,
            memoryLimit,
            image,
            template: envTemplate,
            readOnlyRoot,
            dropCapabilities,
            noNewPrivileges,
            lastUpdated: new Date().toISOString(),
          }
        }
      });
      setSaveMessage('Environment settings saved successfully');
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (e) {
      setSaveMessage('Failed to save environment settings');
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <ScrollArea style={{ height: '100%', padding: '20px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Environment Templates */}
        <Section title="Environment Templates" icon={Cube}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
            {Object.entries(templates).map(([key, template]) => (
              <button
                key={key}
                onClick={() => applyTemplate(key as any)}
                style={{
                  padding: '16px', borderRadius: '10px', border: `1px solid ${envTemplate === key ? STUDIO_THEME.accent : STUDIO_THEME.borderSubtle}`,
                  background: envTemplate === key ? `${STUDIO_THEME.accent}15` : STUDIO_THEME.bgCard,
                  cursor: 'pointer', textAlign: 'left',
                }}
              >
                <div style={{ fontSize: '14px', fontWeight: 500, color: STUDIO_THEME.textPrimary }}>{template.name}</div>
                <div style={{ fontSize: '12px', color: STUDIO_THEME.textMuted, marginTop: 4 }}>{template.cpu} CPU • {template.memory}MB</div>
              </button>
            ))}
          </div>
        </Section>

        {/* Sandbox Configuration */}
        <Section title="Sandbox Configuration" icon={HardDrive}>
          <div style={{ padding: '20px', borderRadius: '10px', border: `1px solid ${STUDIO_THEME.borderSubtle}`, background: STUDIO_THEME.bgCard }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div>
                <div style={{ fontSize: '16px', fontWeight: 600, color: STUDIO_THEME.textPrimary }}>Enable Sandbox</div>
                <div style={{ fontSize: '13px', color: STUDIO_THEME.textMuted }}>Run agent in isolated container</div>
              </div>
              <Switch checked={sandboxEnabled} onCheckedChange={setSandboxEnabled} />
            </div>
            
            {sandboxEnabled && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: STUDIO_THEME.textSecondary, marginBottom: 8 }}>Container Image</label>
                  <Select value={image} onValueChange={setImage}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="alpine:latest">Alpine Linux (Minimal)</SelectItem>
                      <SelectItem value="ubuntu:22.04">Ubuntu 22.04 LTS</SelectItem>
                      <SelectItem value="node:20-alpine">Node.js 20</SelectItem>
                      <SelectItem value="python:3.11-alpine">Python 3.11</SelectItem>
                      <SelectItem value="rust:1.75-alpine">Rust 1.75</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: STUDIO_THEME.textSecondary, marginBottom: 8 }}>CPU Cores: {cpuLimit}</label>
                  <Slider value={[cpuLimit]} onValueChange={v => setCpuLimit(v[0])} min={1} max={8} step={1} />
                </div>
                
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: STUDIO_THEME.textSecondary, marginBottom: 8 }}>Memory: {memoryLimit} MB</label>
                  <Slider value={[memoryLimit]} onValueChange={v => setMemoryLimit(v[0])} min={512} max={16384} step={512} />
                </div>
                
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: STUDIO_THEME.textSecondary, cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={readOnlyRoot}
                      onChange={(e) => setReadOnlyRoot(e.target.checked)}
                    /> Read-only root filesystem
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: STUDIO_THEME.textSecondary, cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={dropCapabilities}
                      onChange={(e) => setDropCapabilities(e.target.checked)}
                    /> Drop all capabilities
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: STUDIO_THEME.textSecondary, cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={noNewPrivileges}
                      onChange={(e) => setNoNewPrivileges(e.target.checked)}
                    /> No new privileges
                  </label>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '8px' }}>
                  <Button 
                    onClick={handleSave} 
                    disabled={isSaving}
                    style={{ background: STUDIO_THEME.accent, color: STUDIO_THEME.bg }}
                  >
                    {isSaving ? 'Saving...' : 'Apply Changes'}
                  </Button>
                  {saveMessage && (
                    <span style={{ 
                      fontSize: '13px', 
                      color: saveMessage.includes('success') ? '#22c55e' : '#ef4444' 
                    }}>
                      {saveMessage}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </Section>

        {/* Environment Spec */}
        <Section title="Environment Specification" icon={FileCode}>
          <Tabs defaultValue="devcontainer">
            <TabsList>
              <TabsTrigger value="devcontainer">DevContainer</TabsTrigger>
              <TabsTrigger value="nix">Nix</TabsTrigger>
              <TabsTrigger value="dockerfile">Dockerfile</TabsTrigger>
            </TabsList>
            <TabsContent value="devcontainer">
              <Textarea 
                defaultValue={`{
  "name": "${agent.name} Environment",
  "image": "${image}",
  "features": {
    "ghcr.io/devcontainers/features/node:1": {},
    "ghcr.io/devcontainers/features/python:1": {}
  },
  "postCreateCommand": "npm install",
  "customizations": {
    "vscode": {
      "extensions": ["dbaeumer.vscode-eslint"]
    }
  }
}`}
                style={{ minHeight: 200, fontFamily: 'monospace', fontSize: '13px' }}
              />
            </TabsContent>
            <TabsContent value="nix">
              <Textarea 
                defaultValue={`{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  buildInputs = with pkgs; [
    nodejs_20
    python311
    git
  ];
  
  shellHook = ''
    echo "${agent.name} environment loaded"
  '';
}`}
                style={{ minHeight: 200, fontFamily: 'monospace', fontSize: '13px' }}
              />
            </TabsContent>
            <TabsContent value="dockerfile">
              <Textarea 
                defaultValue={`FROM ${image}

WORKDIR /workspace

# Install dependencies
RUN apk add --no-cache git curl

# Copy agent files
COPY . .

CMD ["sh"]`}
                style={{ minHeight: 200, fontFamily: 'monospace', fontSize: '13px' }}
              />
            </TabsContent>
          </Tabs>
        </Section>

        {/* Volume Mounts */}
        <Section title="Volume Mounts" icon={FolderOpen}>
          <div style={{ padding: '16px', borderRadius: '10px', border: `1px solid ${STUDIO_THEME.borderSubtle}`, background: STUDIO_THEME.bgCard }}>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
              <Input placeholder="Host path (e.g., /home/user/data)" style={{ flex: 1 }} />
              <Input placeholder="Container path (e.g., /data)" style={{ flex: 1 }} />
              <Button variant="outline" size="sm">Add</Button>
            </div>
            <div style={{ fontSize: '12px', color: STUDIO_THEME.textMuted }}>
              No volume mounts configured
            </div>
          </div>
        </Section>
      </div>
    </ScrollArea>
  );
}

// =============================================================================
// SWARM TAB - Multi-Agent Orchestration
// =============================================================================

function SwarmTab({ agent }: { agent: Agent }) {
  const { agents, updateAgent, sendMail } = useAgentStore();
  const subAgents = agents.filter(a => a.parentAgentId === agent.id);
  const availableAgents = agents.filter(a => a.id !== agent.id);
  const [showAddSubagent, setShowAddSubagent] = useState(false);
  const [swarmStrategy, setSwarmStrategy] = useState((agent.config?.swarmStrategy as string) || 'hierarchical');
  const [coordinatingWith, setCoordinatingWith] = useState<string | null>(null);
  const [coordinationMessage, setCoordinationMessage] = useState<string | null>(null);
  
  const handleStrategyChange = async (strategy: string) => {
    setSwarmStrategy(strategy);
    await updateAgent(agent.id, {
      config: { ...agent.config, swarmStrategy: strategy }
    });
  };
  
  const handleCoordinate = async (targetAgentId: string) => {
    setCoordinatingWith(targetAgentId);
    try {
      const targetAgent = agents.find(a => a.id === targetAgentId);
      if (!targetAgent) return;
      
      // Send coordination request via mail system
      await sendMail(
        agent.id,
        targetAgentId,
        `Coordination Request from ${agent.name}`,
        `Agent ${agent.name} wants to coordinate with you using the "${swarmStrategy}" strategy.\n\nPlease acknowledge to begin collaboration.`
      );
      
      setCoordinationMessage(`Coordination request sent to ${targetAgent.name}`);
      setTimeout(() => setCoordinationMessage(null), 3000);
    } catch (e) {
      console.error('Failed to coordinate:', e);
      setCoordinationMessage('Failed to send coordination request');
    } finally {
      setCoordinatingWith(null);
    }
  };

  return (
    <ScrollArea style={{ height: '100%', padding: '20px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Sub-Agents */}
        <Section title={`Sub-Agents (${subAgents.length})`} icon={Users}>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
            <Button onClick={() => setShowAddSubagent(true)} style={{ background: STUDIO_THEME.accent, color: STUDIO_THEME.bg }}>
              <Plus style={{ width: 16, height: 16, marginRight: 8 }} />Add Sub-Agent
            </Button>
          </div>
          
          {subAgents.length === 0 ? <EmptyMessage>No sub-agents configured</EmptyMessage> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {subAgents.map(subAgent => (
                <div key={subAgent.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', borderRadius: '10px', border: `1px solid ${STUDIO_THEME.borderSubtle}`, background: STUDIO_THEME.bgCard }}>
                  <div style={{ width: 40, height: 40, borderRadius: 8, overflow: 'hidden' }}>
                    <AgentAvatar config={subAgent.config?.avatar as any} size={40} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: STUDIO_THEME.textPrimary, fontSize: '14px', fontWeight: 500 }}>{subAgent.name}</div>
                    <div style={{ color: STUDIO_THEME.textMuted, fontSize: '12px' }}>{subAgent.type} • {subAgent.model}</div>
                  </div>
                  <StatusBadge status={subAgent.status} />
                  <Button variant="ghost" size="sm"><DotsThreeVertical style={{ width: 16, height: 16 }} /></Button>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Available Agents */}
        <Section title="Available Agents" icon={Globe}>
          {availableAgents.length === 0 ? <EmptyMessage>No other agents available</EmptyMessage> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {availableAgents.slice(0, 5).map(otherAgent => (
                <div key={otherAgent.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', borderRadius: '10px', border: `1px solid ${STUDIO_THEME.borderSubtle}`, background: STUDIO_THEME.bgCard }}>
                  <div style={{ width: 40, height: 40, borderRadius: 8, overflow: 'hidden' }}>
                    <AgentAvatar config={otherAgent.config?.avatar as any} size={40} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: STUDIO_THEME.textPrimary, fontSize: '14px', fontWeight: 500 }}>{otherAgent.name}</div>
                    <div style={{ color: STUDIO_THEME.textMuted, fontSize: '12px' }}>{otherAgent.type}</div>
                  </div>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => handleCoordinate(otherAgent.id)}
                    disabled={coordinatingWith === otherAgent.id}
                  >
                    {coordinatingWith === otherAgent.id ? 'Sending...' : 'Coordinate'}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Coordination Status */}
        {coordinationMessage && (
          <div style={{ 
            padding: '12px 16px', 
            background: coordinationMessage.includes('sent') ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
            borderRadius: '8px',
            color: coordinationMessage.includes('sent') ? '#22c55e' : '#ef4444',
            fontSize: '13px'
          }}>
            {coordinationMessage}
          </div>
        )}
        
        {/* Swarm Strategy */}
        <Section title="Swarm Strategy" icon={GitBranch}>
          <div style={{ padding: '20px', borderRadius: '10px', border: `1px solid ${STUDIO_THEME.borderSubtle}`, background: STUDIO_THEME.bgCard }}>
            <Select value={swarmStrategy} onValueChange={handleStrategyChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="hierarchical">Hierarchical (Leader-based)</SelectItem>
                <SelectItem value="democratic">Democratic (Voting)</SelectItem>
                <SelectItem value="round-robin">Round Robin</SelectItem>
                <SelectItem value="competitive">Competitive (Best result)</SelectItem>
                <SelectItem value="collaborative">Collaborative (Consensus)</SelectItem>
                <SelectItem value="specialist">Specialist (Capability-based)</SelectItem>
              </SelectContent>
            </Select>
            <div style={{ marginTop: '16px', padding: '12px', background: STUDIO_THEME.bg, borderRadius: '8px', fontSize: '13px', color: STUDIO_THEME.textSecondary }}>
              {swarmStrategy === 'hierarchical' && 'The orchestrator agent delegates tasks to sub-agents and makes final decisions.'}
              {swarmStrategy === 'democratic' && 'All agents vote on decisions. Majority wins.'}
              {swarmStrategy === 'round-robin' && 'Tasks are distributed evenly across all agents.'}
              {swarmStrategy === 'competitive' && 'Multiple agents work on the same task. Best result is selected.'}
              {swarmStrategy === 'collaborative' && 'Agents work together to reach consensus on solutions.'}
              {swarmStrategy === 'specialist' && 'Tasks are routed to agents based on their capabilities.'}
            </div>
          </div>
        </Section>
      </div>
    </ScrollArea>
  );
}

// =============================================================================
// CHARACTER TAB - Actually Changes Agent
// =============================================================================

function CharacterTab({ agent, stats }: { agent: Agent; stats?: CharacterStats }) {
  const { character, characterTelemetry, loadCharacterLayer, saveCharacterLayer, updateAgent } = useAgentStore();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editedStats, setEditedStats] = useState<Record<string, number>>({});
  const [selectedSetup, setSelectedSetup] = useState((agent.config?.characterBlueprint as any)?.setup || 'generalist');
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([]);
  const telemetry = characterTelemetry[agent.id] || [];
  const charConfig = character[agent.id];

  useEffect(() => {
    loadCharacterLayer(agent.id);
  }, [agent.id]);

  useEffect(() => {
    if (stats) setEditedStats(stats.stats);
  }, [stats]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Save character stats
      await saveCharacterLayer(agent.id, {
        ...charConfig,
        progression: {
          ...charConfig?.progression,
          stats: editedStats as any,
        },
      });
      
      // Update agent configuration
      await updateAgent(agent.id, {
        config: {
          ...agent.config,
          characterBlueprint: {
            setup: selectedSetup,
            specialtySkills: selectedSpecialties,
          },
        },
      });
      
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const setupOptions = CHARACTER_SETUPS;
  const specialtyOptions = getSpecialtyOptions(selectedSetup);

  if (!stats) return <EmptyMessage>No character data available</EmptyMessage>;

  return (
    <ScrollArea style={{ height: '100%', padding: '20px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '20px', padding: '24px',
          borderRadius: '12px', border: `1px solid ${STUDIO_THEME.borderSubtle}`,
          background: `linear-gradient(135deg, ${STUDIO_THEME.bgCard} 0%, rgba(212,149,106,0.08) 100%)`,
        }}>
          <div style={{ width: 80, height: 80, borderRadius: 16, overflow: 'hidden', border: `2px solid ${STUDIO_THEME.accent}` }}>
            <AgentAvatar config={agent.config?.avatar as any} size={80} />
          </div>
          <div style={{ flex: 1 }}>
            {isEditing ? (
              <>
                <Select value={selectedSetup} onValueChange={setSelectedSetup}>
                  <SelectTrigger style={{ marginBottom: 8 }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {setupOptions.map(setup => (
                      <SelectItem key={setup.id} value={setup.id}>{setup.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div style={{ color: STUDIO_THEME.accent, fontSize: '14px' }}>
                  Level {stats.level} • {stats.xp} XP
                </div>
              </>
            ) : (
              <>
                <h2 style={{ color: STUDIO_THEME.textPrimary, margin: 0, fontSize: '24px', fontWeight: 600, fontFamily: 'Georgia, serif' }}>
                  {stats.class}
                </h2>
                <p style={{ color: STUDIO_THEME.accent, margin: '4px 0 0 0', fontSize: '16px' }}>
                  Level {stats.level} • {stats.xp} XP
                </p>
              </>
            )}
          </div>
          <Button onClick={() => isEditing ? handleSave() : setIsEditing(true)} disabled={isSaving}>
            {isSaving ? <CircleNotch style={{ width: 16, height: 16, marginRight: 8, animation: 'spin 1s linear infinite' }} /> : isEditing ? <><Check style={{ width: 16, height: 16, marginRight: 8 }} />Save</> : <><PencilSimple style={{ width: 16, height: 16, marginRight: 8 }} />Edit</>}
          </Button>
        </div>

        {/* Specialties */}
        {isEditing && (
          <Section title="Specialties" icon={Sparkle}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {specialtyOptions.map((specialty: string) => (
                <button
                  key={specialty}
                  onClick={() => {
                    setSelectedSpecialties(prev => 
                      prev.includes(specialty) 
                        ? prev.filter(s => s !== specialty)
                        : [...prev, specialty]
                    );
                  }}
                  style={{
                    padding: '8px 16px', borderRadius: '20px', border: 'none',
                    background: selectedSpecialties.includes(specialty) ? STUDIO_THEME.accent : STUDIO_THEME.bgCard,
                    color: selectedSpecialties.includes(specialty) ? STUDIO_THEME.bg : STUDIO_THEME.textSecondary,
                    cursor: 'pointer', fontSize: '13px',
                  }}
                >
                  {specialty}
                </button>
              ))}
            </div>
          </Section>
        )}

        {/* Stats */}
        <Section title="Attributes" icon={Activity}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {stats.statDefinitions?.map(stat => {
              const value = editedStats[stat.key] ?? stats.stats[stat.key] ?? 0;
              return (
                <div key={stat.key}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ color: STUDIO_THEME.textSecondary, fontSize: '14px' }}>{stat.label}</span>
                    {isEditing ? (
                      <Input 
                        type="number" 
                        value={value} 
                        onChange={e => setEditedStats(s => ({ ...s, [stat.key]: parseInt(e.target.value) || 0 }))}
                        style={{ width: 80, textAlign: 'right' }}
                      />
                    ) : (
                      <span style={{ color: STUDIO_THEME.textPrimary, fontWeight: 600 }}>{value}</span>
                    )}
                  </div>
                  <div style={{ height: 8, backgroundColor: STUDIO_THEME.bgCard, borderRadius: 4, overflow: 'hidden', border: `1px solid ${STUDIO_THEME.borderSubtle}` }}>
                    <div style={{ width: `${Math.min(value, 100)}%`, height: '100%', background: `linear-gradient(90deg, ${STUDIO_THEME.accent}, ${STUDIO_THEME.accent}aa)`, borderRadius: 4 }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Section>

        {/* Telemetry */}
        <Section title="Recent Activity" icon={Clock}>
          {telemetry.slice(0, 5).map((event, i) => (
            <div key={i} style={{ padding: '12px 16px', borderRadius: '8px', border: `1px solid ${STUDIO_THEME.borderSubtle}`, background: STUDIO_THEME.bgCard, marginBottom: '8px' }}>
              <div style={{ color: STUDIO_THEME.textPrimary, fontSize: '13px', textTransform: 'capitalize' }}>
                {event.type.replace(/_/g, ' ')}
              </div>
              <div style={{ color: STUDIO_THEME.textMuted, fontSize: '12px' }}>
                {new Date(event.timestamp).toLocaleString()}
              </div>
            </div>
          ))}
          {telemetry.length === 0 && <EmptyMessage>No recent activity</EmptyMessage>}
        </Section>
      </div>
    </ScrollArea>
  );
}

// =============================================================================

function SettingsTab({ agent }: { agent: Agent }) {
  const { updateAgent, deleteAgent, selectAgent } = useAgentStore();
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editConfig, setEditConfig] = useState({
    name: agent.name,
    description: agent.description || '',
    model: agent.model,
    provider: agent.provider,
    temperature: agent.temperature,
    maxIterations: agent.maxIterations,
    systemPrompt: agent.systemPrompt || '',
    capabilities: [...(agent.capabilities || [])],
  });
  const [newCapability, setNewCapability] = useState('');

  const handleSave = async () => {
    await updateAgent(agent.id, editConfig);
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await deleteAgent(agent.id);
      selectAgent(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const addCapability = () => {
    if (newCapability && !editConfig.capabilities.includes(newCapability)) {
      setEditConfig(c => ({ ...c, capabilities: [...c.capabilities, newCapability] }));
      setNewCapability('');
    }
  };

  const removeCapability = (cap: string) => {
    setEditConfig(c => ({ ...c, capabilities: c.capabilities.filter(x => x !== cap) }));
  };

  return (
    <ScrollArea style={{ height: '100%', padding: '20px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: 700, paddingBottom: 40 }}>
        {/* Basic Info */}
        <Section title="Basic Information" icon={UserCircle}>
          <div style={{ padding: '20px', borderRadius: '10px', border: `1px solid ${STUDIO_THEME.borderSubtle}`, background: STUDIO_THEME.bgCard }}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', color: STUDIO_THEME.textSecondary, marginBottom: 8 }}>Agent Name</label>
              <Input value={editConfig.name} onChange={e => setEditConfig(c => ({ ...c, name: e.target.value }))} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: STUDIO_THEME.textSecondary, marginBottom: 8 }}>Description</label>
              <Textarea value={editConfig.description} onChange={e => setEditConfig(c => ({ ...c, description: e.target.value }))} />
            </div>
          </div>
        </Section>

        {/* Model Configuration */}
        <Section title="Model Configuration" icon={Cpu}>
          <div style={{ padding: '20px', borderRadius: '10px', border: `1px solid ${STUDIO_THEME.borderSubtle}`, background: STUDIO_THEME.bgCard }}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', color: STUDIO_THEME.textSecondary, marginBottom: 8 }}>Provider</label>
              <Select value={editConfig.provider} onValueChange={v => setEditConfig(c => ({ ...c, provider: v as any }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="anthropic">Anthropic</SelectItem>
                  <SelectItem value="local">Local</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', color: STUDIO_THEME.textSecondary, marginBottom: 8 }}>Model</label>
              <Select value={editConfig.model} onValueChange={v => setEditConfig(c => ({ ...c, model: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                  <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                  <SelectItem value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</SelectItem>
                  <SelectItem value="claude-3-opus-20240229">Claude 3 Opus</SelectItem>
                  <SelectItem value="llama-3.1-70b">Llama 3.1 70B</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', color: STUDIO_THEME.textSecondary, marginBottom: 8 }}>
                Temperature: {editConfig.temperature}
              </label>
              <Slider value={[editConfig.temperature]} onValueChange={v => setEditConfig(c => ({ ...c, temperature: v[0] }))} min={0} max={2} step={0.1} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: STUDIO_THEME.textMuted, marginTop: 4 }}>
                <span>Deterministic</span>
                <span>Creative</span>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', color: STUDIO_THEME.textSecondary, marginBottom: 8 }}>
                Max Iterations: {editConfig.maxIterations}
              </label>
              <Slider value={[editConfig.maxIterations]} onValueChange={v => setEditConfig(c => ({ ...c, maxIterations: v[0] }))} min={1} max={50} step={1} />
            </div>
          </div>
        </Section>

        {/* System Prompt */}
        <Section title="System Prompt" icon={Chat}>
          <div style={{ padding: '20px', borderRadius: '10px', border: `1px solid ${STUDIO_THEME.borderSubtle}`, background: STUDIO_THEME.bgCard }}>
            <Textarea 
              value={editConfig.systemPrompt}
              onChange={e => setEditConfig(c => ({ ...c, systemPrompt: e.target.value }))}
              placeholder="Enter system prompt that defines the agent's behavior..."
              style={{ minHeight: 150 }}
            />
          </div>
        </Section>

        {/* Capabilities */}
        <Section title="Capabilities" icon={Lightning}>
          <div style={{ padding: '20px', borderRadius: '10px', border: `1px solid ${STUDIO_THEME.borderSubtle}`, background: STUDIO_THEME.bgCard }}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <Input 
                placeholder="Add capability..." 
                value={newCapability} 
                onChange={e => setNewCapability(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addCapability()}
              />
              <Button onClick={addCapability} size="sm"><Plus style={{ width: 16, height: 16 }} /></Button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {editConfig.capabilities.map(cap => (
                <Badge key={cap} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {cap}
                  <button onClick={() => removeCapability(cap)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}><X style={{ width: 12, height: 12 }} /></button>
                </Badge>
              ))}
            </div>
          </div>
        </Section>

        {/* Agent Metadata */}
        <Section title="Agent Metadata" icon={FileText}>
          <div style={{ padding: '20px', borderRadius: '10px', border: `1px solid ${STUDIO_THEME.borderSubtle}`, background: STUDIO_THEME.bgCard }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${STUDIO_THEME.borderSubtle}` }}>
              <span style={{ color: STUDIO_THEME.textSecondary }}>Agent ID</span>
              <code style={{ color: STUDIO_THEME.textPrimary, fontSize: '12px' }}>{agent.id}</code>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${STUDIO_THEME.borderSubtle}` }}>
              <span style={{ color: STUDIO_THEME.textSecondary }}>Created</span>
              <span style={{ color: STUDIO_THEME.textPrimary }}>{new Date(agent.createdAt).toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
              <span style={{ color: STUDIO_THEME.textSecondary }}>Type</span>
              <span style={{ color: STUDIO_THEME.textPrimary }}>{agent.type}</span>
            </div>
          </div>
        </Section>

        {/* Save Button */}
        <Button onClick={handleSave} style={{ background: STUDIO_THEME.accent, color: STUDIO_THEME.bg }}>
          <Check style={{ width: 16, height: 16, marginRight: 8 }} />Save All Changes
        </Button>

        {/* Danger Zone */}
        <div style={{ padding: '20px', borderRadius: '10px', border: '1px solid rgba(239,68,68,0.3)', backgroundColor: 'rgba(239,68,68,0.05)' }}>
          <h4 style={{ color: '#ef4444', margin: '0 0 16px 0', fontSize: '14px', fontWeight: 600 }}>Danger Zone</h4>
          <Button variant="destructive" onClick={() => setShowDeleteConfirm(true)} disabled={isDeleting}>
            <Trash style={{ width: 16, height: 16, marginRight: 8 }} />
            {isDeleting ? 'Deleting...' : 'Delete Agent'}
          </Button>
        </div>

        {/* Delete Confirmation */}
        {showDeleteConfirm && (
          <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Agent?</DialogTitle>
                <DialogDescription>
                  This will permanently delete <strong>{agent.name}</strong> and all associated data.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
                <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </ScrollArea>
  );
}

// =============================================================================
// OVERVIEW TAB - Agent Summary
// =============================================================================

function OverviewTab({ agent, stats }: { agent: Agent; stats?: CharacterStats }) {
  const { runs, tasks, mail } = useAgentStore();
  const agentRuns = runs[agent.id] || [];
  const agentTasks = tasks[agent.id] || [];
  const agentMail = mail[agent.id] || [];
  
  const recentRuns = agentRuns.slice(0, 3);
  const pendingTasks = agentTasks.filter(t => t.status === 'pending');
  const unreadMessages = agentMail.filter(m => m.status === 'unread').length;

  return (
    <ScrollArea style={{ height: '100%', padding: '20px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Quick Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
          <StatBox label="Total Runs" value={agentRuns.length} icon={Play} />
          <StatBox label="Pending Tasks" value={pendingTasks.length} icon={CheckSquare} />
          <StatBox label="Unread Messages" value={unreadMessages} icon={EnvelopeSimple} />
          <StatBox label="Level" value={stats?.level || 1} icon={UserCircle} />
        </div>

        {/* Recent Activity */}
        <Section title="Recent Runs" icon={Clock}>
          {recentRuns.length === 0 ? (
            <EmptyMessage>No recent runs</EmptyMessage>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {recentRuns.map(run => (
                <RunListItem key={run.id} run={run} compact />
              ))}
            </div>
          )}
        </Section>

        {/* Agent Description */}
        {agent.description && (
          <Section title="About" icon={UserCircle}>
            <div style={{ padding: '16px', borderRadius: '10px', border: `1px solid ${STUDIO_THEME.borderSubtle}`, background: STUDIO_THEME.bgCard, color: STUDIO_THEME.textSecondary, fontSize: '14px', lineHeight: 1.6 }}>
              {agent.description}
            </div>
          </Section>
        )}

        {/* Capabilities */}
        {agent.capabilities && agent.capabilities.length > 0 && (
          <Section title="Capabilities" icon={Lightning}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {agent.capabilities.map(cap => (
                <Badge key={cap} variant="outline">{cap}</Badge>
              ))}
            </div>
          </Section>
        )}
      </div>
    </ScrollArea>
  );
}

// =============================================================================
// TASKS TAB - Task Management
// =============================================================================

function TasksTab({ agent }: { agent: Agent }) {
  const { tasks, updateTask, fetchTasks } = useAgentStore();
  const agentTasks = tasks[agent.id] || [];
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all');

  useEffect(() => { fetchTasks(agent.id); }, [agent.id, fetchTasks]);

  const filteredTasks = useMemo(() => {
    if (filter === 'all') return agentTasks;
    return agentTasks.filter(t => t.status === filter);
  }, [agentTasks, filter]);

  const handleStatusChange = async (taskId: string, status: AgentTask['status']) => {
    await updateTask(agent.id, taskId, { status });
  };

  return (
    <ScrollArea style={{ height: '100%', padding: '20px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Filter */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {(['all', 'pending', 'completed'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '6px 12px', borderRadius: '6px', border: 'none',
                background: filter === f ? STUDIO_THEME.accent : STUDIO_THEME.bgCard,
                color: filter === f ? STUDIO_THEME.bg : STUDIO_THEME.textSecondary,
                fontSize: '12px', cursor: 'pointer', textTransform: 'capitalize',
              }}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Task List */}
        <Section title={`Tasks (${filteredTasks.length})`} icon={CheckSquare}>
          {filteredTasks.length === 0 ? (
            <EmptyMessage>No tasks found</EmptyMessage>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {filteredTasks.map(task => (
                <TaskListItem 
                  key={task.id} 
                  task={task} 
                  onStatusChange={status => handleStatusChange(task.id, status)}
                />
              ))}
            </div>
          )}
        </Section>
      </div>
    </ScrollArea>
  );
}

// =============================================================================
// CHECKPOINTS TAB - State Management
// =============================================================================

function CheckpointsTab({ agent }: { agent: Agent }) {
  const { checkpoints, fetchCheckpoints, restoreCheckpoint } = useAgentStore();
  const agentCheckpoints = checkpoints[agent.id] || [];

  useEffect(() => { fetchCheckpoints(agent.id); }, [agent.id, fetchCheckpoints]);

  const handleRestore = async (checkpointId: string) => {
    await restoreCheckpoint(agent.id, checkpointId);
  };

  return (
    <ScrollArea style={{ height: '100%', padding: '20px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Checkpoints List */}
        <Section title={`Saved States (${agentCheckpoints.length})`} icon={GitCommit}>
          {agentCheckpoints.length === 0 ? (
            <EmptyMessage>No checkpoints saved</EmptyMessage>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {agentCheckpoints.map(cp => (
                <div key={cp.id} style={{ padding: '14px 16px', borderRadius: '10px', border: `1px solid ${STUDIO_THEME.borderSubtle}`, background: STUDIO_THEME.bgCard }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ color: STUDIO_THEME.textPrimary, fontSize: '14px', fontWeight: 500 }}>{cp.label}</div>
                      <div style={{ color: STUDIO_THEME.textMuted, fontSize: '12px' }}>{new Date(cp.timestamp).toLocaleString()}</div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => handleRestore(cp.id)}>
                      <Archive style={{ width: 14, height: 14, marginRight: 6 }} />Restore
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>
    </ScrollArea>
  );
}

// =============================================================================
// UTILITY COMPONENTS
// =============================================================================

function Section({ title, icon: Icon, children }: { title: string; icon?: React.ElementType; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
        {Icon && <Icon style={{ width: 16, height: 16, color: STUDIO_THEME.accent }} />}
        <h4 style={{ color: STUDIO_THEME.textSecondary, margin: 0, fontSize: '11px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {title}
        </h4>
      </div>
      {children}
    </div>
  );
}

function StatBox({ label, value, icon: Icon, color }: { label: string; value: string | number; icon?: React.ElementType; color?: string }) {
  return (
    <div style={{ padding: '16px', borderRadius: '10px', border: `1px solid ${STUDIO_THEME.borderSubtle}`, background: STUDIO_THEME.bgCard, textAlign: 'center' }}>
      {Icon && <Icon style={{ width: 20, height: 20, color: color || STUDIO_THEME.accent, margin: '0 auto 8px' }} />}
      <div style={{ color: STUDIO_THEME.textPrimary, fontSize: '22px', fontWeight: 600 }}>{value}</div>
      <div style={{ color: STUDIO_THEME.textMuted, fontSize: '12px', marginTop: '4px' }}>{label}</div>
    </div>
  );
}

function MetricCard({ label, value, icon: Icon, color, onClick }: { label: string; value: string | number; icon: React.ElementType; color?: string; onClick?: () => void }) {
  return (
    <div onClick={onClick} style={{
      padding: '20px', borderRadius: '10px', border: `1px solid ${STUDIO_THEME.borderSubtle}`,
      background: STUDIO_THEME.bgCard, cursor: onClick ? 'pointer' : 'default',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ width: 40, height: 40, borderRadius: 8, background: color ? `${color}15` : `${STUDIO_THEME.accent}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon style={{ width: 20, height: 20, color: color || STUDIO_THEME.accent }} />
        </div>
        <div>
          <div style={{ color: STUDIO_THEME.textPrimary, fontSize: '20px', fontWeight: 600 }}>{value}</div>
          <div style={{ color: STUDIO_THEME.textMuted, fontSize: '12px' }}>{label}</div>
        </div>
      </div>
    </div>
  );
}

function DetailOverlay({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={onClose}>
      <div style={{ width: 700, maxHeight: '80vh', background: STUDIO_THEME.bgCard, borderRadius: 12, padding: 24, border: `1px solid ${STUDIO_THEME.borderSubtle}`, overflow: 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0, color: STUDIO_THEME.textPrimary }}>{title}</h3>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: STUDIO_THEME.textMuted, cursor: 'pointer' }}><X style={{ width: 20, height: 20 }} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function StatusBadge({ status, size = 'sm' }: { status: string; size?: 'sm' | 'lg' }) {
  const colors: Record<string, string> = {
    completed: '#22c55e', success: '#22c55e', failed: '#ef4444', error: '#ef4444',
    running: '#f59e0b', active: '#3b82f6', pending: STUDIO_THEME.textMuted,
    queued: STUDIO_THEME.textMuted, idle: STUDIO_THEME.textMuted, paused: '#f59e0b',
  };
  const color = colors[status] || STUDIO_THEME.textMuted;
  return (
    <span style={{
      padding: size === 'lg' ? '6px 14px' : '3px 10px', borderRadius: '20px',
      backgroundColor: `${color}15`, color, fontSize: size === 'lg' ? '12px' : '11px',
      fontWeight: 600, textTransform: 'capitalize',
    }}>
      {status}
    </span>
  );
}

function EmptyMessage({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: '40px 20px', color: STUDIO_THEME.textMuted, textAlign: 'center', fontSize: '14px', borderRadius: '10px', border: `1px dashed ${STUDIO_THEME.borderSubtle}` }}>
      {children}
    </div>
  );
}

function RunListItem({ run, onCancel, compact }: { run: AgentRun; onCancel?: () => void; compact?: boolean }) {
  return (
    <div style={{ padding: compact ? '12px' : '14px 16px', borderRadius: '10px', border: `1px solid ${STUDIO_THEME.borderSubtle}`, background: STUDIO_THEME.bgCard }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: STUDIO_THEME.textPrimary, fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {run.input?.slice(0, 50) || `Run ${run.id.slice(0, 8)}`}
          </div>
          {!compact && <div style={{ color: STUDIO_THEME.textMuted, fontSize: '12px', marginTop: 2 }}>{new Date(run.startedAt).toLocaleString()}</div>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <StatusBadge status={run.status} />
          {onCancel && <Button variant="ghost" size="sm" onClick={onCancel}><Trash style={{ width: 14, height: 14 }} /></Button>}
        </div>
      </div>
    </div>
  );
}

function TaskListItem({ task, onStatusChange, compact }: { task: AgentTask; onStatusChange?: (status: AgentTask['status']) => void; compact?: boolean }) {
  return (
    <div style={{ padding: compact ? '12px' : '14px 16px', borderRadius: '10px', border: `1px solid ${STUDIO_THEME.borderSubtle}`, background: STUDIO_THEME.bgCard }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ color: STUDIO_THEME.textPrimary, fontSize: '14px' }}>{task.title}</div>
          {!compact && task.description && <div style={{ color: STUDIO_THEME.textMuted, fontSize: '12px' }}>{task.description}</div>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <StatusBadge status={task.status} />
          {onStatusChange && task.status === 'in-progress' && (
            <Button variant="ghost" size="sm" onClick={() => onStatusChange('completed')}><CheckCircle style={{ width: 14, height: 14 }} /></Button>
          )}
        </div>
      </div>
    </div>
  );
}

// Add Tool Dialog
function AddToolDialog({ onClose, onAdd }: { onClose: () => void; onAdd: (tool: any) => void }) {
  const [toolData, setToolData] = useState({ name: '', description: '', parameters: '{}' });
  
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Custom Tool</DialogTitle>
          <DialogDescription>Register a new tool for this agent</DialogDescription>
        </DialogHeader>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Input placeholder="Tool name..." value={toolData.name} onChange={e => setToolData(d => ({ ...d, name: e.target.value }))} />
          <Input placeholder="Description..." value={toolData.description} onChange={e => setToolData(d => ({ ...d, description: e.target.value }))} />
          <Textarea placeholder="Parameters (JSON)..." value={toolData.parameters} onChange={e => setToolData(d => ({ ...d, parameters: e.target.value }))} style={{ minHeight: 100, fontFamily: 'monospace' }} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onAdd(toolData)} disabled={!toolData.name} style={{ background: STUDIO_THEME.accent, color: STUDIO_THEME.bg }}>Add Tool</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Add MCP Dialog
function AddMcpDialog({ onClose, onAdd }: { onClose: () => void; onAdd: (mcp: any) => void }) {
  const [mcpData, setMcpData] = useState({ name: '', url: '', type: 'http' as const });
  
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add MCP Connector</DialogTitle>
          <DialogDescription>Connect to a Model Context Protocol server</DialogDescription>
        </DialogHeader>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Input placeholder="Connector name..." value={mcpData.name} onChange={e => setMcpData(d => ({ ...d, name: e.target.value }))} />
          <Input placeholder="URL (e.g., https://api.example.com/mcp)..." value={mcpData.url} onChange={e => setMcpData(d => ({ ...d, url: e.target.value }))} />
          <Select value={mcpData.type} onValueChange={v => setMcpData(d => ({ ...d, type: v as any }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="http">HTTP</SelectItem>
              <SelectItem value="sse">Server-Sent Events (SSE)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onAdd(mcpData)} disabled={!mcpData.name || !mcpData.url} style={{ background: STUDIO_THEME.accent, color: STUDIO_THEME.bg }}>Add Connector</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default AgentDashboard;
