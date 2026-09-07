"use client";

import { useEffect, useMemo, useState } from "react";
import { useChatSessionStore } from "@/views/chat/ChatSessionStore";
import { getSandboxForAgent } from "@/lib/bots/vm-operator";
import { useBotOperationalStateStore } from "@/lib/bots/bot-operational-state.store";

export type BotActiveVm = {
  id: string;
  provider: string;
  status: string;
  vncUrl?: string;
};

function vmFromSessionMetadata(value: unknown): BotActiveVm | null {
  if (!value || typeof value !== "object") return null;
  const vm = value as { id?: string; provider?: string; status?: string; vncUrl?: string };
  if (!vm.id) return null;
  return {
    id: vm.id,
    provider: vm.provider ?? "cloud-desktop",
    status: vm.status ?? "running",
    vncUrl: vm.vncUrl,
  };
}

/** Resolve the bot's live cloud-desktop from session metadata, then the computers API. */
export function useBotActiveVm(botId?: string): BotActiveVm | null {
  const sessions = useChatSessionStore((s) => s.sessions);
  const computerState = useBotOperationalStateStore(
    (s) => (botId ? s.projections[botId]?.state.computerState : undefined),
  );

  const fromSession = useMemo(() => {
    if (!botId) return null;
    const session = sessions.find((s) => {
      if (s.metadata?.agentId !== botId && s.metadata?.agentName !== botId) return false;
      const vm = vmFromSessionMetadata(s.metadata?.vmSandbox);
      return vm?.status === "running" || vm?.status === "creating";
    });
    return vmFromSessionMetadata(session?.metadata?.vmSandbox) ?? null;
  }, [sessions, botId]);

  const [fromApi, setFromApi] = useState<BotActiveVm | null>(null);

  useEffect(() => {
    if (!botId) {
      setFromApi(null);
      return;
    }
    let cancelled = false;
    void getSandboxForAgent(botId).then((result) => {
      if (cancelled) return;
      if (result.ok && result.data) {
        setFromApi({
          id: result.data.id,
          provider: result.data.provider,
          status: result.data.status,
          vncUrl: result.data.vncUrl,
        });
      } else {
        setFromApi(null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [botId, computerState]);

  return fromApi ?? fromSession;
}

export function isBotComputerLive(vm: BotActiveVm | null, computerState?: string): boolean {
  if (computerState === "provisioning" || computerState === "running" || computerState === "takeover") {
    return true;
  }
  return vm?.status === "running" || vm?.status === "creating";
}
