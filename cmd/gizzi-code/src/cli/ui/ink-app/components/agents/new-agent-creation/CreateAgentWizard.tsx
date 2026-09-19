import React, { type ReactNode } from 'react';
import { isAutoMemoryEnabled } from '../../../memdir/paths';
import type { Tools } from '../../../Tool';
import type { AgentDefinition } from '../../../tools/AgentTool/loadAgentsDir';
import { WizardProvider } from '../../wizard/index';
import type { WizardStepComponent } from '../../wizard/types';
import type { AgentWizardData } from './types';
import { ColorStep } from './wizard-steps/ColorStep';
import { ConfirmStepWrapper } from './wizard-steps/ConfirmStepWrapper';
import { DescriptionStep } from './wizard-steps/DescriptionStep';
import { GenerateStep } from './wizard-steps/GenerateStep';
import { LocationStep } from './wizard-steps/LocationStep';
import { MemoryStep } from './wizard-steps/MemoryStep';
import { MethodStep } from './wizard-steps/MethodStep';
import { ModelStep } from './wizard-steps/ModelStep';
import { PromptStep } from './wizard-steps/PromptStep';
import { ToolsStep } from './wizard-steps/ToolsStep';
import { TypeStep } from './wizard-steps/TypeStep';
type Props = {
  tools: Tools;
  existingAgents: AgentDefinition[];
  onComplete: (message: string) => void;
  onCancel: () => void;
};
export function CreateAgentWizard({
    tools,
    existingAgents,
    onComplete,
    onCancel
}: Props) {
  const t1 = () => <TypeStep existingAgents={existingAgents} />;

  const t2 = () => <ToolsStep tools={tools} />;

  const t3 = isAutoMemoryEnabled() ? [MemoryStep] : [];

  const t4 = () => <ConfirmStepWrapper tools={tools} existingAgents={existingAgents} onComplete={onComplete} />;

  const t5 = [LocationStep, MethodStep, GenerateStep, t1, PromptStep, DescriptionStep, t2, ModelStep, ColorStep, ...t3, t4];

  const steps = t5;
  const t6 = {};

  const t7 = <WizardProvider steps={steps} initialData={t6} onComplete={_temp} onCancel={onCancel} title="Create new agent" showStepCounter={false} />;

  return t7;
}
function _temp() {}
