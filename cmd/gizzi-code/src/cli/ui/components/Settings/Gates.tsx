import { Box, Text } from '@/ink.js';

interface GatesProps {
  onOwnsEscChange?: (ownsEsc: boolean) => void;
  contentHeight?: number;
}

export function Gates({ onOwnsEscChange, contentHeight }: GatesProps): React.ReactElement {
  return (
    <Box flexDirection="column">
      <Text>Gates Settings</Text>
      <Text dimColor>Feature flags and gates configuration</Text>
    </Box>
  );
}
