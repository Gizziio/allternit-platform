"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ACI_ENGINE_LABEL, subscribeGizziBrain, type AciEngine, type GizziBrainRef } from "@/lib/aci-runtime";
import { useBrowserAgentStore } from "./browserAgent.store";
import { useAgentStore } from "@/lib/agents/agent.store";
import { getBotDisplayName, isBot } from "@/lib/bots/bot-profile";

const ENGINES: AciEngine[] = ["allternit", "sub-agent", "page-agent"];

export function ACIEngineBar() {
  const aciEngine = useBrowserAgentStore((s) => s.aciEngine);
  const setAciEngine = useBrowserAgentStore((s) => s.setAciEngine);
  const connectedBotId = useBrowserAgentStore((s) => s.connectedBotId);
  const setConnectedBotId = useBrowserAgentStore((s) => s.setConnectedBotId);
  const engineHealthy = useBrowserAgentStore((s) => s.engineHealthy);
  const refreshEngineHealth = useBrowserAgentStore((s) => s.refreshEngineHealth);
  const agents = useAgentStore((s) => s.agents);
  const [brain, setBrain] = useState<GizziBrainRef | null>(null);

  useEffect(() => subscribeGizziBrain(setBrain), []);
  useEffect(() => {
    void refreshEngineHealth();
  }, [refreshEngineHealth]);

  const bots = useMemo(() => agents.filter(isBot), [agents]);

  return (
    <div className="shrink-0 border-b border-solid border-[var(--ui-border-muted)] bg-[var(--surface-panel)] px-3 py-1.5 flex items-center gap-2 flex-wrap">
      <span
        className="text-[11px] font-mono truncate max-w-[160px]"
        title={brain ? `${brain.aciModel} — same Gizzi runtime as chat/code` : "Pick a runtime in Gizzi"}
        style={{ color: brain ? "var(--ui-text-secondary)" : "var(--status-warning)" }}
      >
        {brain ? brain.label : "No Gizzi runtime selected"}
      </span>

      <div className="w-px h-3 bg-[var(--ui-border-muted)] shrink-0" />

      <select
        aria-label="Computer-use engine"
        value={aciEngine}
        onChange={(event) => setAciEngine(event.target.value as AciEngine)}
        className="h-6 rounded border border-solid border-[var(--ui-border-muted)] bg-[var(--surface-hover)] px-1.5 text-[11px] text-[var(--ui-text-secondary)] outline-none"
      >
        {ENGINES.map((engine) => (
          <option key={engine} value={engine}>
            {ACI_ENGINE_LABEL[engine]}
            {engine === "allternit" && !engineHealthy ? " (offline)" : ""}
          </option>
        ))}
      </select>

      <div className="w-px h-3 bg-[var(--ui-border-muted)] shrink-0" />

      <select
        aria-label="Connected bot"
        value={connectedBotId ?? ""}
        onChange={(event) => {
          const next = event.target.value;
          setConnectedBotId(next || null);
          if (next) {
            window.dispatchEvent(
              new CustomEvent("allternit:open-view", {
                detail: { viewType: "bot-home", context: { botId: next } },
              }),
            );
          }
        }}
        className="h-6 min-w-0 max-w-[140px] rounded border border-solid border-[var(--ui-border-muted)] bg-[var(--surface-hover)] px-1.5 text-[11px] text-[var(--ui-text-secondary)] outline-none"
      >
        <option value="">No bot connected</option>
        {bots.map((bot) => (
          <option key={bot.id} value={bot.id}>
            {getBotDisplayName(bot)}
          </option>
        ))}
      </select>
    </div>
  );
}
