/**
 * CoworkControls - Control bar for Cowork mode
 * Pause/Resume, Step, Stop, Approve/Reject, Takeover
 */

import React, { memo } from 'react';
import { cn } from '@/lib/utils';
import { useCoworkStore } from './CoworkStore';
import type { CoworkSessionStatus } from './cowork.types';
import {
  Pause,
  Play,
  SkipForward as StepForward,
  Square,
  Hand,
  CheckCircle,
  XCircle,
  ArrowCounterClockwise,
  Flag,
  Clock,
  Pulse as Activity,
} from '@phosphor-icons/react';

// ============================================================================
// Status Badge
// ============================================================================

const StatusBadge = memo(function StatusBadge({ status }: { status: CoworkSessionStatus }) {
  const configs: Record<CoworkSessionStatus, { color: string; icon: React.ReactNode; label: string }> = {
    idle: { color: 'bg-gray-500/20 text-gray-400', icon: <Clock size={12} />, label: 'Idle' },
    running: { color: 'bg-green-500/20 text-green-400', icon: <Activity size={12} />, label: 'Running' },
    paused: { color: 'bg-yellow-500/20 text-yellow-400', icon: <Pause size={12} />, label: 'Paused' },
    waiting_approval: { color: 'bg-orange-500/20 text-orange-400', icon: <CheckCircle size={12} />, label: 'Approval Needed' },
    takeover: { color: 'bg-purple-500/20 text-purple-400', icon: <Hand size={12} />, label: 'Takeover' },
    completed: { color: 'bg-blue-500/20 text-blue-400', icon: <Flag size={12} />, label: 'Completed' },
    error: { color: 'bg-red-500/20 text-red-400', icon: <XCircle size={12} />, label: 'Error' },
  };
  
  const config = configs[status];
  
  return (
    <div className={cn("flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium", config.color)}>
      {config.icon}
      {config.label}
    </div>
  );
});

// ============================================================================
// Control Button
// ============================================================================

interface ControlButtonProps {
  onClick: () => void;
  disabled?: boolean;
  variant?: 'default' | 'primary' | 'danger' | 'success';
  size?: 'sm' | 'md';
  children: React.ReactNode;
  title?: string;
}

const ControlButton = memo(function ControlButton({
  onClick,
  disabled,
  variant = 'default',
  size = 'md',
  children,
  title,
}: ControlButtonProps) {
  const variants = {
    default: 'bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80',
    primary: 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30',
    danger: 'bg-red-500/20 text-red-400 hover:bg-red-500/30',
    success: 'bg-green-500/20 text-green-400 hover:bg-green-500/30',
  };
  
  const sizes = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
  };
  
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "flex items-center gap-1.5 rounded-md font-medium transition-colors",
        variants[variant],
        sizes[size],
        disabled && "opacity-40 cursor-not-allowed"
      )}
    >
      {children}
    </button>
  );
});

// ============================================================================
// Approval Queue
// ============================================================================

const ApprovalQueue = memo(function ApprovalQueue() {
  const { session, sendControl } = useCoworkStore();
  
  if (!session || session.pendingApprovals.length === 0) {
    return null;
  }
  
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-white/40">Pending:</span>
      {session.pendingApprovals.map((approval) => (
        <div 
          key={approval.actionId}
          className="flex items-center gap-1 px-2 py-1 rounded-md bg-orange-500/10 border border-orange-500/20"
        >
          <span className="text-xs text-white/70 truncate max-w-[120px]">{approval.summary}</span>
          <button
            onClick={() => sendControl({ type: 'approve', actionId: approval.actionId })}
            className="p-0.5 rounded hover:bg-green-500/20 text-green-400"
            title="Approve"
          >
            <CheckCircle className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => sendControl({ type: 'reject', actionId: approval.actionId })}
            className="p-0.5 rounded hover:bg-red-500/20 text-red-400"
            title="Reject"
          >
            <XCircle className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
});

// ============================================================================
// Main Controls Component
// ============================================================================

export const CoworkControls = memo(function CoworkControls() {
  const { session, sendControl } = useCoworkStore();
  
  if (!session) {
    return (
      <div className="h-14 flex items-center justify-between px-4 bg-[#161616] border-b border-white/5">
        <StatusBadge status="idle" />
        <span className="text-xs text-white/30">Start a session to see controls</span>
      </div>
    );
  }
  
  const { status, takeover, pendingApprovals, metrics } = session;
  
  const isRunning = status === 'running';
  const isPaused = status === 'paused';
  const isWaitingApproval = status === 'waiting_approval';
  const isTakeover = status === 'takeover';
  
  return (
    <div className="bg-[#161616] border-b border-white/5">
      {/* Main controls row */}
      <div className="h-14 flex items-center justify-between px-4">
        {/* Left: Status and playback controls */}
        <div className="flex items-center gap-3">
          <StatusBadge status={status} />
          
          <div className="w-px h-6 bg-white/10" />
          
          {/* Playback controls */}
          <div className="flex items-center gap-1">
            {isRunning ? (
              <ControlButton
                onClick={() => sendControl({ type: 'pause' })}
                variant="default"
                size="sm"
                title="Pause execution"
              >
                <Pause size={16} />
                Pause
              </ControlButton>
            ) : (
              <ControlButton
                onClick={() => sendControl({ type: 'resume' })}
                variant="primary"
                size="sm"
                disabled={isWaitingApproval || isTakeover}
                title="Resume execution"
              >
                <Play size={16} />
                Resume
              </ControlButton>
            )}
            
            <ControlButton
              onClick={() => sendControl({ type: 'step' })}
              variant="default"
              size="sm"
              disabled={isRunning || isWaitingApproval || isTakeover}
              title="Execute one action then pause"
            >
              <StepForward size={16} />
              Step
            </ControlButton>
            
            <ControlButton
              onClick={() => sendControl({ type: 'stop' })}
              variant="danger"
              size="sm"
              title="Stop and end session"
            >
              <Square size={16} />
              Stop
            </ControlButton>
          </div>
        </div>
        
        {/* Center: Pending approvals */}
        <div className="flex-1 flex justify-center">
          <ApprovalQueue />
        </div>
        
        {/* Right: Takeover and metrics */}
        <div className="flex items-center gap-3">
          {/* Takeover button */}
          {isTakeover ? (
            <ControlButton
              onClick={() => sendControl({ type: 'release_takeover' })}
              variant="primary"
              size="sm"
              title="Release control back to agent"
            >
              <Hand size={16} />
              Release
            </ControlButton>
          ) : (
            <ControlButton
              onClick={() => sendControl({ type: 'takeover' })}
              variant="default"
              size="sm"
              disabled={isRunning}
              title="Take manual control"
            >
              <Hand size={16} />
              Takeover
            </ControlButton>
          )}
          
          <div className="w-px h-6 bg-white/10" />
          
          {/* Metrics */}
          <div className="flex items-center gap-3 text-xs text-white/40">
            <span className="flex items-center gap-1">
              <Activity className="w-3.5 h-3.5" />
              {metrics.actionsExecuted}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {Math.floor(metrics.timeRunning / 60)}:{String(metrics.timeRunning % 60).padStart(2, '0')}
            </span>
          </div>
        </div>
      </div>
      
      {/* Approval banner (shown when waiting) */}
      {isWaitingApproval && pendingApprovals.length > 0 && (
        <div className="px-4 py-3 bg-orange-500/10 border-t border-orange-500/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center">
                <CheckCircle className="w-4 h-4 text-orange-400" />
              </div>
              <div>
                <div className="text-sm font-medium text-white/80">
                  Approval Required: {pendingApprovals[0]?.summary}
                </div>
                <div className="text-xs text-white/50">
                  {pendingApprovals[0]?.details?.consequence}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const firstApproval = pendingApprovals[0];
                  if (!firstApproval) return;
                  sendControl({ 
                    type: 'reject', 
                    actionId: firstApproval.actionId,
                    note: 'User rejected'
                  });
                }}
                className="px-4 py-2 rounded-md bg-white/5 text-white/60 hover:bg-white/10 font-medium text-sm transition-colors"
              >
                Reject
              </button>
              <button
                onClick={() => {
                  const firstApproval = pendingApprovals[0];
                  if (!firstApproval) return;
                  sendControl({ 
                    type: 'approve', 
                    actionId: firstApproval.actionId 
                  });
                }}
                className="px-4 py-2 rounded-md bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 font-medium text-sm transition-colors"
              >
                Approve
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Takeover banner */}
      {isTakeover && (
        <div className="px-4 py-3 bg-purple-500/10 border-t border-purple-500/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                <Hand className="w-4 h-4 text-purple-400" />
              </div>
              <div>
                <div className="text-sm font-medium text-white/80">
                  Manual Takeover Active
                </div>
                <div className="text-xs text-white/50">
                  You have control. Click "Release" when ready to return to agent.
                </div>
              </div>
            </div>
            <button
              onClick={() => sendControl({ type: 'release_takeover' })}
              className="px-4 py-2 rounded-md bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 font-medium text-sm transition-colors"
            >
              Release Control
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

export default CoworkControls;
