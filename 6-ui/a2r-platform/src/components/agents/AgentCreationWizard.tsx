/**
 * Agent Creation Wizard
 * 
 * A2R-native step-by-step wizard for creating new agents.
 * Features:
 * - 4-step guided creation (Identity, Character, Tools, Review)
 * - Glass morphism design with sand accents
 * - Live preview of agent configuration
 * - Mode-aware theming (adapts to chat/cowork/code/browser)
 * 
 * @module AgentCreationWizard
 */

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bot, 
  UserCircle, 
  Wrench, 
  Check, 
  ChevronRight, 
  ChevronLeft,
  Sparkles,
  Brain,
  Shield,
  Code,
  Palette,
  Settings,
  ChevronDown,
  ChevronUp,
  Info,
  AlertCircle,
} from 'lucide-react';

import {
  SAND,
  MODE_COLORS,
  GLASS,
  RADIUS,
  SPACE,
  TEXT,
  SHADOW,
  ANIMATION,
  createGlassStyle,
  type AgentMode,
} from '@/design/a2r.tokens';

import { CHARACTER_SETUPS } from '@/lib/agents/character.service';
import type { AgentSetup } from '@/lib/agents/character.types';

// ============================================================================
// Types
// ============================================================================

export interface AgentCreationWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (config: AgentConfig) => Promise<void>;
  defaultMode?: AgentMode;
}

interface AgentConfig {
  name: string;
  description: string;
  model: string;
  provider: 'openai' | 'anthropic' | 'local' | 'custom';
  setup: AgentSetup;
  capabilities: string[];
  systemPrompt: string;
  tools: string[];
  maxIterations: number;
  temperature: number;
  voice?: {
    enabled: boolean;
    voiceId: string;
    engine: 'chatterbox' | 'xtts_v2' | 'piper';
  };
}

type WizardStep = 'identity' | 'character' | 'tools' | 'review';

const STEPS: { id: WizardStep; label: string; icon: React.ComponentType<{size?: number | string}> }[] = [
  { id: 'identity', label: 'Identity', icon: UserCircle },
  { id: 'character', label: 'Character', icon: Palette },
  { id: 'tools', label: 'Tools', icon: Wrench },
  { id: 'review', label: 'Review', icon: Check },
];

const MODELS = [
  { id: 'gpt-4', name: 'GPT-4', provider: 'openai' as const, description: 'Most capable for complex tasks' },
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'openai' as const, description: 'Fast and efficient' },
  { id: 'claude-3-opus', name: 'Claude 3 Opus', provider: 'anthropic' as const, description: 'Best for analysis and reasoning' },
  { id: 'claude-3-sonnet', name: 'Claude 3 Sonnet', provider: 'anthropic' as const, description: 'Balanced performance' },
  { id: 'local-llama', name: 'Local Llama', provider: 'local' as const, description: 'Self-hosted privacy' },
];

const CAPABILITIES = [
  { id: 'code', name: 'Code Generation', icon: Code, description: 'Write and review code' },
  { id: 'analysis', name: 'Data Analysis', icon: Brain, description: 'Process and analyze data' },
  { id: 'creative', name: 'Creative Writing', icon: Sparkles, description: 'Generate creative content' },
  { id: 'research', name: 'Research', icon: Bot, description: 'Gather and synthesize information' },
  { id: 'planning', name: 'Task Planning', icon: Settings, description: 'Break down complex tasks' },
  { id: 'security', name: 'Security Review', icon: Shield, description: 'Review for security issues' },
];

// ============================================================================
// Main Component
// ============================================================================

export function AgentCreationWizard({ 
  isOpen, 
  onClose, 
  onCreate,
  defaultMode = 'chat',
}: AgentCreationWizardProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>('identity');
  const [isCreating, setIsCreating] = useState(false);
  const [config, setConfig] = useState<AgentConfig>({
    name: '',
    description: '',
    model: 'gpt-4',
    provider: 'openai',
    setup: 'generalist',
    capabilities: [],
    systemPrompt: '',
    tools: [],
    maxIterations: 10,
    temperature: 0.7,
    voice: {
      enabled: false,
      voiceId: 'default',
      engine: 'chatterbox',
    },
  });

  const modeColors = MODE_COLORS[defaultMode];

  const updateConfig = useCallback(<K extends keyof AgentConfig>(
    key: K,
    value: AgentConfig[K]
  ) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  }, []);

  const handleNext = () => {
    const currentIndex = STEPS.findIndex(s => s.id === currentStep);
    if (currentIndex < STEPS.length - 1) {
      setCurrentStep(STEPS[currentIndex + 1].id);
      // Scroll to top of wizard
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleBack = () => {
    const currentIndex = STEPS.findIndex(s => s.id === currentStep);
    if (currentIndex > 0) {
      setCurrentStep(STEPS[currentIndex - 1].id);
      // Scroll to top of wizard
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleCreate = async () => {
    setIsCreating(true);
    try {
      await onCreate(config);
      onClose();
    } catch (error) {
      console.error('Failed to create agent:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep);
  const progress = ((currentStepIndex + 1) / STEPS.length) * 100;

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(26,22,18,0.85)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.3, ease: [0.34, 1.56, 0.64, 1] }}
        className="w-full max-w-4xl max-h-[90vh] overflow-hidden"
        style={{
          ...createGlassStyle('thick'),
          borderRadius: RADIUS['2xl'],
          border: `1px solid ${modeColors.border}`,
          boxShadow: `0 24px 64px rgba(0,0,0,0.4), 0 0 0 1px ${modeColors.glow}`,
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <WizardHeader 
          currentStep={currentStep} 
          progress={progress}
          modeColors={modeColors as typeof MODE_COLORS.chat}
          onClose={onClose}
        />

        {/* Content */}
        <div className="flex overflow-hidden" style={{ height: '500px' }}>
          {/* Sidebar */}
          <WizardSidebar 
            steps={STEPS}
            currentStep={currentStep}
            modeColors={modeColors as typeof MODE_COLORS.chat}
          />

          {/* Main Content */}
          <div className="flex-1 overflow-y-auto p-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                {currentStep === 'identity' && (
                  <IdentityStep 
                    config={config} 
                    updateConfig={updateConfig}
                    modeColors={modeColors as typeof MODE_COLORS.chat}
                  />
                )}
                {currentStep === 'character' && (
                  <CharacterStep 
                    config={config} 
                    updateConfig={updateConfig}
                    modeColors={modeColors as typeof MODE_COLORS.chat}
                  />
                )}
                {currentStep === 'tools' && (
                  <ToolsStep 
                    config={config} 
                    updateConfig={updateConfig}
                    modeColors={modeColors as typeof MODE_COLORS.chat}
                  />
                )}
                {currentStep === 'review' && (
                  <ReviewStep 
                    config={config}
                    modeColors={modeColors as typeof MODE_COLORS.chat}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Live Preview */}
          <AgentPreview config={config} modeColors={modeColors as typeof MODE_COLORS.chat} />
        </div>

        {/* Footer */}
        <WizardFooter
          currentStep={currentStep}
          isFirstStep={currentStepIndex === 0}
          isLastStep={currentStepIndex === STEPS.length - 1}
          isCreating={isCreating}
          canProceed={canProceed(config, currentStep)}
          onBack={handleBack}
          onNext={handleNext}
          onCreate={handleCreate}
          modeColors={modeColors as typeof MODE_COLORS.chat}
        />
      </motion.div>
    </div>
  );
}

// ============================================================================
// Sub-Components
// ============================================================================

function WizardHeader({ 
  currentStep, 
  progress, 
  modeColors,
  onClose,
}: { 
  currentStep: WizardStep; 
  progress: number;
  modeColors: typeof MODE_COLORS.chat;
  onClose: () => void;
}) {
  return (
    <div 
      className="relative px-6 py-4 border-b"
      style={{ borderColor: modeColors.border }}
    >
      {/* Progress Bar */}
      <div 
        className="absolute bottom-0 left-0 h-0.5 transition-all duration-500"
        style={{ 
          width: `${progress}%`,
          background: `linear-gradient(90deg, ${modeColors.accent}, ${SAND[400]})`,
        }}
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div 
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ 
              background: modeColors.soft,
              border: `1px solid ${modeColors.border}`,
            }}
          >
            <Sparkles size={20} style={{ color: modeColors.accent }} />
          </div>
          <div>
            <h2 className="text-lg font-semibold" style={{ color: TEXT.primary }}>
              Create New Agent
            </h2>
            <p className="text-sm" style={{ color: TEXT.secondary }}>
              Step {STEPS.findIndex(s => s.id === currentStep) + 1} of {STEPS.length}: {STEPS.find(s => s.id === currentStep)?.label}
            </p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-white/5"
          style={{ color: TEXT.secondary }}
        >
          ×
        </button>
      </div>
    </div>
  );
}

function WizardSidebar({
  steps,
  currentStep,
  modeColors,
}: {
  steps: typeof STEPS;
  currentStep: WizardStep;
  modeColors: typeof MODE_COLORS.chat;
}) {
  return (
    <div 
      className="w-48 p-4 border-r"
      style={{ 
        borderColor: modeColors.border,
        background: 'rgba(0,0,0,0.2)',
      }}
    >
      <div className="space-y-2">
        {steps.map((step, index) => {
          const isActive = step.id === currentStep;
          const isCompleted = steps.findIndex(s => s.id === currentStep) > index;
          const Icon = step.icon;

          return (
            <div
              key={step.id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all"
              style={{
                background: isActive ? modeColors.soft : 'transparent',
                border: isActive ? `1px solid ${modeColors.border}` : '1px solid transparent',
              }}
            >
              <div 
                className="w-6 h-6 rounded-md flex items-center justify-center"
                style={{
                  background: isActive ? modeColors.accent : isCompleted ? 'rgba(74,222,128,0.2)' : 'rgba(255,255,255,0.05)',
                  color: isActive ? '#1A1612' : isCompleted ? '#4ade80' : TEXT.tertiary,
                }}
              >
                {isCompleted ? (
                  <Check size={14} />
                ) : (
                  <Icon size={14} />
                )}
              </div>
              <span 
                className="text-sm font-medium"
                style={{ color: isActive ? TEXT.primary : TEXT.secondary }}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function IdentityStep({
  config,
  updateConfig,
  modeColors,
}: {
  config: AgentConfig;
  updateConfig: <K extends keyof AgentConfig>(key: K, value: AgentConfig[K]) => void;
  modeColors: typeof MODE_COLORS.chat;
}) {
  return (
    <div className="space-y-6">
      <SectionTitle 
        title="Agent Identity" 
        subtitle="Define the basic identity and model for your agent"
        modeColors={modeColors as typeof MODE_COLORS.chat}
      />

      {/* Name Input */}
      <FormField label="Agent Name" required modeColors={modeColors as typeof MODE_COLORS.chat}>
        <input
          type="text"
          value={config.name}
          onChange={(e) => updateConfig('name', e.target.value)}
          placeholder="e.g., Code Reviewer, Research Assistant"
          className="w-full px-4 py-3 rounded-lg outline-none transition-all"
          style={{
            background: 'rgba(0,0,0,0.3)',
            border: `1px solid ${config.name ? modeColors.border : 'rgba(255,255,255,0.1)'}`,
            color: TEXT.primary,
            fontSize: '14px',
          }}
        />
      </FormField>

      {/* Description */}
      <FormField label="Description" modeColors={modeColors as typeof MODE_COLORS.chat}>
        <textarea
          value={config.description}
          onChange={(e) => updateConfig('description', e.target.value)}
          placeholder="What does this agent do? How should it behave?"
          rows={3}
          className="w-full px-4 py-3 rounded-lg outline-none transition-all resize-none"
          style={{
            background: 'rgba(0,0,0,0.3)',
            border: `1px solid rgba(255,255,255,0.1)`,
            color: TEXT.primary,
            fontSize: '14px',
          }}
        />
      </FormField>

      {/* Model Selection */}
      <FormField label="Model" required modeColors={modeColors as typeof MODE_COLORS.chat}>
        <div className="grid grid-cols-1 gap-2">
          {MODELS.map((model) => (
            <ModelCard
              key={model.id}
              model={model}
              isSelected={config.model === model.id}
              onSelect={() => {
                updateConfig('model', model.id);
                updateConfig('provider', model.provider);
              }}
              modeColors={modeColors as typeof MODE_COLORS.chat}
            />
          ))}
        </div>
      </FormField>
    </div>
  );
}

function CharacterStep({
  config,
  updateConfig,
  modeColors,
}: {
  config: AgentConfig;
  updateConfig: <K extends keyof AgentConfig>(key: K, value: AgentConfig[K]) => void;
  modeColors: typeof MODE_COLORS.chat;
}) {
  const selectedSetup = CHARACTER_SETUPS.find(s => s.id === config.setup);

  return (
    <div className="space-y-6">
      <SectionTitle 
        title="Character & Behavior" 
        subtitle="Define how your agent thinks and behaves"
        modeColors={modeColors as typeof MODE_COLORS.chat}
      />

      {/* Setup Selection */}
      <FormField label="Agent Setup" required modeColors={modeColors as typeof MODE_COLORS.chat}>
        <div className="grid grid-cols-1 gap-3">
          {CHARACTER_SETUPS.map((setup) => (
            <SetupCard
              key={setup.id}
              setup={setup}
              isSelected={config.setup === setup.id}
              onSelect={() => updateConfig('setup', setup.id)}
              modeColors={modeColors as typeof MODE_COLORS.chat}
            />
          ))}
        </div>
      </FormField>

      {/* Capabilities */}
      <FormField label="Capabilities" modeColors={modeColors as typeof MODE_COLORS.chat}>
        <div className="grid grid-cols-2 gap-2">
          {CAPABILITIES.map((cap) => {
            const Icon = cap.icon;
            const isSelected = config.capabilities.includes(cap.id);
            return (
              <button
                key={cap.id}
                onClick={() => {
                  const newCaps = isSelected
                    ? config.capabilities.filter(c => c !== cap.id)
                    : [...config.capabilities, cap.id];
                  updateConfig('capabilities', newCaps);
                }}
                className="flex items-start gap-3 p-3 rounded-lg text-left transition-all"
                style={{
                  background: isSelected ? modeColors.soft : 'rgba(0,0,0,0.2)',
                  border: `1px solid ${isSelected ? modeColors.border : 'rgba(255,255,255,0.05)'}`,
                }}
              >
                <div 
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{
                    background: isSelected ? modeColors.accent : 'rgba(255,255,255,0.05)',
                    color: isSelected ? '#1A1612' : TEXT.secondary,
                  }}
                >
                  <Icon size={16} />
                </div>
                <div>
                  <div 
                    className="text-sm font-medium"
                    style={{ color: isSelected ? TEXT.primary : TEXT.secondary }}
                  >
                    {cap.name}
                  </div>
                  <div className="text-xs" style={{ color: TEXT.tertiary }}>
                    {cap.description}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </FormField>

      {/* System Prompt */}
      <FormField 
        label="System Prompt" 
        modeColors={modeColors as typeof MODE_COLORS.chat}
        hint="Define the agent's personality and instructions"
      >
        <textarea
          value={config.systemPrompt}
          onChange={(e) => updateConfig('systemPrompt', e.target.value)}
          placeholder={`You are a ${selectedSetup?.label || 'helpful assistant'}. ${selectedSetup?.description || ''}`}
          rows={4}
          className="w-full px-4 py-3 rounded-lg outline-none transition-all resize-none font-mono text-sm"
          style={{
            background: 'rgba(0,0,0,0.3)',
            border: `1px solid rgba(255,255,255,0.1)`,
            color: TEXT.primary,
          }}
        />
      </FormField>

      {/* Temperature */}
      <FormField label="Creativity (Temperature)" modeColors={modeColors as typeof MODE_COLORS.chat}>
        <div className="px-2">
          <input
            type="range"
            min={0}
            max={1}
            step={0.1}
            value={config.temperature}
            onChange={(e) => updateConfig('temperature', parseFloat(e.target.value))}
            className="w-full"
            style={{
              accentColor: modeColors.accent,
            }}
          />
          <div className="flex justify-between mt-2 text-xs" style={{ color: TEXT.tertiary }}>
            <span>Precise ({config.temperature})</span>
            <span>Creative</span>
          </div>
        </div>
      </FormField>
    </div>
  );
}

function ToolsStep({
  config,
  updateConfig,
  modeColors,
}: {
  config: AgentConfig;
  updateConfig: <K extends keyof AgentConfig>(key: K, value: AgentConfig[K]) => void;
  modeColors: typeof MODE_COLORS.chat;
}) {
  // Mock tools - in real implementation, fetch from tool registry
  const availableTools = [
    { id: 'read_file', name: 'Read File', category: 'files', description: 'Read file contents' },
    { id: 'write_file', name: 'Write File', category: 'files', description: 'Write to files' },
    { id: 'search_code', name: 'Search Code', category: 'files', description: 'Search codebase' },
    { id: 'run_tests', name: 'Run Tests', category: 'dev', description: 'Execute test suite' },
    { id: 'git_status', name: 'Git Status', category: 'git', description: 'Check git status' },
    { id: 'http_request', name: 'HTTP Request', category: 'api', description: 'Make HTTP calls' },
    { id: 'ask_user', name: 'Ask User', category: 'interaction', description: 'Ask user questions' },
  ];

  const toolsByCategory = availableTools.reduce((acc, tool) => {
    acc[tool.category] = acc[tool.category] || [];
    acc[tool.category].push(tool);
    return acc;
  }, {} as Record<string, typeof availableTools>);

  return (
    <div className="space-y-6">
      <SectionTitle 
        title="Tools & Actions" 
        subtitle="Select tools your agent can use"
        modeColors={modeColors as typeof MODE_COLORS.chat}
      />

      {Object.entries(toolsByCategory).map(([category, tools]) => (
        <div key={category}>
          <div 
            className="text-xs font-semibold uppercase tracking-wider mb-3"
            style={{ color: TEXT.tertiary }}
          >
            {category}
          </div>
          <div className="space-y-2">
            {tools.map((tool) => {
              const isSelected = config.tools.includes(tool.id);
              return (
                <ToolToggle
                  key={tool.id}
                  tool={tool}
                  isSelected={isSelected}
                  onToggle={() => {
                    const newTools = isSelected
                      ? config.tools.filter(t => t !== tool.id)
                      : [...config.tools, tool.id];
                    updateConfig('tools', newTools);
                  }}
                  modeColors={modeColors as typeof MODE_COLORS.chat}
                />
              );
            })}
          </div>
        </div>
      ))}

      {/* Max Iterations */}
      <FormField label="Max Iterations" modeColors={modeColors as typeof MODE_COLORS.chat}>
        <div className="flex items-center gap-4">
          <input
            type="number"
            min={1}
            max={50}
            value={config.maxIterations}
            onChange={(e) => updateConfig('maxIterations', parseInt(e.target.value))}
            className="w-24 px-3 py-2 rounded-lg outline-none"
            style={{
              background: 'rgba(0,0,0,0.3)',
              border: `1px solid rgba(255,255,255,0.1)`,
              color: TEXT.primary,
            }}
          />
          <span className="text-sm" style={{ color: TEXT.secondary }}>
            Maximum steps the agent can take
          </span>
        </div>
      </FormField>
    </div>
  );
}

function ReviewStep({
  config,
  modeColors,
}: {
  config: AgentConfig;
  modeColors: typeof MODE_COLORS.chat;
}) {
  const selectedModel = MODELS.find(m => m.id === config.model);
  const selectedSetup = CHARACTER_SETUPS.find(s => s.id === config.setup);

  return (
    <div className="space-y-6">
      <SectionTitle 
        title="Review & Create" 
        subtitle="Verify your agent configuration"
        modeColors={modeColors as typeof MODE_COLORS.chat}
      />

      <div 
        className="p-4 rounded-xl space-y-4"
        style={{
          background: 'rgba(0,0,0,0.2)',
          border: `1px solid ${modeColors.border}`,
        }}
      >
        <ReviewItem label="Name" value={config.name || 'Not set'} />
        <ReviewItem label="Description" value={config.description || 'No description'} />
        <ReviewItem label="Model" value={selectedModel?.name || config.model} />
        <ReviewItem label="Setup" value={selectedSetup?.label || config.setup} />
        <ReviewItem 
          label="Capabilities" 
          value={config.capabilities.length > 0 
            ? config.capabilities.join(', ')
            : 'None selected'
          } 
        />
        <ReviewItem 
          label="Tools" 
          value={config.tools.length > 0 
            ? `${config.tools.length} tools enabled`
            : 'None selected'
          } 
        />
        <ReviewItem label="Temperature" value={config.temperature.toString()} />
        <ReviewItem label="Max Iterations" value={config.maxIterations.toString()} />
      </div>

      <div 
        className="flex items-start gap-3 p-4 rounded-lg"
        style={{
          background: 'rgba(251,191,36,0.1)',
          border: '1px solid rgba(251,191,36,0.2)',
        }}
      >
        <AlertCircle size={18} style={{ color: '#fbbf24', marginTop: 2 }} />
        <div className="text-sm" style={{ color: TEXT.secondary }}>
          After creation, you can test your agent in the playground and deploy it when ready.
        </div>
      </div>
    </div>
  );
}

function AgentPreview({ 
  config, 
  modeColors 
}: { 
  config: AgentConfig; 
  modeColors: typeof MODE_COLORS.chat;
}) {
  return (
    <div 
      className="w-64 p-4 border-l"
      style={{ 
        borderColor: modeColors.border,
        background: 'rgba(0,0,0,0.3)',
      }}
    >
      <div 
        className="text-xs font-semibold uppercase tracking-wider mb-4"
        style={{ color: TEXT.tertiary }}
      >
        Live Preview
      </div>

      {/* Agent Card Preview */}
      <div 
        className="p-4 rounded-xl"
        style={{
          background: 'rgba(255,255,255,0.03)',
          border: `1px solid ${modeColors.border}`,
        }}
      >
        <div 
          className="w-12 h-12 rounded-xl mb-3 flex items-center justify-center"
          style={{
            background: modeColors.soft,
            border: `1px solid ${modeColors.border}`,
          }}
        >
          <Bot size={24} style={{ color: modeColors.accent }} />
        </div>

        <div 
          className="font-semibold mb-1 truncate"
          style={{ color: TEXT.primary }}
        >
          {config.name || 'Untitled Agent'}
        </div>

        <div 
          className="text-xs mb-3 line-clamp-2"
          style={{ color: TEXT.secondary }}
        >
          {config.description || 'No description'}
        </div>

        <div className="flex flex-wrap gap-1">
          {config.capabilities.slice(0, 3).map(cap => (
            <span 
              key={cap}
              className="px-2 py-0.5 rounded text-[10px]"
              style={{
                background: modeColors.soft,
                color: modeColors.accent,
              }}
            >
              {cap}
            </span>
          ))}
        </div>

        <div 
          className="mt-3 pt-3 text-xs flex items-center gap-2"
          style={{ 
            color: TEXT.tertiary,
            borderTop: `1px solid ${modeColors.border}`,
          }}
        >
          <Settings size={12} />
          {config.setup}
        </div>
      </div>

      {/* Stats Preview */}
      <div className="mt-4 space-y-2">
        <PreviewStat 
          label="Tools" 
          value={config.tools.length.toString()} 
          modeColors={modeColors as typeof MODE_COLORS.chat}
        />
        <PreviewStat 
          label="Model" 
          value={config.model.split('-')[0].toUpperCase()}
          modeColors={modeColors as typeof MODE_COLORS.chat}
        />
        <PreviewStat 
          label="Creativity" 
          value={`${Math.round(config.temperature * 100)}%`}
          modeColors={modeColors as typeof MODE_COLORS.chat}
        />
      </div>
    </div>
  );
}

// ============================================================================
// Helper Components
// ============================================================================

function SectionTitle({ 
  title, 
  subtitle,
  modeColors,
}: { 
  title: string; 
  subtitle: string;
  modeColors: typeof MODE_COLORS.chat;
}) {
  return (
    <div className="mb-6">
      <h3 className="text-lg font-semibold" style={{ color: TEXT.primary }}>
        {title}
      </h3>
      <p className="text-sm mt-1" style={{ color: TEXT.secondary }}>
        {subtitle}
      </p>
      <div 
        className="h-0.5 w-16 mt-3 rounded-full"
        style={{ background: modeColors.accent }}
      />
    </div>
  );
}

function FormField({ 
  label, 
  children, 
  required,
  modeColors,
  hint,
}: { 
  label: string; 
  children: React.ReactNode;
  required?: boolean;
  modeColors: typeof MODE_COLORS.chat;
  hint?: string;
}) {
  return (
    <div>
      <label 
        className="block text-sm font-medium mb-2"
        style={{ color: TEXT.primary }}
      >
        {label}
        {required && (
          <span style={{ color: modeColors.accent }}>*</span>
        )}
        {hint && (
          <span className="ml-2 text-xs font-normal" style={{ color: TEXT.tertiary }}>
            {hint}
          </span>
        )}
      </label>
      {children}
    </div>
  );
}

function ModelCard({ 
  model, 
  isSelected, 
  onSelect,
  modeColors,
}: { 
  model: typeof MODELS[0];
  isSelected: boolean;
  onSelect: () => void;
  modeColors: typeof MODE_COLORS.chat;
}) {
  return (
    <button
      onClick={onSelect}
      className="w-full p-3 rounded-lg text-left transition-all flex items-center gap-3"
      style={{
        background: isSelected ? modeColors.soft : 'rgba(0,0,0,0.2)',
        border: `1px solid ${isSelected ? modeColors.border : 'rgba(255,255,255,0.05)'}`,
      }}
    >
      <div 
        className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0"
        style={{
          borderColor: isSelected ? modeColors.accent : 'rgba(255,255,255,0.2)',
        }}
      >
        {isSelected && (
          <div 
            className="w-2.5 h-2.5 rounded-full"
            style={{ background: modeColors.accent }}
          />
        )}
      </div>
      <div className="flex-1">
        <div 
          className="text-sm font-medium"
          style={{ color: isSelected ? TEXT.primary : TEXT.secondary }}
        >
          {model.name}
        </div>
        <div className="text-xs" style={{ color: TEXT.tertiary }}>
          {model.description}
        </div>
      </div>
      <span 
        className="text-xs px-2 py-0.5 rounded"
        style={{
          background: 'rgba(255,255,255,0.05)',
          color: TEXT.tertiary,
          textTransform: 'uppercase',
        }}
      >
        {model.provider}
      </span>
    </button>
  );
}

function SetupCard({ 
  setup, 
  isSelected, 
  onSelect,
  modeColors,
}: { 
  setup: typeof CHARACTER_SETUPS[0];
  isSelected: boolean;
  onSelect: () => void;
  modeColors: typeof MODE_COLORS.chat;
}) {
  return (
    <button
      onClick={onSelect}
      className="w-full p-4 rounded-lg text-left transition-all"
      style={{
        background: isSelected ? modeColors.soft : 'rgba(0,0,0,0.2)',
        border: `1px solid ${isSelected ? modeColors.border : 'rgba(255,255,255,0.05)'}`,
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div 
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{
              background: isSelected ? modeColors.accent : 'rgba(255,255,255,0.05)',
              color: isSelected ? '#1A1612' : TEXT.secondary,
            }}
          >
            <Sparkles size={18} />
          </div>
          <div>
            <div 
              className="font-medium"
              style={{ color: isSelected ? TEXT.primary : TEXT.secondary }}
            >
              {setup.label}
            </div>
            <div className="text-xs" style={{ color: TEXT.tertiary }}>
              {setup.description}
            </div>
          </div>
        </div>
        <div 
          className="w-5 h-5 rounded-full border-2 flex items-center justify-center"
          style={{
            borderColor: isSelected ? modeColors.accent : 'rgba(255,255,255,0.2)',
          }}
        >
          {isSelected && (
            <div 
              className="w-2.5 h-2.5 rounded-full"
              style={{ background: modeColors.accent }}
            />
          )}
        </div>
      </div>
    </button>
  );
}

function ToolToggle({ 
  tool, 
  isSelected, 
  onToggle,
  modeColors,
}: { 
  tool: { id: string; name: string; description: string };
  isSelected: boolean;
  onToggle: () => void;
  modeColors: typeof MODE_COLORS.chat;
}) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center justify-between p-3 rounded-lg transition-all"
      style={{
        background: isSelected ? modeColors.soft : 'rgba(0,0,0,0.2)',
        border: `1px solid ${isSelected ? modeColors.border : 'rgba(255,255,255,0.05)'}`,
      }}
    >
      <div className="text-left">
        <div 
          className="text-sm font-medium"
          style={{ color: isSelected ? TEXT.primary : TEXT.secondary }}
        >
          {tool.name}
        </div>
        <div className="text-xs" style={{ color: TEXT.tertiary }}>
          {tool.description}
        </div>
      </div>
      <div 
        className="w-10 h-5 rounded-full relative transition-colors"
        style={{
          background: isSelected ? modeColors.accent : 'rgba(255,255,255,0.1)',
        }}
      >
        <div 
          className="absolute top-0.5 w-4 h-4 rounded-full transition-all"
          style={{
            background: '#fff',
            left: isSelected ? '22px' : '2px',
          }}
        />
      </div>
    </button>
  );
}

function ReviewItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-start gap-4">
      <span className="text-sm" style={{ color: TEXT.tertiary }}>
        {label}
      </span>
      <span className="text-sm text-right" style={{ color: TEXT.primary }}>
        {value}
      </span>
    </div>
  );
}

function PreviewStat({ 
  label, 
  value,
  modeColors,
}: { 
  label: string; 
  value: string;
  modeColors: typeof MODE_COLORS.chat;
}) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-xs" style={{ color: TEXT.tertiary }}>
        {label}
      </span>
      <span 
        className="text-xs font-medium px-2 py-0.5 rounded"
        style={{
          background: modeColors.soft,
          color: modeColors.accent,
        }}
      >
        {value}
      </span>
    </div>
  );
}

function WizardFooter({
  currentStep,
  isFirstStep,
  isLastStep,
  isCreating,
  canProceed,
  onBack,
  onNext,
  onCreate,
  modeColors,
}: {
  currentStep: WizardStep;
  isFirstStep: boolean;
  isLastStep: boolean;
  isCreating: boolean;
  canProceed: boolean;
  onBack: () => void;
  onNext: () => void;
  onCreate: () => void;
  modeColors: typeof MODE_COLORS.chat;
}) {
  return (
    <div 
      className="flex items-center justify-between px-6 py-4 border-t"
      style={{ 
        borderColor: modeColors.border,
        background: 'rgba(0,0,0,0.2)',
      }}
    >
      <button
        onClick={onBack}
        disabled={isFirstStep}
        className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-30"
        style={{
          color: TEXT.secondary,
          background: 'transparent',
        }}
      >
        <ChevronLeft size={16} />
        Back
      </button>

      {isLastStep ? (
        <button
          onClick={onCreate}
          disabled={isCreating}
          className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all"
          style={{
            background: modeColors.accent,
            color: '#1A1612',
            opacity: isCreating ? 0.7 : 1,
          }}
        >
          {isCreating ? (
            <>
              <div 
                className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
                style={{ borderColor: '#1A1612', borderTopColor: 'transparent' }}
              />
              Creating...
            </>
          ) : (
            <>
              <Sparkles size={16} />
              Create Agent
            </>
          )}
        </button>
      ) : (
        <button
          onClick={onNext}
          disabled={!canProceed}
          className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold transition-all"
          style={{
            background: canProceed ? modeColors.accent : 'rgba(255,255,255,0.1)',
            color: canProceed ? '#1A1612' : TEXT.tertiary,
          }}
        >
          Next
          <ChevronRight size={16} />
        </button>
      )}
    </div>
  );
}

// ============================================================================
// Utilities
// ============================================================================

function canProceed(config: AgentConfig, step: WizardStep): boolean {
  switch (step) {
    case 'identity':
      return config.name.trim().length > 0;
    case 'character':
      return true;
    case 'tools':
      return true;
    case 'review':
      return config.name.trim().length > 0;
    default:
      return true;
  }
}
