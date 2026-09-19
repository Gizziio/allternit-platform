import figures from 'figures';
import * as React from 'react';
import { Box, Text } from '../ink';
import type { ContextSuggestion } from '../utils/contextSuggestions';
import { formatTokens } from '../utils/format';
import { StatusIcon } from './design-system/StatusIcon';
type Props = {
  suggestions: ContextSuggestion[];
};
export function ContextSuggestions({
    suggestions
}: Props) {
  if (suggestions.length === 0) {
    return null;
  }
  const t1 = <Text bold={true}>Suggestions</Text>;

  const t2 = suggestions.map(_temp);

  const t3 = <Box flexDirection="column" marginTop={1}>{t1}{t2}</Box>;

  return t3;
}
function _temp(suggestion, i) {
  return <Box key={i} flexDirection="column" marginTop={i === 0 ? 0 : 1}><Box><StatusIcon status={suggestion.severity} withSpace={true} /><Text bold={true}>{suggestion.title}</Text>{suggestion.savingsTokens ? <Text dimColor={true}>{" "}{figures.arrowRight} save ~{formatTokens(suggestion.savingsTokens)}</Text> : null}</Box><Box marginLeft={2}><Text dimColor={true}>{suggestion.detail}</Text></Box></Box>;
}
