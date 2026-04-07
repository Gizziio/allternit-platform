import React, { useState, useEffect } from 'react';
import { Box, Text } from '../ink';

interface BootScreenProps {
  harnessEnabled: boolean;
  harnessMode?: string;
  onComplete: () => void;
}
export const BootScreen: React.FC<BootScreenProps> = ({
  harnessEnabled,
  harnessMode,
  onComplete,
}) => {
  const [frame, setFrame] = useState(0);
  const spinners = ['◐', '◓', '◑', '◒'];
  const spinner = spinners[frame % spinners.length];
  useEffect(() => {
    const interval = setInterval(() => {
      setFrame(f => f + 1);
    }, 100);
    const timer = setTimeout(() => {
      clearInterval(interval);
      onComplete();
    }, 1500);
    return () => {
      clearTimeout(timer);
    };
  }, [onComplete]);
  return (
    <Box flexDirection="column" alignItems="center" justifyContent="center" flexGrow={1}>
      {/* Simple, clean Gizzi logo - box drawing style */}
      <Box flexDirection="column" alignItems="center" paddingBottom={1}>
        <Text color="#d4b08c" bold>
          ┌─────────────────────────┐
        </Text>
        <Text color="#d4b08c" bold>
          │                         │
        </Text>
        <Text color="#d4b08c" bold>
          │    ⏺    G I Z Z I    ⏺   │
        </Text>
        <Text color="#d4b08c" bold>
          └─────────────────────────┘
        </Text>
      </Box>
      {/* Status line with spinner */}
      <Box marginTop={1}>
        <Text color="#d4b08c">{spinner}</Text>
        <Text color="gray"> Starting Gizzi Code</Text>
        {harnessEnabled && (
          <Text color="gray"> with Allternit Harness</Text>
        )}
      {harnessEnabled && harnessMode && (
        <Box marginTop={1}>
          <Text color="#8b949e" dimColor>Mode: {harnessMode}</Text>
        </Box>
      )}
      </Box>
    </Box>
  );
};
