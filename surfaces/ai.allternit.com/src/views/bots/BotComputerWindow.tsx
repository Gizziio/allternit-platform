"use client";

import { useMemo } from "react";
import { Spinner, Warning } from "@phosphor-icons/react";
import { useAgentStore } from "@/lib/agents/agent.store";
import { getBotAccentColor } from "@/lib/bots/bot-profile";
import { BotComputerViewport } from "./BotComputerViewport";
import { useBotActiveVm } from "./useBotActiveVm";

/** Chrome-free host for a detached Electron (or popup) bot-computer window. */
export function BotComputerWindow({ botId }: { botId: string }) {
  const agents = useAgentStore((s) => s.agents);
  const isLoadingAgents = useAgentStore((s) => s.isLoadingAgents);
  const agentError = useAgentStore((s) => s.error);
  const bot = useMemo(() => agents.find((a) => a.id === botId) ?? null, [agents, botId]);
  const activeVM = useBotActiveVm(botId);
  const accentColor = bot
    ? getBotAccentColor(bot) ?? bot.botProfile?.accentColor ?? "var(--accent-primary)"
    : "var(--accent-primary)";
  const stillHydrating = isLoadingAgents || (!agentError && agents.length === 0);

  if (!bot && stillHydrating) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-3 bg-[var(--bg-elevated)] text-[var(--text-secondary)]">
        <Spinner size={24} className="animate-spin" />
        <p className="text-[13px]">Opening computer…</p>
      </div>
    );
  }

  if (!bot) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-3 bg-[var(--bg-elevated)] text-[var(--text-secondary)]">
        <Warning size={28} className="text-[var(--status-error)]" />
        <p className="text-[13px]">Could not find that bot&rsquo;s computer.</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen min-h-0 flex-col overflow-hidden bg-[var(--bg-elevated)]">
      <div className="flex min-h-0 flex-1 flex-col">
        <BotComputerViewport
          bot={bot}
          accentColor={accentColor}
          activeVM={activeVM}
          layout="window"
        />
      </div>
    </div>
  );
}
