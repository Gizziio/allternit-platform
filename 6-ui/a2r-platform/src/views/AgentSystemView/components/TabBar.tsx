/**
 * TabBar - Main navigation for AgentSystemView
 */

import React from "react";
import { GitBranch, ClipboardList, Activity, Mail, Settings2, History } from "lucide-react";
import { useUnifiedStore, type MainTab } from "@/lib/agents/unified.store";

interface TabBarProps {
  activeTab: MainTab;
  onTabChange: (tab: MainTab) => void;
}

interface TabConfig {
  id: MainTab;
  label: string;
  icon: React.ElementType;
  badge?: number;
}

export function TabBar({ activeTab, onTabChange }: TabBarProps) {
  const { mailUnreadCount } = useUnifiedStore();

  const tabs: TabConfig[] = [
    { id: "plan", label: "Plan", icon: GitBranch },
    { id: "work", label: "Work", icon: ClipboardList },
    { id: "status", label: "Status", icon: Activity },
    { id: "mail", label: "Mail", icon: Mail, badge: mailUnreadCount > 0 ? mailUnreadCount : undefined },
    { id: "tools", label: "Tools", icon: Settings2 },
    { id: "audit", label: "Audit", icon: History },
  ];

  return (
    <div className="border-b border-white/5 bg-black/15 px-4 py-3 backdrop-blur">
      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <TabButton
            key={tab.id}
            tab={tab}
            isActive={activeTab === tab.id}
            onClick={() => onTabChange(tab.id)}
          />
        ))}
      </div>
    </div>
  );
}

interface TabButtonProps {
  tab: TabConfig;
  isActive: boolean;
  onClick: () => void;
}

function TabButton({ tab, isActive, onClick }: TabButtonProps) {
  const Icon = tab.icon;

  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm transition ${
        isActive
          ? "border-emerald-300/25 bg-emerald-300/12 text-foreground shadow-[0_0_0_1px_rgba(110,231,183,0.08)_inset]"
          : "border-white/5 bg-white/[0.03] text-muted-foreground hover:border-white/10 hover:bg-white/[0.05] hover:text-foreground"
      }`}
    >
      <Icon className={`h-4 w-4 ${isActive ? "text-emerald-200" : ""}`} />
      <span>{tab.label}</span>
      {tab.badge ? (
        <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-semibold text-white">
          {tab.badge > 99 ? "99+" : tab.badge}
        </span>
      ) : null}
    </button>
  );
}

export default TabBar;
