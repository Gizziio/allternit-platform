/**
 * Agent Hub - Consolidated Agent Management View
 * 
 * Open layout matching Chat/Cowork/Code modes - transparent background, no container.
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import {
  PaintBrush,
  Globe,
  ChatText,
  Brain,
  CaretDown,
  Check,
  Robot,
  Stack,
  ChartLineUp,
  Sun,
  Moon,
} from '@phosphor-icons/react';
import { MemoryKernelView } from './MemoryKernelView';
import { PerformanceAnalyticsView } from '@/components/agents/PerformanceAnalyticsView';
import { AgentView } from './AgentView';
import { useAgentStore, agentWorkspaceService } from '../lib/agents';
import { useChatSessions } from './chat/ChatSessionStore';
import { WorkspaceTab } from './WorkspaceTab';
import { useStudioTheme } from './agent-view/useStudioTheme';
import { useThemeStore, resolveTheme } from '@/design/ThemeStore';

// CreateAgentForm component imported for studio tab
import { CreateAgentForm } from './AgentView';

type AgentTab = 'studio' | 'registry' | 'sessions' | 'memory' | 'analytics' | 'workspace';

const TABS = [
  { id: 'studio' as AgentTab, label: 'Agent Studio', icon: PaintBrush },
  { id: 'registry' as AgentTab, label: 'Agent Registry', icon: Globe },
  { id: 'sessions' as AgentTab, label: 'Sessions', icon: ChatText },
  { id: 'memory' as AgentTab, label: 'Memory', icon: Brain },
  { id: 'analytics' as AgentTab, label: 'Analytics', icon: ChartLineUp },
  { id: 'workspace' as AgentTab, label: 'Workspace', icon: Stack },
] as const;

// Stable context object for registry view (prevents unnecessary remounts)
const REGISTRY_CONTEXT = { viewType: 'registry', viewId: 'registry' };

export function AgentHub() {
  const [activeTab, setActiveTab] = useState<AgentTab>('studio');
  const [showDropdown, setShowDropdown] = useState(false);
  const [hoveredTab, setHoveredTab] = useState<AgentTab | null>(null);
  const [isClient, setIsClient] = useState(false);
  const sessions = useChatSessions();
  const { createAgent, fetchAgents } = useAgentStore();
  const STUDIO_THEME = useStudioTheme();
  const gizziCreatingRef = useRef(false);
  const tabMenuRef = useRef<HTMLDivElement | null>(null);
  
  // Ensure default agents exist on mount (only once)
  useEffect(() => {
    const seedAgents = async () => {
      if (gizziCreatingRef.current) return;
      
      await fetchAgents();
      const currentAgents = useAgentStore.getState().agents;
      
      // Deduplicate Gizzi
      const gizziAgents = currentAgents.filter((a: any) => a.name === 'Gizzi');
      if (gizziAgents.length > 1) {
        const { deleteAgent } = useAgentStore.getState();
        for (let i = 1; i < gizziAgents.length; i++) {
          try { await deleteAgent(gizziAgents[i].id); } catch (e) {}
        }
        await fetchAgents();
      }
      
      // Seed personal agent: Gizzi
      if (gizziAgents.length === 0) {
        gizziCreatingRef.current = true;
        try {
          await createAgent({
            name: 'Gizzi',
            description: 'Your personal Allternit platform assistant. Always here to help.',
            type: 'worker',
            model: 'gpt-4o',
            provider: 'openai',
            capabilities: ['chat', 'help', 'navigation'],
            systemPrompt: 'You are Gizzi, the friendly platform assistant for Allternit. Help users navigate and use the platform effectively.',
            tools: [],
            maxIterations: 10,
            temperature: 0.7,
            source: 'personal',
          });
          await agentWorkspaceService.create({
            name: 'Gizzi',
            description: 'Your personal Allternit platform assistant. Always here to help.',
            type: 'worker',
            model: 'gpt-4o',
            provider: 'openai',
            capabilities: ['chat', 'help', 'navigation'],
            systemPrompt: 'You are Gizzi, the friendly platform assistant for Allternit. Help users navigate and use the platform effectively.',
            tools: [],
            maxIterations: 10,
            temperature: 0.7,
          }, 'allternit-standard');
        } catch (e) {
          console.error('[AgentHub] Gizzi creation failed:', e);
        }
      }
      
      // Seed vendor agents (pre-built)
      const vendorSeeds = [
        {
          name: 'Deep Research',
          description: 'Get in-depth answers grounded in web research. Gathers and analyzes information from multiple sources to create a single, coherent summary.',
          capabilities: ['research', 'web-search', 'citations'],
        },
        {
          name: 'Code Assistant',
          description: 'Generate, review, and refactor code across any language. Understands context and suggests improvements.',
          capabilities: ['code', 'review', 'refactor'],
        },
        {
          name: 'Data Analyst',
          description: 'Upload CSV or Excel files and get automatic charts, insights, and SQL queries.',
          capabilities: ['data', 'charts', 'sql'],
        },
      ];
      
      for (const seed of vendorSeeds) {
        const exists = currentAgents.some((a: any) => a.name === seed.name && a.source === 'vendor');
        if (!exists) {
          try {
            await createAgent({
              name: seed.name,
              description: seed.description,
              type: 'specialist',
              model: 'gpt-4o',
              provider: 'openai',
              capabilities: seed.capabilities,
              tools: [],
              maxIterations: 10,
              temperature: 0.3,
              source: 'vendor',
            });
          } catch (e) {
            console.error(`[AgentHub] Failed to seed vendor agent ${seed.name}:`, e);
          }
        }
      }
      
      // Seed organization agents
      const orgSeeds = [
        {
          name: 'Data Catalyst',
          description: 'Analyze complex datasets to surface actionable business insights.',
          capabilities: ['analytics', 'reporting', 'forecasting'],
        },
        {
          name: 'Architect',
          description: 'Design and build complex system architectures with best practices.',
          capabilities: ['architecture', 'design', 'documentation'],
        },
      ];
      
      for (const seed of orgSeeds) {
        const exists = currentAgents.some((a: any) => a.name === seed.name && a.source === 'organization');
        if (!exists) {
          try {
            await createAgent({
              name: seed.name,
              description: seed.description,
              type: 'specialist',
              model: 'gpt-4o',
              provider: 'openai',
              capabilities: seed.capabilities,
              tools: [],
              maxIterations: 10,
              temperature: 0.4,
              source: 'organization',
            });
          } catch (e) {
            console.error(`[AgentHub] Failed to seed org agent ${seed.name}:`, e);
          }
        }
      }
      
      await fetchAgents();
      gizziCreatingRef.current = false;
    };
    seedAgents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeTabInfo = TABS.find(t => t.id === activeTab) || TABS[0];
  const ActiveIcon = activeTabInfo.icon;

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!showDropdown) return;
    const onPointerDown = (event: MouseEvent) => {
      if (tabMenuRef.current && !tabMenuRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    window.addEventListener('mousedown', onPointerDown);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
    };
  }, [showDropdown]);

  const triggerStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    minWidth: '208px',
    height: '36px',
    padding: '0 12px',
    borderRadius: '8px',
    background: STUDIO_THEME.bgCard,
    border: `1px solid ${STUDIO_THEME.borderSubtle}`,
    boxShadow: `0 8px 24px ${STUDIO_THEME.bg}80`,
    color: STUDIO_THEME.textPrimary,
    fontSize: '14px',
    fontWeight: 400,
    cursor: 'pointer',
  };

  const dropdownStyle: React.CSSProperties = {
    position: 'absolute',
    top: 'calc(100% + 8px)',
    right: 0,
    minWidth: '228px',
    background: STUDIO_THEME.bgCard,
    borderRadius: '10px',
    border: `1px solid ${STUDIO_THEME.borderSubtle}`,
    boxShadow: `0 8px 32px ${STUDIO_THEME.bg}80`,
    padding: '8px 0',
    zIndex: 70,
  };

  const dividerStyle: React.CSSProperties = {
    height: '1px',
    background: STUDIO_THEME.borderSubtle,
    margin: '6px 10px',
  };

  const menuItemStyle = (isActive: boolean, isHovered: boolean): React.CSSProperties => ({
    display: 'flex',
    width: '100%',
    alignItems: 'center',
    gap: '12px',
    padding: '8px 12px',
    background: isActive ? `${STUDIO_THEME.accent}25` : isHovered ? `${STUDIO_THEME.textPrimary}10` : 'transparent',
    border: 'none',
    color: isActive ? STUDIO_THEME.accent : STUDIO_THEME.textPrimary,
    fontSize: '14px',
    fontWeight: 400,
    textAlign: 'left',
    cursor: 'pointer',
    transition: 'background-color 0.15s ease',
  });

  const renderContent = () => {
    switch (activeTab) {
      case 'studio':
        // Agent Studio always shows create agent wizard
        return (
          <div className="h-full w-full" style={{ height: '100%', minHeight: 0, overflow: 'auto' }}>
            <CreateAgentForm 
              onCancel={() => {
                setActiveTab('registry');
              }}
              onShowForge={(name) => {
                console.log('[AgentHub] Forge animation shown for:', name);
              }}
              onComplete={(agent, workspaceCreated) => {
                // Auto-switch to registry so user sees their new agent
                setActiveTab('registry');
              }}
            />
          </div>
        );
      
      case 'registry':
        return (
          <div
            className="h-full overflow-auto px-6 pb-6"
            style={{ height: '100%', minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}
          >
            <AgentView context={REGISTRY_CONTEXT} forceListMode hideCreateButton />
          </div>
        );
      
      case 'sessions':
        return (
          <div
            className="h-full overflow-auto px-6 pb-6"
            style={{ height: '100%', minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}
          >
            {/* Sessions content */}
            <div className="max-w-5xl mx-auto space-y-4">
              {sessions.length === 0 ? (
                <div className="text-center py-12">
                  <ChatText className="mx-auto h-12 w-12 text-white/20 mb-4" />
                  <h3 className="text-lg font-medium text-white/60 mb-2">No active sessions</h3>
                  <p className="text-sm text-white/40">Start a conversation with an agent to see sessions here.</p>
                </div>
              ) : (
                sessions.map(session => (
                  <motion.div
                    key={session.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 rounded-lg border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <Robot className="h-10 w-10 text-[#D4956A]/60" />
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-medium text-white/80 truncate">{session.name || 'Untitled Session'}</h4>
                        <p className="text-xs text-white/40 truncate">{session.messageCount} messages</p>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        );
      
      case 'memory':
        return (
          <div
            className="h-full overflow-hidden"
            style={{ height: '100%', minHeight: 0, overflow: 'hidden' }}
          >
            <MemoryKernelView />
          </div>
        );
      
      case 'analytics':
        return (
          <div
            className="h-full overflow-auto px-6 pb-6"
            style={{ height: '100%', minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}
          >
            <PerformanceAnalyticsView />
          </div>
        );
      
      case 'workspace':
        return (
          <div
            className="h-full overflow-auto px-6 pb-6"
            style={{ height: '100%', minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}
          >
            <WorkspaceTab onSwitchToRegistry={() => setActiveTab('registry')} />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div
      className="h-full w-full bg-transparent text-white/90 overflow-hidden flex flex-col"
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      {/* Header - transparent */}
      <div
        className="flex items-center justify-end px-6 py-4 bg-transparent"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          width: '100%',
          height: 70,
          padding: '16px 24px',
          flexShrink: 0,
          pointerEvents: 'none',
        }}
      >
        {isClient
          ? createPortal(
              <div
                style={{
                  position: 'fixed',
                  inset: 0,
                  zIndex: 200,
                  pointerEvents: 'none',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  alignItems: 'flex-start',
                  padding: '24px',
                }}
              >
                <div
                  ref={tabMenuRef}
                  style={{
                    position: 'relative',
                    pointerEvents: 'auto',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                  }}
                >
                  {/* Theme Toggle */}
                  <AgentHubThemeToggle />
                  <button
                    onClick={() => setShowDropdown(!showDropdown)}
                    style={triggerStyle}
                  >
                    <ActiveIcon size={16} color="#a0a0a0" />
                    <span style={{ flex: 1 }}>{activeTabInfo.label}</span>
                    <CaretDown
                      size={14}
                      color="#9ca3af"
                      style={{
                        transform: showDropdown ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.15s ease',
                      }}
                    />
                  </button>

                  {showDropdown && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.14, ease: 'easeOut' }}
                      style={dropdownStyle}
                    >
                      {TABS.map((tab, index) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        const isHovered = hoveredTab === tab.id;
                        return (
                          <React.Fragment key={tab.id}>
                            {(index === 2 || index === 4) && <div style={dividerStyle} />}
                            <button
                              onClick={() => {
                                setActiveTab(tab.id);
                                setShowDropdown(false);
                              }}
                              onMouseEnter={() => setHoveredTab(tab.id)}
                              onMouseLeave={() => setHoveredTab(null)}
                              style={menuItemStyle(isActive, isHovered)}
                            >
                              <Icon size={16} color={isActive ? STUDIO_THEME.accent : STUDIO_THEME.textMuted} />
                              <span style={{ flex: 1 }}>{tab.label}</span>
                              {isActive ? <Check size={14} color={STUDIO_THEME.accent} /> : null}
                            </button>
                          </React.Fragment>
                        );
                      })}
                    </motion.div>
                  )}
                </div>
              </div>,
              document.body,
            )
          : null}
      </div>

      {/* Content area - full width, no max-w-7xl restriction */}
      <div
        className="flex-1 overflow-hidden"
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
          width: '100%',
        }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{ height: '100%', width: '100%', background: 'transparent' }}
            className="bg-transparent"
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function AgentHubThemeToggle() {
  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);
  const resolved = resolveTheme(theme);

  return (
    <button
      type="button"
      onClick={() => setTheme(resolved === 'dark' ? 'light' : 'dark')}
      title={`Theme: ${resolved}. Click to toggle.`}
      aria-label={`Switch to ${resolved === 'dark' ? 'light' : 'dark'} mode`}
      style={{
        width: 36,
        height: 36,
        borderRadius: '8px',
        border: '1px solid var(--ui-border-muted)',
        background: 'var(--surface-panel)',
        color: '#a0a0a0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.color = 'var(--accent-primary)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.color = '#a0a0a0';
      }}
    >
      {resolved === 'dark' ? (
        <Moon size={18} />
      ) : (
        <Sun size={18} />
      )}
    </button>
  );
}

export default AgentHub;
