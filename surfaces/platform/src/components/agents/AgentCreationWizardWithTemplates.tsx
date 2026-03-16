/**
 * Agent Creation Wizard with Template Selection
 *
 * Enhanced version of AgentCreationWizard that includes
 * specialist template selection as Step 0.
 *
 * Flow:
 * Step 0: Select Template (NEW - AgentHubModal)
 * Step 1: Identity
 * Step 2: Character
 * Step 3: Tools
 * Step 4: Review
 *
 * @module AgentCreationWizardWithTemplates
 */

import React, { useState, useCallback } from 'react';
import { AgentCreationWizard, type AgentCreationWizardProps } from './AgentCreationWizard';
import { AgentHubModal } from './AgentHubModal';
import type { SpecialistTemplate } from '@/lib/agents/agent-templates.specialist';
import type { AgentMode } from '@/design/a2r.tokens';

export interface AgentCreationWizardWithTemplatesProps extends Omit<AgentCreationWizardProps, 'onCreate'> {
  /**
   * Called when user selects a template.
   * Return true to proceed with template pre-fill, false to cancel.
   */
  onTemplateSelected?: (template: SpecialistTemplate) => boolean | Promise<boolean>;
  
  /**
   * Called when agent is created (after template selection and form completion)
   */
  onCreate: (config: any) => Promise<void>;
  
  defaultMode?: AgentMode;
  
  /**
   * Show template selection modal when wizard opens
   * @default true
   */
  showTemplateSelection?: boolean;
}

export function AgentCreationWizardWithTemplates({
  isOpen,
  onClose,
  onTemplateSelected,
  onCreate,
  showTemplateSelection = true,
  defaultMode = 'chat',
}: AgentCreationWizardWithTemplatesProps) {
  const [showHubModal, setShowHubModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<SpecialistTemplate | null>(null);
  const [wizardKey, setWizardKey] = useState(0); // Force re-render when template selected

  // Handle template selection from hub
  const handleTemplateSelect = useCallback(async (template: SpecialistTemplate) => {
    // Call custom handler if provided
    if (onTemplateSelected) {
      const shouldProceed = await onTemplateSelected(template);
      if (!shouldProceed) {
        return;
      }
    }

    setSelectedTemplate(template);
    setShowHubModal(false);
    
    // Force wizard to re-render with new template
    setWizardKey(prev => prev + 1);
  }, [onTemplateSelected]);

  // Handle wizard creation with template
  const handleCreate = useCallback(async (config: any) => {
    // Merge template config with wizard config
    const mergedConfig = selectedTemplate ? {
      ...config,
      systemPrompt: config.systemPrompt || selectedTemplate.systemPrompt,
      capabilities: config.capabilities?.length ? config.capabilities : selectedTemplate.agentConfig.capabilities,
      tools: config.tools?.length ? config.tools : selectedTemplate.agentConfig.tools,
    } : config;

    await onCreate(mergedConfig);
  }, [selectedTemplate, onCreate]);

  // Show hub modal when wizard opens (if no template selected)
  React.useEffect(() => {
    if (isOpen && showTemplateSelection && !selectedTemplate) {
      setShowHubModal(true);
    }
  }, [isOpen, showTemplateSelection, selectedTemplate]);

  // Reset state when closing
  React.useEffect(() => {
    if (!isOpen) {
      setSelectedTemplate(null);
      setShowHubModal(false);
    }
  }, [isOpen]);

  return (
    <>
      {/* Agent Hub Modal - Template Selection */}
      <AgentHubModal
        isOpen={showHubModal}
        onClose={() => {
          setShowHubModal(false);
          // If user closes hub without selecting, still show wizard
        }}
        onSelectTemplate={handleTemplateSelect}
        accentColor={defaultMode}
      />

      {/* Agent Creation Wizard */}
      <AgentCreationWizard
        key={wizardKey}
        isOpen={isOpen}
        onClose={onClose}
        onCreate={handleCreate}
        defaultMode={defaultMode}
      />
    </>
  );
}

export default AgentCreationWizardWithTemplates;
