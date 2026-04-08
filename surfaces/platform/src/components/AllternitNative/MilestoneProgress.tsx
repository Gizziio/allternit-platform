"use client";

import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { AllternitNativeState } from "@/agent-workspace/types";

interface MilestoneProgressProps {
  state: AllternitNativeState | null;
  className?: string;
}

/**
 * MilestoneProgress - Literal 0--0---0 linear flight path
 * 
 * Provides a high-signal, minimalist visualization of the Allternit Native protocol state.
 */
export function MilestoneProgress({ state, className }: MilestoneProgressProps) {
  if (!state) return null;

  const { current_state, roadmap } = state;
  const milestones = roadmap?.milestones || [];
  
  return (
    <div className={cn("flex flex-col gap-2 w-full", className)}>
      {/* 1. The Global Roadmap Path (0--0---0) */}
      <div className="flex items-center gap-0 w-full px-4 h-8 bg-black/40 rounded-full border border-white/5 backdrop-blur-md">
        {milestones.length > 0 ? (
          milestones.map((m, idx) => {
            const isCompleted = m.status === 'completed';
            const isActive = m.status === 'active';
            
            return (
              <React.Fragment key={m.id}>
                {/* Node */}
                <div className="relative group">
                  <motion.div
                    initial={false}
                    animate={{
                      scale: isActive ? 1.2 : 1,
                      backgroundColor: isCompleted ? "var(--accent-primary)" : isActive ? "#fff" : "transparent",
                      borderColor: isCompleted ? "var(--accent-primary)" : isActive ? "#fff" : "rgba(255,255,255,0.2)",
                    }}
                    className={cn(
                      "h-3 w-3 rounded-full border-2 transition-shadow",
                      isActive && "shadow-[0_0_10px_#fff]"
                    )}
                  />
                  {/* Label on Hover */}
                  <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap bg-black/90 px-2 py-1 rounded text-[10px] text-white/80 border border-white/10 z-50">
                    {m.title}
                  </div>
                </div>

                {/* Line */}
                {idx < milestones.length - 1 && (
                  <div className="flex-1 h-[2px] mx-1 bg-white/10 overflow-hidden">
                    {isCompleted && (
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: "100%" }}
                        className="h-full bg-accent-primary/50"
                      />
                    )}
                  </div>
                )}
              </React.Fragment>
            );
          })
        ) : (
          /* Fallback simple linear path */
          <div className="flex items-center w-full gap-2 px-2">
             <div className="h-2 w-2 rounded-full bg-accent-primary" />
             <div className="flex-1 h-px bg-white/10" />
             <div className="h-2 w-2 rounded-full border border-white/20" />
             <div className="flex-1 h-px bg-white/10" />
             <div className="h-2 w-2 rounded-full border border-white/20" />
          </div>
        )}
      </div>

      {/* 2. The Active Mission Task Path (Mini 0-0-0) */}
      {state.active_plan && (
        <div className="flex items-center justify-between px-4 py-1.5 bg-accent-primary/5 rounded-xl border border-accent-primary/10">
          <div className="flex flex-col">
            <span className="text-[8px] font-bold uppercase tracking-widest text-accent-primary opacity-70">
              MISSION {state.active_plan.wave}
            </span>
            <span className="text-[10px] text-white/90 font-medium truncate max-w-[180px]">
              {state.active_plan.objective}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {state.active_plan.tasks.map((task, idx) => {
              const isDone = task.status === 'completed';
              const isCurrent = task.status === 'in_progress';
              
              return (
                <React.Fragment key={task.id}>
                  <motion.div 
                    title={task.name}
                    animate={isCurrent ? { scale: [1, 1.2, 1] } : {}}
                    transition={{ repeat: Infinity, duration: 2 }}
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      isDone ? "bg-accent-primary" : isCurrent ? "bg-white" : "bg-white/10"
                    )}
                  />
                  {idx < (state.active_plan?.tasks.length || 0) - 1 && (
                    <div className={cn("w-2 h-[1px]", isDone ? "bg-accent-primary/30" : "bg-white/5")} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
