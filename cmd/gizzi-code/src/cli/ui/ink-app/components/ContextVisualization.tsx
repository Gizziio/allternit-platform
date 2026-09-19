import { feature } from 'bun:bundle';
import * as React from 'react';
import { Box, Text } from '../ink';
import type { ContextData } from '../utils/analyzeContext';
import { generateContextSuggestions } from '../utils/contextSuggestions';
import { getDisplayPath } from '../utils/file';
import { formatTokens } from '../utils/format';
import { getSourceDisplayName, type SettingSource } from '../utils/settings/constants';
import { plural } from '../utils/stringUtils';
import { ContextSuggestions } from './ContextSuggestions';
const RESERVED_CATEGORY_NAME = 'Autocompact buffer';

// Order for displaying source groups: Project > User > Managed > Plugin > Built-in
const SOURCE_DISPLAY_ORDER = ['Project', 'User', 'Managed', 'Plugin', 'Built-in'];

/** Group items by source type for display, sorted by tokens descending within each group */
function groupBySource<T extends {
  source: SettingSource | 'plugin' | 'built-in';
  tokens: number;
}>(items: T[]): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = getSourceDisplayName(item.source);
    const existing = groups.get(key) || [];
    existing.push(item);
    groups.set(key, existing);
  }
  // Sort each group by tokens descending
  for (const [key, group] of groups.entries()) {
    groups.set(key, group.sort((a, b) => b.tokens - a.tokens));
  }
  // Return groups in consistent order
  const orderedGroups = new Map<string, T[]>();
  for (const source of SOURCE_DISPLAY_ORDER) {
    const group = groups.get(source);
    if (group) {
      orderedGroups.set(source, group);
    }
  }
  return orderedGroups;
}
interface Props {
  data: ContextData;
}
export function ContextVisualization(t0) {
  const {
    data
  } = t0;
  const {
    categories,
    totalTokens,
    rawMaxTokens,
    percentage,
    gridRows,
    model,
    memoryFiles,
    mcpTools,
    deferredBuiltinTools: t1,
    systemTools,
    systemPromptSections,
    agents,
    skills,
    messageBreakdown
  } = data;
  let T0;
  let T1;
  let t2;
  let t3;
  let t4;
  let t5;
  let t6;
  let t7;
  let t8;
  let t9;
  const deferredBuiltinTools = t1 === undefined ? [] : t1;
  const visibleCategories = categories.filter(_temp);
  const t10 = categories.some(_temp2);

  const hasDeferredMcpTools = t10;
  const hasDeferredBuiltinTools = deferredBuiltinTools.length > 0;
  const autocompactCategory = categories.find(_temp3);
  T1 = Box;
  t6 = "column";
  t7 = 1;

    t8 = <Text bold={true}>Context Usage</Text>;
  
  const t11 = gridRows.map(_temp5);

  const t12 = <Box flexDirection="column" flexShrink={0}>{t11}</Box>;

  const t13 = formatTokens(totalTokens);

  const t14 = formatTokens(rawMaxTokens);

  const t15 = <Text dimColor={true}>{model} · {t13}/{t14}{" "}tokens ({percentage}%)</Text>;

  const t17 = <Text> </Text>;
  const t18 = <Text dimColor={true} italic={true}>Estimated usage by category</Text>;

  const t19 = (cat_2, index) => {
      const tokenDisplay = formatTokens(cat_2.tokens);
      const percentDisplay = cat_2.isDeferred ? "N/A" : `${(cat_2.tokens / rawMaxTokens * 100).toFixed(1)}%`;
      const isReserved = cat_2.name === RESERVED_CATEGORY_NAME;
      const displayName = cat_2.name;
      const symbol = cat_2.isDeferred ? " " : isReserved ? "\u26DD" : "\u26C1";
      return <Box key={index}><Text color={cat_2.color}>{symbol}</Text><Text> {displayName}: </Text><Text dimColor={true}>{tokenDisplay} tokens ({percentDisplay})</Text></Box>;
    };

  const t20 = visibleCategories.map(t19);
  const t21 = (categories.find(_temp6)?.tokens ?? 0) > 0 && <Box><Text dimColor={true}>⛶</Text><Text> Free space: </Text><Text dimColor={true}>{formatTokens(categories.find(_temp7)?.tokens || 0)}{" "}({((categories.find(_temp8)?.tokens || 0) / rawMaxTokens * 100).toFixed(1)}%)</Text></Box>;

  const t22 = autocompactCategory && autocompactCategory.tokens > 0 && <Box><Text color={autocompactCategory.color}>⛝</Text><Text dimColor={true}> {autocompactCategory.name}: </Text><Text dimColor={true}>{formatTokens(autocompactCategory.tokens)} tokens ({(autocompactCategory.tokens / rawMaxTokens * 100).toFixed(1)}%)</Text></Box>;
  const t23 = <Box flexDirection="column" gap={0} flexShrink={0}>{t15}{t17}{t18}{t20}{t21}{t22}</Box>;


    t9 = <Box flexDirection="row" gap={2}>{t12}{t23}</Box>;
  
  T0 = Box;
  t2 = "column";
  t3 = -1;

    t4 = mcpTools.length > 0 && <Box flexDirection="column" marginTop={1}><Box><Text bold={true}>MCP tools</Text><Text dimColor={true}>{" "}· /mcp{hasDeferredMcpTools ? " (loaded on-demand)" : ""}</Text></Box>{mcpTools.some(_temp9) && <Box flexDirection="column" marginTop={1}><Text dimColor={true}>Loaded</Text>{mcpTools.filter(_temp0).map(_temp1)}</Box>}{hasDeferredMcpTools && mcpTools.some(_temp10) && <Box flexDirection="column" marginTop={1}><Text dimColor={true}>Available</Text>{mcpTools.filter(_temp11).map(_temp12)}</Box>}{!hasDeferredMcpTools && mcpTools.map(_temp13)}</Box>;
  
  t5 = (systemTools && systemTools.length > 0 || hasDeferredBuiltinTools) && false && <Box flexDirection="column" marginTop={1}><Box><Text bold={true}>[ANT-ONLY] System tools</Text>{hasDeferredBuiltinTools && <Text dimColor={true}> (some loaded on-demand)</Text>}</Box><Box flexDirection="column" marginTop={1}><Text dimColor={true}>Loaded</Text>{systemTools?.map(_temp14)}{deferredBuiltinTools.filter(_temp15).map(_temp16)}</Box>{hasDeferredBuiltinTools && deferredBuiltinTools.some(_temp17) && <Box flexDirection="column" marginTop={1}><Text dimColor={true}>Available</Text>{deferredBuiltinTools.filter(_temp18).map(_temp19)}</Box>}</Box>;
  

  const t10_2 = systemPromptSections && systemPromptSections.length > 0 && false && <Box flexDirection="column" marginTop={1}><Text bold={true}>[ANT-ONLY] System prompt sections</Text>{systemPromptSections.map(_temp20)}</Box>;

  const t11_2 = agents.length > 0 && <Box flexDirection="column" marginTop={1}><Box><Text bold={true}>Custom agents</Text><Text dimColor={true}> · /agents</Text></Box>{Array.from(groupBySource(agents).entries()).map(_temp22)}</Box>;

  const t12_2 = memoryFiles.length > 0 && <Box flexDirection="column" marginTop={1}><Box><Text bold={true}>Memory files</Text><Text dimColor={true}> · /memory</Text></Box>{memoryFiles.map(_temp23)}</Box>;

  const t13_2 = skills && skills.tokens > 0 && <Box flexDirection="column" marginTop={1}><Box><Text bold={true}>Skills</Text><Text dimColor={true}> · /skills</Text></Box>{Array.from(groupBySource(skills.skillFrontmatter).entries()).map(_temp25)}</Box>;

  const t14_2 = messageBreakdown && false && <Box flexDirection="column" marginTop={1}><Text bold={true}>[ANT-ONLY] Message breakdown</Text><Box flexDirection="column" marginLeft={1}><Box><Text>Tool calls: </Text><Text dimColor={true}>{formatTokens(messageBreakdown.toolCallTokens)} tokens</Text></Box><Box><Text>Tool results: </Text><Text dimColor={true}>{formatTokens(messageBreakdown.toolResultTokens)} tokens</Text></Box><Box><Text>Attachments: </Text><Text dimColor={true}>{formatTokens(messageBreakdown.attachmentTokens)} tokens</Text></Box><Box><Text>Assistant messages (non-tool): </Text><Text dimColor={true}>{formatTokens(messageBreakdown.assistantMessageTokens)} tokens</Text></Box><Box><Text>User messages (non-tool-result): </Text><Text dimColor={true}>{formatTokens(messageBreakdown.userMessageTokens)} tokens</Text></Box></Box>{messageBreakdown.toolCallsByType.length > 0 && <Box flexDirection="column" marginTop={1}><Text bold={true}>[ANT-ONLY] Top tools</Text>{messageBreakdown.toolCallsByType.slice(0, 5).map(_temp26)}</Box>}{messageBreakdown.attachmentsByType.length > 0 && <Box flexDirection="column" marginTop={1}><Text bold={true}>[ANT-ONLY] Top attachments</Text>{messageBreakdown.attachmentsByType.slice(0, 5).map(_temp27)}</Box>}</Box>;

  const t15_2 = <T0 flexDirection={t2} marginLeft={t3}>{t4}{t5}{t10_2}{t11_2}{t12_2}{t13_2}{t14_2}</T0>;

  const t16 = generateContextSuggestions(data);

  const t17_2 = <ContextSuggestions suggestions={t16} />;

  const t18_2 = <T1 flexDirection={t6} paddingLeft={t7}>{t8}{t9}{t15_2}{t17_2}</T1>;

  return t18_2;
}
function _temp27(attachment, i_10) {
  return <Box key={i_10} marginLeft={1}><Text>└ {attachment.name}: </Text><Text dimColor={true}>{formatTokens(attachment.tokens)} tokens</Text></Box>;
}
function _temp26(tool_5, i_9) {
  return <Box key={i_9} marginLeft={1}><Text>└ {tool_5.name}: </Text><Text dimColor={true}>calls {formatTokens(tool_5.callTokens)}, results{" "}{formatTokens(tool_5.resultTokens)}</Text></Box>;
}
function _temp25(t0) {
  const [sourceDisplay_0, sourceSkills] = t0;
  return <Box key={sourceDisplay_0} flexDirection="column" marginTop={1}><Text dimColor={true}>{sourceDisplay_0}</Text>{sourceSkills.map(_temp24)}</Box>;
}
function _temp24(skill, i_8) {
  return <Box key={i_8}><Text>└ {skill.name}: </Text><Text dimColor={true}>{formatTokens(skill.tokens)} tokens</Text></Box>;
}
function _temp23(file, i_7) {
  return <Box key={i_7}><Text>└ {getDisplayPath(file.path)}: </Text><Text dimColor={true}>{formatTokens(file.tokens)} tokens</Text></Box>;
}
function _temp22(t0) {
  const [sourceDisplay, sourceAgents] = t0;
  return <Box key={sourceDisplay} flexDirection="column" marginTop={1}><Text dimColor={true}>{sourceDisplay}</Text>{sourceAgents.map(_temp21)}</Box>;
}
function _temp21(agent, i_6) {
  return <Box key={i_6}><Text>└ {agent.agentType}: </Text><Text dimColor={true}>{formatTokens(agent.tokens)} tokens</Text></Box>;
}
function _temp20(section, i_5) {
  return <Box key={i_5}><Text>└ {section.name}: </Text><Text dimColor={true}>{formatTokens(section.tokens)} tokens</Text></Box>;
}
function _temp19(tool_4, i_4) {
  return <Box key={i_4}><Text dimColor={true}>└ {tool_4.name}</Text></Box>;
}
function _temp18(t_4) {
  return !t_4.isLoaded;
}
function _temp17(t_5) {
  return !t_5.isLoaded;
}
function _temp16(tool_3, i_3) {
  return <Box key={`def-${i_3}`}><Text>└ {tool_3.name}: </Text><Text dimColor={true}>{formatTokens(tool_3.tokens)} tokens</Text></Box>;
}
function _temp15(t_3) {
  return t_3.isLoaded;
}
function _temp14(tool_2, i_2) {
  return <Box key={`sys-${i_2}`}><Text>└ {tool_2.name}: </Text><Text dimColor={true}>{formatTokens(tool_2.tokens)} tokens</Text></Box>;
}
function _temp13(tool_1, i_1) {
  return <Box key={i_1}><Text>└ {tool_1.name}: </Text><Text dimColor={true}>{formatTokens(tool_1.tokens)} tokens</Text></Box>;
}
function _temp12(tool_0, i_0) {
  return <Box key={i_0}><Text dimColor={true}>└ {tool_0.name}</Text></Box>;
}
function _temp11(t_1) {
  return !t_1.isLoaded;
}
function _temp10(t_2) {
  return !t_2.isLoaded;
}
function _temp1(tool, i) {
  return <Box key={i}><Text>└ {tool.name}: </Text><Text dimColor={true}>{formatTokens(tool.tokens)} tokens</Text></Box>;
}
function _temp0(t) {
  return t.isLoaded;
}
function _temp9(t_0) {
  return t_0.isLoaded;
}
function _temp8(c_0) {
  return c_0.name === "Free space";
}
function _temp7(c) {
  return c.name === "Free space";
}
function _temp6(c_1) {
  return c_1.name === "Free space";
}
function _temp5(row, rowIndex) {
  return <Box key={rowIndex} flexDirection="row" marginLeft={-1}>{row.map(_temp4)}</Box>;
}
function _temp4(square, colIndex) {
  if (square.categoryName === "Free space") {
    return <Text key={colIndex} dimColor={true}>{"\u26F6 "}</Text>;
  }
  if (square.categoryName === RESERVED_CATEGORY_NAME) {
    return <Text key={colIndex} color={square.color}>{"\u26DD "}</Text>;
  }
  return <Text key={colIndex} color={square.color}>{square.squareFullness >= 0.7 ? "\u26C1 " : "\u26C0 "}</Text>;
}
function _temp3(cat_1) {
  return cat_1.name === RESERVED_CATEGORY_NAME;
}
function _temp2(cat_0) {
  return cat_0.isDeferred && cat_0.name.includes("MCP");
}
function _temp(cat) {
  return cat.tokens > 0 && cat.name !== "Free space" && cat.name !== RESERVED_CATEGORY_NAME && !cat.isDeferred;
}
