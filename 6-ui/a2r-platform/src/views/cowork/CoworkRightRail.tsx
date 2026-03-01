/**
 * CoworkRightRail - Right side panel for Cowork mode
 * Shows real session data only when it exists
 */

import React, { memo } from 'react';
import { cn } from '@/lib/utils';
import { useCoworkStore } from './CoworkStore';
import {
  FileText,
  Folder,
  Clock,
  Activity,
  Terminal,
  Zap,
  MessageSquare,
  Target,
  Cpu
} from 'lucide-react';

// ============================================================================
// Real Data Cards - Only render when data exists
// ============================================================================

const MessagesCard = memo(function MessagesCard() {
  const { session } = useCoworkStore();
  if (!session) return null;
  
  const messages = session.events.filter(e => e.type === 'cowork.narration');
  if (messages.length === 0) return null;
  
  const latestMessages = messages.slice(-3);
  
  return (
    <div className="p-4 border-b border-white/5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-white/40" />
          <span className="text-xs font-semibold uppercase tracking-wider text-white/50">Messages</span>
        </div>
        <span className="text-[10px] text-white/30">{messages.length}</span>
      </div>
      
      <div className="space-y-2">
        {latestMessages.map((msg) => {
          const isUser = (msg as any).role === 'user';
          const text = (msg as any).text || '';
          return (
            <div key={msg.id} className="flex items-start gap-2 text-xs">
              <div className={cn(
                "w-1.5 h-1.5 rounded-full mt-1 shrink-0",
                isUser ? "bg-blue-400" : "bg-green-400"
              )} />
              <span className="text-white/60 line-clamp-2">{text.slice(0, 50)}{text.length > 50 ? '...' : ''}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
});

const CommandsCard = memo(function CommandsCard() {
  const { session } = useCoworkStore();
  if (!session) return null;
  
  const commands = session.events.filter(e => e.type === 'cowork.command');
  if (commands.length === 0) return null;
  
  const latestCommands = commands.slice(-3);
  
  return (
    <div className="p-4 border-b border-white/5">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-white/40" />
          <span className="text-xs font-semibold uppercase tracking-wider text-white/50">Commands</span>
        </div>
        <span className="text-[10px] text-white/30">{commands.length}</span>
      </div>
      
      <div className="space-y-1">
        {latestCommands.map((cmd) => (
          <div key={cmd.id} className="flex items-center gap-2 text-xs font-mono">
            <span className="text-green-500">$</span>
            <span className="text-white/50 truncate">{((cmd as any).command || '').slice(0, 35)}</span>
          </div>
        ))}
      </div>
    </div>
  );
});

const FilesCard = memo(function FilesCard() {
  const { session } = useCoworkStore();
  if (!session) return null;
  
  const fileEvents = session.events.filter(e => e.type === 'cowork.file');
  if (fileEvents.length === 0) return null;
  
  const uniqueFiles = new Map();
  fileEvents.forEach(event => {
    const files = (event as any).files || [event];
    files.forEach((file: any) => {
      if (file.path || file.name) {
        uniqueFiles.set(file.path || file.name, file);
      }
    });
  });
  
  const files = Array.from(uniqueFiles.values()).slice(0, 5);
  
  return (
    <div className="p-4 border-b border-white/5">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Folder className="w-4 h-4 text-white/40" />
          <span className="text-xs font-semibold uppercase tracking-wider text-white/50">Files</span>
        </div>
        <span className="text-[10px] text-white/30">{uniqueFiles.size}</span>
      </div>
      
      <div className="space-y-1">
        {files.map((file: any, idx: number) => (
          <div key={idx} className="flex items-center gap-2 text-xs text-white/60">
            <FileText className="w-3.5 h-3.5 text-white/30" />
            <span className="truncate">{file.path || file.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
});

const ActionsCard = memo(function ActionsCard() {
  const { session } = useCoworkStore();
  if (!session) return null;
  
  const actions = session.events.filter(e => e.type === 'cowork.action');
  if (actions.length === 0) return null;
  
  const latestActions = actions.slice(-3);
  
  return (
    <div className="p-4 border-b border-white/5">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-white/40" />
          <span className="text-xs font-semibold uppercase tracking-wider text-white/50">Actions</span>
        </div>
        <span className="text-[10px] text-white/30">{actions.length}</span>
      </div>
      
      <div className="space-y-1">
        {latestActions.map((action) => (
          <div key={action.id} className="flex items-center gap-2 text-xs text-white/60">
            <span className="text-white/30">•</span>
            <span className="capitalize">{(action as any).actionType || 'action'}</span>
          </div>
        ))}
      </div>
    </div>
  );
});

// ============================================================================
// Session Summary - Always shown when session exists
// ============================================================================

const SessionSummary = memo(function SessionSummary() {
  const { session } = useCoworkStore();
  if (!session) return null;
  
  const startEvent = session.events.find(e => e.type === 'cowork.session.start');
  const task = (startEvent as any)?.context?.task || 'Working session';
  const elapsed = Math.floor((Date.now() - session.events[0]?.timestamp) / 1000 / 60);
  
  const messageCount = session.events.filter(e => e.type === 'cowork.narration').length;
  const commandCount = session.events.filter(e => e.type === 'cowork.command').length;
  const actionCount = session.events.filter(e => e.type === 'cowork.action').length;
  const fileCount = session.events.filter(e => e.type === 'cowork.file').length;
  
  const hasAnyActivity = messageCount > 0 || commandCount > 0 || actionCount > 0 || fileCount > 0;
  
  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <Clock className="w-4 h-4 text-white/40" />
        <span className="text-xs font-semibold uppercase tracking-wider text-white/50">Session</span>
      </div>
      
      <p className="text-sm text-white/70 line-clamp-2 mb-3">{task}</p>
      
      {hasAnyActivity ? (
        <div className="grid grid-cols-2 gap-2 mb-3">
          {messageCount > 0 && (
            <div className="bg-white/5 rounded px-2 py-1.5 text-center">
              <div className="text-lg font-semibold text-white/80">{messageCount}</div>
              <div className="text-[10px] text-white/40 uppercase">Msgs</div>
            </div>
          )}
          {commandCount > 0 && (
            <div className="bg-white/5 rounded px-2 py-1.5 text-center">
              <div className="text-lg font-semibold text-white/80">{commandCount}</div>
              <div className="text-[10px] text-white/40 uppercase">Cmds</div>
            </div>
          )}
          {actionCount > 0 && (
            <div className="bg-white/5 rounded px-2 py-1.5 text-center">
              <div className="text-lg font-semibold text-white/80">{actionCount}</div>
              <div className="text-[10px] text-white/40 uppercase">Acts</div>
            </div>
          )}
          {fileCount > 0 && (
            <div className="bg-white/5 rounded px-2 py-1.5 text-center">
              <div className="text-lg font-semibold text-white/80">{fileCount}</div>
              <div className="text-[10px] text-white/40 uppercase">Files</div>
            </div>
          )}
        </div>
      ) : (
        <p className="text-xs text-white/30 mb-3">Session started, waiting for activity...</p>
      )}
      
      <div className="flex items-center gap-1 text-xs text-white/40">
        <span>{elapsed}m elapsed</span>
        <span className="mx-1">•</span>
        <span className={cn(
          "capitalize",
          session.status === 'running' ? 'text-green-400' :
          session.status === 'paused' ? 'text-yellow-400' :
          session.status === 'waiting_approval' ? 'text-orange-400' :
          'text-white/50'
        )}>
          {session.status}
        </span>
      </div>
    </div>
  );
});

// ============================================================================
// Main Right Rail
// ============================================================================

export const CoworkRightRail = memo(function CoworkRightRail() {
  const { session } = useCoworkStore();
  
  if (!session) return null;
  
  return (
    <div className="h-full flex flex-col overflow-hidden text-[var(--text-primary,#ececec)]">
      {/* Header */}
      <div className="p-4 border-b border-white/5">
        <h3 className="text-sm font-semibold text-white/80">Session Activity</h3>
      </div>
      
      {/* Data Cards - only render when they have data */}
      <div className="flex-1 overflow-y-auto">
        <MessagesCard />
        <CommandsCard />
        <ActionsCard />
        <FilesCard />
        <SessionSummary />
      </div>
    </div>
  );
});

export default CoworkRightRail;
