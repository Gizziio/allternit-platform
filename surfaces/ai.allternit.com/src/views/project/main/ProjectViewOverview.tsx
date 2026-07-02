import React from "react";
import { 
  Users, 
  Files, 
  ChatText, 
  ChartLineUp, 
  Sparkle,
  ArrowRight,
  Plus
} from '@phosphor-icons/react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatCard } from "../../rails/components/RailsSharedUI";
import type { ProjectStats } from "./ProjectView.types";

interface ProjectViewOverviewProps {
  stats: ProjectStats;
  recentThreads: any[];
}

export const ProjectViewOverview: React.FC<ProjectViewOverviewProps> = ({
  stats,
  recentThreads,
}) => {
  return (
    <div className="p-8 pb-20 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Active Threads" value={stats.threadsCount} icon={ChatText} color="blue" />
        <StatCard title="Shared Files" value={stats.filesCount} icon={Files} color="purple" />
        <StatCard title="Active Agents" value={stats.activeAgents} icon={Users} color="green" />
        <StatCard title="Total Tokens" value={`${(stats.totalTokens / 1000).toFixed(1)}k`} icon={ChartLineUp} color="gray" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Col: Main Details */}
        <div className="lg:col-span-2 space-y-8">
          <Card className="bg-white/5 border-white/10 border-solid overflow-hidden">
            <CardHeader className="border-b border-solid border-white/5 bg-white/[0.02] p-5">
              <CardTitle className="text-[16px] font-bold flex items-center gap-2">
                <Sparkle size={20} weight="fill" className="text-yellow-500" />
                Project Intelligence
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <p className="text-[14px] text-zinc-400 leading-relaxed m-0">
                This project is currently optimized for <strong className="text-white">autonomous research and document generation</strong>. Our specialized agents are monitoring 14 data sources and have identified 3 high-priority synthesis targets.
              </p>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-black/20 border border-solid border-white/5">
                  <div className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-2">Contextual Depth</div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 w-[78%] rounded-full shadow-[0_0_8px_rgba(59,130,246,0.4)]" />
                    </div>
                    <span className="text-[13px] font-bold text-blue-400">78%</span>
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-black/20 border border-solid border-white/5">
                  <div className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider mb-2">Automation Health</div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 w-[92%] rounded-full shadow-[0_0_8px_rgba(34,197,94,0.4)]" />
                    </div>
                    <span className="text-[13px] font-bold text-green-400">92%</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Activity Feed */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-500">Recent Threads</h3>
              <button type="button" className="text-[12px] font-bold text-[var(--accent-primary)] hover:underline flex items-center gap-1 bg-transparent border-none cursor-pointer">
                View all <ArrowRight size={14} weight="bold" />
              </button>
            </div>
            
            <div className="space-y-3">
              {recentThreads.map((thread) => (
                <div key={thread.id} className="p-4 rounded-2xl bg-white/5 border border-solid border-white/5 hover:border-white/10 transition-all cursor-pointer group flex items-center justify-between">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="size-10 rounded-xl bg-zinc-800 flex items-center justify-center shrink-0 border border-solid border-white/5">
                      <ChatText size={20} className="text-zinc-500 group-hover:text-blue-400 transition-colors" />
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-[14px] truncate text-zinc-200 group-hover:text-white transition-colors">{thread.title}</div>
                      <div className="text-[12px] text-zinc-500 mt-0.5">Last active {thread.lastActive}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="flex -space-x-2">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={`projectviewoverview-${i}`} className="size-6  rounded-full border-2 border-[#1c1917] bg-zinc-700 shadow-sm overflow-hidden flex items-center justify-center">
                          <span className="text-[8px] font-bold text-zinc-400">A{i+1}</span>
                        </div>
                      ))}
                    </div>
                    <ChevronRight size={16} className="text-zinc-600" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Col: Secondary Info */}
        <div className="space-y-8">
          <Card className="bg-black/20 border-solid border-white/5 shadow-inner">
            <CardHeader className="p-5 pb-2">
              <CardTitle className="text-sm font-bold uppercase tracking-wider text-zinc-500">Collaborators</CardTitle>
            </CardHeader>
            <CardContent className="p-5 pt-0 space-y-4">
              <div className="flex items-center gap-3">
                <div className="size-8 rounded-full bg-blue-500 flex items-center justify-center font-bold text-xs shadow-lg">JD</div>
                <div className="flex-1">
                  <div className="text-[13px] font-bold">Jane Doe</div>
                  <div className="text-[11px] text-zinc-500">Project Owner</div>
                </div>
                <Badge variant="outline" className="text-[9px] font-bold text-zinc-500 border-zinc-800">ONLINE</Badge>
              </div>
              <div className="flex items-center gap-3">
                <div className="size-8 rounded-full bg-purple-500 flex items-center justify-center font-bold text-xs shadow-lg">AS</div>
                <div className="flex-1">
                  <div className="text-[13px] font-bold">Alex Smith</div>
                  <div className="text-[11px] text-zinc-500">Specialist</div>
                </div>
                <Badge variant="outline" className="text-[9px] font-bold text-zinc-500 border-zinc-800">AWAY</Badge>
              </div>
              <Button variant="outline" className="w-full mt-2 font-bold text-xs h-9 border-dashed">
                <Plus size={14} className="mr-2" /> Invite Member
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-[var(--accent-primary)]/5 border-solid border-[var(--accent-primary)]/20">
            <CardContent className="p-6">
              <h4 className="text-sm font-bold text-[var(--accent-primary)] uppercase tracking-wider mb-2">Completion Goal</h4>
              <div className="flex items-baseline gap-2 mb-3">
                <span className="text-3xl font-black text-white">{stats.completion}%</span>
                <span className="text-xs text-zinc-500 font-bold uppercase tracking-wider">Finalizing Synthesis</span>
              </div>
              <div className="h-2.5 bg-black/40 rounded-full overflow-hidden shadow-inner border border-solid border-white/5">
                <div 
                  className="h-full bg-gradient-to-r from-[var(--accent-primary)] to-white rounded-full shadow-[0_0_12px_var(--accent-primary)]"
                  style={{ width: `${stats.completion}%` }}
                />
              </div>
              <p className="text-[11px] text-zinc-500 mt-4 leading-relaxed italic">
                Current estimate: Completion in <strong className="text-white">4.5 hours</strong> based on active agent orchestration throughput.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

// Internal icon for feed
function ChevronRight({ size, className }: { size: number; className?: string }) {
  return (
    <svg width={size} height={size} className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
    </svg>
  );
}
