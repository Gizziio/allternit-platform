import figures from 'figures';
import * as React from 'react';
import { Box, color, Text, useTheme } from '../../ink';
import { plural } from '../../utils/stringUtils';
import type { UnifiedInstalledItem } from './unifiedTypes';
type Props = {
  item: UnifiedInstalledItem;
  isSelected: boolean;
};
export function UnifiedInstalledCell({
    item,
    isSelected
}: Props) {
  const [theme] = useTheme();
  if (item.type === "plugin") {
    let statusIcon;
    let statusText;
    if (item.pendingToggle) {
      const t1 = color("suggestion", theme)(figures.arrowRight);

      statusIcon = t1;
      statusText = item.pendingToggle === "will-enable" ? "will enable" : "will disable";
    } else {
      if (item.errorCount > 0) {
        const t1 = color("error", theme)(figures.cross);

        statusIcon = t1;
        const t2 = item.errorCount;
        const t3 = plural(item.errorCount, "error");

        statusText = `${t2} ${t3}`;
      } else {
        if (!item.isEnabled) {
          const t1 = color("inactive", theme)(figures.radioOff);

          statusIcon = t1;
          statusText = "disabled";
        } else {
          const t1 = color("success", theme)(figures.tick);

          statusIcon = t1;
          statusText = "enabled";
        }
      }
    }
    const t1 = isSelected ? "suggestion" : undefined;
    const t2 = isSelected ? `${figures.pointer} ` : "  ";
    const t3 = <Text color={t1}>{t2}</Text>;

    const t4 = isSelected ? "suggestion" : undefined;
    const t5 = <Text color={t4}>{item.name}</Text>;

    const t6 = !isSelected;
    const t7 = <Text backgroundColor="userMessageBackground">Plugin</Text>;

    const t8 = <Text dimColor={t6}>{" "}{t7}</Text>;

    const t9 = <Text dimColor={true}> · {item.marketplace}</Text>;

    const t10 = !isSelected;
    const t11 = <Text dimColor={t10}> · {statusIcon} </Text>;

    const t12 = !isSelected;
    const t13 = <Text dimColor={t12}>{statusText}</Text>;

    const t14 = <Box>{t3}{t5}{t8}{t9}{t11}{t13}</Box>;

    return t14;
  }
  if (item.type === "flagged-plugin") {
    const t1 = color("warning", theme)(figures.warning);

    const statusIcon_0 = t1;
    const t2 = isSelected ? "suggestion" : undefined;
    const t3 = isSelected ? `${figures.pointer} ` : "  ";
    const t4 = <Text color={t2}>{t3}</Text>;

    const t5 = isSelected ? "suggestion" : undefined;
    const t6 = <Text color={t5}>{item.name}</Text>;

    const t7 = !isSelected;
    const t8 = <Text backgroundColor="userMessageBackground">Plugin</Text>;

    const t9 = <Text dimColor={t7}>{" "}{t8}</Text>;

    const t10 = <Text dimColor={true}> · {item.marketplace}</Text>;

    const t11 = !isSelected;
    const t12 = <Text dimColor={t11}> · {statusIcon_0} </Text>;

    const t13 = !isSelected;
    const t14 = <Text dimColor={t13}>removed</Text>;

    const t15 = <Box>{t4}{t6}{t9}{t10}{t12}{t14}</Box>;

    return t15;
  }
  if (item.type === "failed-plugin") {
    const t1 = color("error", theme)(figures.cross);

    const statusIcon_1 = t1;
    const t2 = item.errorCount;
    const t3 = plural(item.errorCount, "error");

    const statusText_0 = `failed to load · ${t2} ${t3}`;
    const t4 = isSelected ? "suggestion" : undefined;
    const t5 = isSelected ? `${figures.pointer} ` : "  ";
    const t6 = <Text color={t4}>{t5}</Text>;

    const t7 = isSelected ? "suggestion" : undefined;
    const t8 = <Text color={t7}>{item.name}</Text>;

    const t9 = !isSelected;
    const t10 = <Text backgroundColor="userMessageBackground">Plugin</Text>;

    const t11 = <Text dimColor={t9}>{" "}{t10}</Text>;

    const t12 = <Text dimColor={true}> · {item.marketplace}</Text>;

    const t13 = !isSelected;
    const t14 = <Text dimColor={t13}> · {statusIcon_1} </Text>;

    const t15 = !isSelected;
    const t16 = <Text dimColor={t15}>{statusText_0}</Text>;

    const t17 = <Box>{t6}{t8}{t11}{t12}{t14}{t16}</Box>;

    return t17;
  }
  let statusIcon_2;
  let statusText_1;
  if (item.status === "connected") {
    const t1 = color("success", theme)(figures.tick);

    statusIcon_2 = t1;
    statusText_1 = "connected";
  } else {
    if (item.status === "disabled") {
      const t1 = color("inactive", theme)(figures.radioOff);

      statusIcon_2 = t1;
      statusText_1 = "disabled";
    } else {
      if (item.status === "pending") {
        const t1 = color("inactive", theme)(figures.radioOff);

        statusIcon_2 = t1;
        statusText_1 = "connecting\u2026";
      } else {
        if (item.status === "needs-auth") {
          // @ts-expect-error TODO(types) vendored figures@3 lacks upstream 'triangleUpOutline'
          const t1 = color("warning", theme)(figures.triangleUpOutline);

          statusIcon_2 = t1;
          statusText_1 = "Enter to auth";
        } else {
          const t1 = color("error", theme)(figures.cross);

          statusIcon_2 = t1;
          statusText_1 = "failed";
        }
      }
    }
  }
  if (item.indented) {
    const t1 = isSelected ? "suggestion" : undefined;
    const t2 = isSelected ? `${figures.pointer} ` : "  ";
    const t3 = <Text color={t1}>{t2}</Text>;

    const t4 = !isSelected;
    const t5 = <Text dimColor={t4}>└ </Text>;

    const t6 = isSelected ? "suggestion" : undefined;
    const t7 = <Text color={t6}>{item.name}</Text>;

    const t8 = !isSelected;
    const t9 = <Text backgroundColor="userMessageBackground">MCP</Text>;

    const t10 = <Text dimColor={t8}>{" "}{t9}</Text>;

    const t11 = !isSelected;
    const t12 = <Text dimColor={t11}> · {statusIcon_2} </Text>;

    const t13 = !isSelected;
    const t14 = <Text dimColor={t13}>{statusText_1}</Text>;

    const t15 = <Box>{t3}{t5}{t7}{t10}{t12}{t14}</Box>;

    return t15;
  }
  const t1 = isSelected ? "suggestion" : undefined;
  const t2 = isSelected ? `${figures.pointer} ` : "  ";
  const t3 = <Text color={t1}>{t2}</Text>;

  const t4 = isSelected ? "suggestion" : undefined;
  const t5 = <Text color={t4}>{item.name}</Text>;

  const t6 = !isSelected;
  const t7 = <Text backgroundColor="userMessageBackground">MCP</Text>;

  const t8 = <Text dimColor={t6}>{" "}{t7}</Text>;

  const t9 = !isSelected;
  const t10 = <Text dimColor={t9}> · {statusIcon_2} </Text>;

  const t11 = !isSelected;
  const t12 = <Text dimColor={t11}>{statusText_1}</Text>;

  const t13 = <Box>{t3}{t5}{t8}{t10}{t12}</Box>;

  return t13;
}
