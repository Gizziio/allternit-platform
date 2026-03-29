/**
 * Agent Creation Wizard - Comprehensive Help System Integration
 * 
 * This file demonstrates the complete integration of the help system
 * into all wizard steps. Copy the patterns shown here into the main
 * AgentCreationWizardEnhanced.tsx file.
 * 
 * Features Integrated:
 * - Contextual help on every step
 * - Tooltips on complex fields
 * - Example values for inputs
 * - Best practices for selections
 * - Help panel with "Need Help?" button
 * - Step-specific guidance
 * - Common questions
 * - Links to documentation
 * - Inline hints
 * - Field descriptions below labels
 * - Example input placeholders
 * - Validation hints
 * - Recommended selections highlighted
 * - Onboarding tour for first-time users
 * - Smart suggestions based on agent type/capabilities
 * - Real-time validation feedback
 * 
 * @version 1.0.0
 * @module AgentCreationWizardHelpIntegration
 */

import React, { useState, useCallback, useMemo, useEffect } from 'react';
import {
  Question as HelpCircle,
  Lightbulb,
  CheckCircle,
  Warning,
  Info,
  Target,
  Lightning,
  Brain,
} from '@phosphor-icons/react';

// Import help components
import {
  HelpPanel,
  HelpButton,
  OnboardingTour,
  SmartSuggestions,
  ValidationFeedback,
  FieldHint,
  StepIntroduction,
  QuickTip,
  useHelpContext,
} from '@/components/agents/wizard-help-components';

// Import help constants
import {
  getModelSuggestions,
  getToolSuggestions,
  getSystemPromptSuggestions,
  validateAgentName,
  validateDescription,
  validateHardBans,
  validateTools,
  validateTemperature,
  type ValidationResult,
  type SmartSuggestion,
} from '@/lib/agents/wizard-help.constants';

// Import design tokens
import { MODE_COLORS, TEXT } from '@/design/a2r.tokens';

// ============================================================================
// MAIN WIZARD COMPONENT - HELP INTEGRATION
// ============================================================================

/**
 * Example: Main Wizard Component with Help System
 * 
 * This shows how to integrate help system at the wizard level
 */
function AgentCreationWizardWithHelp() {
  // Help system state
  const [showHelpPanel, setShowHelpPanel] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [currentHelpStep, setCurrentHelpStep] = useState('identity');

  // Wizard step tracking
  const [currentStep, setCurrentStep] = useState(0);

  // Check if user has completed onboarding
  useEffect(() => {
    const completed = localStorage.getItem('agent-wizard-onboarding-completed');
    if (completed === 'true') {
      setHasCompletedOnboarding(true);
    } else {
      // First time user - show onboarding
      setShowOnboarding(true);
    }
  }, []);

  const handleCompleteOnboarding = () => {
    setShowOnboarding(false);
    setHasCompletedOnboarding(true);
    localStorage.setItem('agent-wizard-onboarding-completed', 'true');
  };

  // Update help step when wizard step changes
  useEffect(() => {
    const stepMap = ['identity', 'character', 'avatar', 'role', 'voice', 'advanced', 'tools', 'plugins', 'workspace', 'review'];
    setCurrentHelpStep(stepMap[currentStep] || 'identity');
  }, [currentStep]);

  const modeColors = MODE_COLORS.chat;

  return (
    <div className="wizard-container">
      {/* Help Panel - Slide-out panel with step-specific guidance */}
      <HelpPanel
        isOpen={showHelpPanel}
        onClose={() => setShowHelpPanel(false)}
        currentStepId={currentHelpStep}
        modeColors={modeColors}
      />

      {/* Onboarding Tour - First-time user walkthrough */}
      <OnboardingTour
        isOpen={showOnboarding}
        onComplete={handleCompleteOnboarding}
        onSkip={() => {
          setShowOnboarding(false);
          setHasCompletedOnboarding(true);
          localStorage.setItem('agent-wizard-onboarding-completed', 'true');
        }}
        currentStep={currentStep}
        totalSteps={10}
        modeColors={modeColors}
      />

      {/* Wizard Header with Help Button */}
      <div className="wizard-header">
        <h1>Agent Creation Wizard</h1>
        <button
          onClick={() => setShowHelpPanel(true)}
          className="help-button"
          aria-label="Open help panel"
        >
          <HelpCircle size={20} />
          Need Help?
        </button>
      </div>

      {/* Wizard Steps would go here */}
      {/* Each step component integrates help as shown below */}
    </div>
  );
}

// ============================================================================
// STEP 1: IDENTITY STEP - HELP INTEGRATION EXAMPLE
// ============================================================================

interface IdentityStepWithHelpProps {
  name: string;
  setName: (name: string) => void;
  description: string;
  setDescription: (desc: string) => void;
  agentType: string;
  setAgentType: (type: string) => void;
  model: string;
  setModel: (model: string) => void;
  modeColors: typeof MODE_COLORS.chat;
}

function IdentityStepWithHelp({
  name,
  setName,
  description,
  setDescription,
  agentType,
  setAgentType,
  model,
  setModel,
  modeColors,
}: IdentityStepWithHelpProps) {
  // Validation states
  const [nameValidation, setNameValidation] = useState<ValidationResult | null>(null);
  const [descValidation, setDescValidation] = useState<ValidationResult | null>(null);

  // Smart suggestions
  const modelSuggestions: SmartSuggestion[] = useMemo(() => {
    // In real implementation, use actual agentType and setup
    return getModelSuggestions('coding' as any, 'worker' as any);
  }, []);

  // Real-time validation
  useEffect(() => {
    if (name) {
      setNameValidation(validateAgentName(name));
    }
  }, [name]);

  useEffect(() => {
    if (description) {
      setDescValidation(validateDescription(description));
    }
  }, [description]);

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* 1. Step Introduction */}
      <StepIntroduction stepId="identity" modeColors={modeColors} />

      {/* 2. Quick Tip */}
      <QuickTip modeColors={modeColors} />

      {/* 3. Name Field with Help */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium" style={{ color: TEXT.secondary }}>
            Agent Name *
          </label>
          <HelpButton fieldId="name" stepId="identity" modeColors={modeColors} />
        </div>
        <input
          id="identity-name-field"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Code Review Specialist"
          className="w-full px-4 py-3 rounded-xl outline-none"
          style={{
            background: 'rgba(0,0,0,0.3)',
            border: `1px solid ${nameValidation?.isValid === false ? '#EF4444' : modeColors.border}`,
            color: TEXT.primary,
          }}
          aria-invalid={nameValidation?.isValid === false}
          aria-describedby="name-validation"
        />
        {/* Validation Feedback */}
        {nameValidation && (
          <ValidationFeedback validations={[nameValidation]} modeColors={modeColors} />
        )}
        {/* Field Hint */}
        <FieldHint stepId="identity" fieldId="name" modeColors={modeColors} />
      </div>

      {/* 4. Description Field with Help */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium" style={{ color: TEXT.secondary }}>
            Description *
          </label>
          <HelpButton fieldId="description" stepId="identity" modeColors={modeColors} />
        </div>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe what this agent does and when to use it..."
          rows={3}
          className="w-full px-4 py-3 rounded-xl outline-none resize-none"
          style={{
            background: 'rgba(0,0,0,0.3)',
            border: `1px solid ${modeColors.border}`,
            color: TEXT.primary,
          }}
        />
        {description && (
          <p className="text-xs" style={{ color: description.length >= 10 ? '#10B981' : TEXT.tertiary }}>
            {description.length}/10 characters minimum
          </p>
        )}
        <FieldHint stepId="identity" fieldId="description" modeColors={modeColors} />
      </div>

      {/* 5. Agent Type with Help */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium" style={{ color: TEXT.secondary }}>
            Agent Type *
          </label>
          <HelpButton fieldId="agentType" stepId="identity" modeColors={modeColors} />
        </div>
        <div id="identity-type-selector" className="grid grid-cols-2 gap-3">
          {/* Agent type buttons */}
          {['orchestrator', 'specialist', 'worker', 'reviewer'].map((type) => (
            <button
              key={type}
              onClick={() => setAgentType(type)}
              className="p-4 rounded-xl text-left capitalize"
              style={{
                background: agentType === type ? modeColors.soft : 'rgba(255,255,255,0.03)',
                border: `1px solid ${agentType === type ? modeColors.border : 'transparent'}`,
              }}
            >
              <div className="font-medium">{type}</div>
              <div className="text-xs" style={{ color: TEXT.tertiary }}>
                {type === 'orchestrator' ? 'Coordinates multiple agents' : 
                 type === 'specialist' ? 'Deep expertise in one area' :
                 type === 'worker' ? 'General task execution' : 'Reviews and validates'}
              </div>
            </button>
          ))}
        </div>
        <FieldHint stepId="identity" fieldId="agentType" modeColors={modeColors} />
      </div>

      {/* 6. Model Selection with Smart Suggestions */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium" style={{ color: TEXT.secondary }}>
            AI Model *
          </label>
          <HelpButton fieldId="model" stepId="identity" modeColors={modeColors} />
        </div>
        <button
          id="identity-model-selector"
          onClick={() => {/* Open model selector */}}
          className="w-full p-4 rounded-xl text-left"
          style={{
            background: 'rgba(0,0,0,0.3)',
            border: `1px solid ${modeColors.border}`,
          }}
        >
          <div className="font-medium" style={{ color: TEXT.primary }}>
            {model || 'Select a model'}
          </div>
          <div className="text-xs" style={{ color: TEXT.tertiary }}>
            {model ? 'Click to change' : 'Choose from available providers'}
          </div>
        </button>

        {/* Smart Suggestions for Models */}
        {modelSuggestions.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center gap-2 mb-2">
              <Lightning size={16} style={{ color: modeColors.accent }} />
              <span className="text-sm font-medium" style={{ color: TEXT.primary }}>
                Recommended Models
              </span>
            </div>
            <SmartSuggestions
              suggestions={modelSuggestions}
              onApplySuggestion={(suggestion) => {
                // Apply suggested model
                const modelId = suggestion.description.split(', ')[0];
                setModel(modelId);
              }}
              modeColors={modeColors}
            />
          </div>
        )}
        <FieldHint stepId="identity" fieldId="model" modeColors={modeColors} />
      </div>
    </div>
  );
}

// ============================================================================
// STEP 2: CHARACTER STEP - HELP INTEGRATION EXAMPLE
// ============================================================================

function CharacterStepWithHelp({ config, setConfig, modeColors }: any) {
  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Step Introduction */}
      <StepIntroduction stepId="character" modeColors={modeColors} />

      {/* Quick Tip */}
      <QuickTip modeColors={modeColors} />

      {/* Specialization with Help */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium" style={{ color: TEXT.secondary }}>
            Professional Specialization *
          </label>
          <HelpButton fieldId="setup" stepId="character" modeColors={modeColors} />
        </div>
        <div id="character-setup-selector" className="grid grid-cols-3 gap-4">
          {/* Setup buttons */}
        </div>
        <FieldHint stepId="character" fieldId="setup" modeColors={modeColors} />
      </div>

      {/* Specialty Skills with Help */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium" style={{ color: TEXT.secondary }}>
            Specialty Skills *
          </label>
          <HelpButton fieldId="specialtySkills" stepId="character" modeColors={modeColors} />
        </div>
        <div id="character-skills-input" className="flex flex-wrap gap-2">
          {/* Skills tags */}
        </div>
        <p className="text-xs" style={{ color: TEXT.tertiary }}>
          Add 3-5 core skills that define this agent's expertise
        </p>
        <FieldHint stepId="character" fieldId="specialtySkills" modeColors={modeColors} />
      </div>

      {/* Temperament with Help */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium" style={{ color: TEXT.secondary }}>
            Work Temperament
          </label>
          <HelpButton fieldId="temperament" stepId="character" modeColors={modeColors} />
        </div>
        <div className="grid grid-cols-4 gap-3">
          {/* Temperament buttons */}
        </div>
        <FieldHint stepId="character" fieldId="temperament" modeColors={modeColors} />
      </div>
    </div>
  );
}

// ============================================================================
// STEP 3: ROLE CARD STEP - HELP INTEGRATION EXAMPLE
// ============================================================================

function RoleCardStepWithHelp({ config, setConfig, modeColors }: any) {
  const hardBansValidation = validateHardBans(config.hardBans || []);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Step Introduction */}
      <StepIntroduction stepId="role" modeColors={modeColors} />

      {/* Quick Tip */}
      <QuickTip modeColors={modeColors} />

      {/* Domain Field */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium" style={{ color: TEXT.secondary }}>
            Domain of Expertise
          </label>
          <HelpButton fieldId="domain" stepId="role" modeColors={modeColors} />
        </div>
        <div id="role-domain-field">
          <input
            type="text"
            value={config.domain}
            onChange={(e) => setConfig({ ...config, domain: e.target.value })}
            placeholder="e.g., React component development"
            className="w-full px-4 py-3 rounded-xl outline-none"
            style={{
              background: 'rgba(0,0,0,0.3)',
              border: `1px solid ${modeColors.border}`,
              color: TEXT.primary,
            }}
          />
        </div>
        <FieldHint stepId="role" fieldId="domain" modeColors={modeColors} />
      </div>

      {/* Hard Bans with Validation */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium" style={{ color: TEXT.secondary }}>
            Hard Bans (Restrictions)
          </label>
          <HelpButton fieldId="hardBans" stepId="role" modeColors={modeColors} size="lg" />
        </div>
        <div id="role-bans-selector" className="grid grid-cols-2 gap-3">
          {/* Hard ban buttons */}
        </div>
        {/* Validation Feedback */}
        <ValidationFeedback validations={[hardBansValidation]} modeColors={modeColors} />
        <FieldHint stepId="role" fieldId="hardBans" modeColors={modeColors} />
      </div>

      {/* Escalation Triggers */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium" style={{ color: TEXT.secondary }}>
            Escalation Triggers
          </label>
          <HelpButton fieldId="escalation" stepId="role" modeColors={modeColors} />
        </div>
        {/* Tag input for escalation triggers */}
        <FieldHint stepId="role" fieldId="escalation" modeColors={modeColors} />
      </div>
    </div>
  );
}

// ============================================================================
// STEP 4: VOICE STEP - HELP INTEGRATION EXAMPLE
// ============================================================================

function VoiceStepWithHelp({ config, setConfig, modeColors }: any) {
  return (
    <div className="space-y-8">
      {/* Step Introduction */}
      <StepIntroduction stepId="voice" modeColors={modeColors} />

      {/* Quick Tip */}
      <QuickTip modeColors={modeColors} />

      {/* Voice Style */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium" style={{ color: TEXT.secondary }}>
            Voice Style
          </label>
          <HelpButton fieldId="style" stepId="voice" modeColors={modeColors} size="lg" />
        </div>
        <div id="voice-style-selector" className="grid grid-cols-2 gap-3">
          {/* Voice style buttons */}
        </div>
        <FieldHint stepId="voice" fieldId="style" modeColors={modeColors} />
      </div>

      {/* Tone Modifiers */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium" style={{ color: TEXT.secondary }}>
            Tone Modifiers
          </label>
          <HelpButton fieldId="tone" stepId="voice" modeColors={modeColors} />
        </div>
        {/* Tone sliders */}
        <FieldHint stepId="voice" fieldId="tone" modeColors={modeColors} />
      </div>
    </div>
  );
}

// ============================================================================
// STEP 5: TOOLS STEP - HELP INTEGRATION EXAMPLE
// ============================================================================

function ToolsStepWithHelp({ selectedTools, setSelectedTools, temperature, setTemperature, modeColors }: any) {
  const toolsValidation = validateTools(selectedTools || []);
  const tempValidation = validateTemperature(temperature || 0.7);

  // Smart suggestions for tools
  const toolSuggestions: SmartSuggestion[] = useMemo(() => {
    return getToolSuggestions('coding' as any, selectedTools || []);
  }, [selectedTools]);

  return (
    <div className="space-y-8">
      {/* Step Introduction */}
      <StepIntroduction stepId="tools" modeColors={modeColors} />

      {/* Quick Tip */}
      <QuickTip modeColors={modeColors} />

      {/* Tools Selection */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium" style={{ color: TEXT.secondary }}>
            Available Tools
          </label>
          <HelpButton fieldId="tools" stepId="tools" modeColors={modeColors} size="lg" />
        </div>
        <div id="tools-selector">
          {/* Tools grid */}
        </div>
        {/* Validation Feedback */}
        <ValidationFeedback validations={[toolsValidation]} modeColors={modeColors} />
        {/* Smart Suggestions */}
        {toolSuggestions.length > 0 && (
          <div className="mt-4">
            <SmartSuggestions
              suggestions={toolSuggestions}
              onApplySuggestion={(suggestion) => {
                // Apply suggested tools
                const toolIds = suggestion.description.split(', ').map(s => s.trim());
                setSelectedTools([...selectedTools, ...toolIds]);
              }}
              modeColors={modeColors}
            />
          </div>
        )}
        <FieldHint stepId="tools" fieldId="tools" modeColors={modeColors} />
      </div>

      {/* Temperature */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium" style={{ color: TEXT.secondary }}>
            Temperature: {temperature}
          </label>
          <HelpButton fieldId="temperature" stepId="tools" modeColors={modeColors} />
        </div>
        <input
          type="range"
          min="0"
          max="2"
          step="0.1"
          value={temperature}
          onChange={(e) => setTemperature(parseFloat(e.target.value))}
          className="w-full"
        />
        {/* Validation Feedback */}
        <ValidationFeedback validations={[tempValidation]} modeColors={modeColors} />
        <FieldHint stepId="tools" fieldId="temperature" modeColors={modeColors} />
      </div>

      {/* Max Iterations */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium" style={{ color: TEXT.secondary }}>
            Max Iterations
          </label>
          <HelpButton fieldId="maxIterations" stepId="tools" modeColors={modeColors} />
        </div>
        <input
          type="number"
          value={5}
          onChange={(e) => {/* handle change */}}
          className="w-32 px-4 py-2 rounded-lg"
          style={{
            background: 'rgba(0,0,0,0.3)',
            border: `1px solid ${modeColors.border}`,
            color: TEXT.primary,
          }}
        />
        <FieldHint stepId="tools" fieldId="maxIterations" modeColors={modeColors} />
      </div>
    </div>
  );
}

// ============================================================================
// EXPORT EXAMPLE COMPONENTS
// ============================================================================

export {
  AgentCreationWizardWithHelp,
  IdentityStepWithHelp,
  CharacterStepWithHelp,
  RoleCardStepWithHelp,
  VoiceStepWithHelp,
  ToolsStepWithHelp,
};
