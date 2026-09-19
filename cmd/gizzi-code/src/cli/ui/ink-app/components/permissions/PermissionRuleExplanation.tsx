import { feature } from 'bun:bundle';
import chalk from '@/shared/util/chalk'
import React from 'react';
import { Ansi, Box, Text } from '../../ink';
import { useAppState } from '../../state/AppState';
import type { PermissionDecision, PermissionDecisionReason } from '../../utils/permissions/PermissionResult';
import { permissionRuleValueToString } from '../../utils/permissions/permissionRuleParser';
import type { Theme } from '../../utils/theme';
import ThemedText from '../design-system/ThemedText';
export type PermissionRuleExplanationProps = {
  permissionResult: PermissionDecision;
  toolType: 'tool' | 'command' | 'edit' | 'read';
};
type DecisionReasonStrings = {
  reasonString: string;
  configString?: string;
  /** When set, reasonString is plain text rendered with this theme color instead of <Ansi>. */
  themeColor?: keyof Theme;
};
function stringsForDecisionReason(reason: PermissionDecisionReason | undefined, toolType: 'tool' | 'command' | 'edit' | 'read'): DecisionReasonStrings | null {
  if (!reason) {
    return null;
  }
  if ((feature('BASH_CLASSIFIER') || feature('TRANSCRIPT_CLASSIFIER')) && reason.type === 'classifier') {
    if (reason.classifier === 'auto-mode') {
      return {
        reasonString: `Auto mode classifier requires confirmation for this ${toolType}.\n${reason.reason}`,
        configString: undefined,
        themeColor: 'error'
      };
    }
    return {
      reasonString: `Classifier ${chalk.bold(reason.classifier)} requires confirmation for this ${toolType}.\n${reason.reason}`,
      configString: undefined
    };
  }
  switch (reason.type) {
    case 'rule':
      return {
        reasonString: `Permission rule ${chalk.bold(permissionRuleValueToString(reason.rule.ruleValue))} requires confirmation for this ${toolType}.`,
        configString: reason.rule.source === 'policySettings' ? undefined : '/permissions to update rules'
      };
    case 'hook':
      {
        const hookReasonString = reason.reason ? `:\n${reason.reason}` : '.';
        const sourceLabel = reason.hookSource ? ` ${chalk.dim(`[${reason.hookSource}]`)}` : '';
        return {
          reasonString: `Hook ${chalk.bold(reason.hookName)} requires confirmation for this ${toolType}${hookReasonString}${sourceLabel}`,
          configString: '/hooks to update'
        };
      }
    case 'safetyCheck':
    case 'other':
      return {
        reasonString: reason.reason,
        configString: undefined
      };
    case 'workingDir':
      return {
        reasonString: reason.reason,
        configString: '/permissions to update rules'
      };
    default:
      return null;
  }
}
export function PermissionRuleExplanation({
    permissionResult,
    toolType
}: PermissionRuleExplanationProps) {
  const permissionMode = useAppState(_temp);
  const t1 = permissionResult?.decisionReason;
  const t2 = stringsForDecisionReason(t1, toolType);

  const strings = t2;
  if (!strings) {
    return null;
  }
  const themeColor = strings.themeColor ?? (permissionResult?.decisionReason?.type === "hook" && permissionMode === "auto" ? "warning" : undefined);
  const t3 = themeColor ? <ThemedText color={themeColor}>{strings.reasonString}</ThemedText> : <Text><Ansi>{strings.reasonString}</Ansi></Text>;

  const t4 = strings.configString && <Text dimColor={true}>{strings.configString}</Text>;

  const t5 = <Box marginBottom={1} flexDirection="column">{t3}{t4}</Box>;

  return t5;
}
function _temp(s) {
  return s.toolPermissionContext.mode;
}
