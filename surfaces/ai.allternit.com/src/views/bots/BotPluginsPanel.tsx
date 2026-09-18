"use client";

/**
 * OpenMaus PluginsPanel — marketplace + per-bot Allow chips.
 * Connect uses Allternit-owned connectors, not Composio.
 */

import React, { useEffect, useMemo, useState } from "react";
import { MagnifyingGlass, PuzzlePiece, X } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { useAgentStore } from "@/lib/agents/agent.store";
import { getBots, getBotDisplayName } from "@/lib/bots/bot-profile";
import { useBotPluginAllowStore } from "@/lib/bots/bot-plugin-allow.store";
import {
  connectOwned,
  listOwnedConnectors,
  type OwnedConnector,
} from "@/lib/design/owned-connector";

export function BotPluginsPanel({ onClose }: { onClose?: () => void }) {
  const agents = useAgentStore((s) => s.agents);
  const bots = useMemo(() => getBots(agents), [agents]);
  const allowedByBot = useBotPluginAllowStore((s) => s.allowedByBot);
  const setAllowed = useBotPluginAllowStore((s) => s.setAllowed);
  const [connectors, setConnectors] = useState<OwnedConnector[]>([]);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"marketplace" | "connected">("marketplace");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    void listOwnedConnectors()
      .then(setConnectors)
      .catch(() => setConnectors([]));
  }, []);

  const visible = connectors.filter((connector) => {
    const hay = `${connector.name} ${connector.description ?? ""}`.toLowerCase();
    if (search && !hay.includes(search.toLowerCase())) return false;
    if (tab === "connected") return connector.connection?.status === "connected" || connector.availability?.authed;
    return true;
  });

  return (
    <div className="flex h-full min-h-[480px] flex-col overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
      <header className="flex items-start justify-between gap-4 px-6 pb-3 pt-6">
        <div>
          <h2 className="flex items-center gap-2 text-[20px] font-semibold">
            <PuzzlePiece size={20} />
            Plugins
          </h2>
          <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
            Connect apps and your own tools. Connecting an app here does not hand it to a bot.
          </p>
        </div>
        {onClose && (
          <button type="button" aria-label="Close" onClick={onClose} className="rounded-lg p-2 hover:bg-[var(--surface-hover)]">
            <X size={18} />
          </button>
        )}
      </header>
      <div className="px-6 pb-4">
        <p className="text-[12.5px] leading-relaxed text-[var(--text-secondary)]">
          <span className="font-medium text-[var(--text-primary)]">Not every bot can use these apps.</span>{" "}
          Each bot has its own Allow switch. Until it is on, the bot does not know the app exists.
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {bots.map((bot) => {
            const on = allowedByBot[bot.id] === true;
            return (
              <button
                key={bot.id}
                type="button"
                aria-pressed={on}
                onClick={() => setAllowed(bot.id, !on)}
                className={cn(
                  "rounded-full px-2.5 py-1 text-[12px]",
                  on
                    ? "bg-[var(--accent-primary)] text-[var(--ui-text-inverse,#fff)]"
                    : "bg-[var(--surface-hover)] text-[var(--text-secondary)]",
                )}
              >
                Allow {getBotDisplayName(bot)}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-[var(--border-subtle)] px-6 py-3">
        <div className="flex rounded-xl bg-[var(--surface-panel)] p-1">
          {(["marketplace", "connected"] as const).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-[13px]",
                tab === id ? "bg-[var(--bg-elevated)] shadow-sm" : "text-[var(--text-secondary)]",
              )}
            >
              {id === "marketplace" ? "Marketplace" : "Connected"}
            </button>
          ))}
        </div>
        <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl bg-[var(--surface-panel)] px-3 sm:max-w-[280px]">
          <MagnifyingGlass size={15} className="text-[var(--text-secondary)]" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search apps"
            className="min-w-0 flex-1 bg-transparent text-[13px] outline-none"
          />
        </label>
      </div>
      <div className="grid flex-1 grid-cols-1 gap-3 overflow-y-auto px-6 py-4 sm:grid-cols-2">
        {visible.map((connector) => {
          const connected = connector.connection?.status === "connected" || connector.availability?.authed;
          return (
            <div
              key={connector.id}
              className="flex items-start justify-between gap-3 rounded-xl border border-[var(--border-subtle)] px-3 py-3"
            >
              <div className="min-w-0">
                <div className="truncate text-[13.5px] font-medium">{connector.name}</div>
                <div className="mt-0.5 line-clamp-2 text-[12px] text-[var(--text-secondary)]">
                  {connector.description || connector.category || connector.auth_type}
                </div>
              </div>
              {connected ? (
                <span className="shrink-0 rounded-full bg-[var(--surface-hover)] px-2.5 py-1 text-[12px] text-[var(--text-secondary)]">
                  Included
                </span>
              ) : (
                <button
                  type="button"
                  disabled={busyId === connector.id}
                  onClick={async () => {
                    setBusyId(connector.id);
                    try {
                      await connectOwned(connector.id);
                      const next = await listOwnedConnectors();
                      setConnectors(next);
                    } finally {
                      setBusyId(null);
                    }
                  }}
                  className="shrink-0 rounded-full border border-[var(--border-subtle)] px-2.5 py-1 text-[12px] hover:bg-[var(--surface-hover)] disabled:opacity-50"
                >
                  Connect
                </button>
              )}
            </div>
          );
        })}
        {visible.length === 0 && (
          <p className="col-span-full py-8 text-center text-[13px] text-[var(--text-secondary)]">
            No apps match.
          </p>
        )}
      </div>
    </div>
  );
}
