import React from "react";
import { 
  Folder, 
  Files, 
  ChatText, 
  ChartLine, 
  Gear,
  Star,
  ShareNetwork,
  DownloadSimple
} from '@phosphor-icons/react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ProjectTab } from "./ProjectView.types";

interface ProjectViewHeaderProps {
  activeTab: ProjectTab;
  setActiveTab: (tab: ProjectTab) => void;
  projectName: string;
  isFavorite: boolean;
  onToggleFavorite: () => void;
}

export const ProjectViewHeader: React.FC<ProjectViewHeaderProps> = ({
  activeTab,
  setActiveTab,
  projectName,
  isFavorite,
  onToggleFavorite,
}) => {
  const tabs = [
    { id: 'overview' as const, icon: Folder, label: 'Overview' },
    { id: 'files' as const, icon: Files, label: 'Files' },
    { id: 'threads' as const, icon: ChatText, label: 'Threads' },
    { id: 'analytics' as const, icon: ChartLine, label: 'Analytics' },
    { id: 'settings' as const, icon: Gear, label: 'Settings' },
  ];

  return (
    <header className="px-8 py-6 border-b border-solid border-white/5 bg-[rgba(15,12,10,0.4)] backdrop-blur-md shrink-0">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="size-12 rounded-2xl bg-[var(--accent-primary)]/10 flex items-center justify-center border border-solid border-[var(--accent-primary)]/20 shadow-lg">
            <Folder size={28} weight="duotone" className="text-[var(--accent-primary)]" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold m-0 tracking-tight text-[var(--ui-text-primary)]">{projectName}</h1>
              <button type="button"
                onClick={onToggleFavorite}
                className="bg-transparent border-none p-0 cursor-pointer text-zinc-500 hover:text-yellow-500 transition-colors"
              >
                <Star size={20} weight={isFavorite ? "fill" : "regular"} className={cn(isFavorite && "text-yellow-500")} />
              </button>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-widest bg-white/5 border-white/10">Active Workspace</Badge>
              <span className="text-xs text-zinc-500 font-medium px-2 py-0.5 border-l border-solid border-white/10">Created 2 days ago</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="text-zinc-400 gap-2">
            <ShareNetwork size={16} /> Share
          </Button>
          <Button variant="ghost" size="sm" className="text-zinc-400 gap-2">
            <DownloadSimple size={16} /> Export
          </Button>
          <div className="w-px h-6 bg-white/10 mx-2" />
          <Button className="bg-[var(--accent-primary)] font-bold shadow-lg">
            Launch Project
          </Button>
        </div>
      </div>

      <nav className="flex items-center gap-1">
        {tabs.map((tab) => (
          <button type="button"
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 px-5 py-2.5 rounded-xl text-[14px] font-semibold cursor-pointer transition-all duration-300 border border-solid",
              activeTab === tab.id 
                ? "bg-[var(--accent-primary)]/15 border-[var(--accent-primary)]/30 text-white" 
                : "bg-transparent border-transparent text-zinc-500 hover:text-white hover:bg-white/5"
            )}
          >
            <tab.icon size={18} weight={activeTab === tab.id ? "fill" : "regular"} />
            {tab.label}
          </button>
        ))}
      </nav>
    </header>
  );
};
