import * as React from 'react';
const { useState, useEffect, useCallback } = React;
import { Box, Text, useInput } from 'ink';
import { runtimeRegistry } from '../runtime/runtime-registry';
import type { RegisteredRuntime } from '../runtime/runtime-registry';

const STATUS_COLORS: Record<string, string> = {
  online: 'green',
  busy: 'yellow',
  offline: 'gray',
};

interface Props {
  onBack?: () => void;
  refreshIntervalMs?: number;
}

export function RuntimeDashboard({ onBack, refreshIntervalMs = 5000 }: Props) {
  const [runtimes, setRuntimes] = useState<RegisteredRuntime[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setRuntimes(runtimeRegistry.list());
    const id = setInterval(() => {
      setTick((t) => t + 1);
      setRuntimes(runtimeRegistry.list());
    }, refreshIntervalMs);
    return () => clearInterval(id);
  }, [refreshIntervalMs]);

  const selected = runtimes[selectedIdx] ?? null;

  useInput((input, key) => {
    if (key.upArrow || input === 'k') {
      setSelectedIdx((i) => Math.max(0, i - 1));
    } else if (key.downArrow || input === 'j') {
      setSelectedIdx((i) => Math.min(runtimes.length - 1, i + 1));
    } else if (key.escape || input === 'q') {
      onBack?.();
    }
  });

  const ageSec = useCallback((ts: number) => Math.round((Date.now() - ts) / 1000), []);

  return (
    <Box flexDirection="column" padding={1} gap={1}>
      {/* Header */}
      <Box borderStyle="round" borderColor="cyan" paddingX={2} paddingY={0}>
        <Text bold color="cyan"> Runtime Dashboard </Text>
        <Text color="gray">  {runtimes.length} runtime{runtimes.length !== 1 ? 's' : ''} registered</Text>
      </Box>

      {runtimes.length === 0 ? (
        <Box paddingX={2}>
          <Text color="gray">
            No runtimes registered.{'\n'}
            Run <Text color="cyan">gizzi runtime register</Text> to auto-discover local agent CLIs.
          </Text>
        </Box>
      ) : (
        <Box flexDirection="row" gap={2}>
          {/* Left: runtime list */}
          <Box flexDirection="column" width={28}>
            {runtimes.map((rt, idx) => {
              const isSelected = idx === selectedIdx;
              const color = STATUS_COLORS[rt.status] ?? 'gray';
              return (
                <Box key={rt.id} paddingX={1}>
                  <Text
                    color={isSelected ? 'cyan' : 'white'}
                    bold={isSelected}
                  >
                    {isSelected ? '▶ ' : '  '}
                    <Text color={color}>●</Text>
                    {' '}{rt.name}
                  </Text>
                </Box>
              );
            })}
          </Box>

          {/* Right: detail panel */}
          {selected && (
            <Box flexDirection="column" borderStyle="single" borderColor="gray" paddingX={2} paddingY={0} flexGrow={1}>
              <Text bold color="white">{selected.name}</Text>
              <Text color="gray">ID: {selected.id}</Text>
              <Text color="gray">Host: {selected.host}</Text>
              <Text>
                Status: <Text color={STATUS_COLORS[selected.status] ?? 'gray'}>{selected.status}</Text>
              </Text>
              <Text color="gray">Heartbeat: {ageSec(selected.lastHeartbeat)}s ago</Text>
              <Text color="gray">Registered: {new Date(selected.registeredAt).toLocaleTimeString()}</Text>

              {selected.agentClis.length > 0 && (
                <Box flexDirection="column" marginTop={1}>
                  <Text bold color="cyan">Agent CLIs ({selected.agentClis.length})</Text>
                  {selected.agentClis.map((cli) => (
                    <Text key={cli.name} color="gray">
                      {'  • '}<Text color="white">{cli.name.padEnd(14)}</Text>{' '}{cli.version}
                    </Text>
                  ))}
                </Box>
              )}
            </Box>
          )}
        </Box>
      )}

      {/* Footer */}
      <Box paddingX={1}>
        <Text color="gray">j/k navigate  q back  auto-refreshes every {refreshIntervalMs / 1000}s</Text>
      </Box>
    </Box>
  );
}

export default RuntimeDashboard;
