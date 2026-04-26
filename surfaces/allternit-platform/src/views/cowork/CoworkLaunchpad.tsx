import React, { useMemo, useState, useEffect } from 'react';
import { GlassCard } from '../../design/GlassCard';
import {
  Plus,
  Clock,
  Chat,
  ArrowRight,
  Globe,
  Terminal,
  FileText,
  Folder,
  SquaresFour,
  Sparkle,
  Image,
  X,
  Code,
  Users,
  Robot,
  RocketLaunch,
  Lightning,
  Target,
  Lightbulb,
  Compass,
  Hammer,
  Wrench,
  MagnifyingGlass,
  ArrowUpRight,
  DownloadSimple,
  CaretRight,
  UsersThree,
  Image as ImageIcon,
} from '@phosphor-icons/react';

import { getSession } from '@/lib/auth-browser';

import { ChatComposer } from '../chat/ChatComposer';
import { useModelSelection } from '@/providers/model-selection-provider';
import { ModelPicker } from '@/components/model-picker';
import { useCoworkStore } from './CoworkStore';
import { useSurfaceAgentModeEnabled } from '@/lib/agents/surface-agent-context';
import { AgentModeBackdrop } from '../chat/agentModeSurfaceTheme';
import { AgentCapabilitiesPanel } from './AgentCapabilitiesPanel';

// ============================================================================
// Animation Keyframes - Each headline gets a unique entrance
// ============================================================================

const animationStyles = `
@keyframes fadeSlideUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fadeSlideDown {
  from {
    opacity: 0;
    transform: translateY(-25px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes slideFromLeft {
  from {
    opacity: 0;
    transform: translateX(-60px) skewX(-8deg);
  }
  to {
    opacity: 1;
    transform: translateX(0) skewX(0);
  }
}

@keyframes slideFromRight {
  from {
    opacity: 0;
    transform: translateX(60px) skewX(8deg);
  }
  to {
    opacity: 1;
    transform: translateX(0) skewX(0);
  }
}

@keyframes scaleIn {
  from {
    opacity: 0;
    transform: scale(0.7);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes blurIn {
  from {
    opacity: 0;
    filter: blur(12px);
    transform: scale(1.1);
  }
  to {
    opacity: 1;
    filter: blur(0);
    transform: scale(1);
  }
}

@keyframes clipReveal {
  from {
    clip-path: inset(0 100% 0 0);
    opacity: 0;
  }
  to {
    clip-path: inset(0 0% 0 0);
    opacity: 1;
  }
}

@keyframes letterSpacingIn {
  from {
    opacity: 0;
    letter-spacing: 0.3em;
    transform: translateY(15px);
  }
  to {
    opacity: 1;
    letter-spacing: -0.01em;
    transform: translateY(0);
  }
}

@keyframes bounceIn {
  0% {
    opacity: 0;
    transform: scale(0.3) translateY(-50px);
  }
  50% {
    transform: scale(1.05) translateY(5px);
  }
  70% {
    transform: scale(0.95) translateY(-2px);
  }
  100% {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

@keyframes waveIn {
  0% {
    opacity: 0;
    transform: translateY(40px) rotate(-5deg);
  }
  60% {
    transform: translateY(-5px) rotate(2deg);
  }
  100% {
    opacity: 1;
    transform: translateY(0) rotate(0);
  }
}
`;

interface CoworkLaunchpadProps {
  onStartChat: (text: string) => void;
  onResumeThread: (id: string) => void;
}

// Animated headline component with various entrance effects
interface AnimatedHeadlineProps {
  children: React.ReactNode;
  animationIndex: number;
  delay?: number;
  as?: 'h1' | 'p' | 'span';
  style?: React.CSSProperties;
}

function AnimatedHeadline({ children, animationIndex, delay = 0, as: Component = 'span', style = {} }: AnimatedHeadlineProps) {
  const animations = [
    { name: 'fadeSlideUp', duration: '0.7s', timingFunction: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)' },
    { name: 'fadeSlideDown', duration: '0.6s', timingFunction: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)' },
    { name: 'slideFromLeft', duration: '0.8s', timingFunction: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)' },
    { name: 'slideFromRight', duration: '0.8s', timingFunction: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)' },
    { name: 'scaleIn', duration: '0.6s', timingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' },
    { name: 'blurIn', duration: '0.9s', timingFunction: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)' },
    { name: 'clipReveal', duration: '0.7s', timingFunction: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)' },
    { name: 'letterSpacingIn', duration: '0.8s', timingFunction: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)' },
    { name: 'bounceIn', duration: '0.9s', timingFunction: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)' },
    { name: 'waveIn', duration: '0.8s', timingFunction: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)' },
  ];
  
  const animation = animations[animationIndex % animations.length];
  
  return (
    <Component
      style={{
        opacity: 0,
        animationName: animation.name,
        animationDuration: animation.duration,
        animationTimingFunction: animation.timingFunction,
        animationDelay: `${delay}ms`,
        animationFillMode: 'forwards',
        display: 'inline-block',
        ...style,
      }}
    >
      {children}
    </Component>
  );
}

// Cowork-specific greetings - platform focused, fun, collaborative
const COWORK_TITLES = [
  "Let's knock something off your list",
  "Ready to build together?",
  "What are we shipping today?",
  "Your collaborative workspace awaits",
  "Time to make things happen",
  "Let's turn ideas into reality",
  "What can we accomplish together?",
  "Your mission, should you choose to accept it...",
  "Let's orchestrate something great",
  "What problem are we solving today?",
  "Ready to deploy some magic?",
  "Let's architect the future",
  "Your digital workshop is open",
  "What shall we create?",
  "Let's automate the boring stuff",
];

const COWORK_TAGLINES = [
  "Cowork is your collaborative agent playground",
  "Build, iterate, ship — together with AI",
  "Your ideas + AI execution = 🚀",
  "Where human creativity meets machine precision",
  "Less context switching, more shipping",
  "Your AI pair programmer is ready",
  "Let's move faster, together",
  "Ship smarter, not harder",
  "Your workspace, amplified",
  "Build the future, one task at a time",
  "From idea to deployment, we've got you",
  "Less meetings, more building",
  "Your digital teammate is warmed up",
  "Time to turn caffeine into code",
  "Ready when you are, Architect",
];

export function CoworkLaunchpad({ onStartChat, onResumeThread }: CoworkLaunchpadProps) {
  const agentModeEnabled = useSurfaceAgentModeEnabled('cowork');
  const { selection: modelSelection, selectModel, startSelection, isSelecting, cancelSelection } = useModelSelection();
  const [composerInput, setComposerInput] = useState('');
  const [showPluginsOverlay, setShowPluginsOverlay] = useState(false);
  const [pluginInput, setShowPluginInput] = useState('');
  const [greeting, setGreeting] = useState({ title: COWORK_TITLES[0], tagline: COWORK_TAGLINES[0] });
  const [titleAnimation, setTitleAnimation] = useState(0);
  const [taglineAnimation, setTaglineAnimation] = useState(0);

  // Randomize greeting on mount with animations
  useEffect(() => {
    const randomTitle = COWORK_TITLES[Math.floor(Math.random() * COWORK_TITLES.length)];
    const randomTagline = COWORK_TAGLINES[Math.floor(Math.random() * COWORK_TAGLINES.length)];
    const randomTitleAnim = Math.floor(Math.random() * 8);
    const randomTaglineAnim = Math.floor(Math.random() * 6);
    setGreeting({ title: randomTitle, tagline: randomTagline });
    setTitleAnimation(randomTitleAnim);
    setTaglineAnimation(randomTaglineAnim);
  }, []);

  const handleTaskClick = (prompt: string) => {
    // Start the chat immediately with the task prompt
    onStartChat(prompt);
  };

  return (
    <div style={{ 
      padding: '80px 40px', 
      height: '100%', 
      overflowY: 'auto', 
      background: 'transparent',
      color: '#ececec',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      position: 'relative',
      isolation: 'isolate',
    }}>
      <style>{animationStyles}</style>
      <AgentModeBackdrop
        active={agentModeEnabled}
        surface="cowork"
        dataTestId="agent-mode-cowork-backdrop"
      />
      <div style={{ width: '100%', maxWidth: '720px', position: 'relative', zIndex: 1 }}>
        {/* Header - Randomized with animated entrance */}
        <div style={{ marginBottom: '48px', textAlign: 'center' }}>
          <AnimatedHeadline 
            animationIndex={titleAnimation} 
            delay={100}
            as="h1"
            style={{ 
              fontSize: '32px', 
              fontWeight: 500, 
              margin: '0 0 12px 0', 
              letterSpacing: '-0.01em', 
              fontFamily: 'Georgia, serif',
              color: '#ececec'
            }}
          >
            {greeting.title}
          </AnimatedHeadline>
          <div style={{ marginTop: '12px' }}>
            <AnimatedHeadline 
              animationIndex={taglineAnimation} 
              delay={350}
              as="p"
              style={{ 
                fontSize: '14px', 
                color: '#666', 
                margin: 0,
                display: 'block'
              }}
            >
              {greeting.tagline}
            </AnimatedHeadline>
          </div>
        </div>

        {/* Primary Functional Composer */}
        <div style={{ marginBottom: '64px', width: '100%' }}>
          <ChatComposer 
            onSend={onStartChat}
            variant="large"
            placeholder="How can I help you today?"
            selectedModel={modelSelection?.modelId}
            selectedModelDisplayName={modelSelection?.modelName || modelSelection?.modelId}
            onOpenModelPicker={startSelection}
            onSelectModel={selectModel}
            showTopActions={false}
            inputValue={composerInput}
            agentModeSurface="cowork"
          />
        </div>

        {/* Pick a task section - Restored with tailored prompts */}
        <section>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: '16px' }}>
            <SquaresFour size={14} color="#444" />
            <h2 style={{ fontSize: '12px', fontWeight: 700, color: '#444', textTransform: 'uppercase' }}>Pick a task, any task</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {[
              { 
                label: "Optimize my week", 
                icon: <Clock size={18} />,
                prompt: `- Busiest days\n- Where I have gaps of 2+ hours\n\nBefore proposing changes, ask me about:\n- What I'm trying to accomplish this week\n- How much focus time I need and for what\n- Any deadlines or commitments not on my calendar\n- Which types of meetings I should decline or shorten\n- Personal commitments or boundaries I want to protect\n\nThen show me your top 3-5 proposed changes with explanations:\n- Focus blocks to add\n- Meetings to decline or reschedule\n- Time conflicts to resolve\n\nStart with the highest-impact changes first. Once I approve each change, make the edits directly in my calendar one at a time.`
              },
              { 
                label: "Organize my screenshots", 
                icon: <ImageIcon size={18} />,
                prompt: `I want to organize my recent screenshots. \n1. Please scan my desktop for screenshot files from the last 24 hours.\n2. Group them by context (e.g., UI design, bugs, research).\n3. Propose a new folder structure and descriptive names for each file.\n4. Once I approve, move the files to the designated folders.`
              },
              { 
                label: "Find insights in files", 
                icon: <FileText size={18} />,
                prompt: `Help me extract insights from my current project files.\n1. Look for patterns in the codebase or documents.\n2. Summarize the key architectural decisions.\n3. Identify areas that might need refactoring or improved documentation.\n4. Present a high-level report of your findings.`
              },
            ].map((task, idx) => (
              <button
                key={task.label}
                onClick={() => handleTaskClick(task.prompt)}
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  padding: 0, 
                  textAlign: 'left', 
                  cursor: 'pointer',
                  borderTop: '1px solid #222'
                }}
              >
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 16, 
                  padding: '16px 0',
                  transition: 'opacity 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = '0.7'}
                onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                >
                  <div style={{ color: '#444' }}>{task.icon}</div>
                  <span style={{ fontSize: '14px', fontWeight: 500, color: '#888' }}>{task.label}</span>
                </div>
              </button>
            ))}
          </div>
          <button 
            onClick={() => setShowPluginsOverlay(true)}
            style={{ 
              marginTop: '24px', 
              background: 'none', 
              border: 'none', 
              fontSize: '11px', 
              color: '#333', 
              fontWeight: 700, 
              textTransform: 'uppercase', 
              cursor: 'pointer',
              padding: 0
            }}
          >
            Customize with plugins
          </button>
        </section>

        {/* Agent Capabilities */}
        <AgentCapabilitiesPanel
          variant="inline"
          onUseCapability={(_type, _item, prompt) => {
            onStartChat(prompt);
          }}
        />

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
      background: 'rgba(0,0,0,0.9)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      backdropFilter: 'blur(10px)'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '700px',
        maxHeight: '80vh',
        background: '#1a1a1a',
        borderRadius: '24px',
        border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{ 
          padding: '24px 32px', 
          borderBottom: '1px solid #222',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start'
        }}>
          <div>
            <h2 style={{ fontSize: '24px', fontWeight: 600, margin: '0 0 8px 0', fontFamily: 'Georgia, serif', color: '#ececec' }}>
              Plugins & Skills
            </h2>
            <p style={{ fontSize: '14px', color: '#666', margin: 0 }}>
              Ready-to-use workflows and capabilities for your Cowork sessions
            </p>
          </div>
          <button 
            onClick={onClose}
            style={{ 
              background: 'rgba(255,255,255,0.05)', 
              border: 'none', 
              borderRadius: '50%', 
              width: '36px', 
              height: '36px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              cursor: 'pointer', 
              color: '#999',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
          >
            <X size={20} />
          </button>
        </div>
        
        {/* Search & Filters */}
        <div style={{ padding: '20px 32px', borderBottom: '1px solid #222' }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 12, 
            background: '#222', 
            borderRadius: '12px', 
            padding: '12px 16px',
            marginBottom: 16
          }}>
            <MagnifyingGlass size={18} color="#666" />
            <input
              type="text"
              placeholder="Search plugins..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: '#ececec',
                fontSize: '15px'
              }}
            />
          </div>
          
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat === 'All' ? null : cat)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  border: '1px solid #333',
                  background: (selectedCategory === cat || (cat === 'All' && !selectedCategory)) ? '#D4B08C' : 'transparent',
                  color: (selectedCategory === cat || (cat === 'All' && !selectedCategory)) ? '#1a1a1a' : '#999',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
        
        {/* Plugins List */}
        <div style={{ 
          flex: 1, 
          overflow: 'auto', 
          padding: '20px 32px',
          display: 'flex',
          flexDirection: 'column',
          gap: 12
        }}>
          {filteredPlugins.map(plugin => (
            <div
              key={plugin.id}
              style={{
                background: '#222',
                borderRadius: '16px',
                padding: '20px',
                border: '1px solid #333',
                display: 'flex',
                gap: 16,
                transition: 'all 0.2s',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#444';
                e.currentTarget.style.background = '#2a2a2a';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#333';
                e.currentTarget.style.background = '#222';
              }}
            >
              <div style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: 'rgba(212,176,140,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#D4B08C',
                flexShrink: 0
              }}>
                {plugin.icon}
              </div>
              
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                  <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#ececec', margin: 0 }}>
                    {plugin.name}
                  </h3>
                  <span style={{ 
                    fontSize: '11px', 
                    color: '#666', 
                    textTransform: 'uppercase',
                    fontWeight: 600,
                    letterSpacing: '0.05em'
                  }}>
                    {plugin.category}
                  </span>
                </div>
                <p style={{ fontSize: '14px', color: '#888', margin: '0 0 12px 0', lineHeight: 1.5 }}>
                  {plugin.description}
                </p>
                <button
                  onClick={() => handleUsePlugin(plugin.prompt)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 16px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#D4B08C',
                    color: '#1a1a1a',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#E5C19D'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#D4B08C'}
                >
                  Use Plugin
                  <CaretRight size={14} />
                </button>
              </div>
            </div>
          ))}
          
          {filteredPlugins.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
              <p>No plugins found matching your search</p>
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div style={{ 
          padding: '16px 32px', 
          borderTop: '1px solid #222',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span style={{ fontSize: '13px', color: '#666' }}>
            {filteredPlugins.length} plugins available
          </span>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              borderRadius: '10px',
              border: '1px solid #333',
              background: 'transparent',
              color: '#999',
              fontSize: '14px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#444';
              e.currentTarget.style.color = '#ececec';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = '#333';
              e.currentTarget.style.color = '#999';
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
