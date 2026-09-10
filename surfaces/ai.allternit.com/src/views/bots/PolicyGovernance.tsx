"use client";

/**
 * Bot-mode gating wrapper for the policy chips, audit list, and editor.
 * Renders nothing unless the open session is a bot session.
 *
 * @module PolicyGovernance
 */

import React, { useState } from "react";
import { PolicyAuditList } from "./PolicyAuditList";
import { PolicyEditor } from "./PolicyEditor";
import { PolicyVerdictChips } from "./PolicyVerdictChips";

export interface PolicyGovernanceSessionMeta {
  sessionMode?: string;
  isBot?: boolean;
}

export function isPolicyGovernanceSession(
  meta?: PolicyGovernanceSessionMeta | null
): boolean {
  return meta?.sessionMode === "agent" || meta?.isBot === true;
}

export interface PolicyGovernanceProps {
  botId?: string;
  sessionMode?: string;
  isBot?: boolean;
}

export function PolicyGovernance({
  botId,
  sessionMode,
  isBot,
}: PolicyGovernanceProps) {
  const [panelOpen, setPanelOpen] = useState(false);

  if (!isPolicyGovernanceSession({ sessionMode, isBot })) {
    return null;
  }

  return (
    <div data-testid="policy-governance" data-policy-governance className="shrink-0">
      {botId ? (
        <PolicyVerdictChips
          botId={botId}
          onViewAll={() => setPanelOpen(true)}
        />
      ) : (
        <div className="border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-4 py-1.5">
          <button
            type="button"
            onClick={() => setPanelOpen(true)}
            className="text-[10px] font-medium text-[var(--accent-primary)]"
          >
            Policy
          </button>
        </div>
      )}

      {panelOpen && (
        <div
          data-testid="policy-governance-panel"
          className="flex max-h-[42vh] min-h-0 flex-col gap-4 overflow-y-auto border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-4 py-3"
        >
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-[var(--text-primary)]">
              Policy audit and rules
            </p>
            <button
              type="button"
              onClick={() => setPanelOpen(false)}
              className="text-[11px] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            >
              Hide
            </button>
          </div>
          {botId ? <PolicyAuditList botId={botId} /> : null}
          <PolicyEditor defaultBotId={botId} />
        </div>
      )}
    </div>
  );
}

export default PolicyGovernance;
