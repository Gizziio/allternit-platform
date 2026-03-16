/**
 * Agent Hub - Consolidated Agent Management View
 * 
 * Open layout matching Chat/Cowork/Code modes - transparent background, no container.
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import {
  Paintbrush,
  Globe,
  MessageSquareText,
  Brain,
  Search,
  ChevronDown,
  Check,
  Bot,
  Layers,
} from 'lucide-react';
import { AgentView } from './AgentView';
import { SkillsRegistryView } from './code/SkillsRegistryView';
import { useNativeAgentStore, useAgentStore, agentWorkspaceService } from '../lib/agents';
import { Input } from '@/components/ui/input';
import { WorkspaceTab } from './WorkspaceTab';

// CreateAgentForm component imported for studio tab
import { CreateAgentForm } from './AgentView';

type AgentTab = 'studio' | 'registry' | 'sessions' | 'memory' | 'workspace';

const TABS = [
  { id: 'studio' as AgentTab, label: 'Agent Studio', icon: Paintbrush },
  { id: 'registry' as AgentTab, label: 'Agent Registry', icon: Globe },
  { id: 'sessions' as AgentTab, label: 'Sessions', icon: MessageSquareText },
  { id: 'memory' as AgentTab, label: 'Memory', icon: Brain },
  { id: 'workspace' as AgentTab, label: 'Workspace', icon: Layers },
] as const;

// Stable context object for registry view (prevents unnecessary remounts)
const REGISTRY_CONTEXT = { viewType: 'registry', viewId: 'registry' };

export function AgentHub() {
  const [activeTab, setActiveTab] = useState<AgentTab>('studio');
  const [showDropdown, setShowDropdown] = useState(false);
  const [hoveredTab, setHoveredTab] = useState<AgentTab | null>(null);
  const [isClient, setIsClient] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const sessions = useNativeAgentStore((state) => state.sessions);
  const { agents, createAgent, fetchAgents, setViewMode } = useAgentStore();
  const gizziCreatingRef = useRef(false);
  const tabMenuRef = useRef<HTMLDivElement | null>(null);
  
  // Ensure default agent "Gizzi" exists on mount (only once)
  useEffect(() => {
    const ensureGizzi = async () => {
      // Prevent duplicate creation attempts
      if (gizziCreatingRef.current) return;
      
      await fetchAgents();
      
      // Check store directly to avoid stale closure
      const currentAgents = useAgentStore.getState().agents;
      const gizziAgents = currentAgents.filter((a: any) => a.name === 'Gizzi');
      
      // Remove duplicates if more than one Gizzi exists
      if (gizziAgents.length > 1) {
        console.log(`[AgentHub] Found ${gizziAgents.length} Gizzi agents, removing duplicates...`);
        const { deleteAgent } = useAgentStore.getState();
        // Keep the first one, delete the rest
        for (let i = 1; i < gizziAgents.length; i++) {
          try {
            await deleteAgent(gizziAgents[i].id);
            console.log(`[AgentHub] Deleted duplicate Gizzi: ${gizziAgents[i].id}`);
          } catch (e) {
            console.error(`[AgentHub] Failed to delete duplicate Gizzi: ${gizziAgents[i].id}`, e);
          }
        }
        // Refresh agents after deletion
        await fetchAgents();
        return;
      }
      
      if (gizziAgents.length === 0) {
        gizziCreatingRef.current = true;
        try {
          console.log('[AgentHub] Creating Gizzi agent with workspace...');
          
          // Create agent record
          const agent = await createAgent({
            name: 'Gizzi',
            description: 'Your personal A2R platform assistant. Always here to help.',
            type: 'worker',
            model: 'gpt-4o',
            provider: 'openai',
            capabilities: ['chat', 'help', 'navigation'],
            systemPrompt: 'You are Gizzi, the friendly platform assistant for A2R. Help users navigate and use the platform effectively.',
            tools: [],
            maxIterations: 10,
            temperature: 0.7,
          });
          
          // Create workspace with Gizzi template
          await agentWorkspaceService.create({
            name: 'Gizzi',
            description: 'Your personal A2R platform assistant. Always here to help.',
            type: 'worker',
            model: 'gpt-4o',
            provider: 'openai',
            capabilities: ['chat', 'help', 'navigation'],
            systemPrompt: 'You are Gizzi, the friendly platform assistant for A2R. Help users navigate and use the platform effectively.',
            tools: [],
            maxIterations: 10,
            temperature: 0.7,
          }, 'gizzi-platform');
          
          console.log('[AgentHub] Gizzi agent and workspace created successfully');
        } catch (e) {
          console.error('[AgentHub] Gizzi creation failed:', e);
        } finally {
          gizziCreatingRef.current = false;
        }
      } else {
        console.log('[AgentHub] Gizzi already exists, skipping creation');
      }
    };
    ensureGizzi();
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
    background: '#1f1f1f',
    border: '1px solid rgba(255,255,255,0.08)',
    boxShadow: '0 8px 24px rgba(0,0,0,0.38)',
    color: '#e5e5e5',
    fontSize: '14px',
    fontWeight: 400,
    cursor: 'pointer',
  };

  const dropdownStyle: React.CSSProperties = {
    position: 'absolute',
    top: 'calc(100% + 8px)',
    right: 0,
    minWidth: '228px',
    background: '#1f1f1f',
    borderRadius: '10px',
    border: '1px solid rgba(255,255,255,0.08)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    padding: '8px 0',
    zIndex: 70,
  };

  const dividerStyle: React.CSSProperties = {
    height: '1px',
    background: 'rgba(255,255,255,0.06)',
    margin: '6px 10px',
  };

  const menuItemStyle = (isActive: boolean, isHovered: boolean): React.CSSProperties => ({
    display: 'flex',
    width: '100%',
    alignItems: 'center',
    gap: '12px',
    padding: '8px 12px',
    background: isActive ? 'rgba(212,149,106,0.16)' : isHovered ? '#2a2a2a' : 'transparent',
    border: 'none',
    color: isActive ? '#f0c7a3' : '#e5e5e5',
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
                console.log('[AgentHub] Create cancelled, switching to registry');
                setActiveTab('registry');
              }}
              onShowForge={(name) => {
                console.log('[AgentHub] Forge animation shown for:', name);
              }}
              onComplete={(agent, workspaceCreated) => {
                console.log('[AgentHub] Agent creation complete:', agent?.id, 'workspace:', workspaceCreated);
                // Stay on studio but show success - let user see the forge animation complete
                // The form handles its own completion state
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
                  <MessageSquareText className="mx-auto h-12 w-12 text-white/20 mb-4" />
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
                      <Bot className="h-10 w-10 text-[#D4956A]/60" />
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
            className="h-full overflow-auto px-6 pb-6"
            style={{ height: '100%', minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}
          >
            <div className="max-w-3xl mx-auto">
              <div className="flex items-center gap-2 mb-6">
                <Search className="h-4 w-4 text-white/40" />
                <Input 
                  placeholder="Search agent memories..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-white/[0.03] border-white/[0.06] text-white placeholder:text-white/30"
                />
              </div>
              <div className="text-center py-12">
                <Brain className="mx-auto h-12 w-12 text-white/20 mb-4" />
                <h3 className="text-lg font-medium text-white/60 mb-2">Agent Memory</h3>
                <p className="text-sm text-white/40">Long-term memory and knowledge storage for agents.</p>
              </div>
            </div>
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
                  }}
                >
                  <button
                    onClick={() => setShowDropdown(!showDropdown)}
                    style={triggerStyle}
                  >
                    <ActiveIcon size={16} color="#a0a0a0" />
                    <span style={{ flex: 1 }}>{activeTabInfo.label}</span>
                    <ChevronDown
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
                              <Icon size={16} color={isActive ? '#d4956a' : '#a0a0a0'} />
                              <span style={{ flex: 1 }}>{tab.label}</span>
                              {isActive ? <Check size={14} color="#d4956a" /> : null}
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

export default AgentHub;
