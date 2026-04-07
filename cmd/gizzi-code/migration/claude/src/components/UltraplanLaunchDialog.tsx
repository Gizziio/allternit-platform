import { Box, Text } from '../ink.js';
import * as React from 'react';

interface UltraplanLaunchDialogProps {
  onChoice: (choice: string, opts?: { disconnectedBridge?: boolean }) => void;
}

export function UltraplanLaunchDialog(_props: UltraplanLaunchDialogProps): React.ReactElement | null {
  return (
    <Box>
      <Text>Ultraplan Launch Dialog</Text>
    </Box>
  );
}
