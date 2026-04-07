import { Box, Text } from '../ink.js';

interface TungstenPillProps {
  selected?: boolean;
}

export function TungstenPill({ selected }: TungstenPillProps): React.ReactElement {
  return (
    <Box>
      <Text color={selected ? 'active' : 'inactive'}>tmux</Text>
    </Box>
  );
}
