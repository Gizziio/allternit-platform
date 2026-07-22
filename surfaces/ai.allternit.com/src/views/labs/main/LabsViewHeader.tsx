import React from "react";
import {
  Compass,
  FlaskConical,
  GraduationCap,
  School,
  Award,
  Settings,
} from 'lucide-react';
import { Pill } from '@/components/ui/Pill';
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
    <div className="w-full max-w-6xl mx-auto px-8 pt-10 shrink-0 relative z-[2]">
      {/* Header — same pattern as Artifacts Library / Automation Tasks / Projects */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1
            className="text-3xl font-medium tracking-tight m-0"
            style={{ fontFamily: 'var(--font-serif)' }}
          >
            a://labs
          </h1>
          <p className="m-0 mt-1 text-sm text-[var(--text-secondary)]">Learning Portal</p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Global Notification */}
          {notification && (
            <span className="bg-[var(--status-success-bg)] text-[var(--status-success)] px-3 py-1 rounded-full text-[11px] font-bold border border-solid border-[var(--status-success)]/20">
              {notification}
            </span>
          )}
          {TABS.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                type="button"
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                data-testid={`labs-tab-${tab.id}`}
                className="border-none bg-transparent p-0 cursor-pointer"
              >
                <Pill
                  active={isActive}
                  icon={<tab.icon size={13} />}
                  size="md"
                >
                  {tab.label}
                </Pill>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
