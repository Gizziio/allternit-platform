/**
 * A2rchitect Super-Agent OS - A2r Chat Integration
 * 
 * Bridges chat conversations to program launches:
 * - Detects launch directives in agent messages
 * - Renders program preview cards in chat
 * - Handles program state streaming
 * - Manages program lifecycle from chat context
 */

import * as React from 'react';
const { useCallback, useEffect, useState } = React;
import { useSidecarStore } from '../stores/useSidecarStore';
import { 
  parseLaunchCommands, 
  executeLaunchCommands, 
  wrapLaunchCommand 
} from '../utils/launchProtocol';
import type { A2rProgram, A2rProgramType } from '../types/programs';

// ============================================================================
// Types
// ============================================================================

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  programs?: LaunchedProgramInfo[];
  streaming?: boolean;
}

interface LaunchedProgramInfo {
  id: string;
  type: A2rProgramType;
  title: string;
  status: 'launching' | 'active' | 'error';
}

export interface A2rChatIntegrationProps {
  messages: ChatMessage[];
  onLaunchProgram?: (program: A2rProgram) => void;
  enableAutoLaunch?: boolean;
  threadId: string;
}

interface ProgramPreviewCardProps {
  programInfo: LaunchedProgramInfo;
  onClick?: () => void;
}

interface LaunchSegment {
  type: 'text' | 'launch';
  content: string;
  launchType?: A2rProgramType;
  title?: string;
}

// ============================================================================
// Program Preview Card
// ============================================================================

const ProgramPreviewCard: React.FC<ProgramPreviewCardProps> = ({ programInfo, onClick }) => {
  const getIcon = (type: A2rProgramType) => {
    const icons: Record<A2rProgramType, string> = {
      'research-doc': '📄',
      'data-grid': '📊',
      'presentation': '🎨',
      'code-preview': '💻',
      'asset-manager': '📁',
      'image-studio': '🖼️',
      'audio-studio': '🎵',
      'telephony': '📞',
      'browser': '🌐',
      'orchestrator': '🤖',
      'workflow-builder': '⚡',
      'custom': '⚙️',
    };
    return icons[type] || '📦';
  };

  const getStatusColor = (status: LaunchedProgramInfo['status']) => {
    switch (status) {
      case 'launching': return 'bg-yellow-100 text-yellow-700 border-yellow-300';
      case 'active': return 'bg-green-100 text-green-700 border-green-300';
      case 'error': return 'bg-red-100 text-red-700 border-red-300';
      default: return 'bg-gray-100 text-gray-700 border-gray-300';
    }
  };

  return (
    <div 
      onClick={onClick}
      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:shadow-md transition-all ${getStatusColor(programInfo.status)}`}
    >
      <span className="text-2xl">{getIcon(programInfo.type)}</span>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate">{programInfo.title}</div>
        <div className="text-xs opacity-70 capitalize">{programInfo.type.replace('-', ' ')}</div>
      </div>
      {programInfo.status === 'launching' && (
        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
      )}
      {programInfo.status === 'active' && (
        <span className="text-green-600">●</span>
      )}
    </div>
  );
};

// ============================================================================
// Parse message into segments
// ============================================================================

function parseMessageSegments(message: string): LaunchSegment[] {
  const commands = parseLaunchCommands(message);
  if (commands.length === 0) {
    return [{ type: 'text', content: message }];
  }

  const segments: LaunchSegment[] = [];
  let lastIndex = 0;
  
  // Regex to find launch commands in the message
  const regex = /<launch_utility[\s\S]*?<\/launch_utility>/g;
  let match;
  
  while ((match = regex.exec(message)) !== null) {
    // Add text before this command
    if (match.index > lastIndex) {
      segments.push({
        type: 'text',
        content: message.slice(lastIndex, match.index),
      });
    }
    
    // Find the matching command
    const cmdIndex = commands.findIndex((c, i) => 
      !segments.filter(s => s.type === 'launch').some((s, si) => si === i)
    );
    const cmd = commands[cmdIndex >= 0 ? cmdIndex : 0];
    
    segments.push({
      type: 'launch',
      content: match[0],
      launchType: cmd.type,
      title: String(cmd.params.title || 'Untitled'),
    });
    
    lastIndex = match.index + match[0].length;
  }
  
  // Add remaining text
  if (lastIndex < message.length) {
    segments.push({
      type: 'text',
      content: message.slice(lastIndex),
    });
  }
  
  return segments;
}

// ============================================================================
// Message Renderer with Program Detection
// ============================================================================

interface MessageRendererProps {
  message: ChatMessage;
  onProgramClick?: (programId: string) => void;
}

export const MessageRenderer: React.FC<MessageRendererProps> = ({ message, onProgramClick }) => {
  const [segments] = useState(() => parseMessageSegments(message.content));

  return (
    <div className="space-y-3">
      {segments.map((segment, idx) => (
        segment.type === 'launch' ? (
          <ProgramPreviewCard 
            key={idx}
            programInfo={{
              id: `launch-${idx}`,
              type: segment.launchType!,
              title: segment.title!,
              status: 'active',
            }}
            onClick={() => onProgramClick?.(`launch-${idx}`)}
          />
        ) : (
          <div key={idx} className="prose dark:prose-invert max-w-none">
            <FormattedText text={segment.content} />
          </div>
        )
      ))}
      
      {/* Show attached programs at the end */}
      {message.programs && message.programs.length > 0 && !segments.some(s => s.type === 'launch') && (
        <div className="flex flex-wrap gap-2 mt-3">
          {message.programs.map(program => (
            <ProgramPreviewCard 
              key={program.id}
              programInfo={program}
              onClick={() => onProgramClick?.(program.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Formatted Text Component
// ============================================================================

const FormattedText: React.FC<{ text: string }> = ({ text }) => {
  // Simple markdown-like formatting
  const lines = text.split('\n');
  
  return (
    <>
      {lines.map((line, idx) => {
        // Headers
        if (line.startsWith('### ')) {
          return <h3 key={idx} className="text-lg font-bold mt-4 mb-2">{line.slice(4)}</h3>;
        }
        if (line.startsWith('## ')) {
          return <h2 key={idx} className="text-xl font-bold mt-4 mb-2">{line.slice(3)}</h2>;
        }
        if (line.startsWith('# ')) {
          return <h1 key={idx} className="text-2xl font-bold mt-4 mb-2">{line.slice(2)}</h1>;
        }
        
        // Code blocks
        if (line.startsWith('```')) {
          return null;
        }
        
        // Lists
        if (line.match(/^[-*]\s/)) {
          return (
            <ul key={idx} className="list-disc list-inside my-1">
              <li>{formatInline(line.slice(2))}</li>
            </ul>
          );
        }
        
        // Numbered lists
        if (line.match(/^\d+\.\s/)) {
          return (
            <ol key={idx} className="list-decimal list-inside my-1">
              <li>{formatInline(line.replace(/^\d+\.\s/, ''))}</li>
            </ol>
          );
        }
        
        // Empty lines
        if (line.trim() === '') {
          return <div key={idx} className="h-2" />;
        }
        
        // Regular paragraph
        return <p key={idx} className="my-1">{formatInline(line)}</p>;
      })}
    </>
  );
};

const formatInline = (text: string): React.ReactNode => {
  // Bold
  let parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={idx}>{part.slice(2, -2)}</strong>;
    }
    // Italic
    if (part.startsWith('*') && part.endsWith('*') && !part.startsWith('**')) {
      return <em key={idx}>{part.slice(1, -1)}</em>;
    }
    // Inline code
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={idx} className="bg-gray-100 dark:bg-gray-800 px-1 rounded text-sm">{part.slice(1, -1)}</code>;
    }
    return part;
  });
};

// ============================================================================
// Main A2r Chat Integration Hook
// ============================================================================

export const useA2rChatIntegration = (options: {
  threadId: string;
  enableAutoLaunch?: boolean;
  onProgramLaunch?: (programId: string) => void;
}) => {
  const { threadId, enableAutoLaunch = true, onProgramLaunch } = options;
  const store = useSidecarStore();
  const [pendingLaunches, setPendingLaunches] = useState<Set<string>>(new Set());

  const processMessage = useCallback(async (message: ChatMessage): Promise<ChatMessage> => {
    // Parse launch commands from message
    const launchCommands = parseLaunchCommands(message.content);
    
    if (launchCommands.length === 0 || !enableAutoLaunch) {
      return message;
    }

    // Execute launches and collect program info
    const launchedProgramIds: string[] = [];
    
    for (const cmd of launchCommands) {
      const launchKey = `${cmd.type}-${Date.now()}`;
      setPendingLaunches(prev => new Set(prev).add(launchKey));
      
      try {
        const programIds = executeLaunchCommands([cmd], threadId);
        launchedProgramIds.push(...programIds);
        programIds.forEach(id => onProgramLaunch?.(id));
      } catch (error) {
        console.error('Failed to launch program:', error);
      } finally {
        setPendingLaunches(prev => {
          const next = new Set(prev);
          next.delete(launchKey);
          return next;
        });
      }
    }

    // Map to LaunchedProgramInfo
    const launchedPrograms: LaunchedProgramInfo[] = launchCommands.map((cmd, idx) => ({
      id: launchedProgramIds[idx] || `pending-${idx}`,
      type: cmd.type,
      title: String(cmd.params.title || 'Untitled'),
      status: launchedProgramIds[idx] ? 'active' : 'error',
    }));

    return {
      ...message,
      programs: launchedPrograms,
    };
  }, [enableAutoLaunch, onProgramLaunch, threadId]);

  const injectLaunchCommand = useCallback((
    programType: A2rProgramType, 
    title: string, 
    initialState?: Record<string, unknown>
  ): string => {
    return wrapLaunchCommand(programType, title, initialState ?? {});
  }, []);

  return {
    processMessage,
    injectLaunchCommand,
    pendingLaunches,
    isProcessing: pendingLaunches.size > 0,
  };
};

// ============================================================================
// Main A2r Chat Integration Component
// ============================================================================

export const A2rChatIntegration: React.FC<A2rChatIntegrationProps> = ({
  messages,
  onLaunchProgram,
  enableAutoLaunch = true,
  threadId,
}) => {
  const store = useSidecarStore();
  const [enrichedMessages, setEnrichedMessages] = useState<ChatMessage[]>(messages);

  useEffect(() => {
    // Process new messages for launch commands
    const processNewMessages = async () => {
      const newMessages: ChatMessage[] = [];
      const processedIds = new Set<string>();
      
      for (const message of messages) {
        if (processedIds.has(message.id)) {
          newMessages.push(message);
          continue;
        }
        
        processedIds.add(message.id);
        
        if (message.role !== 'assistant' || !enableAutoLaunch) {
          newMessages.push(message);
          continue;
        }

        // Parse and execute launch commands
        const launchCommands = parseLaunchCommands(message.content);
        
        if (launchCommands.length === 0) {
          newMessages.push(message);
          continue;
        }

        const launchedProgramIds = executeLaunchCommands(launchCommands, threadId);
        
        // Get program details from store
        const launchedPrograms: LaunchedProgramInfo[] = [];
        for (let i = 0; i < launchCommands.length; i++) {
          const cmd = launchCommands[i];
          const programId = launchedProgramIds[i];
          const program = Object.values(store.programs).find(p => p.id === programId);
          
          if (program) {
            launchedPrograms.push({
              id: program.id,
              type: program.type,
              title: program.title,
              status: 'active',
            });
            onLaunchProgram?.(program);
          }
        }

        newMessages.push({
          ...message,
          programs: launchedPrograms,
        });
      }
      
      setEnrichedMessages(newMessages);
    };

    processNewMessages();
  }, [messages, enableAutoLaunch, onLaunchProgram, store.programs, threadId]);

  const handleProgramClick = useCallback((programId: string) => {
    store.activateProgram(programId);
  }, [store]);

  return (
    <div className="space-y-4">
      {enrichedMessages.map(message => (
        <div 
          key={message.id}
          className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
        >
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${
            message.role === 'user' 
              ? 'bg-blue-600 text-white' 
              : 'bg-gray-200 dark:bg-gray-700'
          }`}>
            {message.role === 'user' ? '👤' : '🤖'}
          </div>
          
          <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
            message.role === 'user'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 dark:bg-gray-800'
          }`}>
            <MessageRenderer 
              message={message} 
              onProgramClick={handleProgramClick}
            />
            
            {message.streaming && (
              <span className="inline-block w-2 h-4 bg-current ml-1 animate-pulse" />
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

// ============================================================================
// Streaming Message Handler
// ============================================================================

export const useStreamingMessage = () => {
  const [content, setContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);

  const startStreaming = useCallback(() => {
    setIsStreaming(true);
    setContent('');
  }, []);

  const appendChunk = useCallback((chunk: string) => {
    setContent(prev => prev + chunk);
  }, []);

  const endStreaming = useCallback(() => {
    setIsStreaming(false);
    return content;
  }, [content]);

  return {
    content,
    isStreaming,
    startStreaming,
    appendChunk,
    endStreaming,
  };
};

// ============================================================================
// Quick Launch Buttons
// ============================================================================

interface QuickLaunchButtonsProps {
  onLaunch: (type: A2rProgramType) => void;
  className?: string;
}

export const QuickLaunchButtons: React.FC<QuickLaunchButtonsProps> = ({ onLaunch, className }) => {
  const buttons: { type: A2rProgramType; icon: string; label: string }[] = [
    { type: 'research-doc', icon: '📄', label: 'Research' },
    { type: 'data-grid', icon: '📊', label: 'Data' },
    { type: 'presentation', icon: '🎨', label: 'Slides' },
    { type: 'code-preview', icon: '💻', label: 'Code' },
    { type: 'asset-manager', icon: '📁', label: 'Files' },
  ];

  return (
    <div className={`flex gap-2 flex-wrap ${className || ''}`}>
      {buttons.map(({ type, icon, label }) => (
        <button
          key={type}
          onClick={() => onLaunch(type)}
          className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg text-sm transition-colors"
        >
          <span>{icon}</span>
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
};

export default A2rChatIntegration;
