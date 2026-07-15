import React, { useState, useEffect } from 'react';
import {
  Clock,
  Chat,
  FileText,
  Folder,
  SquaresFour,
  X,
  Code,
  MagnifyingGlass,
  CaretRight,
} from '@phosphor-icons/react';

import { ChatComposer } from '../chat/ChatComposer';
import { useModelSelection } from '@/providers/model-selection-provider';
import { ModelPicker } from '@/components/model-picker';
import { useSurfaceAgentModeEnabled } from '@/lib/agents/surface-agent-context';
import { RecentSessionsStrip } from './RecentSessionsStrip';
import { AgentModeBackdrop } from '../chat/agentModeSurfaceTheme';
import {
  LAUNCH_TOP_PADDING,
  LAUNCH_SECTION_GAP,
  LAUNCH_COMPOSER_WIDTH,
} from '../chat/main/launchScreenLayout';
import { LaunchHeader } from '../chat/main/LaunchHeader';
import {
  DEFAULT_LAUNCH_GREETING,
  getLaunchGreeting,
  peekLaunchGreeting,
} from '../chat/main/launchGreeting';

interface CoworkLaunchpadProps {
  onStartChat: (text: string) => void;
  onResumeThread: (id: string) => void;
}

export function CoworkLaunchpad({ onStartChat, onResumeThread }: CoworkLaunchpadProps) {
  const agentModeEnabled = useSurfaceAgentModeEnabled('cowork');
  const { selection: modelSelection, selectModel, startSelection, isSelecting, cancelSelection } = useModelSelection();
  const [showPluginsOverlay, setShowPluginsOverlay] = useState(false);
  // Same session greeting as the Chat launch screen — must not re-roll on toggle.
  const [greeting, setGreeting] = useState(() => peekLaunchGreeting() ?? DEFAULT_LAUNCH_GREETING);

  useEffect(() => {
    let cancelled = false;
    getLaunchGreeting().then((g) => {
      if (!cancelled) setGreeting(g);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleTaskClick = (prompt: string) => {
    // Start the chat immediately with the task prompt
    onStartChat(prompt);
  };

  return (
    <div style={{
      padding: `${LAUNCH_TOP_PADDING} 40px 80px`,
      height: '100%',
      overflowY: 'auto',
      background: 'transparent',
      color: 'var(--ui-text-primary)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      position: 'relative',
      isolation: 'isolate',
    }}>
      <AgentModeBackdrop
        active={agentModeEnabled}
        surface="cowork"
        dataTestId="agent-mode-cowork-backdrop"
      />
      <div style={{ width: '100%', maxWidth: '720px', position: 'relative', zIndex: 1 }}>
        {/* Greeting header — identical to the Chat launch screen (shared
            component + session greeting) so toggling modes doesn't change it. */}
        <LaunchHeader greeting={greeting} logo="matrix" />

        {/* Primary Functional Composer — same column width as the Chat
            launch screen. The attached CoworkTopDeck inside ChatComposer
            occupies the band where Chat shows its quick-action pill row. */}
        <div style={{
          width: '100%',
          maxWidth: LAUNCH_COMPOSER_WIDTH,
          margin: `0 auto ${LAUNCH_SECTION_GAP}px`,
        }}>
          <ChatComposer 
            onSend={onStartChat}
            variant="large"
            placeholder="What should we coordinate, build, or review?"
            selectedModel={modelSelection?.modelId}
            selectedModelDisplayName={modelSelection?.modelName || modelSelection?.modelId}
            onOpenModelPicker={startSelection}
            onSelectModel={selectModel}
            showTopActions={false}
            inputValue=""
            agentModeSurface="cowork"
          />
        </div>

        {/* Quick-start flows */}
        <section>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '14px' }}>
            <SquaresFour size={13} color="var(--ui-text-muted)" />
            <h2 style={{ fontSize: '11px', fontWeight: 700, color: 'var(--ui-text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', margin: 0 }}>
              Start with a cowork flow
            </h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {[
              {
                label: 'Plan a deliverable',
                hint: 'Goals, milestones, blockers',
                icon: <Clock size={20} weight="duotone" />,
                accent: 'rgba(200,169,110,0.18)',
                accentHover: 'rgba(200,169,110,0.28)',
                iconColor: 'rgba(200,169,110,0.9)',
                prompt: `Help me plan a deliverable from start to finish.\n1. Clarify the goal, owner, deadline, and dependencies.\n2. Break the work into milestones and concrete next actions.\n3. Call out blockers, missing context, and review points.\n4. End with a short execution plan I can actually run.`,
              },
              {
                label: 'Review workspace',
                hint: 'Files, gaps, next change',
                icon: <Folder size={20} weight="duotone" />,
                accent: 'rgba(99,179,237,0.14)',
                accentHover: 'rgba(99,179,237,0.24)',
                iconColor: 'rgba(99,179,237,0.9)',
                prompt: `Review the current workspace with me.\n1. Inspect the relevant files and summarize what exists today.\n2. Identify incomplete work, risky spots, and obvious cleanup.\n3. Point out the next highest-value change.\n4. If needed, ask for one clarification before acting.`,
              },
              {
                label: 'Coordinate next steps',
                hint: 'Status, actions, handoff',
                icon: <FileText size={20} weight="duotone" />,
                accent: 'rgba(154,205,132,0.14)',
                accentHover: 'rgba(154,205,132,0.24)',
                iconColor: 'rgba(154,205,132,0.85)',
                prompt: `Help me coordinate the next steps for this task.\n1. Summarize the current state in plain language.\n2. Separate what is done, in progress, and blocked.\n3. Draft the next actions for each person or system involved.\n4. End with a concise handoff note I can share.`,
              },
            ].map((task, i) => (
              <button type="button"
                key={task.label}
                onClick={() => handleTaskClick(task.prompt)}
                style={{
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: 10,
                  padding: '16px 14px',
                  background: task.accent,
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 12,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.15s, border-color 0.15s, transform 0.1s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = task.accentHover;
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.13)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = task.accent;
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                {/* Key hint */}
                <span style={{
                  position: 'absolute', top: 10, right: 10,
                  fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.2)',
                  background: 'rgba(255,255,255,0.06)', borderRadius: 4,
                  padding: '1px 5px', letterSpacing: '0.03em',
                }}>{i + 1}</span>
                <span style={{ color: task.iconColor }}>{task.icon}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ui-text-primary)', marginBottom: 3 }}>
                    {task.label}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--ui-text-muted)', lineHeight: 1.4 }}>
                    {task.hint}
                  </div>
                </div>
              </button>
            ))}
          </div>
          <button type="button"
            onClick={() => setShowPluginsOverlay(true)}
            style={{
              marginTop: '20px',
              background: 'none',
              border: 'none',
              fontSize: '12px',
              color: 'var(--ui-text-secondary)',
              fontWeight: 700,
              textTransform: 'uppercase',
              cursor: 'pointer',
              padding: 0,
              letterSpacing: '0.05em',
              opacity: 0.7,
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.7'; }}
          >
            Open tools
          </button>
        </section>

        {/* Recent Sessions */}
        <RecentSessionsStrip onResume={onResumeThread} />

        <ModelPicker
          open={isSelecting}
          onOpenChange={(open) => { if (!open) cancelSelection(); }}
          onSelect={selectModel}
          onCancel={cancelSelection}
          trigger={<div style={{ display: 'none' }} />}
        />
      </div>

      {/* Plugins Overlay */}
      {showPluginsOverlay && (
        <PluginsOverlay 
          onClose={() => setShowPluginsOverlay(false)}
          onStartChat={onStartChat}
        />
      )}
    </div>
  );
}

// ============================================================================
// Plugins Overlay Component
// ============================================================================

interface PluginsOverlayProps {
  onClose: () => void;
  onStartChat: (text: string) => void;
}

const BUILTIN_PLUGINS = [
  {
    id: 'calendar-optimizer',
    name: 'Calendar Optimizer',
    description: 'Analyzes your calendar and suggests focus blocks, meeting consolidations, and schedule improvements.',
    icon: <Clock size={24} />,
    category: 'Productivity',
    prompt: 'Please analyze my calendar for the upcoming week. I want to:\n1. Find gaps where I can add focus blocks\n2. Identify meetings that could be shorter or async\n3. Look for conflicts or back-to-back meetings\n4. Suggest optimal times for deep work\n\nShow me specific changes with explanations before making any edits.'
  },
  {
    id: 'file-organizer',
    name: 'File Organizer',
    description: 'Scans directories, groups files by context, and proposes organizational structures.',
    icon: <Folder size={24} />,
    category: 'Organization',
    prompt: 'I need help organizing files in my workspace. Please:\n1. Scan for screenshots, downloads, and documents from the last week\n2. Group them by type, project, or context\n3. Propose a folder structure\n4. Suggest descriptive names for untitled files\n\nShow me your plan before moving anything.'
  },
  {
    id: 'code-reviewer',
    name: 'Code Reviewer',
    description: 'Analyzes code for patterns, suggests refactoring, and identifies improvement areas.',
    icon: <Code size={24} />,
    category: 'Development',
    prompt: 'Please review my current project codebase:\n1. Identify patterns and architectural decisions\n2. Find areas that need refactoring or better documentation\n3. Look for potential bugs or edge cases\n4. Suggest improvements for readability and maintainability\n\nPresent a summary report with actionable recommendations.'
  },
  {
    id: 'research-assistant',
    name: 'Research Assistant',
    description: 'Gathers information, summarizes sources, and helps compile research documents.',
    icon: <MagnifyingGlass size={24} />,
    category: 'Research',
    prompt: 'Help me research the following topic. Please:\n1. Search for relevant sources and documentation\n2. Summarize key findings from multiple perspectives\n3. Identify conflicting information or gaps\n4. Compile a structured report with citations\n\nWhat topic would you like me to research?'
  },
  {
    id: 'email-drafter',
    name: 'Email Drafter',
    description: 'Drafts professional emails, follow-ups, and correspondence based on context.',
    icon: <Chat size={24} />,
    category: 'Communication',
    prompt: 'I need help drafting an email. Please provide:\n1. The recipient and their relationship to me\n2. The purpose of the email\n3. Any specific points that must be included\n4. The desired tone (formal, casual, urgent, etc.)\n\nI\'ll draft a version for your review and editing.'
  },
  {
    id: 'data-analyzer',
    name: 'Data Analyzer',
    description: 'Processes data files, generates insights, and creates visualizations.',
    icon: <SquaresFour size={24} />,
    category: 'Analytics',
    prompt: 'I have data I need analyzed. Please:\n1. Examine the data structure and format\n2. Calculate key statistics and metrics\n3. Identify trends, outliers, or patterns\n4. Generate charts or visualizations if helpful\n5. Summarize insights in plain language\n\nWhat data would you like me to analyze?'
  }
];

function PluginsOverlay({ onClose, onStartChat }: PluginsOverlayProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  
  const categories = ['All', ...new Set(BUILTIN_PLUGINS.map(p => p.category))];
  
  const filteredPlugins = BUILTIN_PLUGINS.filter(plugin => {
    const matchesSearch = plugin.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         plugin.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !selectedCategory || selectedCategory === 'All' || plugin.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });
  
  const handleUsePlugin = (prompt: string) => {
    onStartChat(prompt);
    onClose();
  };
  
  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'var(--shell-overlay-backdrop)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 180,
      backdropFilter: 'blur(10px)',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '700px',
        maxHeight: '80vh',
        background: 'var(--surface-floating)',
        borderRadius: '24px',
        border: '1px solid var(--ui-border-default)',
        boxShadow: 'var(--shadow-xl)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '24px 32px',
          borderBottom: '1px solid var(--ui-border-muted)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}>
          <div>
            <h2 style={{ fontSize: '24px', fontWeight: 600, margin: '0 0 8px 0', color: 'var(--ui-text-primary)' }}>
              Plugins & Skills
            </h2>
            <p style={{ fontSize: '14px', color: 'var(--ui-text-muted)', margin: 0 }}>
              Ready-to-use workflows and capabilities for your Cowork sessions
            </p>
          </div>
          <button type="button"
            onClick={onClose}
            style={{
              background: 'var(--surface-hover)',
              border: 'none',
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--ui-text-muted)',
              transition: 'all var(--transition-fast)',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-active)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--surface-hover)'; }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Search & Filters */}
        <div style={{ padding: '20px 32px', borderBottom: '1px solid var(--ui-border-muted)' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            background: 'var(--bg-tertiary)',
            borderRadius: '12px',
            padding: '12px 16px',
            marginBottom: 16,
          }}>
            <MagnifyingGlass size={18} color="var(--ui-text-muted)" />
            <input aria-label="Search plugins…" type="text"
              placeholder="Search plugins…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: 'var(--ui-text-primary)',
                fontSize: '15px',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {categories.map(cat => {
              const isActive = selectedCategory === cat || (cat === 'All' && !selectedCategory);
              return (
                <button type="button"
                  key={cat}
                  onClick={() => setSelectedCategory(cat === 'All' ? null : cat)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '20px',
                    border: '1px solid var(--ui-border-default)',
                    background: isActive ? 'var(--accent-primary)' : 'transparent',
                    color: isActive ? 'var(--ui-text-inverse)' : 'var(--ui-text-secondary)',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all var(--transition-fast)',
                  }}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        {/* Plugins List */}
        <div style={{ flex: 1, overflow: 'auto', padding: '20px 32px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filteredPlugins.map(plugin => (
            <div
              key={plugin.id}
              style={{
                background: 'var(--surface-hover)',
                borderRadius: '16px',
                padding: '20px',
                border: '1px solid var(--ui-border-muted)',
                display: 'flex',
                gap: 16,
                transition: 'all var(--transition-fast)',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--ui-border-default)';
                e.currentTarget.style.background = 'var(--surface-active)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--ui-border-muted)';
                e.currentTarget.style.background = 'var(--surface-hover)';
              }}
            >
              <div style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: 'color-mix(in srgb, var(--accent-primary) 12%, var(--surface-panel))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-primary)',
                flexShrink: 0,
              }}>
                {plugin.icon}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--ui-text-primary)', margin: 0 }}>
                    {plugin.name}
                  </h3>
                  <span style={{ fontSize: '12px', color: 'var(--ui-text-muted)', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>
                    {plugin.category}
                  </span>
                </div>
                <p style={{ fontSize: '14px', color: 'var(--ui-text-secondary)', margin: '0 0 12px 0', lineHeight: 1.5 }}>
                  {plugin.description}
                </p>
                <button type="button"
                  onClick={() => handleUsePlugin(plugin.prompt)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    background: 'var(--accent-primary)',
                    color: 'var(--ui-text-inverse)',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'opacity var(--transition-fast)',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.88'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
                >
                  Use Plugin
                  <CaretRight size={14} />
                </button>
              </div>
            </div>
          ))}

          {filteredPlugins.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--ui-text-muted)' }}>
              <p>No plugins found matching your search</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 32px',
          borderTop: '1px solid var(--ui-border-muted)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span style={{ fontSize: '13px', color: 'var(--ui-text-muted)' }}>
            {filteredPlugins.length} plugins available
          </span>
          <button type="button"
            onClick={onClose}
            style={{
              padding: '10px 20px',
              borderRadius: '10px',
              border: '1px solid var(--ui-border-default)',
              background: 'transparent',
              color: 'var(--ui-text-secondary)',
              fontSize: '14px',
              cursor: 'pointer',
              transition: 'all var(--transition-fast)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--ui-border-strong)';
              e.currentTarget.style.color = 'var(--ui-text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--ui-border-default)';
              e.currentTarget.style.color = 'var(--ui-text-secondary)';
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
