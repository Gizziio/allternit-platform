#!/usr/bin/env bun
/**
 * Gizzi TUI Entry Point - Full REPL Integration
 */
import React, { useState, useEffect } from 'react';
import { render, Box, Text } from './ink';
import { REPL } from './screens/REPL';
import { enableConfigs } from './utils/config';
import { AppStateProvider } from './state/AppState';

const App: React.FC = () => {
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Simulate initialization
    const timer = setTimeout(() => {
      try {
        setInitialized(true);
      } catch (err) {
        setError(String(err));
      }
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  if (error) {
    return (
      <Box flexDirection="column" alignItems="center" justifyContent="center" flexGrow={1}>
        <Text color="red" bold>Error</Text>
        <Text color="red">{error}</Text>
      </Box>
    );
  }

  if (!initialized) {
    return (
      <Box flexDirection="column" alignItems="center" justifyContent="center" flexGrow={1}>
        <Text color="#d4b08c" bold>⏺ GIZZI ⏺</Text>
        <Text dimColor>Loading...</Text>
      </Box>
    );
  }

  return (
    <AppStateProvider>
      <Box flexDirection="column" height="100%">
        <REPL
          commands={[]}
          debug={false}
          initialTools={[]}
          initialMessages={[]}
          thinkingConfig={{ enabled: false, budgetTokens: 0 }}
        />
      </Box>
    </AppStateProvider>
  );
};

export async function startInkTUI(): Promise<void> {
  if (!process.stdin.isTTY) {
    console.error('Error: Must run in interactive terminal');
    process.exit(1);
  }
  
  // Enable configs before rendering UI components that may access config
  enableConfigs();
  
  const app = await render(<App />, { exitOnCtrlC: false });
  await app.waitUntilExit();
}

export async function tui(_options?: unknown): Promise<void> {
  await startInkTUI();
}

if (import.meta.main) {
  startInkTUI().catch(err => {
    console.error('Failed:', err);
    process.exit(1);
  });
}
