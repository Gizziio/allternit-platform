/**
 * AuditTab - Timeline and Evidence
 * 
 * Features:
 * - Timeline view of ledger events
 * - Search and filters
 * - Context pack details
 * - Receipt evidence view
 * - Export functionality
 */

import React, { useState, useEffect } from "react";
import {
  ClockCounterClockwise,
  MagnifyingGlass,
  Funnel,
  DownloadSimple,
  Calendar,
  CaretDown,
  CaretUp,
  FileText,
  Hash,
  User,
  Clock,
  ArrowsClockwise,
  ArrowUpRight,
} from '@phosphor-icons/react';
import { useUnifiedStore } from "@/lib/agents/unified.store";
import type { LedgerEvent, ContextPack, Receipt } from "@/lib/agents";

export function AuditTab() {
  const {
    ledgerEvents,
    contextPacks,
    receipts,
    dags,
    isLoading,
    fetchLedgerEvents,
    traceEvents,
    fetchContextPacks,
    fetchReceipts,
  } = useUnifiedStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [eventTypeFilter, setEventTypeFilter] = useState<string>("all");
  const [selectedEvent, setSelectedEvent] = useState<LedgerEvent | null>(null);
  const [expandedPacks, setExpandedPacks] = useState<Set<string>>(new Set());

  // Fetch data on mount
  useEffect(() => {
    fetchLedgerEvents(100);
    fetchContextPacks();
    fetchReceipts();
  }, [fetchLedgerEvents, fetchContextPacks, fetchReceipts]);

  const eventTypes = [...new Set(ledgerEvents.map((e) => e.event_type))];

  const filteredEvents = ledgerEvents.filter((event) => {
    const matchesSearch = searchQuery === "" ||
      event.event_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      JSON.stringify(event.payload).toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.scope?.dag_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.scope?.wih_id?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesType = eventTypeFilter === "all" || event.event_type === eventTypeFilter;
    
    return matchesSearch && matchesType;
  });

  const togglePackExpansion = (packId: string) => {
    const newSet = new Set(expandedPacks);
    if (newSet.has(packId)) {
      newSet.delete(packId);
    } else {
      newSet.add(packId);
    }
    setExpandedPacks(newSet);
  };

  const handleExport = (format: "json" | "csv") => {
    const data = {
      events: ledgerEvents,
      receipts,
      contextPacks,
      exportedAt: new Date().toISOString(),
    };

    if (format === "json") {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-export-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      // CSV export
      const csv = convertToCSV(ledgerEvents);
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-export-${Date.now()}.csv`;
      a.click();
      URL.revokeObjectURL(url);
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
      {/* Left Panel: Timeline */}
      <div
        style={{
          width: 450,
          display: "flex",
          flexDirection: "column",
          borderRight: "1px solid var(--border-subtle, #333)",
          background: "var(--bg-secondary, #141414)",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: 16,
            borderBottom: "1px solid var(--border-subtle, #333)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 12,
            }}
          >
            <h3
              style={{
                fontSize: 16,
                fontWeight: 700,
                margin: 0,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <ClockCounterClockwise size={18} />
              Event Timeline
            </h3>
            <button
              onClick={() => fetchLedgerEvents(100)}
              style={{
                padding: 6,
                background: "transparent",
                border: "none",
                cursor: "pointer",
              }}
            >
              <ArrowsClockwise size={14} color="#888" />
            </button>
          </div>

          {/* Search */}
          <div
            style={{
              display: "flex",
              gap: 8,
            }}
          >
            <div
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 12px",
                background: "var(--bg-primary, #0a0a0a)",
                border: "1px solid var(--border-subtle, #333)",
                borderRadius: 6,
              }}
            >
              <MagnifyingGlass size={14} color="#888" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search events..."
                style={{
                  flex: 1,
                  background: "transparent",
                  border: "none",
                  color: "var(--text-primary, #f0f0f0)",
                  fontSize: 12,
                  outline: "none",
                }}
              />
            </div>
            <select
              value={eventTypeFilter}
              onChange={(e) => setEventTypeFilter(e.target.value)}
              style={{
                padding: "8px 12px",
                background: "var(--bg-primary, #0a0a0a)",
                border: "1px solid var(--border-subtle, #333)",
                borderRadius: 6,
                color: "var(--text-primary, #f0f0f0)",
                fontSize: 12,
              }}
            >
              <option value="all">All Types</option>
              {eventTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Event List */}
        <div
          style={{
            flex: 1,
            overflow: "auto",
            padding: 12,
          }}
        >
          {filteredEvents.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: 40,
                color: "#666",
              }}
            >
              <ClockCounterClockwise size={48} style={{ marginBottom: 16, opacity: 0.3 }} />
              <p>No events found</p>
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              {filteredEvents.map((event) => (
                <EventCard
                  key={event.event_id}
                  event={event}
                  isSelected={selectedEvent?.event_id === event.event_id}
                  onClick={() => setSelectedEvent(event)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Export */}
        <div
          style={{
            padding: 12,
            borderTop: "1px solid var(--border-subtle, #333)",
            display: "flex",
            gap: 8,
          }}
        >
          <button
            onClick={() => handleExport("json")}
            style={{
              flex: 1,
              padding: "10px",
              background: "var(--bg-primary, #0a0a0a)",
              border: "1px solid var(--border-subtle, #333)",
              borderRadius: 6,
              color: "var(--text-primary, #f0f0f0)",
              fontSize: 12,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            <DownloadSimple size={14} />
            Export JSON
          </button>
          <button
            onClick={() => handleExport("csv")}
            style={{
              flex: 1,
              padding: "10px",
              background: "var(--bg-primary, #0a0a0a)",
              border: "1px solid var(--border-subtle, #333)",
              borderRadius: 6,
              color: "var(--text-primary, #f0f0f0)",
              fontSize: 12,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            <DownloadSimple size={14} />
            Export CSV
          </button>
        </div>
      </div>

      {/* Right Panel: Details */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflow: "auto",
          padding: 24,
        }}
      >
        {selectedEvent ? (
          <>
            <EventDetail event={selectedEvent} />
            
            {/* Related Context Packs */}
            <Section title="Related Context Packs">
              {contextPacks
                .filter(
                  (p) =>
                    p.inputs.dag_id === selectedEvent.scope?.dag_id ||
                    p.inputs.wih_id === selectedEvent.scope?.wih_id
                )
                .map((pack) => (
                  <ContextPackDetail
                    key={pack.context_pack_id}
                    pack={pack}
                    isExpanded={expandedPacks.has(pack.context_pack_id)}
                    onToggle={() => togglePackExpansion(pack.context_pack_id)}
                  />
                ))}
            </Section>

            {/* Related Receipts */}
            <Section title="Related Receipts">
              {receipts
                .filter(
                  (r) =>
                    r.dag_id === selectedEvent.scope?.dag_id ||
                    r.wih_id === selectedEvent.scope?.wih_id
                )
                .map((receipt) => (
                  <ReceiptDetail key={receipt.receipt_id} receipt={receipt} />
                ))}
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
            <ClockCounterClockwise size={64} style={{ marginBottom: 16, opacity: 0.3 }} />
            <p>Select an event to view details</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Section Component
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <h4
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
      </h4>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {children}
      </div>
    </div>
  );
}

// Event Card Component
function EventCard({
  event,
  isSelected,
  onClick,
}: {
  event: LedgerEvent;
  isSelected: boolean;
  onClick: () => void;
}) {
  const eventColors: Record<string, string> = {
    dag_created: "#0a84ff",
    wih_created: "#10b981",
    wih_pickup: "#f59e0b",
    wih_close: "#6366f1",
    lease_granted: "#ec4899",
    receipt_written: "#8b5cf6",
  };

  const color = eventColors[event.event_type] || "#888";

  return (
    <div
      onClick={onClick}
      style={{
        padding: 12,
        background: isSelected ? "#0a84ff10" : "var(--bg-primary, #0a0a0a)",
        border: `1px solid ${isSelected ? "#0a84ff" : "var(--border-subtle, #333)"}`,
        borderRadius: 8,
        cursor: "pointer",
        display: "flex",
        gap: 12,
      }}
    >
      <div
        style={{
          width: 3,
          borderRadius: 2,
          background: color,
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
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
              color: color,
            }}
          >
            {event.event_type}
          </span>
          <span
            style={{
              fontSize: 10,
              color: "#666",
            }}
          >
            {new Date(event.timestamp).toLocaleTimeString()}
          </span>
        </div>
        <div
          style={{
            fontSize: 11,
            color: "#888",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {event.scope?.dag_id || event.scope?.wih_id || event.event_id}
        </div>
      </div>
    </div>
  );
}

// Event Detail Component
function EventDetail({ event }: { event: LedgerEvent }) {
  return (
    <div
      style={{
        background: "var(--bg-secondary, #141414)",
        border: "1px solid var(--border-subtle, #333)",
        borderRadius: 12,
        padding: 20,
        marginBottom: 24,
      }}
    >
      <h3
        style={{
          fontSize: 18,
          fontWeight: 700,
          margin: "0 0 16px 0",
        }}
      >
        {event.event_type}
      </h3>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: 16,
          marginBottom: 16,
        }}
      >
        <DetailItem label="Event ID" value={event.event_id} />
        <DetailItem
          label="Timestamp"
          value={new Date(event.timestamp).toLocaleString()}
        />
        {event.scope?.dag_id && (
          <DetailItem label="DAG ID" value={event.scope.dag_id} />
        )}
        {event.scope?.node_id && (
          <DetailItem label="Node ID" value={event.scope.node_id} />
        )}
        {event.scope?.wih_id && (
          <DetailItem label="WIH ID" value={event.scope.wih_id} />
        )}
      </div>

      <div>
        <label
          style={{
            display: "block",
            fontSize: 12,
            color: "#888",
            marginBottom: 8,
          }}
        >
          Payload
        </label>
        <pre
          style={{
            background: "var(--bg-primary, #0a0a0a)",
            padding: 16,
            borderRadius: 8,
            fontSize: 12,
            overflow: "auto",
            maxHeight: 200,
            margin: 0,
          }}
        >
          {JSON.stringify(event.payload, null, 2)}
        </pre>
      </div>
    </div>
  );
}

// Detail Item Component
function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label
        style={{
          display: "block",
          fontSize: 11,
          color: "#888",
          marginBottom: 4,
          textTransform: "uppercase",
        }}
      >
        {label}
      </label>
      <div
        style={{
          fontSize: 13,
          fontFamily: "monospace",
          color: "var(--text-primary, #f0f0f0)",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
        title={value}
      >
        {value}
      </div>
    </div>
  );
}

// Context Pack Detail Component
function ContextPackDetail({
  pack,
  isExpanded,
  onToggle,
}: {
  pack: ContextPack;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      style={{
        background: "var(--bg-secondary, #141414)",
        border: "1px solid var(--border-subtle, #333)",
        borderRadius: 8,
        overflow: "hidden",
      }}
    >
      <div
        onClick={onToggle}
        style={{
          padding: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: "pointer",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <FileText size={16} color="#0a84ff" />
          <div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {pack.context_pack_id}
            </div>
            <div
              style={{
                fontSize: 11,
                color: "#888",
              }}
            >
              v{pack.version} • {new Date(pack.created_at).toLocaleDateString()}
            </div>
          </div>
        </div>
        {isExpanded ? <CaretUp size={16} color="#888" /> : <CaretDown size={16} color="#888" />}
      </div>

      {isExpanded && (
        <div
          style={{
            padding: 12,
            borderTop: "1px solid var(--border-subtle, #333)",
            background: "var(--bg-primary, #0a0a0a)",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: 12,
              marginBottom: 12,
            }}
          >
            <DetailItem label="DAG ID" value={pack.inputs.dag_id} />
            <DetailItem label="Node ID" value={pack.inputs.node_id} />
            <DetailItem label="WIH ID" value={pack.inputs.wih_id} />
            <DetailItem label="Correlation ID" value={pack.correlation_id} />
          </div>
          {pack.inputs.receipt_refs && pack.inputs.receipt_refs.length > 0 && (
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 11,
                  color: "#888",
                  marginBottom: 4,
                }}
              >
                Receipt References ({pack.inputs.receipt_refs.length})
              </label>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 4,
                }}
              >
                {pack.inputs.receipt_refs.map((ref) => (
                  <span
                    key={ref as string}
                    style={{
                      padding: "4px 8px",
                      background: "var(--bg-secondary, #141414)",
                      borderRadius: 4,
                      fontSize: 10,
                      fontFamily: "monospace",
                      color: "#888",
                    }}
                  >
                    {ref.slice(0, 16)}...
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Receipt Detail Component
function ReceiptDetail({ receipt }: { receipt: Receipt }) {
  const kindColors: Record<string, string> = {
    tool_call_post: "#0a84ff",
    validator_report: "#10b981",
    build_report: "#f59e0b",
    gate_decision: "#ec4899",
    session_start: "#6366f1",
    dag_load: "#8b5cf6",
    node_entry: "#06b6d4",
    context_pack_sealed: "#84cc16",
  };

  return (
    <div
      style={{
        background: "var(--bg-secondary, #141414)",
        border: "1px solid var(--border-subtle, #333)",
        borderRadius: 8,
        padding: 12,
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
          <span
            style={{
              padding: "4px 8px",
              background: `${kindColors[receipt.kind] || "#888"}20`,
              borderRadius: 4,
              fontSize: 10,
              fontWeight: 600,
              color: kindColors[receipt.kind] || "#888",
              textTransform: "uppercase",
            }}
          >
            {receipt.kind}
          </span>
          <span
            style={{
              fontSize: 12,
              fontFamily: "monospace",
              color: "#888",
            }}
          >
            {receipt.receipt_id.slice(0, 20)}...
          </span>
        </div>
        <span
          style={{
            fontSize: 11,
            color: "#666",
          }}
        >
          {new Date(receipt.timestamp).toLocaleTimeString()}
        </span>
      </div>
      <div
        style={{
          fontSize: 11,
          color: "#888",
          marginBottom: 8,
        }}
      >
        Run: {receipt.run_id.slice(0, 16)}...
      </div>
      <pre
        style={{
          background: "var(--bg-primary, #0a0a0a)",
          padding: 12,
          borderRadius: 6,
          fontSize: 11,
          overflow: "auto",
          maxHeight: 150,
          margin: 0,
        }}
      >
        {JSON.stringify(receipt.payload, null, 2)}
      </pre>
    </div>
  );
}

// Helper Functions
function convertToCSV(events: LedgerEvent[]): string {
  const headers = ["event_id", "event_type", "timestamp", "dag_id", "node_id", "wih_id", "payload"];
  const rows = events.map((e) => [
    e.event_id,
    e.event_type,
    e.timestamp,
    e.scope?.dag_id || "",
    e.scope?.node_id || "",
    e.scope?.wih_id || "",
    JSON.stringify(e.payload),
  ]);
  return [headers.join(","), ...rows.map((r) => r.map((v) => `"${v}"`).join(","))].join("\n");
}

export default AuditTab;
