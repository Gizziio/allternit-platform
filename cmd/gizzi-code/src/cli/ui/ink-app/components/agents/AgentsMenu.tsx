import chalk from '@/shared/util/chalk'
import * as React from 'react';
import { useCallback, useMemo, useState } from 'react';
import type { SettingSource } from './../../utils/settings/constants.ts';
import type { CommandResultDisplay } from '../../commands';
import { useExitOnCtrlCDWithKeybindings } from '../../hooks/useExitOnCtrlCDWithKeybindings';
import { useMergedTools } from '../../hooks/useMergedTools';
import { Box, Text } from '../../ink';
import { useAppState, useSetAppState } from '../../state/AppState';
import type { Tools } from '../../Tool';
import { type ResolvedAgent, resolveAgentOverrides } from '../../tools/AgentTool/agentDisplay';
import { type AgentDefinition, getActiveAgentsFromList } from '../../tools/AgentTool/loadAgentsDir';
import { toError } from '../../utils/errors';
import { logError } from '../../utils/log';
import { Select } from '../CustomSelect/select';
import { Dialog } from '../design-system/Dialog';
import { AgentDetail } from './AgentDetail';
import { AgentEditor } from './AgentEditor';
import { AgentNavigationFooter } from './AgentNavigationFooter';
import { AgentsList } from './AgentsList';
import { deleteAgentFromFile } from './agentFileUtils';
import { CreateAgentWizard } from './new-agent-creation/CreateAgentWizard';
import type { ModeState } from './types';
type Props = {
  tools: Tools;
  onExit: (result?: string, options?: {
    display?: CommandResultDisplay;
  }) => void;
};
export function AgentsMenu({
    tools,
    onExit
}: Props) {
  const t1: ModeState = {
      mode: "list-agents",
      source: "all"
    };

  const [modeState, setModeState] = useState<ModeState>(t1);
  const agentDefinitions = useAppState(_temp);
  const mcpTools = useAppState(_temp2);
  const toolPermissionContext = useAppState(_temp3);
  const setAppState = useSetAppState();
  const {
    allAgents,
    activeAgents: agents
  } = agentDefinitions;
  const t2 = [];

  const [changes, setChanges] = useState(t2);
  const mergedTools = useMergedTools(tools, mcpTools, toolPermissionContext);
  useExitOnCtrlCDWithKeybindings();
  const t3 = allAgents.filter(_temp4);

  const t4 = allAgents.filter(_temp5);

  const t5 = allAgents.filter(_temp6);

  const t6 = allAgents.filter(_temp7);

  const t7 = allAgents.filter(_temp8);

  const t8 = allAgents.filter(_temp9);

  const t9 = allAgents.filter(_temp0);

  const t10 = {
      "built-in": t3,
      userSettings: t4,
      projectSettings: t5,
      policySettings: t6,
      localSettings: t7,
      flagSettings: t8,
      plugin: t9,
      all: allAgents
    };

  const agentsBySource = t10;
  const t11 = message => {
      setChanges(prev => [...prev, message]);
      setModeState({
        mode: "list-agents",
        source: "all"
      });
    };

  const handleAgentCreated = t11;
  const t12 = async agent => {
      ;
      try {
        await deleteAgentFromFile(agent);
        setAppState(state => {
          const allAgents_0 = state.agentDefinitions.allAgents.filter(a_6 => !(a_6.agentType === agent.agentType && a_6.source === agent.source));
          return {
            ...state,
            agentDefinitions: {
              ...state.agentDefinitions,
              allAgents: allAgents_0,
              activeAgents: getActiveAgentsFromList(allAgents_0)
            }
          };
        });
        setChanges(prev_0 => [...prev_0, `Deleted agent: ${chalk.bold(agent.agentType)}`]);
        setModeState({
          mode: "list-agents",
          source: "all"
        });
      } catch (t13) {
        const error = t13;
        logError(toError(error));
      }
    };

  const handleAgentDeleted = t12;
  switch (modeState.mode) {
    case "list-agents":
      {
        const t13 = modeState.source === "all" ? [...agentsBySource["built-in"], ...agentsBySource.userSettings, ...agentsBySource.projectSettings, ...agentsBySource.localSettings, ...agentsBySource.policySettings, ...agentsBySource.flagSettings, ...agentsBySource.plugin] : agentsBySource[modeState.source];

        const agentsToShow = t13;
        const t14 = resolveAgentOverrides(agentsToShow, agents);

        const allResolved = t14;
        const resolvedAgents = allResolved;
        const t15 = () => {
            const exitMessage = changes.length > 0 ? `Agent changes:\n${changes.join("\n")}` : undefined;
            onExit(exitMessage ?? "Agents dialog dismissed", {
              display: changes.length === 0 ? "system" : undefined
            });
          };

        const t16 = agent_0 => setModeState({
            mode: "agent-menu",
            agent: agent_0,
            previousMode: modeState
          });

        const t17 = () => setModeState({
            mode: "create-agent"
          });

        const t18 = <AgentsList source={modeState.source} agents={resolvedAgents} onBack={t15} onSelect={t16} onCreateNew={t17} changes={changes} />;

        const t19 = <AgentNavigationFooter />;

        const t20 = <>{t18}{t19}</>;

        return t20;
      }
    case "create-agent":
      {
        const t13 = () => setModeState({
            mode: "list-agents",
            source: "all"
          });

        const t14 = <CreateAgentWizard tools={mergedTools} existingAgents={agents} onComplete={handleAgentCreated} onCancel={t13} />;

        return t14;
      }
    case "agent-menu":
      {
        const t14 = a_9 => a_9.agentType === modeState.agent.agentType && a_9.source === modeState.agent.source;

        const t13 = allAgents.find(t14);

        const freshAgent_1 = t13;
        const agentToUse = freshAgent_1 || modeState.agent;
        const isEditable = agentToUse.source !== "built-in" && agentToUse.source !== "plugin" && agentToUse.source !== "flagSettings";
        const t14_2 = {
            label: "View agent",
            value: "view"
          };

        const t15 = isEditable ? [{
            label: "Edit agent",
            value: "edit"
          }, {
            label: "Delete agent",
            value: "delete"
          }] : [];

        const t16 = {
            label: "Back",
            value: "back"
          };

        const t17 = [t14_2, ...t15, t16];

        const menuItems = t17;
        const t18 = value_0 => {
            bb129: switch (value_0) {
              case "view":
                {
                  setModeState({
                    mode: "view-agent",
                    agent: agentToUse,
                    previousMode: modeState.previousMode
                  });
                  break bb129;
                }
              case "edit":
                {
                  setModeState({
                    mode: "edit-agent",
                    agent: agentToUse,
                    previousMode: modeState
                  });
                  break bb129;
                }
              case "delete":
                {
                  setModeState({
                    mode: "delete-confirm",
                    agent: agentToUse,
                    previousMode: modeState
                  });
                  break bb129;
                }
              case "back":
                {
                  setModeState(modeState.previousMode);
                }
            }
          };

        const handleMenuSelect = t18;
        const t19 = () => setModeState(modeState.previousMode);

        const t20 = () => setModeState(modeState.previousMode);

        const t21 = <Select options={menuItems} onChange={handleMenuSelect} onCancel={t20} />;

        const t22 = changes.length > 0 && <Box marginTop={1}><Text dimColor={true}>{changes[changes.length - 1]}</Text></Box>;

        const t23 = <Box flexDirection="column">{t21}{t22}</Box>;

        const t24 = <Dialog title={modeState.agent.agentType} onCancel={t19} hideInputGuide={true}>{t23}</Dialog>;

        const t25 = <AgentNavigationFooter />;

        const t26 = <>{t24}{t25}</>;

        return t26;
      }
    case "view-agent":
      {
        const t14 = a_8 => a_8.agentType === modeState.agent.agentType && a_8.source === modeState.agent.source;

        const t13 = allAgents.find(t14);

        const freshAgent_0 = t13;
        const agentToDisplay = freshAgent_0 || modeState.agent;
        const t14_2_ = () => setModeState({
            mode: "agent-menu",
            agent: agentToDisplay,
            previousMode: modeState.previousMode
          });

        const t15 = () => setModeState({
            mode: "agent-menu",
            agent: agentToDisplay,
            previousMode: modeState.previousMode
          });

        const t16 = <AgentDetail agent={agentToDisplay} tools={mergedTools} allAgents={allAgents} onBack={t15} />;

        const t17 = <Dialog title={agentToDisplay.agentType} onCancel={t14_2_} hideInputGuide={true}>{t16}</Dialog>;

        const t18 = <AgentNavigationFooter instructions="Press Enter or Esc to go back" />;

        const t19 = <>{t17}{t18}</>;

        return t19;
      }
    case "delete-confirm":
      {
        const t13 = [{
            label: "Yes, delete",
            value: "yes"
          }, {
            label: "No, cancel",
            value: "no"
          }];

        const deleteOptions = t13;
        const t14 = () => {
            if ("previousMode" in modeState) {
              setModeState(modeState.previousMode);
            }
          };

        const t15 = <Text>Are you sure you want to delete the agent{" "}<Text bold={true}>{modeState.agent.agentType}</Text>?</Text>;

        const t16 = <Box marginTop={1}><Text dimColor={true}>Source: {modeState.agent.source}</Text></Box>;

        const t17 = value => {
            if (value === "yes") {
              handleAgentDeleted(modeState.agent);
            } else {
              if ("previousMode" in modeState) {
                setModeState(modeState.previousMode);
              }
            }
          };

        const t18 = () => {
            if ("previousMode" in modeState) {
              setModeState(modeState.previousMode);
            }
          };

        const t19 = <Box marginTop={1}><Select options={deleteOptions} onChange={t17} onCancel={t18} /></Box>;

        const t20 = <Dialog title="Delete agent" onCancel={t14} color="error">{t15}{t16}{t19}</Dialog>;

        const t21 = <AgentNavigationFooter instructions={"Press \u2191\u2193 to navigate, Enter to select, Esc to cancel"} />;

        const t22 = <>{t20}{t21}</>;

        return t22;
      }
    case "edit-agent":
      {
        const t14 = a_7 => a_7.agentType === modeState.agent.agentType && a_7.source === modeState.agent.source;

        const t13 = allAgents.find(t14);

        const freshAgent = t13;
        const agentToEdit = freshAgent || modeState.agent;
        const t14_2__ = `Edit agent: ${agentToEdit.agentType}`;
        const t15 = () => setModeState(modeState.previousMode);

        const t16 = message_0 => {
            handleAgentCreated(message_0);
            setModeState(modeState.previousMode);
          };
        const t17 = () => setModeState(modeState.previousMode);

        const t18 = <AgentEditor agent={agentToEdit} tools={mergedTools} onSaved={t16} onBack={t17} />;

        const t19 = <Dialog title={t14_2__} onCancel={t15} hideInputGuide={true}>{t18}</Dialog>;

        const t20 = <AgentNavigationFooter />;

        const t21 = <>{t19}{t20}</>;

        return t21;
      }
    default:
      {
        return null;
      }
  }
}
function _temp0(a_5) {
  return a_5.source === "plugin";
}
function _temp9(a_4) {
  return a_4.source === "flagSettings";
}
function _temp8(a_3) {
  return a_3.source === "localSettings";
}
function _temp7(a_2) {
  return a_2.source === "policySettings";
}
function _temp6(a_1) {
  return a_1.source === "projectSettings";
}
function _temp5(a_0) {
  return a_0.source === "userSettings";
}
function _temp4(a) {
  return a.source === "built-in";
}
function _temp3(s_1) {
  return s_1.toolPermissionContext;
}
function _temp2(s_0) {
  return s_0.mcp.tools;
}
function _temp(s) {
  return s.agentDefinitions;
}
