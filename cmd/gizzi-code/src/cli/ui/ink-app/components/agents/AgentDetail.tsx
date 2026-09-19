import figures from 'figures';
import * as React from 'react';
import type { KeyboardEvent } from '../../ink/events/keyboard-event';
import { Box, Text } from '../../ink';
import { useKeybinding } from '../../keybindings/useKeybinding';
import type { Tools } from '../../Tool';
import { getAgentColor } from '../../tools/AgentTool/agentColorManager';
import { getMemoryScopeDisplay } from '../../tools/AgentTool/agentMemory';
import { resolveAgentTools } from '../../tools/AgentTool/agentToolUtils';
import { type AgentDefinition, isBuiltInAgent } from '../../tools/AgentTool/loadAgentsDir';
import { getAgentModelDisplay } from '../../utils/model/agent';
import { Markdown } from '../Markdown';
import { getActualRelativeAgentFilePath } from './agentFileUtils';
type Props = {
  agent: AgentDefinition;
  tools: Tools;
  allAgents?: AgentDefinition[];
  onBack: () => void;
};
export function AgentDetail({
    agent,
    tools,
    onBack
}: Props) {
  const resolvedTools = resolveAgentTools(agent, tools, false);
  const t1 = getActualRelativeAgentFilePath(agent);

  const filePath = t1;
  const t2 = getAgentColor(agent.agentType);

  const backgroundColor = t2;
  const t3 = {
      context: "Confirmation"
    };

  useKeybinding("confirm:no", onBack, t3);
  const t4 = e => {
      if (e.key === "return") {
        e.preventDefault();
        onBack();
      }
    };

  const handleKeyDown = t4;
  const renderToolsList = function renderToolsList() {
    if (resolvedTools.hasWildcard) {
      return <Text>All tools</Text>;
    }
    if (!agent.tools || agent.tools.length === 0) {
      return <Text>None</Text>;
    }
    return <>{resolvedTools.validTools.length > 0 && <Text>{resolvedTools.validTools.join(", ")}</Text>}{resolvedTools.invalidTools.length > 0 && <Text color="warning">{figures.warning} Unrecognized:{" "}{resolvedTools.invalidTools.join(", ")}</Text>}</>;
  };
  const T0 = Box;
  const t5 = "column";
  const t6 = 1;
  const t7 = 0;
  const t8 = true;
  const t9 = <Text dimColor={true}>{filePath}</Text>;

  const t10 = <Text><Text bold={true}>Description</Text> (tells Gizzi when to use this agent):</Text>;

  const t11 = <Box flexDirection="column">{t10}<Box marginLeft={2}><Text>{agent.whenToUse}</Text></Box></Box>;

  const T1 = Box;
  const t12 = <Text><Text bold={true}>Tools</Text>:{" "}</Text>;

  const t13 = renderToolsList();
  const t14 = <T1>{t12}{t13}</T1>;

  const t15 = <Text bold={true}>Model</Text>;

  const t16 = getAgentModelDisplay(agent.model);

  const t17 = <Text>{t15}: {t16}</Text>;

  const t18 = agent.permissionMode && <Text><Text bold={true}>Permission mode</Text>: {agent.permissionMode}</Text>;

  const t19 = agent.memory && <Text><Text bold={true}>Memory</Text>: {getMemoryScopeDisplay(agent.memory)}</Text>;

  const t20 = agent.hooks && Object.keys(agent.hooks).length > 0 && <Text><Text bold={true}>Hooks</Text>: {Object.keys(agent.hooks).join(", ")}</Text>;

  const t21 = agent.skills && agent.skills.length > 0 && <Text><Text bold={true}>Skills</Text>:{" "}{agent.skills.length > 10 ? `${agent.skills.length} skills` : agent.skills.join(", ")}</Text>;

  const t22 = backgroundColor && <Box><Text><Text bold={true}>Color</Text>:{" "}<Text backgroundColor={backgroundColor} color="inverseText">{" "}{agent.agentType}{" "}</Text></Text></Box>;

  const t23 = !isBuiltInAgent(agent) && <><Box><Text><Text bold={true}>System prompt</Text>:</Text></Box><Box marginLeft={2} marginRight={2}><Markdown>{agent.getSystemPrompt()}</Markdown></Box></>;

  const t24 = <T0 flexDirection={t5} gap={t6} tabIndex={t7} autoFocus={t8} onKeyDown={handleKeyDown}>{t9}{t11}{t14}{t17}{t18}{t19}{t20}{t21}{t22}{t23}</T0>;

  return t24;
}
