import { feature } from 'bun:bundle';
import chalk from '@/shared/util/chalk'
import figures from 'figures';
import React, { useMemo } from 'react';
import { Ansi, Box, color, Text, useTheme } from '../../ink';
import { useAppState } from '../../state/AppState';
import type { PermissionMode } from '../../utils/permissions/PermissionMode';
import { permissionModeTitle } from '../../utils/permissions/PermissionMode';
import type { PermissionDecision, PermissionDecisionReason } from '../../utils/permissions/PermissionResult';
import { extractRules } from '../../utils/permissions/PermissionUpdate';
import type { PermissionUpdate } from '../../utils/permissions/PermissionUpdateSchema';
import { permissionRuleValueToString } from '../../utils/permissions/permissionRuleParser';
import { detectUnreachableRules } from '../../utils/permissions/shadowedRuleDetection';
import { SandboxManager } from '../../utils/sandbox/sandbox-adapter';
import { getSettingSourceDisplayNameLowercase } from '../../utils/settings/constants';
type PermissionDecisionInfoItemProps = {
  title?: string;
  decisionReason: PermissionDecisionReason;
};
function decisionReasonDisplayString(decisionReason: PermissionDecisionReason & {
  type: Exclude<PermissionDecisionReason['type'], 'subcommandResults'>;
}): string {
  if ((feature('BASH_CLASSIFIER') || feature('TRANSCRIPT_CLASSIFIER')) && decisionReason.type === 'classifier') {
    return `${chalk.bold(decisionReason.classifier)} classifier: ${decisionReason.reason}`;
  }
  switch (decisionReason.type) {
    case 'rule':
      return `${chalk.bold(permissionRuleValueToString(decisionReason.rule.ruleValue))} rule from ${getSettingSourceDisplayNameLowercase(decisionReason.rule.source)}`;
    case 'mode':
      return `${permissionModeTitle(decisionReason.mode)} mode`;
    case 'sandboxOverride':
      return 'Requires permission to bypass sandbox';
    case 'workingDir':
      return decisionReason.reason;
    case 'safetyCheck':
    case 'other':
      return decisionReason.reason;
    case 'permissionPromptTool':
      return `${chalk.bold(decisionReason.permissionPromptToolName)} permission prompt tool`;
    case 'hook':
      return decisionReason.reason ? `${chalk.bold(decisionReason.hookName)} hook: ${decisionReason.reason}` : `${chalk.bold(decisionReason.hookName)} hook`;
    case 'asyncAgent':
      return decisionReason.reason;
    default:
      return '';
  }
}
function PermissionDecisionInfoItem({
    title,
    decisionReason
}: PermissionDecisionInfoItemProps) {
  const [theme] = useTheme();
  const t1 = function formatDecisionReason() {
      switch (decisionReason.type) {
        case "subcommandResults":
          {
            return <Box flexDirection="column">{Array.from(decisionReason.reasons.entries()).map(t2 => {
                const [subcommand, result] = t2;
                const icon = result.behavior === "allow" ? color("success", theme)(figures.tick) : color("error", theme)(figures.cross);
                return <Box flexDirection="column" key={subcommand}><Text>{icon} {subcommand}</Text>{result.decisionReason !== undefined && result.decisionReason.type !== "subcommandResults" && <Text><Text dimColor={true}>{"  "}⎿{"  "}</Text><Ansi>{decisionReasonDisplayString(result.decisionReason)}</Ansi></Text>}{result.behavior === "ask" && <SuggestedRules suggestions={result.suggestions} />}</Box>;
              })}</Box>;
          }
        default:
          {
            return <Text><Ansi>{decisionReasonDisplayString(decisionReason)}</Ansi></Text>;
          }
      }
    };

  const formatDecisionReason = t1;
  const t2 = title && <Text>{title}</Text>;

  const t3 = formatDecisionReason();

  const t4 = <Box flexDirection="column">{t2}{t3}</Box>;

  return t4;
}
function SuggestedRules(t0: {
  suggestions: PermissionUpdate[] | undefined;
}) {
  const {
    suggestions
  } = t0;
  const rules = extractRules(suggestions);
  if (rules.length === 0) {
    return null;
  }
  const t2 = <Text dimColor={true}>{"  "}⎿{"  "}</Text>;
  const t3 = "Suggested rules:";
  const t4 = " ";
  const t1 = rules.map(_temp).join(", ");
  const t6 = <Ansi>{t1}</Ansi>;
  const t7 = <Text>{t2}{t3}{t4}{t6}</Text>;
  return t7;
}
function _temp(rule) {
  return chalk.bold(permissionRuleValueToString(rule));
}
type Props = {
  permissionResult: PermissionDecision;
  toolName?: string; // Filter unreachable rules to this tool
};

// Helper function to extract directories from permission updates
function extractDirectories(updates: PermissionUpdate[] | undefined): string[] {
  if (!updates) return [];
  return updates.flatMap(update => {
    switch (update.type) {
      case 'addDirectories':
        return update.directories;
      default:
        return [];
    }
  });
}

// Helper function to extract mode from permission updates
function extractMode(updates: PermissionUpdate[] | undefined): PermissionMode | undefined {
  if (!updates) return undefined;
  const update = updates.findLast(u => u.type === 'setMode');
  return update?.type === 'setMode' ? update.mode : undefined;
}
function SuggestionDisplay(t0: {
  suggestions: PermissionUpdate[] | undefined;
  width: number;
}) {
  const {
    suggestions,
    width
  } = t0;
  if (!suggestions || suggestions.length === 0) {
    const t1 = <Text dimColor={true}>Suggestions </Text>;

    const t2 = <Box justifyContent="flex-end" minWidth={width}>{t1}</Box>;

    const t3 = <Text>None</Text>;

    const t4 = <Box flexDirection="row">{t2}{t3}</Box>;

    return t4;
  }
  const rules = extractRules(suggestions);
  const directories = extractDirectories(suggestions);
  const mode = extractMode(suggestions);
  if (rules.length === 0 && directories.length === 0 && !mode) {
    const t3 = <Text dimColor={true}>Suggestion </Text>;

    const t4 = <Box justifyContent="flex-end" minWidth={width}>{t3}</Box>;

    const t5 = <Text>None</Text>;

    const t6 = <Box flexDirection="row">{t4}{t5}</Box>;

    return t6;
  }
  const t3 = <Text dimColor={true}>Suggestions </Text>;

  const t4 = <Box justifyContent="flex-end" minWidth={width}>{t3}</Box>;

  const t5 = <Text> </Text>;

  const t6 = <Box flexDirection="row">{t4}{t5}</Box>;

  const t1 = <Box flexDirection="column">{t6}{rules.length > 0 && <Box flexDirection="row"><Box justifyContent="flex-end" minWidth={width}><Text dimColor={true}> Rules </Text></Box><Box flexDirection="column">{rules.map(_temp2)}</Box></Box>}{directories.length > 0 && <Box flexDirection="row"><Box justifyContent="flex-end" minWidth={width}><Text dimColor={true}> Directories </Text></Box><Box flexDirection="column">{directories.map(_temp3)}</Box></Box>}{mode && <Box flexDirection="row"><Box justifyContent="flex-end" minWidth={width}><Text dimColor={true}> Mode </Text></Box><Text>{permissionModeTitle(mode)}</Text></Box>}</Box>;
  return t1;
}
function _temp3(dir, index_0) {
  return <Text key={index_0}>{figures.bullet} {dir}</Text>;
}
function _temp2(rule, index) {
  return <Text key={index}>{figures.bullet} {permissionRuleValueToString(rule)}</Text>;
}
export function PermissionDecisionDebugInfo({
    permissionResult,
    toolName
}: Props) {
  const toolPermissionContext = useAppState(_temp4);
  const decisionReason = permissionResult.decisionReason;
  const suggestions = "suggestions" in permissionResult ? permissionResult.suggestions : undefined;
  const sandboxAutoAllowEnabled = SandboxManager.isSandboxingEnabled() && SandboxManager.isAutoAllowBashIfSandboxedEnabled();
  const all = detectUnreachableRules(toolPermissionContext, {
    sandboxAutoAllowEnabled
  });
  const suggestedRules = extractRules(suggestions);
  let unreachableRules: typeof all;
  if (suggestedRules.length > 0) {
    unreachableRules = all.filter(u => suggestedRules.some(suggested => suggested.toolName === u.rule.ruleValue.toolName && suggested.ruleContent === u.rule.ruleValue.ruleContent));
  } else if (toolName) {
    unreachableRules = all.filter(u_0 => u_0.rule.ruleValue.toolName === toolName);
  } else {
    unreachableRules = all;
  }
  const t2 = <Box justifyContent="flex-end" minWidth={10}><Text dimColor={true}>Behavior </Text></Box>;

  const t3 = <Box flexDirection="row">{t2}<Text>{permissionResult.behavior}</Text></Box>;

  const t4 = permissionResult.behavior !== "allow" && <Box flexDirection="row"><Box justifyContent="flex-end" minWidth={10}><Text dimColor={true}>Message </Text></Box><Text>{permissionResult.message}</Text></Box>;

  const t5 = <Box justifyContent="flex-end" minWidth={10}><Text dimColor={true}>Reason </Text></Box>;

  const t6 = <Box flexDirection="row">{t5}{decisionReason === undefined ? <Text>undefined</Text> : <PermissionDecisionInfoItem decisionReason={decisionReason} />}</Box>;

  const t7 = <SuggestionDisplay suggestions={suggestions} width={10} />;

  const t8 = unreachableRules.length > 0 && <Box flexDirection="column" marginTop={1}><Text color="warning">{figures.warning} Unreachable Rules ({unreachableRules.length})</Text>{unreachableRules.map(_temp5)}</Box>;

  const t9 = <Box flexDirection="column">{t3}{t4}{t6}{t7}{t8}</Box>;

  return t9;
}
function _temp5(u_1, i) {
  return <Box key={i} flexDirection="column" marginLeft={2}><Text color="warning">{permissionRuleValueToString(u_1.rule.ruleValue)}</Text><Text dimColor={true}>{"  "}{u_1.reason}</Text><Text dimColor={true}>{"  "}Fix: {u_1.fix}</Text></Box>;
}
function _temp4(s) {
  return s.toolPermissionContext;
}
