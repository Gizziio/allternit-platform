/**
 * CoworkStatusBar - Minimal status bar for Cowork mode
 * Shows running/paused status with pause/step/stop controls
 */

import React, { memo } from 'react';
import { cn } from '@/lib/utils';
import { useCoworkStore } from './CoworkStore';
import {
  Pause,
  Play,
  StepForward,
  Square,
  Hand,
  Activity,
  Loader2,
  AlertCircle,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';

interface CoworkStatusBarProps {
  onToggleRail?: () => void;
  showRail?: boolean;
}

export const CoworkStatusBar = memo(function CoworkStatusBar({ 
  onToggleRail, 
  showRail = true 
}: CoworkStatusBarProps) {
  const { session, sendControl } = useCoworkStore();
  
  if (!session) return null;
  
  const { status, pendingApprovals } = session;
  
  const isRunning = status === 'running';
  const isPaused = status === 'paused';
  const isWaitingApproval = status === 'waiting_approval';
  const isTakeover = status === 'takeover';
  
  const statusConfig = {
    running: { 
      icon: <Activity className="w-3.5 h-3.5 animate-pulse" />, 
      color: 'text-green-400',
      bg: 'bg-green-500/10',
      label: 'Running'
    },
    paused: { 
      icon: <Pause className="w-3.5 h-3.5" />, 
      color: 'text-yellow-400',
      bg: 'bg-yellow-500/10',
      label: 'Paused'
    },
    waiting_approval: { 
      icon: <AlertCircle className="w-3.5 h-3.5" />, 
      color: 'text-orange-400',
      bg: 'bg-orange-500/10',
      label: 'Needs approval'
    },
    takeover: { 
      icon: <Hand className="w-3.5 h-3.5" />, 
      color: 'text-purple-400',
      bg: 'bg-purple-500/10',
      label: 'Manual control'
    },
    idle: { 
      icon: <Activity className="w-3.5 h-3.5" />, 
      color: 'text-white/40',
      bg: 'bg-white/5',
      label: 'Idle'
    },
    completed: { 
      icon: <Activity className="w-3.5 h-3.5" />, 
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
      label: 'Completed'
    },
    error: { 
      icon: <Activity className="w-3.5 h-3.5" />, 
      color: 'text-red-400',
      bg: 'bg-red-500/10',
      label: 'Error'
    },
  };
  
  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.idle;
  
  return (
    <div className="h-10 flex items-center justify-between px-4 border-b border-white/5 bg-[#161616]/30">
      {/* Left: Status */}
      <div className="flex items-center gap-3">
        <div className={cn(
          "flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium",
          config.bg,
          config.color
        )}>
          {config.icon}
          <span>{config.label}</span>
        </div>
        
        {pendingApprovals.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-orange-400">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>{pendingApprovals.length} pending</span>
          </div>
        )}
      </div>
      
      {/* Right: Controls */}
      <div className="flex items-center gap-1">
        {isRunning ? (
          <button
            onClick={() => sendControl({ type: 'pause' })}
            className="flex items-center gap-1.5 px-2 py-1 rounded text-xs text-white/60 hover:text-white/80 hover:bg-white/5 transition-colors"
            title="Pause execution"
          >
            <Pause className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Pause</span>
          </button>
        ) : (
          <button
            onClick={() => sendControl({ type: 'resume' })}
            disabled={isWaitingApproval || isTakeover}
            className="flex items-center gap-1.5 px-2 py-1 rounded text-xs text-green-400 hover:text-green-300 hover:bg-green-500/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Resume execution"
          >
            <Play className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Resume</span>
          </button>
        )}
        
        <button
          onClick={() => sendControl({ type: 'step' })}
          disabled={isRunning || isWaitingApproval || isTakeover}
          className="flex items-center gap-1.5 px-2 py-1 rounded text-xs text-white/60 hover:text-white/80 hover:bg-white/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          title="Execute one action"
        >
          <StepForward className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Step</span>
        </button>
        
        <div className="w-px h-4 bg-white/10 mx-1" />
        
        {isTakeover ? (
          <button
            onClick={() => sendControl({ type: 'release_takeover' })}
            className="flex items-center gap-1.5 px-2 py-1 rounded text-xs text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 transition-colors"
            title="Release control"
          >
            <Hand className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Release</span>
          </button>
        ) : (
          <button
            onClick={() => sendControl({ type: 'takeover' })}
            disabled={isRunning}
            className="flex items-center gap-1.5 px-2 py-1 rounded text-xs text-white/60 hover:text-white/80 hover:bg-white/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Take manual control"
          >
            <Hand className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Takeover</span>
          </button>
        )}
        
        <button
          onClick={() => sendControl({ type: 'stop' })}
          className="flex items-center gap-1.5 px-2 py-1 rounded text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
          title="Stop session"
        >
          <Square className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Stop</span>
        </button>
        
        {onToggleRail && (
          <>
            <div className="w-px h-4 bg-white/10 mx-1" />
            <button
              onClick={onToggleRail}
              className="flex items-center gap-1.5 px-2 py-1 rounded text-xs text-white/60 hover:text-white/80 hover:bg-white/5 transition-colors"
              title={showRail ? "Hide sidebar" : "Show sidebar"}
            >
              {showRail ? (
                <PanelLeftClose className="w-3.5 h-3.5" />
              ) : (
                <PanelLeftOpen className="w-3.5 h-3.5" />
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
});

export default CoworkStatusBar;
