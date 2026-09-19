import React, { useCallback, useMemo } from 'react';
import { logError } from './../../../utils/log.ts';
import { getOriginalCwd } from '../../../bootstrap/state';
import { Box, Text } from '../../../ink';
import { sanitizeToolNameForAnalytics } from '../../../services/analytics/metadata';
import { SKILL_TOOL_NAME } from '../../../tools/SkillTool/constants';
import { SkillTool } from '../../../tools/SkillTool/SkillTool';
import { env } from '../../../utils/env';
import { shouldShowAlwaysAllowOptions } from '../../../utils/permissions/permissionsLoader';
import { logUnaryEvent } from '../../../utils/unaryLogging';
import { type UnaryEvent, usePermissionRequestLogging } from '../hooks';
import { PermissionDialog } from '../PermissionDialog';
import { PermissionPrompt, type PermissionPromptOption, type ToolAnalyticsContext } from '../PermissionPrompt';
import type { PermissionRequestProps } from '../PermissionRequest';
import { PermissionRuleExplanation } from '../PermissionRuleExplanation';
type SkillOptionValue = 'yes' | 'yes-exact' | 'yes-prefix' | 'no';
export function SkillPermissionRequest(props) {
  const {
    toolUseConfirm,
    onDone,
    onReject,
    workerBadge
  } = props;
  const parseInput = _temp;
  const t0 = parseInput(toolUseConfirm.input);

  const skill = t0;
  const commandObj = toolUseConfirm.permissionResult.behavior === "ask" && toolUseConfirm.permissionResult.metadata && "command" in toolUseConfirm.permissionResult.metadata ? toolUseConfirm.permissionResult.metadata.command : undefined;
  const t1 = {
      completion_type: "tool_use_single",
      language_name: "none"
    } as UnaryEvent;

  const unaryEvent = t1;
  usePermissionRequestLogging(toolUseConfirm, unaryEvent);
  const t2 = getOriginalCwd();

  const originalCwd = t2;
  const t3 = shouldShowAlwaysAllowOptions();

  const showAlwaysAllowOptions = t3;
  const t4 = [{
      label: "Yes",
      value: "yes",
      feedbackConfig: {
        type: "accept"
      }
    }];

  const baseOptions = t4;
  const alwaysAllowOptions = [];
  if (showAlwaysAllowOptions) {
      const t5 = <Text bold={true}>{skill}</Text>;
      const t6 = <Text bold={true}>{originalCwd}</Text>;

      const t7 = {
          label: <Text>Yes, and don't ask again for {t5} in{" "}{t6}</Text>,
          value: "yes-exact"
        };

      alwaysAllowOptions.push(t7);
      const spaceIndex = skill.indexOf(" ");
      if (spaceIndex > 0) {
        const commandPrefix = skill.substring(0, spaceIndex);
        const t8 = commandPrefix + ":*";
        const t9 = <Text bold={true}>{t8}</Text>;

        const t10 = <Text bold={true}>{originalCwd}</Text>;

        const t11 = {
            label: <Text>Yes, and don't ask again for{" "}{t9} commands in{" "}{t10}</Text>,
            value: "yes-prefix"
          };

        alwaysAllowOptions.push(t11);
      }
    }

  const t5 = {
      label: "No",
      value: "no",
      feedbackConfig: {
        type: "reject"
      }
    };

  const noOption = t5;
  const t6 = [...baseOptions, ...alwaysAllowOptions, noOption];

  const options = t6;
  const t7 = sanitizeToolNameForAnalytics(toolUseConfirm.tool.name);

  const t8 = toolUseConfirm.tool.isMcp ?? false;
  const t9 = {
      toolName: t7,
      isMcp: t8
    };

  const toolAnalyticsContext = t9;
  const t10 = (value, feedback) => {
      bb33: switch (value) {
        case "yes":
          {
            logUnaryEvent({
              completion_type: "tool_use_single",
              event: "accept",
              metadata: {
                language_name: "none",
                message_id: toolUseConfirm.assistantMessage.message.id,
                platform: env.platform
              }
            });
            toolUseConfirm.onAllow(toolUseConfirm.input, [], feedback);
            onDone();
            break bb33;
          }
        case "yes-exact":
          {
            logUnaryEvent({
              completion_type: "tool_use_single",
              event: "accept",
              metadata: {
                language_name: "none",
                message_id: toolUseConfirm.assistantMessage.message.id,
                platform: env.platform
              }
            });
            toolUseConfirm.onAllow(toolUseConfirm.input, [{
              type: "addRules",
              rules: [{
                toolName: SKILL_TOOL_NAME,
                ruleContent: skill
              }],
              behavior: "allow",
              destination: "localSettings"
            }]);
            onDone();
            break bb33;
          }
        case "yes-prefix":
          {
            logUnaryEvent({
              completion_type: "tool_use_single",
              event: "accept",
              metadata: {
                language_name: "none",
                message_id: toolUseConfirm.assistantMessage.message.id,
                platform: env.platform
              }
            });
            const spaceIndex_0 = skill.indexOf(" ");
            const commandPrefix_0 = spaceIndex_0 > 0 ? skill.substring(0, spaceIndex_0) : skill;
            toolUseConfirm.onAllow(toolUseConfirm.input, [{
              type: "addRules",
              rules: [{
                toolName: SKILL_TOOL_NAME,
                ruleContent: `${commandPrefix_0}:*`
              }],
              behavior: "allow",
              destination: "localSettings"
            }]);
            onDone();
            break bb33;
          }
        case "no":
          {
            logUnaryEvent({
              completion_type: "tool_use_single",
              event: "reject",
              metadata: {
                language_name: "none",
                message_id: toolUseConfirm.assistantMessage.message.id,
                platform: env.platform
              }
            });
            toolUseConfirm.onReject(feedback);
            onReject();
            onDone();
          }
      }
    };

  const handleSelect = t10;
  const t11 = () => {
      logUnaryEvent({
        completion_type: "tool_use_single",
        event: "reject",
        metadata: {
          language_name: "none",
          message_id: toolUseConfirm.assistantMessage.message.id,
          platform: env.platform
        }
      });
      toolUseConfirm.onReject();
      onReject();
      onDone();
    };

  const handleCancel = t11;
  const t12 = `Use skill "${skill}"?`;
  const t13 = <Text>Gizzi may use instructions, code, or files from this Skill.</Text>;

  const t14 = commandObj?.description;
  const t15 = <Box flexDirection="column" paddingX={2} paddingY={1}><Text dimColor={true}>{t14}</Text></Box>;

  const t16 = <PermissionRuleExplanation permissionResult={toolUseConfirm.permissionResult} toolType="tool" />;

  const t17 = <PermissionPrompt options={options} onSelect={handleSelect} onCancel={handleCancel} toolAnalyticsContext={toolAnalyticsContext} />;

  const t18 = <Box flexDirection="column">{t16}{t17}</Box>;

  const t19 = <PermissionDialog title={t12} workerBadge={workerBadge}>{t13}{t15}{t18}</PermissionDialog>;

  return t19;
}
function _temp(input) {
  const result = SkillTool.inputSchema.safeParse(input);
  if (!result.success) {
    logError(new Error(`Failed to parse skill tool input: ${result.error.message}`));
    return "";
  }
  return result.data.skill;
}
