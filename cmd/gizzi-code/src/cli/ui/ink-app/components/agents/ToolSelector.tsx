import figures from 'figures';
import React, { useCallback, useMemo, useState } from 'react';
import { mcpInfoFromString } from './../../services/mcp/mcpStringUtils.ts';
import { isMcpTool } from './../../services/mcp/utils.ts';
import type { Tool, Tools } from './../../Tool.ts';
import { filterToolsForAgent } from './../../tools/AgentTool/agentToolUtils.ts';
import { AGENT_TOOL_NAME } from './../../tools/AgentTool/constants.ts';
import { BashTool } from './../../tools/BashTool/BashTool.tsx';
import { ExitPlanModeV2Tool } from './../../tools/ExitPlanModeTool/ExitPlanModeV2Tool.ts';
import { FileEditTool } from './../../tools/FileEditTool/FileEditTool.ts';
import { FileReadTool } from './../../tools/FileReadTool/FileReadTool.ts';
import { FileWriteTool } from './../../tools/FileWriteTool/FileWriteTool.ts';
import { GlobTool } from './../../tools/GlobTool/GlobTool.ts';
import { GrepTool } from './../../tools/GrepTool/GrepTool.ts';
import { ListMcpResourcesTool } from './../../tools/ListMcpResourcesTool/ListMcpResourcesTool.ts';
import { NotebookEditTool } from './../../tools/NotebookEditTool/NotebookEditTool.ts';
import { ReadMcpResourceTool } from './../../tools/ReadMcpResourceTool/ReadMcpResourceTool.ts';
import { TaskOutputTool } from './../../tools/TaskOutputTool/TaskOutputTool.tsx';
import { TaskStopTool } from './../../tools/TaskStopTool/TaskStopTool.ts';
import { TodoWriteTool } from './../../tools/TodoWriteTool/TodoWriteTool.ts';
import { TungstenTool } from './../../tools/TungstenTool/TungstenTool.ts';
import { WebFetchTool } from './../../tools/WebFetchTool/WebFetchTool.ts';
import { WebSearchTool } from './../../tools/WebSearchTool/WebSearchTool.ts';
import type { KeyboardEvent } from '../../ink/events/keyboard-event';
import { Box, Text } from '../../ink';
import { useKeybinding } from '../../keybindings/useKeybinding';
import { count } from '../../utils/array';
import { plural } from '../../utils/stringUtils';
import { Divider } from '../design-system/Divider';
type Props = {
  tools: Tools;
  initialTools: string[] | undefined;
  onComplete: (selectedTools: string[] | undefined) => void;
  onCancel?: () => void;
};
type ToolBucket = {
  name: string;
  toolNames: Set<string>;
  isMcp?: boolean;
};
type ToolBuckets = {
  READ_ONLY: ToolBucket;
  EDIT: ToolBucket;
  EXECUTION: ToolBucket;
  MCP: ToolBucket;
  OTHER: ToolBucket;
};
function getToolBuckets(): ToolBuckets {
  return {
    READ_ONLY: {
      name: 'Read-only tools',
      toolNames: new Set([GlobTool.name, GrepTool.name, ExitPlanModeV2Tool.name, FileReadTool.name, WebFetchTool.name, TodoWriteTool.name, WebSearchTool.name, TaskStopTool.name, TaskOutputTool.name, ListMcpResourcesTool.name, ReadMcpResourceTool.name])
    },
    EDIT: {
      name: 'Edit tools',
      toolNames: new Set([FileEditTool.name, FileWriteTool.name, NotebookEditTool.name])
    },
    EXECUTION: {
      name: 'Execution tools',
      // @ts-expect-error TODO(types) verbatim upstream feature-flag placeholder ("external" vs 'ant') — dead comparison kept per spec rule 6
      toolNames: new Set([BashTool.name, "external" === 'ant' ? TungstenTool.name : undefined].filter(n => n !== undefined))
    },
    MCP: {
      name: 'MCP tools',
      toolNames: new Set(),
      // Dynamic - no static list
      isMcp: true
    },
    OTHER: {
      name: 'Other tools',
      toolNames: new Set() // Dynamic - catch-all for uncategorized tools
    }
  };
}

// Helper to get MCP server buckets dynamically
function getMcpServerBuckets(tools: Tools): Array<{
  serverName: string;
  tools: Tools;
}> {
  const serverMap = new Map<string, Tool[]>();
  tools.forEach(tool => {
    if (isMcpTool(tool)) {
      const mcpInfo = mcpInfoFromString(tool.name);
      if (mcpInfo?.serverName) {
        const existing = serverMap.get(mcpInfo.serverName) || [];
        existing.push(tool);
        serverMap.set(mcpInfo.serverName, existing);
      }
    }
  });
  return Array.from(serverMap.entries()).map(([serverName, tools]) => ({
    serverName,
    tools
  })).sort((a, b) => a.serverName.localeCompare(b.serverName));
}
export function ToolSelector({
    tools,
    initialTools,
    onComplete,
    onCancel
}: Props) {
  const t1 = filterToolsForAgent({
      tools,
      isBuiltIn: false,
      isAsync: false
    });

  const customAgentTools = t1;
  const t2 = !initialTools || initialTools.includes("*") ? customAgentTools.map(_temp) : initialTools;

  const expandedInitialTools = t2;
  const [selectedTools, setSelectedTools] = useState(expandedInitialTools);
  const [focusIndex, setFocusIndex] = useState(0);
  const [showIndividualTools, setShowIndividualTools] = useState(false);
  const t3 = new Set(customAgentTools.map(_temp2));

  const toolNames = t3;
  const t5 = name => toolNames.has(name);

  const t4 = selectedTools.filter(t5);

  const validSelectedTools = t4;
  const t5_2 = new Set(validSelectedTools);

  const selectedSet = t5_2;
  const isAllSelected = validSelectedTools.length === customAgentTools.length && customAgentTools.length > 0;
  const t6 = toolName => {
      if (!toolName) {
        return;
      }
      setSelectedTools(current => current.includes(toolName) ? current.filter(t_1 => t_1 !== toolName) : [...current, toolName]);
    };

  const handleToggleTool = t6;
  const t7 = (toolNames_0, select) => {
      setSelectedTools(current_0 => {
        if (select) {
          const toolsToAdd = toolNames_0.filter(t_2 => !current_0.includes(t_2));
          return [...current_0, ...toolsToAdd];
        } else {
          return current_0.filter(t_3 => !toolNames_0.includes(t_3));
        }
      });
    };

  const handleToggleTools = t7;
  const t8 = () => {
      const allToolNames = customAgentTools.map(_temp3);
      const areAllToolsSelected = validSelectedTools.length === allToolNames.length && allToolNames.every(name_0 => validSelectedTools.includes(name_0));
      const finalTools = areAllToolsSelected ? undefined : validSelectedTools;
      onComplete(finalTools);
    };

  const handleConfirm = t8;
  const toolBuckets = getToolBuckets();
  const buckets = {
      readOnly: [] as Tool[],
      edit: [] as Tool[],
      execution: [] as Tool[],
      mcp: [] as Tool[],
      other: [] as Tool[]
    };
  customAgentTools.forEach(tool => {
      if (isMcpTool(tool)) {
        buckets.mcp.push(tool);
      } else {
        if (toolBuckets.READ_ONLY.toolNames.has(tool.name)) {
          buckets.readOnly.push(tool);
        } else {
          if (toolBuckets.EDIT.toolNames.has(tool.name)) {
            buckets.edit.push(tool);
          } else {
            if (toolBuckets.EXECUTION.toolNames.has(tool.name)) {
              buckets.execution.push(tool);
            } else {
              if (tool.name !== AGENT_TOOL_NAME) {
                buckets.other.push(tool);
              }
            }
          }
        }
      }
    });

  const toolsByBucket = buckets;
  const t9 = (bucketTools: Tool[]) => {
      const selected = count(bucketTools, t_5 => selectedSet.has(t_5.name));
      const needsSelection = selected < bucketTools.length;
      return () => {
        const toolNames_1 = bucketTools.map(_temp4);
        handleToggleTools(toolNames_1, needsSelection);
      };
    };

  const createBucketToggleAction = t9;
  const navigableItems = [];
  navigableItems.push({
      id: "continue",
      label: "Continue",
      action: handleConfirm,
      isContinue: true
    });
  const t10 = () => {
        const allToolNames_0 = customAgentTools.map(_temp5);
        handleToggleTools(allToolNames_0, !isAllSelected);
      };

  navigableItems.push({
      id: "bucket-all",
      label: `${isAllSelected ? figures.checkboxOn : figures.checkboxOff} All tools`,
      action: t10
    });
  const toolBuckets_0 = getToolBuckets();
  const bucketConfigs = [{
      id: "bucket-readonly",
      name: toolBuckets_0.READ_ONLY.name,
      tools: toolsByBucket.readOnly
    }, {
      id: "bucket-edit",
      name: toolBuckets_0.EDIT.name,
      tools: toolsByBucket.edit
    }, {
      id: "bucket-execution",
      name: toolBuckets_0.EXECUTION.name,
      tools: toolsByBucket.execution
    }, {
      id: "bucket-mcp",
      name: toolBuckets_0.MCP.name,
      tools: toolsByBucket.mcp
    }, {
      id: "bucket-other",
      name: toolBuckets_0.OTHER.name,
      tools: toolsByBucket.other
    }];
  bucketConfigs.forEach(t11 => {
      const {
        id,
        name: name_1,
        tools: bucketTools_0
      } = t11;
      if (bucketTools_0.length === 0) {
        return;
      }
      const selected_0 = count(bucketTools_0, t_8 => selectedSet.has(t_8.name));
      const isFullySelected = selected_0 === bucketTools_0.length;
      navigableItems.push({
        id,
        label: `${isFullySelected ? figures.checkboxOn : figures.checkboxOff} ${name_1}`,
        action: createBucketToggleAction(bucketTools_0)
      });
    });
  const toggleButtonIndex = navigableItems.length;
  const t12 = () => {
        setShowIndividualTools(!showIndividualTools);
        if (showIndividualTools && focusIndex > toggleButtonIndex) {
          setFocusIndex(toggleButtonIndex);
        }
      };

  navigableItems.push({
      id: "toggle-individual",
      label: showIndividualTools ? "Hide advanced options" : "Show advanced options",
      action: t12,
      isToggle: true
    });
  const mcpServerBuckets = getMcpServerBuckets(customAgentTools);
  if (showIndividualTools) {
      if (mcpServerBuckets.length > 0) {
        navigableItems.push({
          id: "mcp-servers-header",
          label: "MCP Servers:",
          action: _temp6,
          isHeader: true
        });
        mcpServerBuckets.forEach(t13 => {
          const {
            serverName,
            tools: serverTools
          } = t13;
          const selected_1 = count(serverTools, t_9 => selectedSet.has(t_9.name));
          const isFullySelected_0 = selected_1 === serverTools.length;
          navigableItems.push({
            id: `mcp-server-${serverName}`,
            label: `${isFullySelected_0 ? figures.checkboxOn : figures.checkboxOff} ${serverName} (${serverTools.length} ${plural(serverTools.length, "tool")})`,
            action: () => {
              const toolNames_2 = serverTools.map(_temp7);
              handleToggleTools(toolNames_2, !isFullySelected_0);
            }
          });
        });
        navigableItems.push({
          id: "tools-header",
          label: "Individual Tools:",
          action: _temp8,
          isHeader: true
        });
      }
      customAgentTools.forEach(tool_0 => {
        let displayName = tool_0.name;
        if (tool_0.name.startsWith("mcp__")) {
          const mcpInfo = mcpInfoFromString(tool_0.name);
          displayName = mcpInfo ? `${mcpInfo.toolName} (${mcpInfo.serverName})` : tool_0.name;
        }
        navigableItems.push({
          id: `tool-${tool_0.name}`,
          label: `${selectedSet.has(tool_0.name) ? figures.checkboxOn : figures.checkboxOff} ${displayName}`,
          action: () => handleToggleTool(tool_0.name)
        });
      });
    }

  const t10_2 = () => {
      if (onCancel) {
        onCancel();
      } else {
        onComplete(initialTools);
      }
    };

  const handleCancel = t10_2;
  const t11 = {
      context: "Confirmation"
    };

  useKeybinding("confirm:no", handleCancel, t11);
  const t12_2 = e => {
      if (e.key === "return") {
        e.preventDefault();
        const item = navigableItems[focusIndex];
        if (item && !item.isHeader) {
          item.action();
        }
      } else {
        if (e.key === "up") {
          e.preventDefault();
          let newIndex = focusIndex - 1;
          while (newIndex > 0 && navigableItems[newIndex]?.isHeader) {
            newIndex--;
          }
          setFocusIndex(Math.max(0, newIndex));
        } else {
          if (e.key === "down") {
            e.preventDefault();
            let newIndex_0 = focusIndex + 1;
            while (newIndex_0 < navigableItems.length - 1 && navigableItems[newIndex_0]?.isHeader) {
              newIndex_0++;
            }
            setFocusIndex(Math.min(navigableItems.length - 1, newIndex_0));
          }
        }
      }
    };

  const handleKeyDown = t12_2;
  const t13 = focusIndex === 0 ? "suggestion" : undefined;
  const t14 = focusIndex === 0;
  const t15 = focusIndex === 0 ? `${figures.pointer} ` : "  ";
  const t16 = <Text color={t13} bold={t14}>{t15}[ Continue ]</Text>;

  const t17 = <Divider width={40} />;

  const t18 = navigableItems.slice(1);

  const t19 = t18.map((item_0, index) => {
      const isCurrentlyFocused = index + 1 === focusIndex;
      const isToggleButton = item_0.isToggle;
      const isHeader = item_0.isHeader;
      return <React.Fragment key={item_0.id}>{isToggleButton && <Divider width={40} />}{isHeader && index > 0 && <Box marginTop={1} />}<Text color={isHeader ? undefined : isCurrentlyFocused ? "suggestion" : undefined} dimColor={isHeader} bold={isToggleButton && isCurrentlyFocused}>{isHeader ? "" : isCurrentlyFocused ? `${figures.pointer} ` : "  "}{isToggleButton ? `[ ${item_0.label} ]` : item_0.label}</Text></React.Fragment>;
    });

  const t20 = isAllSelected ? "All tools selected" : `${selectedSet.size} of ${customAgentTools.length} tools selected`;
  const t21 = <Box marginTop={1} flexDirection="column"><Text dimColor={true}>{t20}</Text></Box>;

  const t22 = <Box flexDirection="column" marginTop={1} tabIndex={0} autoFocus={true} onKeyDown={handleKeyDown}>{t16}{t17}{t19}{t21}</Box>;

  return t22;
}
function _temp8() {}
function _temp7(t_10) {
  return t_10.name;
}
function _temp6() {}
function _temp5(t_7) {
  return t_7.name;
}
function _temp4(t_6) {
  return t_6.name;
}
function _temp3(t_4) {
  return t_4.name;
}
function _temp2(t_0) {
  return t_0.name;
}
function _temp(t) {
  return t.name;
}
