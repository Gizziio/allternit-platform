/**
 * Help System Integration Examples
 * 
 * Copy-paste examples for integrating help system into remaining wizard steps.
 * 
 * Usage: Import the components and follow the patterns below for each step.
 */

import React from 'react';
import {
  HelpButton,
  FieldHint,
  StepIntroduction,
  QuickTip,
  SmartSuggestions,
  ValidationFeedback,
} from '@/components/agents/wizard-help-components';
import {
  validateHardBans,
  validateTools,
  validateTemperature,
  getToolSuggestions,
} from '@/lib/agents/wizard-help.constants';

// ============================================================================
// Example 1: Role Card Step
// ============================================================================

function RoleCardStepExample({ config, setConfig, modeColors }) {
  const hardBansValidation = validateHardBans(config.hardBans);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* 1. Step Introduction */}
      <StepIntroduction stepId="role" modeColors={modeColors} />
      
      {/* 2. Quick Tip */}
      <div className="mb-6">
        <QuickTip modeColors={modeColors} />
      </div>

      {/* 3. Form Fields with Help */}
      <FormField label="Domain" required>
        <div className="flex items-start gap-2">
          <input
            type="text"
            value={config.domain}
            onChange={(e) => setConfig({ ...config, domain: e.target.value })}
            placeholder="e.g., React component development"
            className="w-full px-4 py-3 rounded-xl outline-none transition-all"
            style={{
              background: 'rgba(0,0,0,0.3)',
              border: `1px solid ${modeColors.border}`,
              color: TEXT.primary,
            }}
          />
          <HelpButton fieldId="domain" stepId="role" modeColors={modeColors} />
        </div>
        <FieldHint fieldId="domain" stepId="role" modeColors={modeColors} />
      </FormField>

      {/* 4. Hard Bans with Validation */}
      <FormField label="Hard Bans (Restrictions)">
        <div className="flex items-start gap-2">
          <div className="flex-1">
            {/* Your hard bans selector component */}
            <HardBansSelector
              hardBans={config.hardBans}
              onChange={(hardBans) => setConfig({ ...config, hardBans })}
              modeColors={modeColors}
            />
          </div>
          <HelpButton fieldId="hardBans" stepId="role" modeColors={modeColors} size="lg" />
        </div>
        
        {/* Validation Feedback */}
        <div className="mt-2">
          <ValidationFeedback 
            validations={[hardBansValidation]} 
            modeColors={modeColors} 
          />
        </div>
        <FieldHint fieldId="hardBans" stepId="role" modeColors={modeColors} />
      </FormField>

      {/* 5. Escalation Triggers */}
      <FormField label="Escalation Triggers">
        <div className="flex items-start gap-2">
          <TagInput
            tags={config.escalation}
            onChange={(escalation) => setConfig({ ...config, escalation })}
            placeholder="Add escalation trigger..."
            modeColors={modeColors}
          />
          <HelpButton fieldId="escalation" stepId="role" modeColors={modeColors} />
        </div>
        <FieldHint fieldId="escalation" stepId="role" modeColors={modeColors} />
      </FormField>
    </div>
  );
}

// ============================================================================
// Example 2: Tools Step
// ============================================================================

function ToolsStepExample({ selectedTools, setSelectedTools, temperature, setTemperature, modeColors }) {
  const toolsValidation = validateTools(selectedTools);
  const tempValidation = validateTemperature(temperature);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Step Introduction */}
      <StepIntroduction stepId="tools" modeColors={modeColors} />
      
      {/* Quick Tip */}
      <div className="mb-6">
        <QuickTip modeColors={modeColors} />
      </div>

      {/* Tools Selection */}
      <FormField label="Available Tools">
        <div className="flex items-start gap-2">
          <div className="flex-1">
            <ToolsSelector
              selectedTools={selectedTools}
              onSelectionChange={setSelectedTools}
              modeColors={modeColors}
            />
          </div>
          <HelpButton fieldId="tools" stepId="tools" modeColors={modeColors} size="lg" />
        </div>
        
        {/* Validation Feedback */}
        <div className="mt-2">
          <ValidationFeedback 
            validations={[toolsValidation]} 
            modeColors={modeColors} 
          />
        </div>
        
        {/* Smart Suggestions */}
        <div className="mt-4">
          <SmartSuggestions
            suggestions={getToolSuggestions('coding', selectedTools)}
            onApplySuggestion={(suggestion) => {
              // Apply the suggested tools
              const toolIds = suggestion.description.split(', ').map(s => s.trim());
              setSelectedTools([...selectedTools, ...toolIds]);
            }}
            modeColors={modeColors}
          />
        </div>
      </FormField>

      {/* Temperature Setting */}
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
        
        {/* Validation Feedback */}
        <div className="mt-2">
          <ValidationFeedback 
            validations={[tempValidation]} 
            modeColors={modeColors} 
          />
        </div>
        <FieldHint fieldId="temperature" stepId="tools" modeColors={modeColors} />
      </FormField>

      {/* Max Iterations */}
      <FormField label="Max Iterations">
        <div className="flex items-center gap-2">
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
          <HelpButton fieldId="maxIterations" stepId="tools" modeColors={modeColors} />
        </div>
        <FieldHint fieldId="maxIterations" stepId="tools" modeColors={modeColors} />
      </FormField>
    </div>
  );
}

// ============================================================================
// Example 3: Voice Step
// ============================================================================

function VoiceStepExample({ config, setConfig, modeColors }) {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Step Introduction */}
      <StepIntroduction stepId="voice" modeColors={modeColors} />
      
      {/* Quick Tip */}
      <div className="mb-6">
        <QuickTip modeColors={modeColors} />
      </div>

      {/* Voice Style Selection */}
      <FormField label="Voice Style">
        <div className="flex items-start gap-2">
          <div className="grid grid-cols-2 gap-3 flex-1">
            {VOICE_STYLES.map((style) => (
              <button
                key={style.id}
                onClick={() => setConfig({ ...config, style: style.id })}
                className="p-4 rounded-xl text-left transition-all"
                style={{
                  background: config.style === style.id ? modeColors.soft : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${config.style === style.id ? modeColors.border : 'transparent'}`,
                }}
              >
                <div className="font-medium" style={{ color: TEXT.primary }}>
                  {style.label}
                </div>
                <div className="text-xs mt-1" style={{ color: TEXT.tertiary }}>
                  {style.description}
                </div>
              </button>
            ))}
          </div>
          <HelpButton fieldId="style" stepId="voice" modeColors={modeColors} size="lg" />
        </div>
        <FieldHint fieldId="style" stepId="voice" modeColors={modeColors} />
      </FormField>

      {/* Tone Modifiers */}
      <FormField label="Tone Modifiers">
        <div className="space-y-4">
          {/* Formality Slider */}
          <div className="flex items-center gap-2">
            <span className="text-sm w-24" style={{ color: TEXT.secondary }}>Formality</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={config.tone.formality}
              onChange={(e) => setConfig({ 
                ...config, 
                tone: { ...config.tone, formality: parseFloat(e.target.value) } 
              })}
              className="flex-1"
            />
            <span className="text-sm w-12 text-right" style={{ color: TEXT.tertiary }}>
              {Math.round(config.tone.formality * 100)}%
            </span>
          </div>
          
          {/* Add other tone modifiers similarly... */}
        </div>
        <FieldHint fieldId="tone" stepId="voice" modeColors={modeColors} />
      </FormField>
    </div>
  );
}

// ============================================================================
// Example 4: Avatar Step
// ============================================================================

function AvatarStepExample({ config, setConfig, modeColors }) {
  return (
    <div className="space-y-8">
      {/* Step Introduction */}
      <StepIntroduction stepId="avatar" modeColors={modeColors} />
      
      {/* Quick Tip */}
      <div className="mb-6">
        <QuickTip modeColors={modeColors} />
      </div>

      {/* Avatar Category */}
      <FormField label="Avatar Category">
        <div className="flex items-start gap-2">
          <div className="flex flex-wrap gap-2 flex-1">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
                style={{
                  background: selectedCategory === cat.id ? modeColors.soft : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${selectedCategory === cat.id ? modeColors.border : 'transparent'}`,
                  color: selectedCategory === cat.id ? modeColors.accent : TEXT.secondary,
                }}
              >
                {cat.label} ({cat.count})
              </button>
            ))}
          </div>
        </div>
        <FieldHint fieldId="avatarCategory" stepId="avatar" modeColors={modeColors} />
      </FormField>

      {/* Avatar Selection */}
      <FormField label="Select Avatar">
        <div className="flex items-start gap-2">
          <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 flex-1">
            {filteredAvatars.map((avatar) => (
              <button
                key={avatar.id}
                onClick={() => handleAvatarSelect(avatar)}
                className="group relative p-3 rounded-xl transition-all hover:scale-105"
                style={{
                  background: selectedAvatar === avatar.id ? modeColors.soft : 'rgba(255,255,255,0.03)',
                  border: `2px solid ${selectedAvatar === avatar.id ? modeColors.border : 'transparent'}`,
                }}
              >
                {/* Avatar preview */}
                <div className="aspect-square rounded-lg overflow-hidden mb-2">
                  {avatar.svgContent}
                </div>
                <div className="text-xs font-medium truncate" style={{ color: TEXT.primary }}>
                  {avatar.name}
                </div>
              </button>
            ))}
          </div>
        </div>
        <FieldHint fieldId="selectAvatar" stepId="avatar" modeColors={modeColors} />
      </FormField>
    </div>
  );
}

// ============================================================================
// Example 5: Plugins Step
// ============================================================================

function PluginsStepExample({ selectedPlugins, onSelectionChange, modeColors }) {
  return (
    <div className="space-y-8">
      {/* Step Introduction */}
      <StepIntroduction stepId="plugins" modeColors={modeColors} />
      
      {/* Quick Tip */}
      <div className="mb-6">
        <QuickTip modeColors={modeColors} />
      </div>

      {/* Plugin Categories */}
      <FormField label="Browse by Category">
        <div className="flex flex-wrap gap-2">
          {PLUGIN_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={{
                background: selectedCategory === cat.id ? modeColors.soft : 'rgba(255,255,255,0.05)',
                border: `1px solid ${selectedCategory === cat.id ? modeColors.border : 'transparent'}`,
                color: selectedCategory === cat.id ? modeColors.accent : TEXT.secondary,
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </FormField>

      {/* Plugin List */}
      <FormField label="Available Plugins">
        <div className="space-y-3">
          {plugins.map((plugin) => (
            <PluginCard
              key={plugin.id}
              plugin={plugin}
              isSelected={selectedPlugins.some(p => p.id === plugin.id)}
              onToggle={() => {
                // Handle toggle
              }}
              modeColors={modeColors}
            />
          ))}
        </div>
        <FieldHint fieldId="plugins" stepId="plugins" modeColors={modeColors} />
      </FormField>
    </div>
  );
}

// ============================================================================
// Example 6: Workspace Step
// ============================================================================

function WorkspaceStepExample({ workspaceDocs, modeColors }) {
  return (
    <div className="space-y-8">
      {/* Step Introduction */}
      <StepIntroduction stepId="workspace" modeColors={modeColors} />
      
      {/* Quick Tip */}
      <div className="mb-6">
        <QuickTip modeColors={modeColors} />
      </div>

      {/* File List */}
      <div className="grid grid-cols-2 gap-4">
        {workspaceFiles.map((file) => (
          <div
            key={file.id}
            className="p-4 rounded-xl cursor-pointer transition-all hover:scale-[1.02]"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: `1px solid ${modeColors.border}`,
            }}
          >
            <div className="flex items-center gap-3 mb-2">
              <file.icon size={20} style={{ color: modeColors.accent }} />
              <span className="font-medium" style={{ color: TEXT.primary }}>
                {file.name}
              </span>
            </div>
            <p className="text-sm" style={{ color: TEXT.secondary }}>
              {file.description}
            </p>
          </div>
        ))}
      </div>

      {/* Help Text */}
      <div
        className="p-4 rounded-lg flex items-start gap-3"
        style={{
          background: 'rgba(59, 130, 246, 0.1)',
          border: `1px solid rgba(59, 130, 246, 0.3)`,
        }}
      >
        <Info size={18} style={{ color: '#3B82F6' }} />
        <p className="text-sm" style={{ color: TEXT.secondary }}>
          These files are auto-generated based on your configuration. 
          Click any file to preview and edit before saving to your workspace.
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// Example 7: Review Step
// ============================================================================

function ReviewStepExample({ name, characterConfig, selectedTools, modeColors }) {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Step Introduction */}
      <StepIntroduction stepId="review" modeColors={modeColors} />
      
      {/* Quick Tip */}
      <div className="mb-6">
        <QuickTip modeColors={modeColors} />
      </div>

      {/* Review Sections */}
      <div className="space-y-6">
        {/* Identity Summary */}
        <SectionCard title="Agent Identity" icon={User} section="identity">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs mb-1" style={{ color: TEXT.tertiary }}>Name</div>
              <div className="font-medium" style={{ color: TEXT.primary }}>
                {name || 'Unnamed Agent'}
              </div>
            </div>
            {/* More fields... */}
          </div>
        </SectionCard>

        {/* Character Summary */}
        <SectionCard title="Character Configuration" icon={Sparkles} section="character">
          {/* Character details */}
        </SectionCard>

        {/* Tools Summary */}
        <SectionCard title="Tools & Capabilities" icon={Wrench} section="tools">
          {/* Tools details */}
        </SectionCard>
      </div>

      {/* Final Validation */}
      <div
        className="p-4 rounded-lg flex items-start gap-3"
        style={{
          background: 'rgba(16, 185, 129, 0.1)',
          border: `1px solid rgba(16, 185, 129, 0.3)`,
        }}
      >
        <CheckCircle2 size={18} style={{ color: '#10B981' }} />
        <div>
          <p className="text-sm font-medium" style={{ color: '#10B981' }}>
            Ready to Create Agent
          </p>
          <p className="text-sm mt-1" style={{ color: TEXT.secondary }}>
            All required fields are complete. Review the configuration above and click "Create Agent" when ready.
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Helper Components (Assumed to exist in your codebase)
// ============================================================================

function FormField({ label, required, children }) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium" style={{ color: TEXT.secondary }}>
        {label}
        {required && <span style={{ color: '#f87171' }}> *</span>}
      </label>
      {children}
    </div>
  );
}

function TagInput({ tags, onChange, placeholder, modeColors }) {
  // Your existing TagInput implementation
  return <div>TagInput</div>;
}

function HardBansSelector({ hardBans, onChange, modeColors }) {
  // Your hard bans selector component
  return <div>HardBansSelector</div>;
}

function ToolsSelector({ selectedTools, onSelectionChange, modeColors }) {
  // Your tools selector component
  return <div>ToolsSelector</div>;
}

function PluginCard({ plugin, isSelected, onToggle, modeColors }) {
  // Your plugin card component
  return <div>PluginCard</div>;
}

function SectionCard({ title, icon: Icon, section, children }) {
  return (
    <div
      className="p-4 rounded-xl"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: `1px solid ${modeColors.border}`,
      }}
    >
      <div className="flex items-center gap-2 mb-4">
        <Icon size={20} style={{ color: modeColors.accent }} />
        <h3 className="text-lg font-semibold" style={{ color: TEXT.primary }}>
          {title}
        </h3>
      </div>
      {children}
    </div>
  );
}
