import { Box, Text } from '@/ink.js';
import * as React from 'react';

interface UltraplanChoiceDialogProps {
  plan: string;
  sessionId: string;
  taskId: string;
  setMessages: (messages: unknown[] | ((prev: unknown[]) => unknown[])) => void;
  readFileState: unknown;
  getAppState: () => unknown;
  setConversationId: (id: string | null) => void;
}

export function UltraplanChoiceDialog(_props: UltraplanChoiceDialogProps): React.ReactElement | null {
  return (
    <Box>
      <Text>Ultraplan Choice Dialog</Text>
    </Box>
  );
}
