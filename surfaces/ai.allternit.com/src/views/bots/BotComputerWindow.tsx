"use client";

import { useEffect, useMemo } from "react";
import { Warning } from "@phosphor-icons/react";
import type { Agent } from "@/lib/agents/agent.types";
import { useAgentStore } from "@/lib/agents/agent.store";
import { getBotAccentColor } from "@/lib/bots/bot-profile";
import { BotComputerViewport } from "./BotComputerViewport";
import { useBotActiveVm } from "./useBotActiveVm";

/** Chrome-free host for a detached Electron (or popup) bot-computer window. */
export function BotComputerWindow({ botId, sandboxId }: { botId: string; sandboxId?: string | null }) {
  const agents = useAgentStore((s) => s.agents);
  const isLoadingAgents = useAgentStore((s) => s.isLoadingAgents);
  const agentError = useAgentStore((s) => s.error);
  const fetchAgents = useAgentStore((s) => s.fetchAgents);
  const found = useMemo(() => agents.find((a) => a.id === botId) ?? null, [agents, botId]);
  const bot = useMemo<Agent>(
    () =>
      found ??
      ({
        id: botId,
        name: "Bot",
        isBot: true,
        botProfile: { displayName: "Computer" },
      } as Agent),
    [found, botId],
  );
  const activeVM = useBotActiveVm(botId, sandboxId);

  useEffect(() => {
    if (agents.length === 0 && !isLoadingAgents) {
      void fetchAgents();
    }
  }, [agents.length, isLoadingAgents, fetchAgents]);
  const accentColor =
    getBotAccentColor(bot) ?? bot.botProfile?.accentColor ?? "var(--accent-primary)";
  if (agentError && !found && !sandboxId && !activeVM) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-3 bg-[#0F0C0A] text-[#D4B08C]">
        <Warning size={28} />
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
