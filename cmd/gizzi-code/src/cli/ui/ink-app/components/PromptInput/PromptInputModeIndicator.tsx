import figures from 'figures';
import * as React from 'react';
import { Box, Text } from './../../ink.ts';
import { AGENT_COLOR_TO_THEME_COLOR, AGENT_COLORS, type AgentColorName } from './../../tools/AgentTool/agentColorManager.ts';
import type { PromptInputMode } from './../../types/textInputTypes.ts';
import { getTeammateColor } from './../../utils/teammate.ts';
import type { Theme } from './../../utils/theme.ts';
import { isAgentSwarmsEnabled } from '../../utils/agentSwarmsEnabled';
type Props = {
  mode: PromptInputMode;
  isLoading: boolean;
  viewingAgentName?: string;
  viewingAgentColor?: AgentColorName;
};

/**
 * Gets the theme color key for the teammate's assigned color.
 * Returns undefined if not a teammate or if the color is invalid.
 */
function getTeammateThemeColor(): keyof Theme | undefined {
  if (!isAgentSwarmsEnabled()) {
    return undefined;
  }
  const colorName = getTeammateColor();
  if (!colorName) {
    return undefined;
  }
  if (AGENT_COLORS.includes(colorName as AgentColorName)) {
    return AGENT_COLOR_TO_THEME_COLOR[colorName as AgentColorName];
  }
  return undefined;
}
type PromptCharProps = {
  isLoading: boolean;
  // Dead code elimination: parameter named themeColor to avoid "teammate" string in external builds
  themeColor?: keyof Theme;
};

/**
 * Renders the prompt character (❯).
 * Teammate color overrides the default color when set.
 */
function PromptChar({
    isLoading,
    themeColor
}: PromptCharProps) {
  const teammateColor = themeColor;
  const color = teammateColor ?? (false ? "subtle" : undefined);
  const t1 = <Text color={color} dimColor={isLoading}>{figures.pointer} </Text>;

  return t1;
}
export function PromptInputModeIndicator({
    mode,
    isLoading,
    viewingAgentName,
    viewingAgentColor
}: Props) {
  const t1 = getTeammateThemeColor();

  const teammateColor = t1;
  const viewedTeammateThemeColor = viewingAgentColor ? AGENT_COLOR_TO_THEME_COLOR[viewingAgentColor] : undefined;
  const t2 = <Box alignItems="flex-start" alignSelf="flex-start" flexWrap="nowrap" justifyContent="flex-start">{viewingAgentName ? <PromptChar isLoading={isLoading} themeColor={viewedTeammateThemeColor} /> : mode === "bash" ? <Text color="bashBorder" dimColor={isLoading}>! </Text> : <PromptChar isLoading={isLoading} themeColor={isAgentSwarmsEnabled() ? teammateColor : undefined} />}</Box>;

  return t2;
}
