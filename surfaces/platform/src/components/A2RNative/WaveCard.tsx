"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  Check,
  Circle,
  Pulse as Activity,
  ShieldCheck,
  Lightning,
} from '@phosphor-icons/react';
import { cn } from "@/lib/utils";

interface WaveCardProps {
  type: "plan" | "state";
  data: any;
  className?: string;
}

/**
 * WaveCard - Interactive inline card for A2R Native protocol updates
 */
export function WaveCard({ type, data, className }: WaveCardProps) {
  if (type === "plan") {
    return (
      <div className={cn("my-4 w-full max-w-md rounded-2xl border border-accent-primary/20 bg-accent-primary/5 p-4 backdrop-blur-sm", className)}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-accent-primary/20 text-accent-primary">
              <Lightning className="h-3.5 w-3.5" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-accent-primary">
              Execution Wave {data.wave || 1}
            </span>
          </div>
          <Badge variant="outline" className="h-4 text-[8px] border-accent-primary/30 text-accent-primary px-1.5">
            {data.phase || "Active"}
          </Badge>
        </div>

        <h4 className="text-sm font-semibold text-white/90 mb-3">{data.objective}</h4>

        <div className="space-y-3">
          {data.tasks?.map((task: any, idx: number) => {
            const isDone = task.status === "completed";
            const isPending = task.status === "pending";
            const isRunning = task.status === "in_progress";

            return (
              <div key={task.id || idx} className="flex items-start gap-3 group">
                <div className="flex flex-col items-center gap-1 mt-1">
                  <div className={cn(
                    "h-4 w-4 rounded-full border-2 flex items-center justify-center transition-all",
                    isDone ? "bg-accent-primary border-accent-primary" : 
                    isRunning ? "border-white animate-pulse shadow-[0_0_8px_rgba(255,255,255,0.5)]" : 
                    "border-white/20"
                  )}>
                    {isDone && <Check className="h-2.5 w-2.5 text-black" />}
                    {isRunning && <div className="h-1 w-1 bg-white rounded-full" />}
                  </div>
                  {idx < data.tasks.length - 1 && (
                    <div className={cn("w-px h-6", isDone ? "bg-accent-primary/30" : "bg-white/5")} />
                  )}
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className={cn(
                      "text-xs font-medium transition-colors",
                      isDone ? "text-white/40 line-through" : isRunning ? "text-white" : "text-white/60"
                    )}>
                      {task.name}
                    </span>
                    {task.verify && isDone && (
                      <ShieldCheck className="h-3 w-3 text-emerald-500/60" />
                    )}
                  </div>
                  {isRunning && task.action && (
                    <p className="text-[10px] text-accent-primary/60 mt-1 font-mono italic">
                      {task.action}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // State Update Card
  return (
    <div className={cn("my-4 w-full max-w-sm rounded-2xl border border-white/5 bg-white/[0.02] p-4", className)}>
      <div className="flex items-center gap-2 mb-3 opacity-40">
        <Activity size={12} />
        <span className="text-[9px] font-bold uppercase tracking-[0.2em]">Protocol Sync</span>
      </div>
      <div className="flex items-end justify-between gap-4">
        <div className="flex-1">
          <div className="text-[10px] text-white/40 uppercase mb-1">Project Velocity</div>
          <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${data.progress_percent || 0}%` }}
              className="h-full bg-white/40"
            />
          </div>
        </div>
        <div className="text-xl font-mono font-light tracking-tighter">
          {data.progress_percent || 0}<span className="text-[10px] opacity-20 ml-0.5">%</span>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-white/5">
        <span className="text-[10px] text-white/30 italic">
          Last event: {data.last_activity}
        </span>
      </div>
    </div>
  );
}

function Badge({ children, className, variant }: any) {
  return (
    <div className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2", className)}>
      {children}
    </div>
  );
}
