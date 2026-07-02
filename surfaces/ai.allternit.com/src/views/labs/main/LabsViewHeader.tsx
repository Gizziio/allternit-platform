import React from "react";
import {
  Compass,
  FlaskConical,
  GraduationCap,
  School,
  Award,
  Settings,
} from 'lucide-react';
import { GlassSurface, GlassSurfaceThin } from '@/design/glass/GlassSurface';
import { Text } from '@/components/typography/Text';
import { cn } from '@/lib/utils';
import type { Tab } from "./LabsView.constants";

interface LabsViewHeaderProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  notification: string | null;
}

export const LabsViewHeader: React.FC<LabsViewHeaderProps> = ({ 
  activeTab, 
  setActiveTab,
  notification 
}) => {
  const TABS = [
    { id: 'discovery', label: 'Discovery', icon: Compass },
    { id: 'research', label: 'Research', icon: FlaskConical },
    { id: 'tracks', label: 'Tracks', icon: GraduationCap },
    { id: 'classroom', label: 'Classroom', icon: School },
    { id: 'certifications', label: 'Certifications', icon: Award },
    { id: 'settings', label: 'Settings', icon: Settings },
  ] as const;

  return (
    <GlassSurface 
      className="flex items-center justify-between px-9 py-4 shrink-0 relative z-[2] border-b border-solid border-[var(--ui-border-muted)]"
    >
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          <div className="size-10 bg-[var(--accent-primary)]/10 rounded-xl flex items-center justify-center border border-solid border-[var(--accent-primary)]/20 shadow-[0_0_20px_var(--accent-primary)/10]">
            <span className="text-[20px] font-black italic text-[var(--accent-primary)] tracking-tighter">A:</span>
          </div>
          <div>
            <Text variant="researchHeading" className="text-[19px] font-black italic m-0 tracking-tight text-[var(--ui-text-primary)] leading-none">Labs</Text>
            <Text variant="label" className="text-[10px] font-bold tracking-[0.2em] uppercase text-[var(--ui-text-muted)] mt-1 opacity-60">Learning Portal</Text>
          </div>
        </div>

        {/* Global Notification */}
        {notification && (
          <div className="animate-in fade-in slide-in-from-left-2 duration-300">
            <Text variant="label" className="bg-emerald-500/10 text-emerald-500 px-3 py-1 rounded-full text-[11px] font-bold border border-solid border-emerald-500/20">
              {notification}
            </Text>
          </div>
        )}
      </div>

      <div className="flex items-center">
        <GlassSurfaceThin className="flex p-1 gap-1 rounded-xl bg-white/[0.03]">
          {TABS.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button type="button"
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-1.5 p-2 px-4 rounded-lg border-none text-[13px] font-semibold cursor-pointer transition-all whitespace-nowrap",
                  isActive 
                    ? "bg-[var(--accent-primary)]/15 text-[#f0f0f0]" 
                    : "bg-transparent text-[var(--ui-text-secondary)] hover:bg-white/5"
                )}
              >
                <tab.icon size={13} /> {tab.label}
              </button>
            );
          })}
        </GlassSurfaceThin>
      </div>
    </GlassSurface>
  );
};
