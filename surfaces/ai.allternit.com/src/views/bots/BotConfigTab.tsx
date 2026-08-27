"use client";

import React, { useState } from "react";
import { Folder, PencilSimple, Brain, Robot } from "@phosphor-icons/react";
import type { Agent } from "@/lib/agents/agent.types";
import { WorkspaceTab } from "@/components/AgentDashboard/WorkspaceTab";
import { EditAgentForm } from "@/views/agent-view/components/EditAgentForm";
import { getBotDisplayName } from "@/lib/bots/bot-profile";

interface BotConfigTabProps {
  bot: Agent;
  accentColor: string;
}

export function BotConfigTab({ bot, accentColor }: BotConfigTabProps) {
  const [isEditOpen, setIsEditOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-[18px] font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <Folder size={20} style={{ color: accentColor }} />
            Workspace & Config
          </h2>
          <p className="text-[13px] text-[var(--text-secondary)] mt-1">
            Files, identity, and runtime configuration for {getBotDisplayName(bot)}.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsEditOpen(true)}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-card)] px-4 text-[13px] font-medium text-[var(--text-primary)] transition-colors hover:bg-[var(--surface-hover)]"
        >
          <PencilSimple size={14} />
          Edit bot profile
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] overflow-hidden">
          <div className="h-[600px]">
            <WorkspaceTab agent={bot} />
          </div>
        </div>

        <div className="space-y-4">
          <InfoCard
            icon={Brain}
            label="Brain"
            value={bot.brainId ? `Gizzi · ${shortId(bot.brainId)}` : "Default"}
            accentColor={accentColor}
          />
          <InfoCard
            icon={Robot}
            label="Model"
            value={`${bot.provider.toUpperCase()} · ${bot.model}`}
            accentColor={accentColor}
          />
        </div>
      </div>

      {isEditOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-[var(--shell-overlay-backdrop)] backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsEditOpen(false);
          }}
        >
          <div className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl overflow-hidden bg-[var(--bg-elevated)] border border-[var(--border-subtle)] shadow-2xl">
            <EditAgentForm
              agent={bot}
              onCancel={() => setIsEditOpen(false)}
              onSaved={() => setIsEditOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function InfoCard({
  icon: Icon,
  label,
  value,
  accentColor,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  accentColor: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4">
      <div className="flex items-center gap-3">
        <div
          className="size-10 rounded-xl flex items-center justify-center"
          style={{ background: `color-mix(in srgb, ${accentColor} 14%, transparent)` }}
        >
          <Icon size={18} style={{ color: accentColor }} />
        </div>
        <div>
          <div className="text-[12px] text-[var(--text-tertiary)] uppercase tracking-wider font-semibold">{label}</div>
          <div className="text-[14px] font-medium text-[var(--text-primary)] mt-0.5">{value}</div>
        </div>
      </div>
    </div>
  );
}

function shortId(id: string): string {
  if (!id) return "";
  if (id.length <= 12) return id;
  return `${id.slice(0, 6)}…${id.slice(-6)}`;
}
