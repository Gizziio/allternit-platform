import React, { useCallback, useMemo } from 'react';
import { getOriginalCwd } from '../../bootstrap/state';
import { Box, Text, useTheme } from '../../ink';
import { sanitizeToolNameForAnalytics } from '../../services/analytics/metadata';
import { env } from '../../utils/env';
import { shouldShowAlwaysAllowOptions } from '../../utils/permissions/permissionsLoader';
import { truncateToLines } from '../../utils/stringUtils';
import { logUnaryEvent } from '../../utils/unaryLogging';
import { type UnaryEvent, usePermissionRequestLogging } from './hooks';
import { PermissionDialog } from './PermissionDialog';
import { PermissionPrompt, type PermissionPromptOption, type ToolAnalyticsContext } from './PermissionPrompt';
import type { PermissionRequestProps } from './PermissionRequest';
import { PermissionRuleExplanation } from './PermissionRuleExplanation';
type FallbackOptionValue = 'yes' | 'yes-dont-ask-again' | 'no';
export function FallbackPermissionRequest(t0) {
  const {
    toolUseConfirm,
    onDone,
    onReject,
    workerBadge
  } = t0;
  const [theme] = useTheme();
  const originalUserFacingName = toolUseConfirm.tool.userFacingName(toolUseConfirm.input as never);
  const t1 = originalUserFacingName.endsWith(" (MCP)") ? originalUserFacingName.slice(0, -6) : originalUserFacingName;

  const userFacingName = t1;
  const t2: UnaryEvent = {
      completion_type: "tool_use_single",
      language_name: "none"
    };

  const unaryEvent = t2;
  usePermissionRequestLogging(toolUseConfirm, unaryEvent);
  const t3 = (value, feedback) => {
      bb8: switch (value) {
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
            break bb8;
          }
        case "yes-dont-ask-again":
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
                toolName: toolUseConfirm.tool.name
              }],
              behavior: "allow",
              destination: "localSettings"
            }]);
            onDone();
            break bb8;
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

  const handleSelect = t3;
  const t4 = () => {
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

  const handleCancel = t4;
  const t5 = getOriginalCwd();

  const originalCwd = t5;
  const t6 = shouldShowAlwaysAllowOptions();

  const showAlwaysAllowOptions = t6;
  const t7: PermissionPromptOption<FallbackOptionValue> = {
      label: "Yes",
      value: "yes",
      feedbackConfig: {
        type: "accept"
      }
    };

  const result: PermissionPromptOption<FallbackOptionValue>[] = [t7];
  if (showAlwaysAllowOptions) {
      const t8 = <Text bold={true}>{userFacingName}</Text>;
      const t9 = <Text bold={true}>{originalCwd}</Text>;

      const t10: PermissionPromptOption<FallbackOptionValue> = {
          label: <Text>Yes, and don't ask again for {t8}{" "}commands in {t9}</Text>,
          value: "yes-dont-ask-again"
        };

      result.push(t10);
    }
  const t8: PermissionPromptOption<FallbackOptionValue> = {
        label: "No",
        value: "no",
        feedbackConfig: {
          type: "reject"
        }
      };

  result.push(t8);

  const options = result;
  const t8_2 = sanitizeToolNameForAnalytics(toolUseConfirm.tool.name);

  const t9 = toolUseConfirm.tool.isMcp ?? false;
  const t10 = {
      toolName: t8_2,
      isMcp: t9
    };

  const toolAnalyticsContext = t10;
  const t11 = toolUseConfirm.tool.renderToolUseMessage(toolUseConfirm.input as never, {
      theme,
      verbose: true
    });

  const t12 = originalUserFacingName.endsWith(" (MCP)") ? <Text dimColor={true}> (MCP)</Text> : "";

  const t13 = <Text>{userFacingName}({t11}){t12}</Text>;

  const t14 = truncateToLines(toolUseConfirm.description, 3);

  const t15 = <Text dimColor={true}>{t14}</Text>;

  const t16 = <Box flexDirection="column" paddingX={2} paddingY={1}>{t13}{t15}</Box>;

  const t17 = <PermissionRuleExplanation permissionResult={toolUseConfirm.permissionResult} toolType="tool" />;

  const t18 = <PermissionPrompt options={options} onSelect={handleSelect} onCancel={handleCancel} toolAnalyticsContext={toolAnalyticsContext} />;

  const t19 = <Box flexDirection="column">{t17}{t18}</Box>;

  const t20 = <PermissionDialog title="Tool use" workerBadge={workerBadge}>{t16}{t19}</PermissionDialog>;

  return t20;
}
