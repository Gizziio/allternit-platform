import React, { useState, useCallback, useEffect } from 'react';
import { Box, Text, useApp, useInput } from '../ink';
import type { Session, ToolUse, ToolResult, CommandOption } from '../../types';
import { getHarnessService } from '../../services/harness';
import { CommandPalette } from '../CommandPalette';
import { useCommandRegistry } from '../../hooks/useCommandRegistry';

interface MainScreenProps {
  session: Session | null;
  harnessEnabled?: boolean;
  vmEnabled?: boolean;
  vmStatus?: string;
  onExit?: () => void;
}

interface OutputItem {
  id: string;
  type: 'command' | 'response' | 'tool' | 'error' | 'system';
  content: string;
  metadata?: {
    toolName?: string;
    status?: 'running' | 'success' | 'error';
    tokens?: { input: number; output: number };
    cost?: number;
  };
  timestamp: number;
}

export const MainScreen: React.FC<MainScreenProps> = ({
  session,
  harnessEnabled = false,
  vmEnabled = false,
  vmStatus = 'idle',
  onExit,
}) => {
  const { exit } = useApp();
  const { register, visibleOptions, suggestedOptions, trigger } = useCommandRegistry();
  
  // Output history
  const [items, setItems] = useState<OutputItem[]>([]);
  // Input state
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentResponse, setCurrentResponse] = useState('');
  // UI state
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [currentAgent, setCurrentAgent] = useState('default');
  const [currentModel, setCurrentModel] = useState('claude-3-5-haiku');
  // Spinner animation
  const [spinnerFrame, setSpinnerFrame] = useState(0);
  const spinners = ['◐', '◓', '◑', '◒'];

  // Register commands (ported from OpenTUI)
  useEffect(() => {
    const unregister = register(() => [
      // Session commands
      {
        title: 'New Session',
        value: 'session.new',
        category: 'Session',
        slash: { name: 'new', aliases: ['clear'] },
        description: 'Start a new session',
        onSelect: () => {
          setItems([]);
          addItem({ type: 'system', content: 'Started new session' });
        },
      },
      {
        title: 'Switch Session',
        value: 'session.list',
        slash: { name: 'sessions', aliases: ['resume', 'continue'] },
        description: 'Resume a previous session',
        suggested: true,
      },
      // Model commands
      {
        title: 'Switch Model',
        value: 'model.list',
        category: 'Agent',
        slash: { name: 'models' },
        description: 'Change the AI model',
        onSelect: () => {
          // Would show model picker
          addItem({ type: 'system', content: 'Model picker would open here' });
        },
      },
      {
        title: 'Cycle Recent Model',
        value: 'model.cycle_recent',
        footer: 'Ctrl+M',
        onSelect: () => {
          setCurrentModel(m => m === 'claude-3-5-haiku' ? 'gpt-4' : 'claude-3-5-haiku');
          addItem({ type: 'system', content: `Switched to ${currentModel}` });
        },
      },
      // Agent commands
      {
        title: 'Switch Agent',
        value: 'agent.list',
        slash: { name: 'agents' },
        description: 'Change the active agent',
      },
      {
        title: 'Agent Mode',
        value: 'agent.mode',
        slash: { name: 'agent-mode', aliases: ['mode'] },
        description: 'Switch to agent mode',
      },
      // System commands
      {
        title: 'Help',
        value: 'help.show',
        category: 'System',
        slash: { name: 'help' },
        description: 'Show help',
        onSelect: () => {
          addItem({ type: 'system', content: 'Type / to see all commands' });
        },
      },
      {
        title: 'Status',
        value: 'status.view',
        slash: { name: 'status' },
        description: 'View system status',
      },
      {
        title: 'Exit',
        value: 'app.exit',
        slash: { name: 'exit', aliases: ['quit', 'q'] },
        description: 'Exit the application',
        onSelect: () => exit(),
      },
    ]);
    
    return unregister;
  }, [register, exit, currentModel]);

  // Spinner animation effect
  useEffect(() => {
    if (!isProcessing) return;
    const interval = setInterval(() => {
      setSpinnerFrame(f => (f + 1) % spinners.length);
    }, 100);
    return () => clearInterval(interval);
  }, [isProcessing]);

  useInput((value, key) => {
    // Command palette trigger
    if (key.ctrl && value === 'p') {
      setShowCommandPalette(true);
      return;
    }
    // Slash command trigger
    if (value === '/' && input === '' && !isProcessing && !showCommandPalette) {
      setShowCommandPalette(true);
      return;
    }
    if (showCommandPalette) return; // Let palette handle input
    if (key.escape) {
      if (onExit) onExit();
      exit();
      return;
    }
    if (key.ctrlC) {
      if (isProcessing) {
        getHarnessService().cancel();
        setIsProcessing(false);
        setCurrentResponse('');
        addItem({ type: 'error', content: 'Interrupted by user' });
      }
      return;
    }
    if (key.upArrow) {
      if (historyIndex < history.length - 1) {
        const newIndex = historyIndex + 1;
        setHistoryIndex(newIndex);
        setInput(history[history.length - 1 - newIndex] || '');
      }
      return;
    }
    if (key.downArrow) {
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInput(history[history.length - 1 - newIndex] || '');
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setInput('');
      }
      return;
    }
    if (key.return && input.trim() && !isProcessing) {
      handleSubmit();
      return;
    }
    if (value && !key.ctrl && !key.meta) {
      setInput(prev => prev + value);
      return;
    }
    if (key.backspace || key.delete) {
      setInput(prev => prev.slice(0, -1));
    }
  });

  const addItem = useCallback((item: Omit<OutputItem, 'id' | 'timestamp'>) => {
    setItems(prev => [...prev, {
      ...item,
      id: `item_${Date.now()}_${Math.random()}`,
      timestamp: Date.now(),
    }]);
  }, []);

  const handleSubmit = useCallback(async () => {
    const command = input.trim();
    if (!command || isProcessing) return;
    // Check for slash command
    if (command.startsWith('/')) {
      const slashName = command.slice(1).split(' ')[0];
      const slashCmd = visibleOptions.find(o => 
        o.slash?.name === slashName || o.slash?.aliases?.includes(slashName)
      );
      if (slashCmd) {
        slashCmd.onSelect?.();
        return;
      }
    }
    setHistory(prev => [...prev, command]);
    setHistoryIndex(-1);
    addItem({ type: 'command', content: command });
    setInput('');
    setIsProcessing(true);
    setCurrentResponse('');
    try {
      const service = getHarnessService();
      if (!service.isAvailable()) {
        await simulateDemoResponse(command, addItem, setCurrentResponse);
      } else {
        // Real harness integration
      }
    } catch (error) {
      addItem({ type: 'error', content: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      setIsProcessing(false);
      setCurrentResponse('');
    }
  }, [input, isProcessing, addItem, visibleOptions]);

  const workspaceName = session?.workspace?.split('/').pop() || 'gizzi-code';

  // Command palette handler
  if (showCommandPalette) {
    return (
      <Box flexDirection="column" height="100%">
        <Box 
          flexDirection="row" 
          paddingX={1} 
          borderStyle="single" 
          borderColor="#30363d"
          borderTop={false}
          borderLeft={false}
          borderRight={false}
        >
          <Text color="#d4b08c">⏺</Text>
          <Text> {workspaceName}</Text>
          <Box flexGrow={1} />
          <Text dimColor>Command Palette</Text>
        </Box>
        <CommandPalette
          title="Commands"
          options={visibleOptions}
          suggestedOptions={suggestedOptions}
          onSelect={(option) => {
            option.onSelect?.();
            setShowCommandPalette(false);
          }}
          onCancel={() => setShowCommandPalette(false)}
        />
      </Box>
    );
  }

  return (
    <Box flexDirection="column" height="100%">
      {/* Header */}
      <Box 
        flexDirection="row" 
        paddingX={1} 
        borderStyle="single" 
        borderColor="#30363d"
        borderTop={false}
        borderLeft={false}
        borderRight={false}
      >
        <Text color="#d4b08c">⏺</Text>
        <Text> {workspaceName}</Text>
        <Box flexGrow={1} />
        <Text color="#3fb950">{currentAgent}</Text>
        <Text dimColor>{session?.id?.slice(0, 8) || 'new'}</Text>
      </Box>
      {/* Message List */}
      <Box flexGrow={1} flexDirection="column" paddingX={1} overflowY="hidden">
        {items.map((item, index) => (
          <OutputItem key={item.id} item={item} isLast={index === items.length - 1} />
        ))}
        
        {isProcessing && (
          <Box flexDirection="column" marginY={1}>
            <Box>
              <Text color="#d4b08c">{spinners[spinnerFrame]}</Text>
            </Box>
            {currentResponse && (
              <Box marginLeft={2}>
                <Text wrap="wrap">{currentResponse}</Text>
                <Text color="#58a6ff">▌</Text>
              </Box>
            )}
          </Box>
        )}
      </Box>
      {/* Input */}
      <Box
        flexDirection="row"
        borderBottom={false}
      >
        <Text bold color="#d4b08c">›</Text>
        <Text> </Text>
        <Text>{input}</Text>
        {!isProcessing && <Text color="#58a6ff">▌</Text>}
      </Box>
      {/* Footer */}
      <Box flexDirection="row" paddingX={1}>
        <Text dimColor>
          ^C Interrupt • ^P Commands • / Slash • ↑↓ History
          {harnessEnabled && ' • Harness'}
        </Text>
      </Box>
    </Box>
  );
};

// Output item component
const OutputItem: React.FC<{ item: OutputItem; isLast: boolean }> = ({ item }) => {
  switch (item.type) {
    case 'command':
      return (
        <Box marginY={1}>
          <Text color="#58a6ff">$</Text>
          <Text> {item.content}</Text>
        </Box>
      );
    case 'response':
      return (
        <Box flexDirection="column" marginY={1} marginLeft={2}>
          <Text wrap="wrap">{item.content}</Text>
        </Box>
      );
    case 'tool':
      return (
        <Box marginY={0} marginLeft={2}>
          {item.metadata?.status === 'running' && <Text color="#d4b08c">⏺</Text>}
          {item.metadata?.status === 'success' && <Text color="#3fb950">✓</Text>}
          {item.metadata?.status === 'error' && <Text color="#f85149">✗</Text>}
          <Text color="#8b949e"> {item.content}</Text>
        </Box>
      );
    case 'error':
      return (
        <Box marginY={1} marginLeft={2}>
          <Text color="#f85149">Error: {item.content}</Text>
        </Box>
      );
    case 'system':
      return (
        <Box marginY={1} marginLeft={2}>
          <Text color="#8b949e" dimColor>{item.content}</Text>
        </Box>
      );
    default:
      return null;
  }
};

// Demo response simulation
async function simulateDemoResponse(
  command: string,
  addItem: (item: Omit<OutputItem, 'id' | 'timestamp'>) => void,
  setCurrentResponse: (text: string) => void
) {
  addItem({ type: 'tool', content: 'Read(src/main.ts)', metadata: { status: 'running' } });
  await new Promise(r => setTimeout(r, 300));
  addItem({ type: 'tool', content: 'Read(src/main.ts)', metadata: { status: 'success' } });
  const response = `I'll help you with that. Based on the codebase analysis, I can see this is a TypeScript project with the following structure...`;
  let displayed = '';
  for (const char of response) {
    displayed += char;
    setCurrentResponse(displayed);
    await new Promise(r => setTimeout(r, 10));
  }
  addItem({ type: 'response', content: response, metadata: { cost: 0.002, tokens: { input: 150, output: 45 } } });
}
