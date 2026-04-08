/**
 * CoworkWorkBlock - Inline work event blocks for chat transcript
 * Renders compact, expandable blocks like "Ran 4 commands", "Read 1 file"
 */

import React, { memo, useState } from 'react';
import { cn } from '@/lib/utils';
import type { 
  AnyCoworkEvent, 
  ActionEvent, 
  CommandEvent, 
  FileEvent, 
  ObservationEvent, 
  CheckpointEvent,
  ToolCallEvent,
  ToolResultEvent 
} from './cowork.types';
import {
  Terminal,
  FileText,
  Cursor as MousePointerClick,
  Camera,
  CheckCircle,
  Flag,
  CaretDown,
  CaretUp,
  CircleNotch,
  Code,
  Eye,
} from '@phosphor-icons/react';

// ============================================================================
// Work Block Types
// ============================================================================

type WorkBlockType = 'action' | 'observation' | 'command' | 'file' | 'tool' | 'checkpoint';

interface WorkBlockProps {
  event: AnyCoworkEvent;
  isStreaming?: boolean;
}

interface BlockComponentProps {
  event: AnyCoworkEvent;
  isExpanded: boolean;
  onToggle: () => void;
}

// ============================================================================
// Type Guards
// ============================================================================

const isActionEvent = (event: AnyCoworkEvent): event is ActionEvent => 
  event.type === 'cowork.action';

const isCommandEvent = (event: AnyCoworkEvent): event is CommandEvent => 
  event.type === 'cowork.command';

const isFileEvent = (event: AnyCoworkEvent): event is FileEvent => 
  event.type === 'cowork.file';

const isObservationEvent = (event: AnyCoworkEvent): event is ObservationEvent => 
  event.type === 'cowork.observation';

const isCheckpointEvent = (event: AnyCoworkEvent): event is CheckpointEvent => 
  event.type === 'cowork.checkpoint';

const isToolCallEvent = (event: AnyCoworkEvent): event is ToolCallEvent => 
  event.type === 'cowork.tool_call';

const isToolResultEvent = (event: AnyCoworkEvent): event is ToolResultEvent => 
  event.type === 'cowork.tool_result';

// ============================================================================
// Action Block (click, type, scroll)
// ============================================================================

const ActionBlock = memo(function ActionBlock({ event, isExpanded, onToggle }: BlockComponentProps) {
  if (!isActionEvent(event)) {
    console.warn('[CoworkWorkBlock] Expected action event, got:', event.type);
    return null;
  }
  
  return (
    <div 
      onClick={onToggle}
      className={cn(
        "group flex items-center gap-3 p-3 rounded-lg cursor-pointer",
        "bg-[#1e1e1e] border border-white/5 hover:border-white/10",
        "transition-all duration-200"
      )}
    >
      <div className="w-8 h-8 rounded-md bg-green-500/10 flex items-center justify-center shrink-0">
        <MousePointerClick className="w-4 h-4 text-green-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white/80">
            {event.actionType === 'click' ? 'Clicked' :
             event.actionType === 'type' ? 'Typed' :
             event.actionType === 'scroll' ? 'Scrolled' : 'Action'}
          </span>
          <span className="text-xs text-white/40">
            {event.target?.type === 'coordinates' ? 'at position' : 
             event.target?.type === 'selector' ? 'on element' : ''}
          </span>
        </div>
        {isExpanded && (
          <div className="mt-2 text-xs text-white/50 font-mono bg-black/20 p-2 rounded">
            {JSON.stringify(event.args, null, 2)}
          </div>
        )}
      </div>
      {isExpanded ? (
        <CaretUp className="w-4 h-4 text-white/30" />
      ) : (
        <CaretDown className="w-4 h-4 text-white/30" />
      )}
    </div>
  );
});

// ============================================================================
// Command Block (terminal commands)
// ============================================================================

const CommandBlock = memo(function CommandBlock({ event, isExpanded, onToggle }: BlockComponentProps) {
  if (!isCommandEvent(event)) {
    console.warn('[CoworkWorkBlock] Expected command event, got:', event.type);
    return null;
  }
  
  const commands = event.commands;
  
  return (
    <div 
      className={cn(
        "bg-[#1e1e1e] border border-white/5 rounded-lg overflow-hidden",
        "transition-all duration-200"
      )}
    >
      <div 
        onClick={onToggle}
        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-white/5"
      >
        <div className="w-8 h-8 rounded-md bg-blue-500/10 flex items-center justify-center shrink-0">
          <Terminal className="w-4 h-4 text-blue-400" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-white/80">
            Ran {commands.length} command{commands.length > 1 ? 's' : ''}
          </span>
        </div>
        {isExpanded ? (
          <CaretUp className="w-4 h-4 text-white/30" />
        ) : (
          <CaretDown className="w-4 h-4 text-white/30" />
        )}
      </div>
      
      {isExpanded && (
        <div className="px-3 pb-3">
          <div className="bg-black/30 rounded-md p-3 font-mono text-xs text-white/70 space-y-1">
            {commands.map((cmd: string, i: number) => (
              <div key={i} className="flex items-start gap-2">
                <span className="text-green-500">$</span>
                <span>{cmd}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

// ============================================================================
// File Block (read/edit files)
// ============================================================================

const FileBlock = memo(function FileBlock({ event, isExpanded, onToggle }: BlockComponentProps) {
  if (!isFileEvent(event)) {
    console.warn('[CoworkWorkBlock] Expected file event, got:', event.type);
    return null;
  }
  
  const files = event.files;
  const operation = event.operation;
  
  const operationConfig = {
    read: { icon: Eye, color: 'text-purple-400', bg: 'bg-purple-500/10' },
    edit: { icon: Code, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
    create: { icon: FileText, color: 'text-green-400', bg: 'bg-green-500/10' },
    delete: { icon: FileText, color: 'text-red-400', bg: 'bg-red-500/10' },
  };
  
  const config = operationConfig[operation] || operationConfig.read;
  const Icon = config.icon;
  
  return (
    <div 
      className={cn(
        "bg-[#1e1e1e] border border-white/5 rounded-lg overflow-hidden",
        "transition-all duration-200"
      )}
    >
      <div 
        onClick={onToggle}
        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-white/5"
      >
        <div className={cn("w-8 h-8 rounded-md flex items-center justify-center shrink-0", config.bg)}>
          <Icon className={cn("w-4 h-4", config.color)} />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-white/80">
            {operation === 'read' ? 'Read' : 
             operation === 'edit' ? 'Edited' :
             operation === 'create' ? 'Created' : 'Deleted'} {files.length} file{files.length > 1 ? 's' : ''}
          </span>
        </div>
        {isExpanded ? (
          <CaretUp className="w-4 h-4 text-white/30" />
        ) : (
          <CaretDown className="w-4 h-4 text-white/30" />
        )}
      </div>
      
      {isExpanded && (
        <div className="px-3 pb-3">
          <div className="space-y-1">
            {files.map((file, i: number) => (
              <div key={i} className="flex items-center gap-2 text-xs text-white/60">
                <FileText className="w-3.5 h-3.5 text-white/30" />
                <span className="font-mono">{file.path || file.name}</span>
                {file.changes !== undefined && (
                  <span className="text-white/30">({file.changes} changes)</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

// ============================================================================
// Observation Block (screenshots)
// ============================================================================

const ObservationBlock = memo(function ObservationBlock({ event, isExpanded, onToggle }: BlockComponentProps) {
  if (!isObservationEvent(event)) {
    console.warn('[CoworkWorkBlock] Expected observation event, got:', event.type);
    return null;
  }
  
  return (
    <div 
      className={cn(
        "bg-[#1e1e1e] border border-white/5 rounded-lg overflow-hidden",
        "transition-all duration-200"
      )}
    >
      <div 
        onClick={onToggle}
        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-white/5"
      >
        <div className="w-8 h-8 rounded-md bg-cyan-500/10 flex items-center justify-center shrink-0">
          <Camera className="w-4 h-4 text-cyan-400" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-white/80">Viewed page</span>
          {event.metadata?.url && (
            <span className="text-xs text-white/40 ml-2 truncate">
              {new URL(event.metadata.url).hostname}
            </span>
          )}
        </div>
        {isExpanded ? (
          <CaretUp className="w-4 h-4 text-white/30" />
        ) : (
          <CaretDown className="w-4 h-4 text-white/30" />
        )}
      </div>
      
      {isExpanded && event.imageRef && (
        <div className="px-3 pb-3">
          <img 
            src={event.imageRef} 
            alt="Observation"
            className="w-full rounded-md border border-white/10"
          />
        </div>
      )}
    </div>
  );
});

// ============================================================================
// Checkpoint Block
// ============================================================================

interface CheckpointBlockProps {
  event: AnyCoworkEvent;
}

const CheckpointBlock = memo(function CheckpointBlock({ event }: CheckpointBlockProps) {
  if (!isCheckpointEvent(event)) {
    console.warn('[CoworkWorkBlock] Expected checkpoint event, got:', event.type);
    return null;
  }
  
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-[#1e1e1e] border border-purple-500/20">
      <div className="w-8 h-8 rounded-md bg-purple-500/10 flex items-center justify-center shrink-0">
        <Flag className="w-4 h-4 text-purple-400" />
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-white/80">Checkpoint saved</span>
        <span className="text-xs text-white/40 ml-2">{event.label}</span>
      </div>
    </div>
  );
});

// ============================================================================
// Tool Block (tool calls/results)
// ============================================================================

const ToolBlock = memo(function ToolBlock({ event, isExpanded, onToggle }: BlockComponentProps) {
  const toolEvent = isToolCallEvent(event) 
    ? event 
    : isToolResultEvent(event) 
      ? event 
      : null;
      
  if (!toolEvent) {
    console.warn('[CoworkWorkBlock] Expected tool call or result event, got:', event.type);
    return null;
  }
  
  const toolName = isToolCallEvent(event) ? event.toolName : 'tool';
  const toolData = isToolCallEvent(event) ? event.args : (event as ToolResultEvent).result;
  
  return (
    <div 
      className={cn(
        "bg-[#1e1e1e] border border-white/5 rounded-lg overflow-hidden",
        "transition-all duration-200"
      )}
    >
      <div 
        onClick={onToggle}
        className="flex items-center gap-3 p-3 cursor-pointer hover:bg-white/5"
      >
        <div className="w-8 h-8 rounded-md bg-orange-500/10 flex items-center justify-center shrink-0">
          <Code className="w-4 h-4 text-orange-400" />
        </div>
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-white/80">
            Used tool: {toolName}
          </span>
        </div>
        {isExpanded ? (
          <CaretUp className="w-4 h-4 text-white/30" />
        ) : (
          <CaretDown className="w-4 h-4 text-white/30" />
        )}
      </div>
      
      {isExpanded && (
        <div className="px-3 pb-3">
          <div className="bg-black/30 rounded-md p-3 font-mono text-xs text-white/60">
            {JSON.stringify(toolData, null, 2)}
          </div>
        </div>
      )}
    </div>
  );
});

// ============================================================================
// Main Work Block Dispatcher
// ============================================================================

export const CoworkWorkBlock = memo(function CoworkWorkBlock({ event, isStreaming }: WorkBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const toggle = () => setIsExpanded(!isExpanded);
  
  switch (event.type) {
    case 'cowork.action':
      return <ActionBlock event={event} isExpanded={isExpanded} onToggle={toggle} />;
    case 'cowork.command':
      return <CommandBlock event={event} isExpanded={isExpanded} onToggle={toggle} />;
    case 'cowork.file':
      return <FileBlock event={event} isExpanded={isExpanded} onToggle={toggle} />;
    case 'cowork.observation':
      return <ObservationBlock event={event} isExpanded={isExpanded} onToggle={toggle} />;
    case 'cowork.checkpoint':
      return <CheckpointBlock event={event} />;
    case 'cowork.tool_call':
    case 'cowork.tool_result':
      return <ToolBlock event={event} isExpanded={isExpanded} onToggle={toggle} />;
    default:
      return null;
  }
});

export default CoworkWorkBlock;
