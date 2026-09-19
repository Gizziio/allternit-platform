import React, { type ReactNode } from 'react';
import type { KeyboardEvent } from '../../../../ink/events/keyboard-event';
import { Box, Text } from '../../../../ink';
import { useKeybinding } from '../../../../keybindings/useKeybinding';
import { isAutoMemoryEnabled } from '../../../../memdir/paths';
import type { Tools } from '../../../../Tool';
import { getMemoryScopeDisplay } from '../../../../tools/AgentTool/agentMemory';
import type { AgentDefinition } from '../../../../tools/AgentTool/loadAgentsDir';
import { truncateToWidth } from '../../../../utils/format';
import { getAgentModelDisplay } from '../../../../utils/model/agent';
import { ConfigurableShortcutHint } from '../../../ConfigurableShortcutHint';
import { Byline } from '../../../design-system/Byline';
import { KeyboardShortcutHint } from '../../../design-system/KeyboardShortcutHint';
import { useWizard } from '../../../wizard/index';
import { WizardDialogLayout } from '../../../wizard/WizardDialogLayout';
import { getNewRelativeAgentFilePath } from '../../agentFileUtils';
import { validateAgent } from '../../validateAgent';
import type { AgentWizardData } from '../types';
type Props = {
  tools: Tools;
  existingAgents: AgentDefinition[];
  onSave: () => void;
  onSaveAndEdit: () => void;
  error?: string | null;
};
export function ConfirmStep({
    tools,
    existingAgents,
    onSave,
    onSaveAndEdit,
    error
}: Props) {
  const {
    goBack,
    wizardData
  } = useWizard();
  const t1 = {
      context: "Confirmation"
    };

  useKeybinding("confirm:no", goBack, t1);
  const t2 = e => {
      if (e.key === "s" || e.key === "return") {
        e.preventDefault();
        onSave();
      } else {
        if (e.key === "e") {
          e.preventDefault();
          onSaveAndEdit();
        }
      }
    };

  const handleKeyDown = t2;
  const agent = wizardData.finalAgent;
  let T0;
  let T1;
  let t10;
  let t11;
  let t12;
  let t13;
  let t14;
  let t15;
  let t16;
  let t17;
  let t18;
  let t19;
  let t3;
  let t4;
  let t5;
  let t6;
  let t7;
  let t8;
  let t9;
  const validation = validateAgent(agent, tools, existingAgents);
  const t20 = truncateToWidth(agent.getSystemPrompt(), 240);

  const systemPromptPreview = t20;
  const t21 = truncateToWidth(agent.whenToUse, 240);

  const whenToUsePreview = t21;
  const getToolsDisplay = _temp;
  const t22 = isAutoMemoryEnabled() ? <Text><Text bold={true}>Memory</Text>: {getMemoryScopeDisplay(agent.memory)}</Text> : null;

  const memoryDisplayElement = t22;
  T1 = WizardDialogLayout;
  t18 = "Confirm and save";

    t19 = <Byline><KeyboardShortcutHint shortcut="s/Enter" action="save" /><KeyboardShortcutHint shortcut="e" action="edit in your editor" /><ConfigurableShortcutHint action="confirm:no" context="Confirmation" fallback="Esc" description="cancel" /></Byline>;
  
  T0 = Box;
  t3 = "column";
  t4 = 0;
  t5 = true;
  t6 = handleKeyDown;
  const t23 = <Text bold={true}>Name</Text>;


    t7 = <Text>{t23}: {agent.agentType}</Text>;
  
  const t24 = <Text bold={true}>Location</Text>;

  const t25 = getNewRelativeAgentFilePath({
      source: wizardData.location,
      agentType: agent.agentType
    });


    t8 = <Text>{t24}:{" "}{t25}</Text>;
  
  const t26 = <Text bold={true}>Tools</Text>;

  const t27 = getToolsDisplay(agent.tools);


    t9 = <Text>{t26}: {t27}</Text>;
  
  const t28 = <Text bold={true}>Model</Text>;

  const t29 = getAgentModelDisplay(agent.model);


    t10 = <Text>{t28}: {t29}</Text>;
  
  t11 = memoryDisplayElement;

    t12 = <Box marginTop={1}><Text><Text bold={true}>Description</Text> (tells Gizzi when to use this agent):</Text></Box>;
  

    t13 = <Box marginLeft={2} marginTop={1}><Text>{whenToUsePreview}</Text></Box>;
  

    t14 = <Box marginTop={1}><Text><Text bold={true}>System prompt</Text>:</Text></Box>;
  

    t15 = <Box marginLeft={2} marginTop={1}><Text>{systemPromptPreview}</Text></Box>;
  
  t16 = validation.warnings.length > 0 && <Box marginTop={1} flexDirection="column"><Text color="warning">Warnings:</Text>{validation.warnings.map(_temp2)}</Box>;
  t17 = validation.errors.length > 0 && <Box marginTop={1} flexDirection="column"><Text color="error">Errors:</Text>{validation.errors.map(_temp3)}</Box>;
  

  const t20_2 = error && <Box marginTop={1}><Text color="error">{error}</Text></Box>;

  const t21_2 = <Text bold={true}>s</Text>;

  const t22_2 = <Text bold={true}>Enter</Text>;

  const t23_2 = <Box marginTop={2}><Text color="success">Press {t21_2} or {t22_2} to save,{" "}<Text bold={true}>e</Text> to save and edit</Text></Box>;

  const t24_2 = <T0 flexDirection={t3} tabIndex={t4} autoFocus={t5} onKeyDown={t6}>{t7}{t8}{t9}{t10}{t11}{t12}{t13}{t14}{t15}{t16}{t17}{t20_2}{t23_2}</T0>;

  const t25_2 = <T1 subtitle={t18} footerText={t19}>{t24_2}</T1>;

  return t25_2;
}
function _temp3(err, i_0) {
  return <Text key={i_0} color="error">{" "}• {err}</Text>;
}
function _temp2(warning, i) {
  return <Text key={i} dimColor={true}>{" "}• {warning}</Text>;
}
function _temp(toolNames) {
  if (toolNames === undefined) {
    return "All tools";
  }
  if (toolNames.length === 0) {
    return "None";
  }
  if (toolNames.length === 1) {
    return toolNames[0] || "None";
  }
  if (toolNames.length === 2) {
    return toolNames.join(" and ");
  }
  return `${toolNames.slice(0, -1).join(", ")}, and ${toolNames[toolNames.length - 1]}`;
}
