/**
 * ReceiptsView - Console Drawer tab for browser agent evidence
 * 
 * Shows evidence receipts from browser agent actions.
 * Aligned with Receipts.json schema.
 * 
 * Displays:
 * - Action summary
 * - Policy tier
 * - Selector/target metadata
 * - Screenshot links
 * - Redactions when needed
 * 
 * Receipts are persistent per run and exportable.
 */

"use client";

import React, { useMemo } from 'react';
import {
  Scroll,
} from '@phosphor-icons/react';
import {
  BrowserReceipt,
  RiskTier,
  ArtifactKind,
  PolicyDecisionType,
  getRiskTierLabel,
} from '@/capsules/browser/browserAgent.types';
import { useBrowserAgentStore } from '@/capsules/browser/browserAgent.store';

// ============================================================================
// Component
// ============================================================================

export function ReceiptsView({
  className,
}: { className?: string }) {
  // Get receipts from store
  const receiptIds = useBrowserAgentStore(state => state.receipts);
  const queryReceipts = useBrowserAgentStore(state => state.queryReceipts);
  
  const [isLoading, setIsLoading] = React.useState(false);
  const [expandedReceiptId, setExpandedReceiptId] = React.useState<string | null>(null);
  const [filterTier, setFilterTier] = React.useState<RiskTier | 'all'>('all');
  const [filterStatus, setFilterStatus] = React.useState<string | 'all'>('all');
  const [receipts, setReceipts] = React.useState<BrowserReceipt[]>([]);

  // Load receipts on mount
  React.useEffect(() => {
    loadReceipts();
  }, []);

  const loadReceipts = async () => {
    setIsLoading(true);
    try {
      const result = await queryReceipts({ page: 1, pageSize: 100 });
      setReceipts(result.receipts);
    } catch (error) {
      console.error('Failed to load receipts:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter receipts
  const filteredReceipts = useMemo(() => {
    return receipts.filter((receipt) => {
      if (filterTier !== 'all' && receipt.riskTier !== filterTier) {
        return false;
      }
      if (filterStatus !== 'all' && receipt.status !== filterStatus) {
        return false;
      }
      return true;
    });
  }, [receipts, filterTier, filterStatus]);

  // Group receipts by status
  const receiptsByStatus = useMemo(() => {
    const groups: Record<string, BrowserReceipt[]> = {
      success: [],
      fail: [],
      blocked: [],
      needs_confirm: [],
      skipped: [],
    };
    receipts.forEach((receipt) => {
      groups[receipt.status].push(receipt);
    });
    return groups;
  }, [receipts]);

  // Handle export
  // @placeholder APPROVED - Backend export API pending
  // @ticket GAP-54
  // @fallback Client-side JSON download
  const handleExport = () => {
    const blob = new Blob([JSON.stringify(filteredReceipts, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'receipts_' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Scroll className="w-8 h-8 mx-auto mb-2 text-muted-foreground animate-pulse" />
          <p className="text-sm text-muted-foreground">Loading receipts...</p>
        </div>
      </div>
    );
  }

  if (receipts.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Scroll className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No receipts yet</p>
          <p className="text-xs text-muted-foreground mt-1">
            Receipts will appear here as the agent executes actions
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full ${className || ''}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Scroll className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-medium">Evidence Receipts</h3>
          <span className="text-xs text-muted-foreground">
            ({filteredReceipts.length} of {receipts.length})
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Filter by Tier */}
          <select
            value={filterTier}
            onChange={(e) => setFilterTier(e.target.value as RiskTier | 'all')}
            className="text-xs bg-secondary border border-border rounded px-2 py-1"
          >
            <option value="all">All Tiers</option>
            <option value="0">Tier 0 (Read)</option>
            <option value="1">Tier 1 (Nav)</option>
            <option value="2">Tier 2 (Form)</option>
            <option value="3">Tier 3 (Commit)</option>
            <option value="4">Tier 4 (Irreversible)</option>
          </select>

          {/* Filter by Status */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="text-xs bg-secondary border border-border rounded px-2 py-1"
          >
            <option value="all">All Status</option>
            <option value="success">Success</option>
            <option value="fail">Failed</option>
            <option value="blocked">Blocked</option>
            <option value="needs_confirm">Needs Confirm</option>
            <option value="skipped">Skipped</option>
          </select>

          {/* Export */}
          <button
            onClick={handleExport}
            className="text-xs px-3 py-1 rounded bg-accent/20 text-accent border border-accent/50 hover:bg-accent/30 transition-colors"
          >
            Export
          </button>
        </div>
      </div>

      {/* Summary Bar */}
      <div className="flex items-center gap-4 px-4 py-2 bg-secondary/30 border-b border-border text-xs">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          Success: {receiptsByStatus.success.length}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-red-500" />
          Failed: {receiptsByStatus.fail.length}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-yellow-500" />
          Pending: {receiptsByStatus.needs_confirm.length}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-gray-500" />
          Blocked: {receiptsByStatus.blocked.length}
        </span>
      </div>

      {/* Receipts List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {filteredReceipts.map((receipt, index) => (
          <ReceiptItem
            key={receipt.actionId || index}
            receipt={receipt}
            isExpanded={expandedReceiptId === receipt.actionId}
            onToggle={() =>
              setExpandedReceiptId(
                expandedReceiptId === receipt.actionId ? null : receipt.actionId
              )
            }
          />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Receipt Item Component
// ============================================================================

interface ReceiptItemProps {
  receipt: BrowserReceipt;
  isExpanded: boolean;
  onToggle: () => void;
}

function ReceiptItem({ receipt, isExpanded, onToggle }: ReceiptItemProps) {
  const statusColors: Record<string, string> = {
    success: 'bg-green-500/20 text-green-500 border-green-500/50',
    fail: 'bg-red-500/20 text-red-500 border-red-500/50',
    blocked: 'bg-gray-500/20 text-gray-500 border-gray-500/50',
    needs_confirm: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/50',
    skipped: 'bg-blue-500/20 text-blue-500 border-blue-500/50',
  };

  const statusBorderColors: Record<string, string> = {
    success: 'border-l-green-500',
    fail: 'border-l-red-500',
    blocked: 'border-l-gray-500',
    needs_confirm: 'border-l-yellow-500',
    skipped: 'border-l-blue-500',
  };

  const actionType = receipt.trace.find((e) => e.type === 'action_start')?.data?.actionType || 'Unknown';
  const duration = new Date(receipt.endedAt).getTime() - new Date(receipt.startedAt).getTime();

  return (
    <div
      className={`
        border rounded-lg overflow-hidden
        border-l-4 ${statusBorderColors[receipt.status]}
        ${statusColors[receipt.status]}
        transition-all
      `}
    >
      {/* Receipt Header */}
      <div
        className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-black/5"
        onClick={onToggle}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono opacity-60">#{receipt.actionId.slice(0, 8)}</span>
          <span className="text-sm font-medium">{actionType as React.ReactNode}</span>
          <span className="text-xs px-1.5 py-0.5 rounded bg-black/10">
            Tier {receipt.riskTier}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs opacity-60">{duration}ms</span>
          <span className="text-xs font-medium">{receipt.status.replace('_', ' ')}</span>
          <svg
            className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-3 pb-3 space-y-3 bg-black/5">
          {/* Policy Decision */}
          {receipt.policyDecision && (
            <div className="text-xs">
              <span className="font-medium opacity-60">Policy: </span>
              <span className={getPolicyDecisionColor(receipt.policyDecision.decision)}>
                {receipt.policyDecision.decision}
              </span>
              {receipt.policyDecision.reason && (
                <span className="opacity-60 ml-2">({receipt.policyDecision.reason})</span>
              )}
            </div>
          )}

          {/* Page States */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="font-medium opacity-60">Before:</span>
              <div className="mt-1 font-mono truncate">{receipt.before.url}</div>
            </div>
            <div>
              <span className="font-medium opacity-60">After:</span>
              <div className="mt-1 font-mono truncate">{receipt.after.url}</div>
            </div>
          </div>

          {/* Artifacts */}
          {receipt.artifacts.length > 0 && (
            <div>
              <span className="text-xs font-medium opacity-60">Artifacts:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {receipt.artifacts.map((artifact, i) => (
                  <ArtifactBadge key={i} artifact={artifact} />
                ))}
              </div>
            </div>
          )}

          {/* Error */}
          {receipt.error && (
            <div className="text-xs text-red-500">
              <span className="font-medium">Error: </span>
              {receipt.error.message}
            </div>
          )}

          {/* Trace Summary */}
          <div className="text-xs opacity-60">
            <span className="font-medium">Events: </span>
            {receipt.trace.length} trace events
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Artifact Badge Component
// ============================================================================

interface ArtifactBadgeProps {
  artifact: {
    kind: ArtifactKind;
    sha256: string;
    mime?: string;
    path?: string;
  };
}

function ArtifactBadge({ artifact }: ArtifactBadgeProps) {
  const colors: Record<ArtifactKind, string> = {
    screenshot: 'bg-pink-500/20 text-pink-500 border-pink-500/50',
    dom_snippet: 'bg-blue-500/20 text-blue-500 border-blue-500/50',
    table_json: 'bg-green-500/20 text-green-500 border-green-500/50',
    form_json: 'bg-purple-500/20 text-purple-500 border-purple-500/50',
    download: 'bg-orange-500/20 text-orange-500 border-orange-500/50',
    selection_text: 'bg-cyan-500/20 text-cyan-500 border-cyan-500/50',
    note: 'bg-gray-500/20 text-gray-500 border-gray-500/50',
  };

  return (
    <span
      className={`
        text-xs px-2 py-0.5 rounded border
        ${colors[artifact.kind]}
      `}
    >
      {artifact.kind.replace('_', ' ')}
    </span>
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

function getPolicyDecisionColor(decision: PolicyDecisionType): string {
  switch (decision) {
    case 'allow':
      return 'text-green-500';
    case 'deny':
      return 'text-red-500';
    case 'require_confirm':
      return 'text-yellow-500';
    default:
      return 'text-muted-foreground';
  }
}

export default ReceiptsView;
