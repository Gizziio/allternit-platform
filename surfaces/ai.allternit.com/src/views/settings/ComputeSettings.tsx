"use client";

import React, { useState } from "react";
import {
  ComputerTower,
  HardDrives,
  Plus,
  Receipt,
  Desktop,
} from "@phosphor-icons/react";
import { ComputeBillingPanel } from "@/components/settings/ComputeBillingPanel";
import { EnterpriseByocPanel } from "@/components/settings/EnterpriseByocPanel";
import { VPSConnectionsPanel } from "./VPSConnectionsPanel";
import { CloudInstancesPanel } from "./CloudInstancesPanel";
import { DesktopCloudAdminView } from "@/views/desktop-cloud/DesktopCloudAdminView";
import { ToastProvider } from "@/components/ui/toast-provider";
import { cn } from "@/lib/utils";

type ComputeTab =
  | "overview"
  | "my-computers"
  | "add-computer"
  | "templates"
  | "usage-credits";

interface TabDefinition {
  id: ComputeTab;
  label: string;
  icon: React.ReactNode;
}

const TABS: TabDefinition[] = [
  { id: "overview", label: "Overview", icon: <ComputerTower size={14} /> },
  { id: "my-computers", label: "My Computers", icon: <HardDrives size={14} /> },
  { id: "add-computer", label: "Add Computer", icon: <Plus size={14} /> },
  { id: "templates", label: "Templates", icon: <Desktop size={14} /> },
  { id: "usage-credits", label: "Usage & Credits", icon: <Receipt size={14} /> },
];

export function ComputeSettings(): React.ReactElement {
  const [activeTab, setActiveTab] = useState<ComputeTab>("overview");

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-[16px] font-semibold text-[var(--text-primary)] m-0 mb-1">
          Compute & Cloud Desktops
        </h2>
        <p className="text-[12px] text-[var(--text-secondary)] m-0 leading-relaxed">
          Manage every compute source — local, BYO VPS, managed hosting, BYOC,
          and Desktop Cloud — in one place.
        </p>
      </div>

      <div className="flex items-center gap-1 rounded-lg bg-[var(--bg-secondary)] p-1 border border-solid border-[var(--border-subtle)]">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex-1 inline-flex items-center justify-center gap-1.5 rounded-md border-none px-3 py-2 text-[11px] font-medium cursor-pointer transition-colors",
              activeTab === tab.id
                ? "bg-[var(--surface-canvas)] text-[var(--text-primary)] shadow-sm"
                : "bg-transparent text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]",
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <div>
        {activeTab === "overview" && <ComputeBillingPanel />}
        {activeTab === "my-computers" && (
          <ToastProvider>
            <VPSConnectionsPanel />
          </ToastProvider>
        )}
        {activeTab === "add-computer" && <CloudInstancesPanel />}
        {activeTab === "templates" && <DesktopCloudAdminView />}
        {activeTab === "usage-credits" && <EnterpriseByocPanel />}
      </div>
    </div>
  );
}

export default ComputeSettings;
