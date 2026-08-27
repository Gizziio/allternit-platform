"use client";

import React, { useCallback, useMemo, useState } from "react";
import { Plugs, Warning } from "@phosphor-icons/react";
import type { Agent, AgentConnectorBinding } from "@/lib/agents/agent.types";
import { updateAgent } from "@/lib/agents/agent.service";
import { ConnectorMarketplace } from "@/components/marketplace/ConnectorMarketplace";
import type { OwnedConnector } from "@/lib/design/owned-connector";

interface BotConnectedAppsPanelProps {
  bot: Agent;
}

export function BotConnectedAppsPanel({ bot }: BotConnectedAppsPanelProps) {
  const [bindings, setBindings] = useState<AgentConnectorBinding[]>(
    bot.connectorBindings ?? [],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const boundIds = useMemo(
    () => new Set(bindings.map((b) => b.connectorId)),
    [bindings],
  );

  const persistBindings = useCallback(
    async (next: AgentConnectorBinding[]) => {
      setSaving(true);
      setError(null);
      try {
        await updateAgent(bot.id, { connectorBindings: next });
        setBindings(next);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to update bindings");
      } finally {
        setSaving(false);
      }
    },
    [bot.id],
  );

  const handleBind = useCallback(
    async (connector: OwnedConnector) => {
      if (boundIds.has(connector.id)) return;
      const next: AgentConnectorBinding = {
        connectorId: connector.id,
        provider: connector.id,
        label: connector.name,
        capabilities: connector.category ? [connector.category] : [],
        autonomous: false,
      };
      await persistBindings([...bindings, next]);
    },
    [bindings, boundIds, persistBindings],
  );

  const handleUnbind = useCallback(
    async (connector: OwnedConnector) => {
      const next = bindings.filter((b) => b.connectorId !== connector.id);
      await persistBindings(next);
    },
    [bindings, persistBindings],
  );

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-xl border border-[var(--status-error)]/30 bg-[var(--status-error)]/10 p-4 text-[13px] text-[var(--status-error)] flex items-start gap-2">
          <Warning size={16} className="shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[14px] font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <Plugs size={16} />
            Connected Apps
          </h3>
          <p className="text-[12px] text-[var(--text-secondary)] mt-0.5">
            Connect accounts and bind them to this bot. Bindings grant the bot
            permission to use the connector at runtime.
          </p>
        </div>
        {saving && (
          <span className="text-[12px] text-[var(--text-tertiary)]">
            Saving…
          </span>
        )}
      </div>

      <ConnectorMarketplace
        agentId={bot.id}
        bindOnConnect
        boundIds={boundIds}
        onBind={handleBind}
        onUnbind={handleUnbind}
        groupByCategory
      />
    </div>
  );
}
