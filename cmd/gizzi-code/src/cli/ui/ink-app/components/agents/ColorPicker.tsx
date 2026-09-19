import figures from 'figures';
import React, { useState } from 'react';
import type { KeyboardEvent } from '../../ink/events/keyboard-event';
import { Box, Text } from '../../ink';
import { AGENT_COLOR_TO_THEME_COLOR, AGENT_COLORS, type AgentColorName } from '../../tools/AgentTool/agentColorManager';
import { capitalize } from '../../utils/stringUtils';
type ColorOption = AgentColorName | 'automatic';
const COLOR_OPTIONS: ColorOption[] = ['automatic', ...AGENT_COLORS];
type Props = {
  agentName: string;
  currentColor?: AgentColorName | 'automatic';
  onConfirm: (color: AgentColorName | undefined) => void;
};
export function ColorPicker({
    agentName,
    currentColor: t1,
    onConfirm
}: Props) {
  const currentColor = t1 === undefined ? "automatic" : t1;
  const t2 = COLOR_OPTIONS.findIndex(opt => opt === currentColor);

  const [selectedIndex, setSelectedIndex] = useState(Math.max(0, t2));
  const t3 = e => {
      if (e.key === "up") {
        e.preventDefault();
        setSelectedIndex(_temp);
      } else {
        if (e.key === "down") {
          e.preventDefault();
          setSelectedIndex(_temp2);
        } else {
          if (e.key === "return") {
            e.preventDefault();
            const selected = COLOR_OPTIONS[selectedIndex];
            onConfirm(selected === "automatic" ? undefined : selected);
          }
        }
      }
    };

  const handleKeyDown = t3;
  const selectedValue = COLOR_OPTIONS[selectedIndex];
  const t4 = COLOR_OPTIONS.map((option, index) => {
      const isSelected = index === selectedIndex;
      return <Box key={option} flexDirection="row" gap={1}><Text color={isSelected ? "suggestion" : undefined}>{isSelected ? figures.pointer : " "}</Text>{option === "automatic" ? <Text bold={isSelected}>Automatic color</Text> : <Box gap={1}><Text backgroundColor={AGENT_COLOR_TO_THEME_COLOR[option]} color="inverseText">{" "}</Text><Text bold={isSelected}>{capitalize(option)}</Text></Box>}</Box>;
    });

  const t5 = <Box flexDirection="column">{t4}</Box>;

  const t6 = <Text>Preview: </Text>;

  const t7 = <Box marginTop={1}>{t6}{selectedValue === undefined || selectedValue === "automatic" ? <Text inverse={true} bold={true}>{" "}@{agentName}{" "}</Text> : <Text backgroundColor={AGENT_COLOR_TO_THEME_COLOR[selectedValue]} color="inverseText" bold={true}>{" "}@{agentName}{" "}</Text>}</Box>;

  const t8 = <Box flexDirection="column" gap={1} tabIndex={0} autoFocus={true} onKeyDown={handleKeyDown}>{t5}{t7}</Box>;

  return t8;
}
function _temp2(prev_0) {
  return prev_0 < COLOR_OPTIONS.length - 1 ? prev_0 + 1 : 0;
}
function _temp(prev) {
  return prev > 0 ? prev - 1 : COLOR_OPTIONS.length - 1;
}
