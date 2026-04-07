import React, { useState } from 'react';
import { Box, Text, useInput } from '../ink';
import type { DiscretionAction, VMStatus } from '../../types';

interface DiscretionScreenProps {
  workspace: string;
  harnessEnabled: boolean;
  harnessMode?: string;
  vmEnabled: boolean;
  vmStatus: VMStatus;
  onAction: (action: DiscretionAction) => void;
}
const actions: { id: DiscretionAction; label: string; desc: string; cmd: string }[] = [
  { id: 'resume', label: 'Resume Session', desc: 'Continue your last active conversation', cmd: '/resume' },
  { id: 'code', label: 'Code Mode', desc: 'Enter optimized environment for engineering', cmd: 'code' },
  { id: 'cowork', label: 'Cowork Mode', desc: 'Multi-agent collaborative workspace', cmd: 'cowork' },
  { id: 'new', label: 'New Session', desc: 'Start a fresh interaction', cmd: '/new' },
];
export const DiscretionScreen: React.FC<DiscretionScreenProps> = ({
  workspace,
  harnessEnabled,
  harnessMode,
  vmEnabled,
  vmStatus,
  onAction,
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  useInput((_, key) => {
    if (key.upArrow) {
      setSelectedIndex(i => (i > 0 ? i - 1 : actions.length - 1));
    } else if (key.downArrow) {
      setSelectedIndex(i => (i < actions.length - 1 ? i + 1 : 0));
    } else if (key.return) {
      onAction(actions[selectedIndex].id);
    }
  });
  return (
    <Box flexDirection="column" alignItems="center" padding={1}>
      {/* Status badges */}
      <Box flexDirection="column" alignItems="flex-end" marginBottom={1}>
        {harnessEnabled && (
          <Box>
            <Text backgroundColor="#d4b08c" color="black" bold>
              {' '}HARNESS{' '}
            </Text>
            <Text color="green"> ● {harnessMode?.toUpperCase() || 'BYOK'}</Text>
          </Box>
        )}
        {vmEnabled && (
          <Box>
            <Text backgroundColor="#3fb950" color="black" bold>
              {' '}VM{' '}
            </Text>
            <Text color={vmStatus === 'ready' ? 'green' : vmStatus === 'error' ? 'red' : 'yellow'}>
              {' '}● {vmStatus.toUpperCase()}
            </Text>
          </Box>
        )}
      </Box>
      {/* Mascot */}
      <Box marginBottom={1}>
        <Text>🦀</Text>
      </Box>
      <Text bold color="#d4b08c">Welcome to Gizzi Code</Text>
      {/* Access Box */}
      <Box
        borderStyle="single"
        borderColor="#d4b08c"
        paddingX={4}
        paddingY={2}
        flexDirection="column"
        alignItems="center"
        width={70}
        marginY={1}
      >
        <Text bold color="#d4b08c">WORKSPACE ACCESS GRANTED</Text>
        <Box marginY={1} flexDirection="column" alignItems="center">
          <Text dimColor>Project Root:</Text>
          <Text>{workspace}</Text>
        </Box>
        <Box marginY={1}>
          <Text dimColor wrap="wrap">
            Gizzi Code now has access to this directory. It can read, modify, and create
            files to assist with your engineering tasks.
          </Text>
        </Box>
        {/* VM Notice */}
        {vmEnabled && vmStatus === 'ready' && (
          <Box
            borderStyle="single"
            borderColor="#3fb950"
            paddingX={2}
            paddingY={1}
            marginY={1}
            flexDirection="column"
          >
            <Text color="#3fb950" bold>VM ISOLATION ACTIVE</Text>
            <Text dimColor>Ubuntu 24.04 microVM mounted</Text>
            <Text dimColor>All bash commands run inside VM</Text>
          </Box>
        )}
        {vmEnabled && vmStatus === 'provisioning' && (
          <Box borderStyle="single" borderColor="#c9a000" paddingX={2} paddingY={1} marginY={1}>
            <Text color="#c9a000">◐ Provisioning VM...</Text>
          </Box>
        )}
        <Box borderStyle="single" borderColor="#c8a050" paddingX={2} paddingY={1} marginY={1}>
          <Text color="#c8a050" italic>
            ⚠ Always review destructive actions before confirming.
          </Text>
        </Box>
        {/* Action List */}
        <Box flexDirection="column" marginTop={1}>
          {actions.map((action, i) => (
            <Box key={action.id}>
              <Text color={i === selectedIndex ? '#d4b08c' : 'gray'}>
                {i === selectedIndex ? '●' : '○'}{' '}
              </Text>
              <Text bold={i === selectedIndex} color={i === selectedIndex ? 'white' : 'gray'}>
                {action.label}
              </Text>
              <Box flexGrow={1} />
              <Text dimColor>{action.cmd}</Text>
            </Box>
          ))}
        </Box>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>↑↓ Navigate • Enter Select</Text>
      </Box>
    </Box>
  );
};
