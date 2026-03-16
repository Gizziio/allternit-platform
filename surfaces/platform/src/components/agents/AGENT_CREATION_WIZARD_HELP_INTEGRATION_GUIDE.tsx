/**
 * Agent Creation Wizard - Help System Integration Guide
 * 
 * This file provides step-by-step instructions for integrating the comprehensive
 * help system into the AgentCreationWizardEnhanced.tsx file.
 * 
 * The help system includes:
 * 1. Contextual help on every wizard step
 * 2. Tooltips on complex fields
 * 3. Example values for inputs
 * 4. Best practices for selections
 * 5. Help panel with "Need Help?" button
 * 6. Step-specific guidance
 * 7. Common questions
 * 8. Links to documentation
 * 9. Inline hints
 * 10. Field descriptions below labels
 * 11. Example input placeholders
 * 12. Validation hints (what's required, format)
 * 13. Recommended selections highlighted
 * 14. Onboarding tour for first-time users
 * 15. Smart suggestions based on agent type/capabilities
 * 16. Real-time validation feedback
 * 
 * PREREQUISITES:
 * - wizard-help-components.tsx exists with all components
 * - wizard-help.constants.ts exists with all content
 * 
 * INTEGRATION STEPS:
 * 
 * Step 1: Add imports to AgentCreationWizardEnhanced.tsx
 * Step 2: Add help state to main wizard component
 * Step 3: Wrap wizard with HelpPanel and OnboardingTour
 * Step 4: Add HelpButton to each form field
 * Step 5: Add StepIntroduction to each step
 * Step 6: Add QuickTip to each step
 * Step 7: Add FieldHint to each field
 * Step 8: Add ValidationFeedback to validated fields
 * Step 9: Add SmartSuggestions where applicable
 * 
 * See the code examples below for each step component.
 */

// ============================================================================
// STEP 1: ADD IMPORTS TO AGENTCREATIONWIZARDENHANCED.TSX
// ============================================================================

/**
 * Add these imports at the top of AgentCreationWizardEnhanced.tsx
 * (after the existing imports)
 */

/*
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
  HelpProvider,
} from '@/components/agents/wizard-help-components';

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
*/

// ============================================================================
// STEP 2: ADD HELP STATE TO MAIN WIZARD COMPONENT
// ============================================================================

/**
 * In the AgentCreationWizardEnhanced component, add these state variables:
 */

/*
export function AgentCreationWizardEnhanced({ ...props }) {
  const modeColors = MODE_COLORS.chat as typeof MODE_COLORS.chat;

  // Help System State
  const [showHelpPanel, setShowHelpPanel] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [currentHelpStep, setCurrentHelpStep] = useState('identity');

  // Check if user has completed onboarding before
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

  // ... rest of existing state
*/

// ============================================================================
// STEP 3: ADD HELP PANEL AND ONBOARDING TOUR TO WIZARD
// ============================================================================

/**
 * In the main return statement of AgentCreationWizardEnhanced,
 * add these components at the top level:
 */

/*
return (
  <>
    {/* Global Styles for Animations *}
    <style>{...}</style>

    {/* Help Panel - Slide-out panel with step-specific guidance *}
    <HelpPanel
      isOpen={showHelpPanel}
      onClose={() => setShowHelpPanel(false)}
      currentStepId={currentHelpStep}
      modeColors={modeColors}
    />

    {/* Onboarding Tour - First-time user walkthrough *}
    <OnboardingTour
      isOpen={showOnboarding}
      onComplete={handleCompleteOnboarding}
      onSkip={() => {
        setShowOnboarding(false);
        setHasCompletedOnboarding(true);
        localStorage.setItem('agent-wizard-onboarding-completed', 'true');
      }}
      currentStep={currentStep}
      totalSteps={steps.length}
      modeColors={modeColors}
    />

    <div className="h-screen flex flex-col overflow-hidden">
      {/* Header with Help Button *}
      <WizardHeader
        steps={steps}
        currentStep={currentStep}
        onClose={onCancel}
        modeColors={modeColors}
        onOpenHelp={() => setShowHelpPanel(true)}
      />

      {/* ... rest of wizard content *}
    </div>
  </>
);
*/

// ============================================================================
// STEP 4: UPDATE WIZARD HEADER WITH HELP BUTTON
// ============================================================================

/**
 * Update the WizardHeader component to include a help button:
 */

/*
interface WizardHeaderProps {
  steps: { id: string; label: string; icon: React.ElementType }[];
  currentStep: number;
  onClose?: () => void;
  modeColors: typeof MODE_COLORS.chat;
  onOpenHelp?: () => void;
}

function WizardHeader({ steps, currentStep, onClose, modeColors, onOpenHelp }: WizardHeaderProps) {
  return (
    <div
      className="px-4 sm:px-6 py-4 border-b flex items-center justify-between"
      style={{ borderColor: modeColors.border }}
      role="banner"
    >
      <div className="flex items-center gap-3">
        <div
          className="p-2 rounded-lg hidden sm:block"
          style={{ background: modeColors.soft }}
          aria-hidden="true"
        >
          <Sparkles size={20} style={{ color: modeColors.accent }} />
        </div>
        <div>
          <h2 className="text-base sm:text-lg font-semibold" style={{ color: TEXT.primary }}>
            Create Agent
          </h2>
          <p className="text-xs sm:text-sm" style={{ color: TEXT.secondary }}>
            <span className="hidden sm:inline">Step {currentStep + 1} of {steps.length}:</span>
            <span className="sm:hidden">Step {currentStep + 1}/{steps.length}:</span>
            {' '}{steps[currentStep]?.label}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {onOpenHelp && (
          <button
            onClick={onOpenHelp}
            className="px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            style={{
              background: modeColors.soft,
              color: modeColors.accent,
              minHeight: '44px',
            }}
            aria-label="Open help panel"
          >
            <HelpCircle size={18} />
            <span className="hidden sm:inline">Need Help?</span>
          </button>
        )}
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/5 transition-colors focus:outline-none focus:ring-2 focus:ring-white/20 focus:ring-offset-2 focus:ring-offset-[#0D0B09]"
            style={{ minHeight: '44px', minWidth: '44px' }}
            aria-label="Close wizard"
          >
            <X size={20} style={{ color: TEXT.tertiary }} />
          </button>
        )}
      </div>
    </div>
  );
}
*/

// ============================================================================
// STEP 5: INTEGRATE HELP INTO IDENTITY STEP
// ============================================================================

/**
 * Replace the IdentityStep component with this enhanced version:
 */

/*
function IdentityStep({
  name, setName,
  description, setDescription,
  agentType, setAgentType,
  model, setModel,
  provider, setProvider,
  availableModels,
  modeColors,
  onNameChange,
  nameError,
  isLoadingModels,
  modelLoadProgress,
}: {
  name: string; setName: (v: string) => void;
  description: string; setDescription: (v: string) => void;
  agentType: AgentType; setAgentType: (v: AgentType) => void;
  model: string; setModel: (v: string) => void;
  provider: ModelProvider; setProvider: (v: ModelProvider) => void;
  availableModels: string[];
  modeColors: typeof MODE_COLORS.chat;
  onNameChange?: (v: string) => void;
  nameError?: string | null;
  isLoadingModels?: boolean;
  modelLoadProgress?: number;
}) {
  // Validation states
  const [nameValidation, setNameValidation] = useState<ValidationResult | null>(null);
  const [descValidation, setDescValidation] = useState<ValidationResult | null>(null);

  // Smart suggestions for models
  const modelSuggestions: SmartSuggestion[] = useMemo(() => {
    return getModelSuggestions(characterConfig.identity.setup, agentType);
  }, [characterConfig.identity.setup, agentType]);

  // Real-time validation
  useEffect(() => {
    if (name) {
      const validation = validateAgentName(name);
      setNameValidation(validation);
    }
  }, [name]);

  useEffect(() => {
    if (description) {
      const validation = validateDescription(description);
      setDescValidation(validation);
    }
  }, [description]);

  return (
    <div className="max-w-2xl mx-auto space-y-8" ref={focusRef} tabIndex={-1}>
      {/* Step Introduction *}
      <StepIntroduction stepId="identity" modeColors={modeColors} />

      {/* Quick Tip *}
      <QuickTip modeColors={modeColors} />

      {/* Name Field with Help *}
      <FormField label="Name" required>
        <div className="flex items-center gap-2">
          <input
            id="identity-name-field"
            type="text"
            value={name}
            onChange={handleNameChange}
            placeholder="e.g., Code Review Specialist"
            className="w-full px-4 py-3 rounded-xl outline-none transition-all focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-[#0D0B09]"
            style={{
              background: 'rgba(0,0,0,0.3)',
              borderColor: nameError ? '#EF4444' : modeColors.border,
              borderWidth: '1px',
              borderStyle: 'solid',
              color: TEXT.primary,
              minHeight: '44px',
            }}
            aria-invalid={!!nameError}
            aria-describedby={nameError ? 'name-error' : undefined}
          />
          <HelpButton fieldId="name" stepId="identity" modeColors={modeColors} />
        </div>
        {nameError && (
          <p id="name-error" className="text-xs mt-1" style={{ color: '#EF4444' }} role="alert" aria-live="assertive">
            {nameError}
          </p>
        )}
        {name && name.length >= 2 && !nameError && (
          <p className="text-xs mt-1" style={{ color: '#10B981' }} role="status" aria-live="polite">
            <span className="inline-flex items-center gap-1">
              <CheckCircle2 size={12} />
              Name is available
            </span>
          </p>
        )}
        <FieldHint stepId="identity" fieldId="name" modeColors={modeColors} />
      </FormField>

      {/* Description Field with Help *}
      <FormField label="Description" required>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe what this agent does and when to use it..."
          rows={3}
          className="w-full px-4 py-3 rounded-xl outline-none transition-all resize-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-[#0D0B09]"
          style={{
            background: 'rgba(0,0,0,0.3)',
            border: `1px solid ${modeColors.border}`,
            color: TEXT.primary,
            minHeight: '88px',
          }}
          aria-required="true"
        />
        <p className="text-xs mt-1" style={{ color: description.trim().length >= 10 ? '#10B981' : TEXT.tertiary }} role="status">
          {description.trim().length}/10 characters minimum
        </p>
        <FieldHint stepId="identity" fieldId="description" modeColors={modeColors} />
      </FormField>

      {/* Agent Type with Help *}
      <FormField label="Agent Type" required>
        <div id="identity-type-selector" className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="radiogroup" aria-label="Agent type selection">
          {agentTypes.map((type) => (
            <button
              key={type.id}
              onClick={() => setAgentType(type.id)}
              role="radio"
              aria-checked={agentType === type.id}
              className="flex items-center gap-3 p-4 rounded-xl text-left transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-[#0D0B09]"
              style={{
                background: agentType === type.id ? modeColors.soft : 'rgba(255,255,255,0.03)',
                border: `1px solid ${agentType === type.id ? modeColors.border : 'transparent'}`,
                minHeight: '80px',
              }}
            >
              <div
                className="w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{
                  background: agentType === type.id ? modeColors.accent : 'rgba(255,255,255,0.05)',
                }}
                aria-hidden="true"
              >
                <type.icon size={22} color={agentType === type.id ? '#0D0B09' : modeColors.accent} />
              </div>
              <div>
                <div className="font-medium" style={{ color: agentType === type.id ? TEXT.primary : TEXT.secondary }}>
                  {type.label}
                </div>
                <div className="text-xs" style={{ color: TEXT.tertiary }}>
                  {type.description}
                </div>
              </div>
            </button>
          ))}
        </div>
        <FieldHint stepId="identity" fieldId="agentType" modeColors={modeColors} />
      </FormField>

      {/* Model Selection with Smart Suggestions *}
      <FormField label="Runtime Model" required>
        {/* ... existing model selector code ... *}
        
        {/* Smart Suggestions for Models *}
        {modelSuggestions.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center gap-2 mb-2">
              <Zap size={16} style={{ color: modeColors.accent }} />
              <span className="text-sm font-medium" style={{ color: TEXT.primary }}>
                Recommended for Your Configuration
              </span>
            </div>
            <SmartSuggestions
              suggestions={modelSuggestions}
              onApplySuggestion={(suggestion) => {
                const modelId = suggestion.description.split(', ')[0];
                setModel(modelId);
              }}
              modeColors={modeColors}
            />
          </div>
        )}
        <FieldHint stepId="identity" fieldId="model" modeColors={modeColors} />
      </FormField>
    </div>
  );
}
*/

// ============================================================================
// STEP 6: INTEGRATE HELP INTO CHARACTER STEP
// ============================================================================

/**
 * Update CharacterStep with help components:
 */

/*
function CharacterStep({
  config,
  setConfig,
  modeColors,
}: {
  config: CharacterLayerConfig;
  setConfig: (c: CharacterLayerConfig) => void;
  modeColors: typeof MODE_COLORS.chat;
}) {
  const setups = Object.entries(SETUP_CONFIG);
  const [isSkillModalOpen, setIsSkillModalOpen] = useState(false);

  const handleAddSkill = (skill: string) => {
    if (skill && skill.trim()) {
      setConfig({
        ...config,
        identity: {
          ...config.identity,
          specialtySkills: [...config.identity.specialtySkills, skill.trim()],
        },
      });
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-10">
      {/* Step Introduction *}
      <StepIntroduction stepId="character" modeColors={modeColors} />

      {/* Quick Tip *}
      <QuickTip modeColors={modeColors} />

      {/* Setup Selection with Help *}
      <FormField label="Professional Specialization" required>
        <div id="character-setup-selector" className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {setups.map(([key, setup]) => (
            <button
              key={key}
              onClick={() => {
                const newConfig = generateDefaultCharacterConfig(key as AgentSetup);
                setConfig({ ...newConfig, avatar: config.avatar });
              }}
              className="p-5 rounded-xl text-left transition-all relative overflow-hidden"
              style={{
                background: config.identity.setup === key ? `${setup.color}15` : 'rgba(255,255,255,0.03)',
                border: `2px solid ${config.identity.setup === key ? setup.color : 'transparent'}`,
              }}
            >
              {/* ... existing setup card content ... *}
            </button>
          ))}
        </div>
        <FieldHint stepId="character" fieldId="setup" modeColors={modeColors} />
      </FormField>

      {/* Specialty Skills with Help *}
      <FormField label="Specialty Skills" required>
        <div id="character-skills-input" className="flex flex-wrap gap-2">
          {config.identity.specialtySkills.map((skill, idx) => (
            <span
              key={idx}
              className="px-3 py-2 rounded-lg text-sm flex items-center gap-2 font-medium"
              style={{ background: modeColors.soft, color: modeColors.accent }}
            >
              {skill}
              <button
                onClick={() => {
                  const skills = [...config.identity.specialtySkills];
                  skills.splice(idx, 1);
                  setConfig({
                    ...config,
                    identity: { ...config.identity, specialtySkills: skills },
                  });
                }}
                className="hover:bg-white/10 rounded p-0.5 transition-colors"
              >
                <X size={14} />
              </button>
            </span>
          ))}
          <button
            onClick={() => setIsSkillModalOpen(true)}
            className="px-4 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors hover:bg-white/10 font-medium"
            style={{ background: 'rgba(255,255,255,0.05)', color: TEXT.secondary }}
          >
            <Plus size={14} />
            Add Skill
          </button>
        </div>
        <p className="text-xs mt-2" style={{ color: TEXT.tertiary }}>
          Add 3-5 core skills that define this agent's expertise
        </p>
        <FieldHint stepId="character" fieldId="specialtySkills" modeColors={modeColors} />
      </FormField>

      {/* Temperament with Help *}
      <FormField label="Work Temperament">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {(['precision', 'exploratory', 'systemic', 'balanced'] as Temperament[]).map((t) => (
            <button
              key={t}
              onClick={() => setConfig({
                ...config,
                identity: { ...config.identity, temperament: t },
              })}
              className="p-3 rounded-xl text-center capitalize transition-all"
              style={{
                background: config.identity.temperament === t ? modeColors.soft : 'rgba(255,255,255,0.03)',
                border: `1px solid ${config.identity.temperament === t ? modeColors.border : 'transparent'}`,
                color: config.identity.temperament === t ? modeColors.accent : TEXT.secondary,
              }}
            >
              {t}
            </button>
          ))}
        </div>
        <FieldHint stepId="character" fieldId="temperament" modeColors={modeColors} />
      </FormField>

      {/* ... rest of CharacterStep ... *}
    </div>
  );
}
*/

// ============================================================================
// STEP 7: INTEGRATE HELP INTO ROLE CARD STEP
// ============================================================================

/**
 * Update RoleCardStep with help components:
 */

/*
function RoleCardStep({
  config,
  setConfig,
  modeColors,
}: {
  config: RoleCardConfig;
  setConfig: (c: RoleCardConfig) => void;
  modeColors: typeof MODE_COLORS.chat;
}) {
  const bans = Object.entries(HARD_BAN_CATEGORIES);
  const hardBansValidation = validateHardBans(config.hardBans);

  return (
    <div className="space-y-8">
      {/* Step Introduction *}
      <StepIntroduction stepId="role" modeColors={modeColors} />

      {/* Quick Tip *}
      <QuickTip modeColors={modeColors} />

      {/* Domain Field with Help *}
      <FormField label="Domain">
        <div className="flex items-center gap-2">
          <input
            id="role-domain-field"
            type="text"
            value={config.domain}
            onChange={(e) => setConfig({ ...config, domain: e.target.value })}
            placeholder="e.g., Frontend Development"
            className="w-full px-4 py-3 rounded-xl outline-none"
            style={{
              background: 'rgba(0,0,0,0.3)',
              border: `1px solid ${modeColors.border}`,
              color: TEXT.primary,
            }}
          />
          <HelpButton fieldId="domain" stepId="role" modeColors={modeColors} />
        </div>
        <FieldHint stepId="role" fieldId="domain" modeColors={modeColors} />
      </FormField>

      {/* Hard Bans with Validation *}
      <FormField label="Hard Bans (Restrictions)">
        <div id="role-bans-selector" className="grid grid-cols-2 gap-3">
          {bans.map(([key, ban]) => {
            const isSelected = config.hardBans.some((b) => b.category === key);
            return (
              <button
                key={key}
                onClick={() => {
                  if (isSelected) {
                    setConfig({
                      ...config,
                      hardBans: config.hardBans.filter((b) => b.category !== key),
                    });
                  } else {
                    setConfig({
                      ...config,
                      hardBans: [...config.hardBans, { category: key as HardBanCategory, severity: ban.severity }],
                    });
                  }
                }}
                className="flex items-start gap-3 p-3 rounded-xl text-left transition-all"
                style={{
                  background: isSelected ? 'rgba(248,113,113,0.1)' : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${isSelected ? 'rgba(248,113,113,0.3)' : 'transparent'}`,
                }}
              >
                {/* ... existing ban button content ... *}
              </button>
            );
          })}
        </div>
        {/* Validation Feedback *}
        <ValidationFeedback validations={[hardBansValidation]} modeColors={modeColors} />
        <FieldHint stepId="role" fieldId="hardBans" modeColors={modeColors} />
      </FormField>

      {/* Escalation Triggers with Help *}
      <FormField label="Escalation Triggers">
        <div className="flex items-center gap-2">
          <TagInput
            tags={config.escalation}
            onChange={(tags) => setConfig({ ...config, escalation: tags })}
            placeholder="Add escalation trigger..."
            modeColors={modeColors}
          />
          <HelpButton fieldId="escalation" stepId="role" modeColors={modeColors} />
        </div>
        <FieldHint stepId="role" fieldId="escalation" modeColors={modeColors} />
      </FormField>

      {/* ... rest of RoleCardStep ... *}
    </div>
  );
}
*/

// ============================================================================
// STEP 8: INTEGRATE HELP INTO VOICE STEP
// ============================================================================

/**
 * Update VoiceStep with help components:
 */

/*
function VoiceStep({
  config,
  setConfig,
  modeColors,
  isLoadingVoice,
}: {
  config: VoiceConfigLayer;
  setConfig: (c: VoiceConfigLayer) => void;
  modeColors: typeof MODE_COLORS.chat;
  isLoadingVoice?: boolean;
}) {
  return (
    <div className="space-y-8" ref={focusRef} tabIndex={-1}>
      {/* Step Introduction *}
      <StepIntroduction stepId="voice" modeColors={modeColors} />

      {/* Quick Tip *}
      <QuickTip modeColors={modeColors} />

      {/* Voice Style with Help *}
      <FormField label="Voice Style">
        {isLoadingVoice ? (
          <VoiceSkeleton />
        ) : (
          <div id="voice-style-selector" className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="radiogroup" aria-label="Voice style selection">
            {VOICE_STYLES.map((style) => (
              <button
                key={style.id}
                onClick={() => setConfig({ ...config, style: style.id })}
                role="radio"
                aria-checked={config.style === style.id}
                className="p-4 rounded-xl text-left transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-[#0D0B09] min-h-[80px]"
                style={{
                  background: config.style === style.id ? modeColors.soft : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${config.style === style.id ? modeColors.border : 'transparent'}`,
                }}
              >
                {/* ... existing voice style content ... *}
              </button>
            ))}
          </div>
        )}
        <FieldHint stepId="voice" fieldId="style" modeColors={modeColors} />
      </FormField>

      {/* Tone Modifiers with Help *}
      <FormField label="Tone Modifiers">
        <div className="space-y-6">
          {[
            { key: 'formality', label: 'Formality', low: 'Casual', high: 'Formal' },
            { key: 'enthusiasm', label: 'Enthusiasm', low: 'Reserved', high: 'Energetic' },
            { key: 'empathy', label: 'Empathy', low: 'Direct', high: 'Supportive' },
            { key: 'directness', label: 'Directness', low: 'Nuanced', high: 'Blunt' },
          ].map(({ key, label, low, high }) => (
            <div key={key}>
              <div className="flex justify-between text-sm mb-2">
                <span style={{ color: TEXT.secondary }}>{label}</span>
                <span style={{ color: TEXT.tertiary }}>{low} → {high}</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.1}
                value={config.tone[key as keyof typeof config.tone]}
                onChange={(e) => setConfig({
                  ...config,
                  tone: { ...config.tone, [key]: parseFloat(e.target.value) },
                })}
                className="w-full h-3 cursor-pointer"
                aria-valuemin={0}
                aria-valuemax={1}
                aria-valuenow={config.tone[key as keyof typeof config.tone]}
                aria-label={`${label} slider`}
              />
            </div>
          ))}
        </div>
        <FieldHint stepId="voice" fieldId="tone" modeColors={modeColors} />
      </FormField>

      {/* ... rest of VoiceStep ... *}
    </div>
  );
}
*/

// ============================================================================
// STEP 9: INTEGRATE HELP INTO TOOLS STEP
// ============================================================================

/**
 * Update ToolsStep with help components:
 */

/*
function ToolsStep({
  selectedTools, setSelectedTools,
  systemPrompt, setSystemPrompt,
  temperature, setTemperature,
  maxIterations, setMaxIterations,
  availableTools,
  modeColors,
  isLoadingPlugins,
  pluginLoadProgress,
}: {
  selectedTools: string[]; setSelectedTools: (t: string[]) => void;
  systemPrompt: string; setSystemPrompt: (s: string) => void;
  temperature: number; setTemperature: (t: number) => void;
  maxIterations: number; setMaxIterations: (n: number) => void;
  availableTools: string[];
  modeColors: typeof MODE_COLORS.chat;
  isLoadingPlugins?: boolean;
  pluginLoadProgress?: number;
}) {
  // Validation states
  const toolsValidation = validateTools(selectedTools);
  const tempValidation = validateTemperature(temperature);

  // Smart suggestions for tools
  const toolSuggestions: SmartSuggestion[] = useMemo(() => {
    return getToolSuggestions(characterConfig.identity.setup, selectedTools);
  }, [characterConfig.identity.setup, selectedTools]);

  return (
    <div className="space-y-8" ref={focusRef} tabIndex={-1}>
      {/* Step Introduction *}
      <StepIntroduction stepId="tools" modeColors={modeColors} />

      {/* Quick Tip *}
      <QuickTip modeColors={modeColors} />

      {/* Tools Selection with Help *}
      <FormField label="Available Tools">
        <div id="tools-selector">
          {/* ... existing tools grid ... *}
        </div>
        {/* Validation Feedback *}
        <ValidationFeedback validations={[toolsValidation]} modeColors={modeColors} />
        {/* Smart Suggestions *}
        {toolSuggestions.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center gap-2 mb-2">
              <Target size={16} style={{ color: modeColors.accent }} />
              <span className="text-sm font-medium" style={{ color: TEXT.primary }}>
                Recommended Tools
              </span>
            </div>
            <SmartSuggestions
              suggestions={toolSuggestions}
              onApplySuggestion={(suggestion) => {
                const toolIds = suggestion.description.split(', ').map(s => s.trim());
                setSelectedTools([...selectedTools, ...toolIds]);
              }}
              modeColors={modeColors}
            />
          </div>
        )}
        <FieldHint stepId="tools" fieldId="tools" modeColors={modeColors} />
      </FormField>

      {/* Temperature with Validation *}
      <FormField label={`Temperature: ${temperature}`}>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={temperature}
            onChange={(e) => setTemperature(parseFloat(e.target.value))}
            className="flex-1"
          />
          <HelpButton fieldId="temperature" stepId="tools" modeColors={modeColors} />
        </div>
        {/* Validation Feedback *}
        <ValidationFeedback validations={[tempValidation]} modeColors={modeColors} />
        <FieldHint stepId="tools" fieldId="temperature" modeColors={modeColors} />
      </FormField>

      {/* Max Iterations with Help *}
      <FormField label="Max Iterations">
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={maxIterations}
            onChange={(e) => setMaxIterations(parseInt(e.target.value))}
            className="w-32 px-4 py-2 rounded-lg"
            style={{
              background: 'rgba(0,0,0,0.3)',
              border: `1px solid ${modeColors.border}`,
              color: TEXT.primary,
            }}
          />
          <HelpButton fieldId="maxIterations" stepId="tools" modeColors={modeColors} />
        </div>
        <FieldHint stepId="tools" fieldId="maxIterations" modeColors={modeColors} />
      </FormField>

      {/* ... rest of ToolsStep ... *}
    </div>
  );
}
*/

// ============================================================================
// SUMMARY
// ============================================================================

/**
 * This integration provides:
 * 
 * 1. CONTEXTUAL HELP:
 *    - StepIntroduction component at the top of each step
 *    - Explains what the step does and what users will accomplish
 * 
 * 2. FIELD-LEVEL HELP:
 *    - HelpButton on complex fields shows tooltips on hover/focus
 *    - FieldHint below fields provides additional context
 *    - Example values in placeholders
 * 
 * 3. VALIDATION FEEDBACK:
 *    - Real-time validation with ValidationResult
 *    - ValidationFeedback component shows errors/warnings/info
 *    - Suggestions to fix issues
 * 
 * 4. SMART SUGGESTIONS:
 *    - getModelSuggestions() based on agent setup/type
 *    - getToolSuggestions() based on capabilities
 *    - getSystemPromptSuggestions() for prompt templates
 * 
 * 5. ONBOARDING TOUR:
 *    - OnboardingTour component for first-time users
 *    - Highlights important fields
 *    - Explains key concepts
 *    - Skip option for experienced users
 * 
 * 6. HELP PANEL:
 *    - "Need Help?" button in wizard header
 *    - Slide-out panel with step-specific content
 *    - Best practices
 *    - Common questions
 *    - Documentation links
 * 
 * 7. QUICK TIPS:
 *    - QuickTip component shows rotating helpful hints
 *    - Non-intrusive, dismissible
 * 
 * ACCESSIBILITY:
 * - All help buttons have aria-label
 * - Tooltips are keyboard accessible
 * - Screen reader announcements for validation
 * - Focus management between steps
 * 
 * PERFORMANCE:
 * - Help content loaded from constants (no API calls)
 * - Tooltips use AnimatePresence for smooth animations
 * - Memoized suggestions to prevent recalculation
 */

export {};
