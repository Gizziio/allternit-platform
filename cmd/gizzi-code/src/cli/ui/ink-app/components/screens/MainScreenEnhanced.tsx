/**
 * MainScreenEnhanced - Production-quality main screen
 * 
 * This is an enhanced version of MainScreen that integrates vendored components
 * from free-code while maintaining stability. It serves as a bridge until
 * the full REPL.tsx can be integrated.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Box, Text, useApp, useInput } from '../ink';
import { useTerminalSize } from '../../hooks/useTerminalSize';
import type { Session, Message, ToolUse, ToolResult } from '../../types';
import { getHarnessService } from '../../services/harness';
import { CommandPalette } from '../CommandPalette';
import { useCommandRegistry } from '../../hooks/useCommandRegistry';

interface MainScreenEnhancedProps {
  session: Session | null;
  harnessEnabled?: boolean;
  vmEnabled?: boolean;
  vmStatus?: string;
  onExit?: () => void;
}

interface OutputItem {
  id: string;
  type: 'user' | 'assistant' | 'tool' | 'error' | 'system';
  content: string;
  metadata?: {
    toolName?: string;
    status?: 'pending' | 'running' | 'success' | 'error';
    tokens?: { input: number; output: number };
    cost?: number;
  };
  timestamp: number;
}

// Tool execution visualization
const ToolExecution: React.FC<{ 
  name: string; 
  status: 'pending' | 'running' | 'success' | 'error';
  input?: Record<string, any>;
}> = ({ name, status, input }) => {
  const statusColors = {
    pending: 'yellow',
    running: 'yellow',
    success: 'green',
    error: 'red'
  };
  const statusIcons = {
    pending: '○',
    running: '◐',
    success: '✓',
    error: '✗'
  };
  return (
    <Box flexDirection="row" marginY={0}>
      <Text color={statusColors[status]}>{statusIcons[status]}</Text>
      <Text> </Text>
      <Text color="cyan">{name}</Text>
      {input && (
        <Text dimColor> {JSON.stringify(input).slice(0, 50)}...</Text>
      )}
    </Box>
  );
};

export const MainScreenEnhanced: React.FC<MainScreenEnhancedProps> = ({
  session,
  harnessEnabled = false,
  vmEnabled = false,
  vmStatus = 'idle',
  onExit,
}) => {
  const { exit } = useApp();
  const { width, height } = useTerminalSize();
  const { register, visibleOptions, suggestedOptions } = useCommandRegistry();
  
  // Output history
  const [items, setItems] = useState<OutputItem[]>([]);
  const scrollRef = useRef<number>(0);
  // Input state
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [inputMode, setInputMode] = useState<'insert' | 'normal'>('insert');
  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentResponse, setCurrentResponse] = useState('');
  const [activeTools, setActiveTools] = useState<Array<{ id: string; name: string; status: any; input?: Record<string, any> }>>([]);
  // UI state
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [currentModel, setCurrentModel] = useState('claude-3-5-sonnet');
  const [totalCost, setTotalCost] = useState(0);
  // Spinner animation
  const [spinnerFrame, setSpinnerFrame] = useState(0);
  const spinners = ['◐', '◓', '◑', '◒'];

  // Register slash commands
  useEffect(() => {
    const unregister = register(() => [
      {
        title: 'New Session',
        value: 'session.new',
        category: 'Session',
        slash: { name: 'new', aliases: ['clear', 'reset'] },
        description: 'Start a new session',
        onSelect: () => {
          setItems([]);
          setTotalCost(0);
          addItem({ type: 'system', content: '🔄 Started new session' });
        },
      },
      {
        title: 'Switch Model',
        value: 'model.list',
        category: 'Agent',
        slash: { name: 'models', aliases: ['model'] },
        description: 'Change the AI model',
        suggested: true,
        onSelect: () => setShowModelPicker(true),
      },
      {
        title: 'Help',
        value: 'help.show',
        category: 'System',
        slash: { name: 'help', aliases: ['h', '?'] },
        description: 'Show help',
        onSelect: () => {
          addItem({ 
            type: 'system', 
            content: 'Commands: /new, /models, /help, /exit | Shortcuts: Ctrl+P (palette), Ctrl+C (interrupt), Esc (exit)' 
          });
        },
      },
      {
        title: 'Exit',
        value: 'app.exit',
        slash: { name: 'exit', aliases: ['quit', 'q'] },
        description: 'Exit the application',
        onSelect: () => {
          if (onExit) onExit();
          exit();
        },
      },
    ]);
    
    return unregister;
  }, [register, exit, onExit]);

  useEffect(() => {
    if (!isProcessing) return;
    const interval = setInterval(() => {
      setSpinnerFrame(f => (f + 1) % spinners.length);
    }, 100);
    return () => clearInterval(interval);
  }, [isProcessing]);

  // Input handling
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
    if (showCommandPalette) return;
    if (showModelPicker) return;
    // Exit handlers
    if (key.escape) {
      if (isProcessing) {
        getHarnessService().cancel();
        setIsProcessing(false);
        addItem({ type: 'error', content: '⏹ Interrupted by user' });
      } else {
        if (onExit) onExit();
        exit();
      }
      return;
    }
    if (key.ctrlC) {
      return;
    }
    // History navigation
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
    // Submit
    if (key.return && input.trim() && !isProcessing) {
      handleSubmit();
      return;
    }
    // Character input
    if (value && !key.ctrl && !key.meta) {
      setInput(prev => prev + value);
      return;
    }
    // Backspace
    if (key.backspace || key.delete) {
      setInput(prev => prev.slice(0, -1));
    }
  });

  const addItem = useCallback((item: Omit<OutputItem, 'id' | 'timestamp'>) => {
    setItems(prev => [...prev, {
      ...item,
      id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    }]);
  }, []);

  const handleSubmit = useCallback(async () => {
    const command = input.trim();
    if (!command || isProcessing) return;
    // Handle slash commands
    if (command.startsWith('/')) {
      const slashName = command.slice(1).split(' ')[0];
      const slashCmd = visibleOptions.find(o => 
        o.slash?.name === slashName || o.slash?.aliases?.includes(slashName)
      );
      if (slashCmd?.onSelect) {
        slashCmd.onSelect();
        return;
      }
    }
    // Add to history
    setHistory(prev => [...prev, command]);
    setHistoryIndex(-1);
    // Add user message
    addItem({ type: 'user', content: command });
    setInput('');
    setIsProcessing(true);
    setCurrentResponse('');
    setActiveTools([]);
    try {
      const service = getHarnessService();
      if (!service.isAvailable()) {
        // Demo mode - simulate response
        await simulateDemoResponse(command, addItem, setCurrentResponse, setActiveTools);
      } else {
        // Real harness integration
        let responseText = '';
        
        await service.sendMessage(command, {
          onText: (text: string) => {
            responseText += text;
            setCurrentResponse(responseText);
          },
          onToolUse: (toolUse: any) => {
            setActiveTools(prev => [...prev, {
              id: toolUse.id,
              name: toolUse.name,
              status: 'running',
              input: toolUse.input
            }]);
            addItem({ 
              type: 'tool', 
              content: `${toolUse.name}`,
              metadata: { toolName: toolUse.name, status: 'running' }
            });
          },
          onToolResult: (result: any) => {
            setActiveTools(prev => prev.map(t => 
              t.id === result.tool_use_id ? { ...t, status: result.is_error ? 'error' : 'success' } : t
            ));
          },
          onError: (error: Error) => {
            addItem({ type: 'error', content: error.message });
          },
          onComplete: (usage?: { cost?: number }) => {
            if (usage) {
              setTotalCost(prev => prev + (usage.cost || 0));
            }
          }
        });
        if (responseText) {
          addItem({
            type: 'assistant', 
            content: responseText,
            metadata: { tokens: { input: 0, output: responseText.length / 4 } }
          });
        }
      }
    } catch (error) {
      addItem({ 
        type: 'error', 
        content: error instanceof Error ? error.message : 'Unknown error' 
      });
    } finally {
      setIsProcessing(false);
      setCurrentResponse('');
      setActiveTools([]);
    }
  }, [input, isProcessing, addItem, visibleOptions]);

  const workspaceName = session?.title || 'gizzi-code';
  const sessionId = session?.id?.slice(0, 8) || 'new';

  // Command palette
  if (showCommandPalette) {
    return (
      <Box flexDirection="column" height={height}>
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

  // Model picker (simplified)
  if (showModelPicker) {
    return (
      <Box flexDirection="column" height={height} padding={1}>
        <Text bold>Select Model</Text>
        <Box flexDirection="column" marginY={1}>
          {['claude-3-5-sonnet', 'claude-3-5-haiku', 'gpt-4', 'gpt-3.5-turbo'].map((model) => (
            <Box key={model} paddingY={0}>
              <Text color={currentModel === model ? 'green' : undefined}>
                {currentModel === model ? '● ' : '○ '}{model}
              </Text>
            </Box>
          ))}
        </Box>
        <Text dimColor>Press Enter to select, Esc to cancel</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" height={height}>
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
        {isProcessing && (
          <>
            <Text color="#d4b08c">{spinners[spinnerFrame]}</Text>
            <Text> </Text>
          </>
        )}
        <Text color="#58a6ff">{currentModel}</Text>
        <Text dimColor>{sessionId}</Text>
      </Box>
      {/* Messages Area */}
      <Box flexGrow={1} flexDirection="column" paddingX={1}>
        {items.map((item, index) => (
          <MessageItem key={item.id} item={item} isLast={index === items.length - 1} />
        ))}
        {isProcessing && currentResponse && (
          <Box flexDirection="column" marginY={1}>
            <Box>
              <Text color="#d4b08c">◆</Text>
              <Text> </Text>
              <Text color="#58a6ff" bold>Claude</Text>
            </Box>
            <Box marginLeft={2}>
              <Text wrap="wrap">{currentResponse}</Text>
              <Text color="#58a6ff">▌</Text>
            </Box>
          </Box>
        )}
        {/* Active Tools */}
        {activeTools.length > 0 && (
          <Box flexDirection="column" marginY={1} marginLeft={2}>
            {activeTools.map(tool => (
              <ToolExecution 
                key={tool.id} 
                name={tool.name} 
                status={tool.status || 'running'}
                input={tool.input}
              />
            ))}
          </Box>
        )}
      </Box>
      {/* Input Area */}
      <Box 
        flexDirection="row"
        borderBottom={false}
      >
        <Text bold color="#d4b08c">›</Text>
        <Text> </Text>
        <Text>{input}</Text>
        {!isProcessing && <Text color="#58a6ff">▌</Text>}
      </Box>
      {/* Status Bar */}
      <Box flexDirection="row" paddingX={1} paddingY={0}>
        <Text dimColor>
          {isProcessing ? 'Thinking...' : 'Ready'}
          {harnessEnabled && ' • Harness'}
          {vmEnabled && ' • VM'}
          {totalCost > 0 && ` • $${totalCost.toFixed(4)}`}
        </Text>
        <Box flexGrow={1} />
        <Text dimColor>^C Interrupt • ^P Commands • /help</Text>
      </Box>
    </Box>
  );
};

// Message item component
const MessageItem: React.FC<{ item: OutputItem; isLast: boolean }> = ({ item }) => {
  switch (item.type) {
    case 'user':
      return (
        <Box marginY={1}>
          <Text bold color="#d4b08c">›</Text>
          <Text> {item.content}</Text>
        </Box>
      );
    case 'assistant':
      return (
        <Box>
          <Box>
            <Text color="#d4b08c">◆</Text>
            <Text color="#58a6ff" bold>Claude</Text>
          </Box>
          <Box marginLeft={2}>
            <Text wrap="wrap">{item.content}</Text>
          </Box>
          {item.metadata?.tokens && (
            <Box>
              <Text dimColor>
                Tokens: {item.metadata.tokens.input} → {item.metadata.tokens.output}
                {item.metadata.cost && ` • $${item.metadata.cost.toFixed(4)}`}
              </Text>
            </Box>
          )}
        </Box>
      );
    case 'tool':
      return (
        <Box marginY={0} marginLeft={2}>
          {item.metadata?.status === 'running' && <Text color="#d4b08c">◐</Text>}
          {item.metadata?.status === 'success' && <Text color="#3fb950">✓</Text>}
          {item.metadata?.status === 'error' && <Text color="#f85149">✗</Text>}
          {item.metadata?.status === 'pending' && <Text color="#8b949e">○</Text>}
          <Text color="#8b949e"> {item.content}</Text>
        </Box>
      );
    case 'error':
      return (
        <Box marginY={1} marginLeft={2}>
          <Text color="#f85149">{item.content}</Text>
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
  setCurrentResponse: (text: string) => void,
  setActiveTools: React.Dispatch<React.SetStateAction<Array<{ id: string; name: string; status: any; input?: Record<string, any> }>>>
) {
  // Simulate tool execution
  const toolId = `tool_${Date.now()}`;
  setActiveTools(prev => [...prev, { id: toolId, name: 'Read', status: 'running', input: { file_path: 'README.md' } }]);
  addItem({ type: 'tool', content: 'Read(README.md)', metadata: { toolName: 'Read', status: 'running' } });
  await new Promise(r => setTimeout(r, 600));
  setActiveTools(prev => prev.map(t => t.id === toolId ? { ...t, status: 'success' } : t));
  addItem({ type: 'tool', content: 'Read(README.md)', metadata: { toolName: 'Read', status: 'success' } });
  // Simulate streaming response
  const response = `I'll help you with "${command}". This is a demo response from Gizzi Code. The full AI integration is available when the harness is properly configured.`;
  let displayed = '';
  for (const char of response) {
    displayed += char;
    setCurrentResponse(displayed);
    await new Promise(r => setTimeout(r, 15));
  }
  addItem({ 
    type: 'assistant', 
    content: response, 
    metadata: { cost: 0.002, tokens: { input: command.length / 4, output: response.length / 4 } } 
  });
}

export default MainScreenEnhanced;
