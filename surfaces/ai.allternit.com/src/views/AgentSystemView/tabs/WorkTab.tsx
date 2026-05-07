/**
 * WorkTab - WIH Queue and Active Work Management
 * 
 * Features:
 * - WIH queue with filters
 * - Active work details panel
 * - Lease info display
 * - Context pack browser
 * - Quick action buttons (Pickup, Complete)
 */

import React, { useState, useEffect } from "react";
import {
  CheckCircle,
  XCircle,
  Clock,
  User,
  FileText,
  Lock,
  LockOpen,
  Play,
  Warning,
  Funnel,
  CaretRight,
  ArrowsClockwise,
} from '@phosphor-icons/react';
import { useUnifiedStore } from "@/lib/agents/unified.store";
import type { WihInfo, ManagedLease, ContextPack } from "@/lib/agents";

export function WorkTab() {
  const {
    wihs,
    myWihs,
    currentWih,
    selectedWihId,
    leases,
    contextPacks,
    currentDag,
    isLoading,
    fetchWihs,
    fetchLeases,
    fetchContextPacks,
    pickupWih,
    closeWih,
    requestLease,
    releaseLease,
    renewLease,
    selectWih,
    selectDag,
  } = useUnifiedStore();

  const [filter, setFilter] = useState<"all" | "ready" | "in_progress" | "blocked">("all");
  const [showMyWorkOnly, setShowMyWorkOnly] = useState(false);

  // Fetch data on mount
  useEffect(() => {
    fetchWihs();
    fetchLeases();
  }, [fetchWihs, fetchLeases]);

  // Fetch context packs when WIH is selected
  useEffect(() => {
    if (currentWih) {
      fetchContextPacks(currentWih.dag_id, currentWih.node_id, currentWih.wih_id);
    }
  }, [currentWih, fetchContextPacks]);

  const filteredWihs = showMyWorkOnly ? myWihs : wihs.filter((w) => {
    if (filter === "all") return true;
    if (filter === "ready") return w.status === "open" || w.status === "ready" || w.status === "signed";
    if (filter === "in_progress") return w.status === "in_progress";
    if (filter === "blocked") return w.status === "blocked";
    return true;
  });

  const handlePickup = async (dagId: string, nodeId: string) => {
    try {
      const agentId = `agent_${Date.now()}`;
      await pickupWih(dagId, nodeId, agentId, "builder");
    } catch (err) {
      // Error handled by store
    }
  };

  const handleClose = async (wihId: string, status: "completed" | "failed") => {
    try {
      await closeWih(wihId, status);
    } catch (err) {
      // Error handled by store
    }
  };

  const handleRequestLease = async (wihId: string) => {
    try {
      const agentId = `agent_${Date.now()}`;
      await requestLease(wihId, agentId, ["/project/**"], 900);
    } catch (err) {
      // Error handled by store
    }
  };

  return (
    <div
      style={{
        display: "flex",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {/* Left Panel: WIH Queue */}
      <div
        style={{
          width: 380,
          display: "flex",
          flexDirection: "column",
          borderRight: "1px solid var(--border-subtle, #333)",
          background: "var(--bg-secondary, #141414)",
        }}
      >
        {/* Filters */}
        <div
          style={{
            padding: 12,
            borderBottom: "1px solid var(--border-subtle, #333)",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Funnel size={14} color="#888" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              style={{
                flex: 1,
                padding: "6px 10px",
                background: "var(--bg-primary, #0a0a0a)",
                border: "1px solid var(--border-subtle, #333)",
                borderRadius: 6,
                color: "var(--text-primary, #f0f0f0)",
                fontSize: 12,
              }}
            >
              <option value="all">All WIHs</option>
              <option value="ready">Ready</option>
              <option value="in_progress">In Progress</option>
              <option value="blocked">Blocked</option>
            </select>
            <button
              onClick={() => fetchWihs()}
              style={{
                padding: "6px",
                background: "transparent",
                border: "1px solid var(--border-subtle, #333)",
                borderRadius: 6,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ArrowsClockwise size={14} color="#888" />
            </button>
          </div>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 12,
              color: "#888",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={showMyWorkOnly}
              onChange={(e) => setShowMyWorkOnly(e.target.checked)}
              style={{
                width: 16,
                height: 16,
                accentColor: "#0a84ff",
              }}
            />
            Show my work only
          </label>
        </div>

        {/* WIH List */}
        <div
          style={{
            flex: 1,
            overflow: "auto",
            padding: 12,
          }}
        >
          {filteredWihs.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: 40,
                color: "#666",
              }}
            >
              <Clock size={48} style={{ marginBottom: 16, opacity: 0.3 }} />
              <p>No WIHs found matching your filters.</p>
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {filteredWihs.map((wih) => (
                <WihCard
                  key={wih.wih_id}
                  wih={wih}
                  isSelected={selectedWihId === wih.wih_id}
                  onClick={() => selectWih(wih.wih_id)}
                  onPickup={() => wih.dag_id && handlePickup(wih.dag_id, wih.node_id)}
                  onClose={(status) => handleClose(wih.wih_id, status)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel: Active Work Details */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "auto",
          padding: 16,
        }}
      >
        {currentWih ? (
          <>
            {/* Header */}
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                marginBottom: 24,
                paddingBottom: 16,
                borderBottom: "1px solid var(--border-subtle, #333)",
              }}
            >
              <div>
                <h2
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    margin: "0 0 8px 0",
                    color: "var(--text-primary, #f0f0f0)",
                  }}
                >
                  {currentWih.title || `WIH ${currentWih.wih_id}`}
                </h2>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    fontSize: 13,
                    color: "#888",
                  }}
                >
                  <span>{currentWih.wih_id}</span>
                  {currentWih.dag_id && (
                    <>
                      <CaretRight size={14} />
                      <button
                        onClick={() => currentWih.dag_id && selectDag(currentWih.dag_id)}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#0a84ff",
                          cursor: "pointer",
                          textDecoration: "underline",
                          padding: 0,
                          fontSize: 13,
                        }}
                      >
                        {currentDag?.metadata?.title || currentWih.dag_id}
                      </button>
                    </>
                  )}
                </div>
              </div>

              <StatusBadge status={currentWih.status} />
            </div>

            {/* Actions */}
            <div
              style={{
                display: "flex",
                gap: 12,
                marginBottom: 24,
              }}
            >
              {(currentWih.status === "open" || currentWih.status === "ready") && (
                <button
                  onClick={() => currentWih.dag_id && handlePickup(currentWih.dag_id, currentWih.node_id)}
                  disabled={isLoading}
                  style={{
                    padding: "10px 20px",
                    background: "#0a84ff",
                    border: "none",
                    borderRadius: 8,
                    color: "#fff",
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: isLoading ? "not-allowed" : "pointer",
                    opacity: isLoading ? 0.5 : 1,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <Play size={16} />
                  Pickup Work
                </button>
              )}

              {(currentWih.status === "signed" || currentWih.status === "in_progress") && (
                <>
                  <button
                    onClick={() => handleClose(currentWih.wih_id, "completed")}
                    disabled={isLoading}
                    style={{
                      padding: "10px 20px",
                      background: "#10b981",
                      border: "none",
                      borderRadius: 8,
                      color: "#fff",
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: isLoading ? "not-allowed" : "pointer",
                      opacity: isLoading ? 0.5 : 1,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <CheckCircle size={16} />
                    Complete
                  </button>

                  <button
                    onClick={() => handleClose(currentWih.wih_id, "failed")}
                    disabled={isLoading}
                    style={{
                      padding: "10px 20px",
                      background: "#ff3b30",
                      border: "none",
                      borderRadius: 8,
                      color: "#fff",
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: isLoading ? "not-allowed" : "pointer",
                      opacity: isLoading ? 0.5 : 1,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <XCircle size={16} />
                    Fail
                  </button>
                </>
              )}
            </div>

            {/* Leases Section */}
            <Section title="Active Leases">
              {leases.filter((l) => l.wih_id === currentWih.wih_id).length === 0 ? (
                <div
                  style={{
                    padding: 16,
                    background: "var(--bg-secondary, #141414)",
                    borderRadius: 8,
                    textAlign: "center",
                    color: "#888",
                  }}
                >
                  <Lock size={24} style={{ marginBottom: 8, opacity: 0.5 }} />
                  <p style={{ margin: 0, fontSize: 13 }}>No active leases for this WIH</p>
                  <button
                    onClick={() => handleRequestLease(currentWih.wih_id)}
                    style={{
                      marginTop: 12,
                      padding: "8px 16px",
                      background: "#0a84ff",
                      border: "none",
                      borderRadius: 6,
                      color: "#fff",
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    Request Lease
                  </button>
                </div>
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  {leases
                    .filter((l) => l.wih_id === currentWih.wih_id)
                    .map((lease) => (
                      <LeaseCard
                        key={lease.lease_id}
                        lease={lease}
                        onRenew={() => renewLease(lease.lease_id)}
                        onRelease={() => releaseLease(lease.lease_id)}
                      />
                    ))}
                </div>
              )}
            </Section>

            {/* Context Packs Section */}
            <Section title="Context Packs">
              {contextPacks.length === 0 ? (
                <div
                  style={{
                    padding: 16,
                    background: "var(--bg-secondary, #141414)",
                    borderRadius: 8,
                    textAlign: "center",
                    color: "#888",
                  }}
                >
                  <FileText size={24} style={{ marginBottom: 8, opacity: 0.5 }} />
                  <p style={{ margin: 0, fontSize: 13 }}>No context packs sealed for this WIH</p>
                </div>
              ) : (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  {contextPacks.map((pack) => (
                    <ContextPackCard key={pack.context_pack_id} pack={pack} />
                  ))}
                </div>
              )}
            </Section>
          </>
        ) : (
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              color: "#666",
            }}
          >
            <User size={64} style={{ marginBottom: 16, opacity: 0.3 }} />
            <p>Select a WIH from the queue to view details</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Section Component
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        marginBottom: 24,
      }}
    >
      <h3
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: "var(--text-primary, #f0f0f0)",
          margin: "0 0 12px 0",
          textTransform: "uppercase",
          letterSpacing: 0.5,
        }}
      >
        {title}
      </h3>
      {children}
    </div>
  );
}

// Status Badge Component
function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; color: string; bg: string }> = {
    open: { label: "Open", color: "#888", bg: "#333" },
    ready: { label: "Ready", color: "#0a84ff", bg: "#0a84ff20" },
    signed: { label: "Signed", color: "#f59e0b", bg: "#f59e0b20" },
    in_progress: { label: "In Progress", color: "#10b981", bg: "#10b98120" },
    blocked: { label: "Blocked", color: "#ff3b30", bg: "#ff3b3020" },
    closed: { label: "Closed", color: "#666", bg: "#333" },
  };

  const { label, color, bg } = config[status] || config.open;

  return (
    <span
      style={{
        padding: "6px 12px",
        background: bg,
        color: color,
        borderRadius: 6,
        fontSize: 12,
        fontWeight: 600,
        textTransform: "uppercase",
      }}
    >
      {label}
    </span>
  );
}

// WIH Card Component
interface WihCardProps {
  wih: WihInfo;
  isSelected: boolean;
  onClick: () => void;
  onPickup: () => void;
  onClose: (status: "completed" | "failed") => void;
}

function WihCard({ wih, isSelected, onClick, onPickup, onClose }: WihCardProps) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: 12,
        background: isSelected ? "#0a84ff10" : "var(--bg-primary, #0a0a0a)",
        border: `1px solid ${isSelected ? "#0a84ff" : "var(--border-subtle, #333)"}`,
        borderRadius: 8,
        cursor: "pointer",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 4,
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--text-primary, #f0f0f0)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            maxWidth: 200,
          }}
        >
          {wih.title || wih.wih_id}
        </span>
        <StatusBadge status={wih.status} />
      </div>

      <div
        style={{
          fontSize: 11,
          color: "#888",
          marginBottom: 8,
        }}
      >
        {wih.node_id}
      </div>

      {wih.blocked_by && wih.blocked_by.length > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            fontSize: 11,
            color: "#ff3b30",
            marginBottom: 8,
          }}
        >
          <Warning size={12} />
          Blocked by: {wih.blocked_by.join(", ")}
        </div>
      )}
    </div>
  );
}

// Lease Card Component
interface LeaseCardProps {
  lease: ManagedLease;
  onRenew: () => void;
  onRelease: () => void;
}

function LeaseCard({ lease, onRenew, onRelease }: LeaseCardProps) {
  const isExpiring = lease.expires_at < Date.now() + 60000;
  const isExpired = lease.expires_at < Date.now();

  return (
    <div
      style={{
        padding: 12,
        background: "var(--bg-primary, #0a0a0a)",
        border: `1px solid ${isExpired ? "#ff3b30" : isExpiring ? "#f59e0b" : "var(--border-subtle, #333)"}`,
        borderRadius: 8,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 8,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          {isExpired ? <LockOpen size={14} color="#ff3b30" /> : <Lock size={14} color="#10b981" />}
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: isExpired ? "#ff3b30" : "var(--text-primary, #f0f0f0)",
            }}
          >
            {isExpired ? "Expired" : isExpiring ? "Expiring Soon" : "Active"}
          </span>
        </div>
        <span
          style={{
            fontSize: 11,
            color: "#888",
          }}
        >
          {new Date(lease.expires_at).toLocaleTimeString()}
        </span>
      </div>

      <div
        style={{
          fontSize: 11,
          color: "#888",
          marginBottom: 8,
        }}
      >
        Paths: {lease.keys?.join(", ") || "None"}
      </div>

      <div
        style={{
          display: "flex",
          gap: 8,
        }}
      >
        <button
          onClick={onRenew}
          disabled={isExpired}
          style={{
            flex: 1,
            padding: "6px 12px",
            background: "#0a84ff",
            border: "none",
            borderRadius: 6,
            color: "#fff",
            fontSize: 11,
            fontWeight: 600,
            cursor: isExpired ? "not-allowed" : "pointer",
            opacity: isExpired ? 0.5 : 1,
          }}
        >
          Renew
        </button>
        <button
          onClick={onRelease}
          style={{
            flex: 1,
            padding: "6px 12px",
            background: "transparent",
            border: "1px solid var(--border-subtle, #333)",
            borderRadius: 6,
            color: "#888",
            fontSize: 11,
            cursor: "pointer",
          }}
        >
          Release
        </button>
      </div>
    </div>
  );
}

// Context Pack Card Component
function ContextPackCard({ pack }: { pack: ContextPack }) {
  return (
    <div
      style={{
        padding: 12,
        background: "var(--bg-primary, #0a0a0a)",
        border: "1px solid var(--border-subtle, #333)",
        borderRadius: 8,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 4,
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "var(--text-primary, #f0f0f0)",
          }}
        >
          {pack.context_pack_id}
        </span>
        <span
          style={{
            fontSize: 11,
            color: "#888",
          }}
        >
          v{pack.version}
        </span>
      </div>
      <div
        style={{
          fontSize: 11,
          color: "#888",
        }}
      >
        Created: {new Date(pack.created_at).toLocaleString()}
      </div>
    </div>
  );
}

export default WorkTab;
