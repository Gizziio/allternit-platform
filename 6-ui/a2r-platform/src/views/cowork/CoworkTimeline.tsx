/**
 * CoworkTimeline - Timeline component for Cowork mode events
 * Shows structured events (observations, actions, approvals, checkpoints)
 */

import React, { memo, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import type {
  AnyCoworkEvent,
  ObservationEvent,
  ActionEvent,
  ApprovalRequestEvent,
  CheckpointEvent,
  NarrationEvent,
} from './cowork.types';
import { useCoworkStore } from './CoworkStore';
import {
  Camera,
  MousePointerClick,
  Keyboard,
  CheckCircle,
  XCircle,
  Flag,
  MessageSquare,
  Pause,
  Play,
  AlertCircle,
  Clock,
} from 'lucide-react';

// ============================================================================
// Event Icons
// ============================================================================

const EventIcon = memo(function EventIcon({ type }: { type: AnyCoworkEvent['type'] }) {
  const iconClass = "w-4 h-4";
  
  switch (type) {
    case 'cowork.observation':
      return <Camera className={cn(iconClass, "text-blue-400")} />;
    case 'cowork.action':
      return <MousePointerClick className={cn(iconClass, "text-green-400")} />;
    case 'cowork.approval_request':
      return <AlertCircle className={cn(iconClass, "text-yellow-400")} />;
    case 'cowork.approval_result':
      return <CheckCircle className={cn(iconClass, "text-green-400")} />;
    case 'cowork.checkpoint':
      return <Flag className={cn(iconClass, "text-purple-400")} />;
    case 'cowork.narration':
      return <MessageSquare className={cn(iconClass, "text-gray-400")} />;
    case 'cowork.takeover':
      return <Keyboard className={cn(iconClass, "text-orange-400")} />;
    default:
      return <Clock className={cn(iconClass, "text-gray-500")} />;
  }
});

// ============================================================================
// Event Row Components
// ============================================================================

const ObservationRow = memo(function ObservationRow({ 
  event, 
  isSelected,
  onClick 
}: { 
  event: ObservationEvent; 
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "group flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all",
        isSelected ? "bg-white/10" : "hover:bg-white/5"
      )}
    >
      <div className="mt-0.5">
        <EventIcon type="cowork.observation" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white/80">Observation</span>
          <span className="text-xs text-white/40">
            {event.metadata.width}×{event.metadata.height}
          </span>
        </div>
        {event.metadata.url && (
          <div className="text-xs text-white/30 truncate">{event.metadata.url}</div>
        )}
        {event.labels && event.labels.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {event.labels.slice(0, 3).map(label => (
              <span 
                key={label.id}
                className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300"
              >
                {label.text}
              </span>
            ))}
            {event.labels.length > 3 && (
              <span className="text-[10px] text-white/30">+{event.labels.length - 3}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

const ActionRow = memo(function ActionRow({ 
  event, 
  isSelected,
  onClick 
}: { 
  event: ActionEvent; 
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "group flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all",
        isSelected ? "bg-white/10" : "hover:bg-white/5"
      )}
    >
      <div className="mt-0.5">
        <EventIcon type="cowork.action" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white/80 capitalize">
            {event.actionType}
          </span>
          <span className="text-[10px] text-white/30 uppercase">
            {event.target?.type}
          </span>
        </div>
        <div className="text-sm text-white/60">{event.humanReadable}</div>
        {event.args && (
          <div className="mt-1 text-xs text-white/30 font-mono truncate">
            {JSON.stringify(event.args)}
          </div>
        )}
      </div>
    </div>
  );
});

const ApprovalRow = memo(function ApprovalRow({ 
  event, 
  isSelected,
  onClick,
  onApprove,
  onReject,
}: { 
  event: ApprovalRequestEvent; 
  isSelected: boolean;
  onClick: () => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  const riskColors = {
    low: 'text-green-400 bg-green-400/10',
    medium: 'text-yellow-400 bg-yellow-400/10',
    high: 'text-orange-400 bg-orange-400/10',
    critical: 'text-red-400 bg-red-400/10',
  };
  
  return (
    <div
      onClick={onClick}
      className={cn(
        "group flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all border",
        isSelected ? "bg-white/10 border-white/20" : "hover:bg-white/5 border-transparent",
        "border-l-4",
        event.riskLevel === 'critical' ? 'border-l-red-400' :
        event.riskLevel === 'high' ? 'border-l-orange-400' :
        event.riskLevel === 'medium' ? 'border-l-yellow-400' : 'border-l-green-400'
      )}
    >
      <div className="mt-0.5">
        <EventIcon type="cowork.approval_request" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white/80">Approval Required</span>
          <span className={cn("text-[10px] px-1.5 py-0.5 rounded uppercase font-bold", riskColors[event.riskLevel])}>
            {event.riskLevel}
          </span>
        </div>
        <div className="text-sm text-white/60">{event.summary}</div>
        <div className="mt-1 text-xs text-white/40">{event.details.consequence}</div>
        
        {/* Approval buttons */}
        <div className="mt-3 flex gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); onApprove(); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors"
          >
            <CheckCircle className="w-3.5 h-3.5" />
            Approve
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onReject(); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
          >
            <XCircle className="w-3.5 h-3.5" />
            Reject
          </button>
        </div>
      </div>
    </div>
  );
});

const CheckpointRow = memo(function CheckpointRow({ 
  event, 
  isSelected,
  onClick,
  onRestore,
}: { 
  event: CheckpointEvent; 
  isSelected: boolean;
  onClick: () => void;
  onRestore: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "group flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all",
        isSelected ? "bg-white/10" : "hover:bg-white/5"
      )}
    >
      <div className="mt-0.5">
        <EventIcon type="cowork.checkpoint" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white/80">Checkpoint</span>
          <span className="text-[10px] text-white/30 font-mono">{event.checkpointId}</span>
        </div>
        <div className="text-sm text-white/60">{event.label}</div>
        <button
          onClick={(e) => { e.stopPropagation(); onRestore(); }}
          className="mt-2 text-xs text-purple-400 hover:text-purple-300 underline"
        >
          Restore to this point
        </button>
      </div>
    </div>
  );
});

const NarrationRow = memo(function NarrationRow({ 
  event, 
  isSelected,
  onClick 
}: { 
  event: NarrationEvent; 
  isSelected: boolean;
  onClick: () => void;
}) {
  const styleColors = {
    thinking: 'text-gray-300 italic',
    action: 'text-green-300',
    result: 'text-blue-300',
    question: 'text-yellow-300',
  };
  
  return (
    <div
      onClick={onClick}
      className={cn(
        "group flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all",
        isSelected ? "bg-white/10" : "hover:bg-white/5"
      )}
    >
      <div className="mt-0.5">
        <EventIcon type="cowork.narration" />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm", styleColors[event.style])}>{event.text}</p>
      </div>
    </div>
  );
});

// ============================================================================
// Timeline Component
// ============================================================================

export const CoworkTimeline = memo(function CoworkTimeline() {
  const { 
    session, 
    selectedEventId, 
    selectEvent, 
    sendControl,
    isTimelineExpanded,
    toggleTimeline,
  } = useCoworkStore();
  
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to bottom on new events
  useEffect(() => {
    if (scrollRef.current && isTimelineExpanded) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [session?.events, isTimelineExpanded]);
  
  if (!session) {
    return (
      <div className="h-full flex items-center justify-center text-white/30 text-sm">
        No active session
      </div>
    );
  }
  
  const { events, pendingApprovals, checkpoints } = session;
  
  const renderEvent = (event: AnyCoworkEvent) => {
    const isSelected = selectedEventId === event.id;
    const onClick = () => selectEvent(event.id);
    
    switch (event.type) {
      case 'cowork.observation':
        return (
          <ObservationRow
            key={event.id}
            event={event as ObservationEvent}
            isSelected={isSelected}
            onClick={onClick}
          />
        );
      case 'cowork.action':
        return (
          <ActionRow
            key={event.id}
            event={event as ActionEvent}
            isSelected={isSelected}
            onClick={onClick}
          />
        );
      case 'cowork.approval_request':
        return (
          <ApprovalRow
            key={event.id}
            event={event as ApprovalRequestEvent}
            isSelected={isSelected}
            onClick={onClick}
            onApprove={() => sendControl({ type: 'approve', actionId: (event as ApprovalRequestEvent).actionId })}
            onReject={() => sendControl({ type: 'reject', actionId: (event as ApprovalRequestEvent).actionId })}
          />
        );
      case 'cowork.checkpoint':
        return (
          <CheckpointRow
            key={event.id}
            event={event as CheckpointEvent}
            isSelected={isSelected}
            onClick={onClick}
            onRestore={() => sendControl({ type: 'restore', checkpointId: (event as CheckpointEvent).checkpointId })}
          />
        );
      case 'cowork.narration':
        return (
          <NarrationRow
            key={event.id}
            event={event as NarrationEvent}
            isSelected={isSelected}
            onClick={onClick}
          />
        );
      default:
        return null;
    }
  };
  
  return (
    <div className="h-full flex flex-col bg-[#1a1a1a]">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-white/50">Timeline</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-white/40">
            {events.length} events
          </span>
        </div>
        <div className="flex items-center gap-1">
          {pendingApprovals.length > 0 && (
            <span className="text-[10px] px-2 py-1 rounded-full bg-yellow-500/20 text-yellow-400">
              {pendingApprovals.length} pending
            </span>
          )}
          <button
            onClick={toggleTimeline}
            className="p-1.5 rounded-md hover:bg-white/10 text-white/40 hover:text-white/60"
          >
            {isTimelineExpanded ? (
              <Pause className="w-3.5 h-3.5" />
            ) : (
              <Play className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>
      
      {/* Events list */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-2 space-y-1"
      >
        {events.map(renderEvent)}
        
        {events.length === 0 && (
          <div className="p-8 text-center">
            <p className="text-white/20 text-sm">Waiting for events...</p>
            <p className="text-white/10 text-xs mt-2">
              Events will appear here from the agent backend
            </p>
          </div>
        )}
      </div>
      
      {/* Footer stats */}
      <div className="p-2 border-t border-white/5 text-[10px] text-white/30 flex justify-between">
        <span>{checkpoints.length} checkpoints</span>
        <span>{session.metrics.actionsExecuted} actions</span>
      </div>
    </div>
  );
});

export default CoworkTimeline;
