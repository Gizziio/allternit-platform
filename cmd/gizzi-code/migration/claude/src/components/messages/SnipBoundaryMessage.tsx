import React from 'react';
import { Box, Text } from '../../ink.js';

interface Props {
  message: {
    type: string;
    uuid?: string;
  };
}

export function SnipBoundaryMessage({ message }: Props): React.ReactElement {
  return (
    <Box>
      <Text dimColor>--- snip ---</Text>
    </Box>
  );
}
