import React, { useMemo } from 'react';
import { Box, Text, useTheme } from '../../../ink';
import { WebFetchTool } from '../../../tools/WebFetchTool/WebFetchTool';
import { shouldShowAlwaysAllowOptions } from '../../../utils/permissions/permissionsLoader';
import { type OptionWithDescription, Select } from '../../CustomSelect/select';
import { type UnaryEvent, usePermissionRequestLogging } from '../hooks';
import { PermissionDialog } from '../PermissionDialog';
import type { PermissionRequestProps } from '../PermissionRequest';
import { PermissionRuleExplanation } from '../PermissionRuleExplanation';
import { logUnaryPermissionEvent } from '../utils';
function inputToPermissionRuleContent(input: {
  [k: string]: unknown;
}): string {
  try {
    const parsedInput = WebFetchTool.inputSchema.safeParse(input);
    if (!parsedInput.success) {
      return `input:${input.toString()}`;
    }
    const {
      url
    } = parsedInput.data;
    const hostname = new URL(url).hostname;
    return `domain:${hostname}`;
  } catch {
    return `input:${input.toString()}`;
  }
}
export function WebFetchPermissionRequest(t0) {
  const {
    toolUseConfirm,
    onDone,
    onReject,
    verbose,
    workerBadge
  } = t0;
  const [theme] = useTheme();
  const {
    url
  } = toolUseConfirm.input as {
    url: string;
  };
  const t1 = new URL(url);

  const hostname = t1.hostname;
  const t2 = {
      completion_type: "tool_use_single",
      language_name: "none"
    } as UnaryEvent;

  const unaryEvent = t2;
  usePermissionRequestLogging(toolUseConfirm, unaryEvent);
  const t3 = shouldShowAlwaysAllowOptions();

  const showAlwaysAllowOptions = t3;
  const t4 = {
      label: "Yes",
      value: "yes"
    };

  const result: OptionWithDescription[] = [t4];
  if (showAlwaysAllowOptions) {
      const t5 = <Text bold={true}>{hostname}</Text>;
      const t6 = {
          label: <Text>Yes, and don't ask again for {t5}</Text>,
          value: "yes-dont-ask-again-domain"
        };

      result.push(t6);
    }
  const t5 = {
        label: <Text>No, and tell Gizzi what to do differently <Text bold={true}>(esc)</Text></Text>,
        value: "no"
      };

  result.push(t5);

  const options = result;
  const t5_2 = function onChange(newValue) {
      bb8: switch (newValue) {
        case "yes":
          {
            logUnaryPermissionEvent("tool_use_single", toolUseConfirm, "accept");
            toolUseConfirm.onAllow(toolUseConfirm.input, []);
            onDone();
            break bb8;
          }
        case "yes-dont-ask-again-domain":
          {
            logUnaryPermissionEvent("tool_use_single", toolUseConfirm, "accept");
            const ruleContent = inputToPermissionRuleContent(toolUseConfirm.input);
            const ruleValue = {
              toolName: toolUseConfirm.tool.name,
              ruleContent
            };
            toolUseConfirm.onAllow(toolUseConfirm.input, [{
              type: "addRules",
              rules: [ruleValue],
              behavior: "allow",
              destination: "localSettings"
            }]);
            onDone();
            break bb8;
          }
        case "no":
          {
            logUnaryPermissionEvent("tool_use_single", toolUseConfirm, "reject");
            toolUseConfirm.onReject();
            onReject();
            onDone();
          }
      }
    };

  const onChange = t5_2;
  const t6 = WebFetchTool.renderToolUseMessage(toolUseConfirm.input as {
      url: string;
      prompt: string;
    }, {
      theme,
      verbose
    });

  const t7 = <Text>{t6}</Text>;

  const t8 = <Text dimColor={true}>{toolUseConfirm.description}</Text>;

  const t9 = <Box flexDirection="column" paddingX={2} paddingY={1}>{t7}{t8}</Box>;

  const t10 = <PermissionRuleExplanation permissionResult={toolUseConfirm.permissionResult} toolType="tool" />;

  const t11 = <Text>Do you want to allow Gizzi to fetch this content?</Text>;

  const t12 = () => onChange("no");

  const t13 = <Select options={options} onChange={onChange} onCancel={t12} />;

  const t14 = <Box flexDirection="column">{t10}{t11}{t13}</Box>;

  const t15 = <PermissionDialog title="Fetch" workerBadge={workerBadge}>{t9}{t14}</PermissionDialog>;

  return t15;
}
