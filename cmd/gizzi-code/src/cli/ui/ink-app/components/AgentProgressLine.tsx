import * as React from 'react';
import { Box, Text } from '../ink';
import { formatNumber } from '../utils/format';
import type { Theme } from '../utils/theme';
type Props = {
  agentType: string;
  description?: string;
  name?: string;
  descriptionColor?: keyof Theme;
  taskDescription?: string;
  toolUseCount: number;
  tokens: number | null;
  color?: keyof Theme;
  isLast: boolean;
  isResolved: boolean;
  isError: boolean;
  isAsync?: boolean;
  shouldAnimate: boolean;
  lastToolInfo?: string | null;
  hideType?: boolean;
};
export function AgentProgressLine({
    agentType,
    description,
    name,
    descriptionColor,
    taskDescription,
    toolUseCount,
    tokens,
    color,
    isLast,
    isResolved,
    isAsync: t1,
    lastToolInfo,
    hideType: t2
}: Props) {
  const isAsync = t1 === undefined ? false : t1;
  const hideType = t2 === undefined ? false : t2;
  const treeChar = isLast ? "\u2514\u2500" : "\u251C\u2500";
  const isBackgrounded = isAsync && isResolved;
  const t3 = () => {
      if (!isResolved) {
        return lastToolInfo || "Initializing\u2026";
      }
      if (isBackgrounded) {
        return taskDescription ?? "Running in the background";
      }
      return "Done";
    };

  const getStatusText = t3;
  const t4 = <Text dimColor={true}>{treeChar} </Text>;

  const t5 = !isResolved;
  const t6 = hideType ? <><Text bold={true}>{name ?? description ?? agentType}</Text>{name && description && <Text dimColor={true}>: {description}</Text>}</> : <><Text bold={true} backgroundColor={color} color={color ? "inverseText" : undefined}>{agentType}</Text>{description && <>{" ("}<Text backgroundColor={descriptionColor} color={descriptionColor ? "inverseText" : undefined}>{description}</Text>{")"}</>}</>;

  const t7 = !isBackgrounded && <>{" \xB7 "}{toolUseCount} tool {toolUseCount === 1 ? "use" : "uses"}{tokens !== null && <> · {formatNumber(tokens)} tokens</>}</>;

  const t8 = <Text dimColor={t5}>{t6}{t7}</Text>;

  const t9 = <Box paddingLeft={3}>{t4}{t8}</Box>;

  const t10 = !isBackgrounded && <Box paddingLeft={3} flexDirection="row"><Text dimColor={true}>{isLast ? "   \u23BF  " : "\u2502  \u23BF  "}</Text><Text dimColor={true}>{getStatusText()}</Text></Box>;

  const t11 = <Box flexDirection="column">{t9}{t10}</Box>;

  return t11;
}
