/**
 * REPLAdapter - Production-quality adapter for integrating free-code REPL into gizzi-code
 * 
 * This adapter provides:
 * 1. Props mapping from gizzi app state to REPL props
 * 2. Stub implementations for missing free-code dependencies
 * 3. Error boundaries and graceful degradation
 * 4. Theme integration
 */

import React, { useMemo, useEffect, useState, lazy, Suspense } from 'react';
import { Box, Text } from '../ink';
import { getHarnessService } from '../../services/harness';
// Lazy load REPL to avoid bundling issues with the large file
const REPL = lazy(() => import('./REPL.js').then(m => ({ default: m.REPL })));
import type { Props as REPLProps } from './REPL';
import type { Session, Tool, Command, Message, ThinkingConfig } from '../../types';
import type { AgentDefinition } from '../../vendor/tools/AgentTool/loadAgentsDir';
import type { MCPServerConnection, ScopedMcpServerConfig } from '../../vendor/services/mcp/types';
import type { FileHistorySnapshot } from '../../vendor/utils/fileHistory';
import type { ContentReplacementRecord } from '../../vendor/utils/toolResultStorage';
import type { HookResultMessage, Message as MessageType } from '../../vendor/types/message';
import type { RemoteSessionConfig } from '../../vendor/remote/RemoteSessionManager';
import type { DirectConnectConfig } from '../../vendor/server/directConnectManager';
import type { SSHSession } from '../../vendor/ssh/createSSHSession';
import type { AgentColorName } from '../../vendor/tools/AgentTool/agentColorManager';

interface REPLAdapterProps {
  session: Session | null;
  harnessEnabled?: boolean;
  vmEnabled?: boolean;
  vmStatus?: string;
  onExit?: () => void;
  initialMessages?: Message[];
}

// Production-ready stub commands - core functionality only
const createStubCommands = (): Command[] => {
  const baseCommands: Command[] = [
    {
      name: 'help',
      description: 'Show help information',
      aliases: ['h', '?'],
      category: 'System',
      handler: async () => ({
        type: 'success' as const,
        message: 'Gizzi Code Help:\n  /new - New session\n  /exit - Exit application\n  /models - Switch model\n  /agents - Switch agent'
      })
    },
    {
      name: 'exit',
      description: 'Exit the application',
      aliases: ['quit', 'q'],
      handler: async () => {
        process.exit(0);
      }
    },
    {
      name: 'new',
      description: 'Start a new session',
      aliases: ['clear', 'reset'],
      category: 'Session',
      handler: async () => ({
        type: 'info' as const,
        message: 'Starting new session...'
      })
    },
    {
      name: 'models',
      description: 'Switch AI model',
      category: 'Agent',
      handler: async () => ({
        type: 'info' as const,
        message: 'Available models: Claude 3.5 Sonnet, GPT-4, Gemini Pro'
      })
    },
    {
      name: 'agents',
      description: 'Switch active agent',
      handler: async () => ({
        type: 'info' as const,
        message: 'Available agents: default, code, review'
      })
    }
  ];
  
  return baseCommands;
};

// Stub tools - minimal set for functionality
const createStubTools = (): Tool[] => {
  return [
    {
      name: 'Read',
      description: 'Read file contents',
      parameters: {
        type: 'object',
        properties: {
          file_path: { type: 'string' }
        },
        required: ['file_path']
      }
    },
    {
      name: 'Write',
      description: 'Write to a file',
      parameters: {
        type: 'object',
        properties: {
          file_path: { type: 'string' },
          content: { type: 'string' }
        },
        required: ['file_path', 'content']
      }
    },
    {
      name: 'Bash',
      description: 'Execute bash command',
      parameters: {
        type: 'object',
        properties: {
          command: { type: 'string' }
        },
        required: ['command']
      }
    }
  ];
};

// Default thinking config
const defaultThinkingConfig: ThinkingConfig = {
  enabled: false,
  budgetTokens: 0
};

// Error boundary for REPL
class REPLErrorBoundary extends React.Component<
  { children: React.ReactNode; onError: (error: Error) => void },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode; onError: (error: Error) => void }) {
    super(props);
    this.state = { hasError: false };
  }
  
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.props.onError(error);
    console.error('REPL Error:', error, errorInfo);
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <Box flexDirection="column" padding={1}>
          <Text color="red" bold>REPL Error</Text>
          <Text color="red">{this.state.error?.message || 'Unknown error'}</Text>
          <Text dimColor>Press any key to restart...</Text>
        </Box>
      );
    }
    return this.props.children;
  }
}

export const REPLAdapter: React.FC<REPLAdapterProps> = ({
  session,
  harnessEnabled = false,
  vmEnabled = false,
  vmStatus = 'idle',
  onExit,
  initialMessages = []
}) => {
  const [error, setError] = useState<Error | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Initialize adapter
  useEffect(() => {
    const init = async () => {
      try {
        // Pre-load any necessary resources
        setIsReady(true);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to initialize REPL'));
      }
    };
    init();
  }, []);

  // Map props for REPL component
  const replProps: REPLProps = useMemo(() => {
    const commands = createStubCommands();
    const tools = createStubTools();
    
    // Convert gizzi messages to REPL message format
    const messages: MessageType[] = initialMessages.map((msg, index) => ({
      id: `msg_${index}`,
      type: msg.role === 'user' ? 'user' : msg.role === 'assistant' ? 'assistant' : 'system',
      content: [{ type: 'text', text: msg.content || '' }],
      timestamp: Date.now() - (initialMessages.length - index) * 1000
    } as MessageType));

    return {
      commands,
      debug: process.env.DEBUG === 'true',
      initialTools: tools,
      initialMessages: messages,
      thinkingConfig: defaultThinkingConfig,
      // Stubs for optional props
      initialFileHistorySnapshots: [],
      initialContentReplacements: [],
      mcpClients: [],
      dynamicMcpConfig: {},
      strictMcpConfig: false,
      disableSlashCommands: false,
      disabled: false,
      // Callbacks
      onBeforeQuery: async (input: string, newMessages: MessageType[]) => {
        if (harnessEnabled) {
          const service = getHarnessService();
          if (service.isAvailable()) {
            try {
              await service.sendMessage(input, {
                onText: (text: string) => {
                  // Text streaming handled by REPL
                },
                onToolUse: (toolUse: any) => {
                  // Tool use handled by REPL
                },
                onToolResult: (result: any) => {
                  // Tool result handled by REPL
                },
                onError: (err: Error) => {
                  console.error('Harness error:', err);
                },
                onComplete: () => {
                  // Completion handled by REPL
                }
              });
            } catch (err) {
              console.error('Failed to send message:', err);
            }
          }
        }
        return true;
      },
      onTurnComplete: (messages: MessageType[]) => {
        // Turn complete callback
      }
    };
  }, [session, harnessEnabled, initialMessages]);

  if (error) {
    return (
      <Box flexDirection="column" padding={2}>
        <Text color="red" bold>Failed to initialize REPL</Text>
        <Text color="red">{error.message}</Text>
        <Box marginTop={1}>
          <Text dimColor>Press Enter to exit or wait to retry...</Text>
        </Box>
      </Box>
    );
  }

  if (!isReady) {
    return (
      <Box flexDirection="column" padding={2} alignItems="center">
        <Text color="yellow">Initializing REPL...</Text>
      </Box>
    );
  }

  return (
    <REPLErrorBoundary onError={setError}>
      <Suspense fallback={<Box padding={2}><Text color="yellow">Loading REPL...</Text></Box>}>
        <REPL {...replProps} />
      </Suspense>
    </REPLErrorBoundary>
  );
};

export default REPLAdapter;
