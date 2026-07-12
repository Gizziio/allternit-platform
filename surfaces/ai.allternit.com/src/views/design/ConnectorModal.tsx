"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Key, CheckCircle, Circle, Trash, MagnifyingGlass, Plug } from "@phosphor-icons/react";
import {
  listOwnedConnectors,
  connectOwned,
  disconnectOwned,
  type OwnedConnector,
  type OwnedConnectStatus,
} from "../../lib/design/owned-connector";

interface Props {
  onClose: () => void;
  onConnect?: () => void;
}

// The catalog now spans 1,000+ entries (legacy Allternit list + every
// open-connector sidecar provider). Rendering all of them as real DOM nodes
// at once is a real jank risk with no search query active, so the unfiltered
// view is capped and expandable; an active search narrows the set naturally
// and always shows every match.
const INITIAL_VISIBLE_COUNT = 80;
const VISIBLE_COUNT_STEP = 120;

export function ConnectorModal({ onClose, onConnect }: Props) {
  const [connectors, setConnectors] = useState<OwnedConnector[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<Record<string, string>>({});
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_COUNT);

  async function refresh() {
    setLoading(true);
    try {
      const list = await listOwnedConnectors();
      setConnectors(list);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return connectors;
    return connectors.filter((c) =>
      [c.id, c.name, c.category, c.description].some((v) => (v || "").toLowerCase().includes(q)),
    );
  }, [connectors, query]);

  // Reset the visible window whenever the underlying match set changes so a
  // new search always starts from a sane, fast-to-render slice.
  useEffect(() => {
    setVisibleCount(INITIAL_VISIBLE_COUNT);
  }, [query, connectors]);

  const isSearching = query.trim().length > 0;
  const visible = isSearching ? filtered : filtered.slice(0, visibleCount);
  const remaining = filtered.length - visible.length;

  function setInline(id: string, msg: string) {
    setNote((prev) => ({ ...prev, [id]: msg }));
  }

  async function handleConnect(c: OwnedConnector) {
    setBusy(c.id);
    setInline(c.id, "");
    try {
      const r: OwnedConnectStatus = await connectOwned(c.id);
      switch (r.status) {
        case "connected":
          onConnect?.();
          await refresh();
          break;
        case "authorization_required": {
          const url = (r as { authorize_url?: string }).authorize_url;
          if (url) window.open(url, "_blank", "width=600,height=700");
          setInline(c.id, "Authorize Allternit in the opened window, then click Refresh.");
          break;
        }
        case "oauth_app_registration_required": {
          const env = (r as { set_env?: string }).set_env;
          setInline(
            c.id,
            env
              ? `One-time setup: set ${env} (the Allternit OAuth app for ${c.name}), then Connect again. No third-party key.`
              : "One-time Allternit OAuth app required, then Connect again.",
          );
          break;
        }
        case "device_provider_reached":
        case "owned_oauth_endpoint_mapping_needed":
          setInline(c.id, (r as { message?: string }).message || r.status);
          break;
        default:
          setInline(c.id, (r as { message?: string }).message || `Status: ${r.status}`);
      }
    } catch (e) {
      setInline(c.id, e instanceof Error ? e.message : "connect failed");
    } finally {
      setBusy(null);
    }
  }

  async function handleDisconnect(c: OwnedConnector) {
    setBusy(c.id);
    try {
      await disconnectOwned(c.id);
      await refresh();
    } finally {
      setBusy(null);
    }
  }

  const isConnected = (c: OwnedConnector) => c.connection?.status === "connected";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ duration: 0.25, ease: [0.2, 0, 0, 1] }}
        onClick={(e) => e.stopPropagation()}
        style={{ background: "var(--bg-primary, #fff)", border: "1px solid var(--border-subtle, rgba(0,0,0,0.08))", borderRadius: "24px", width: "100%", maxWidth: "560px", maxHeight: "80vh", overflow: "hidden", boxShadow: "0 32px 80px rgba(0,0,0,0.2)", display: "flex", flexDirection: "column" }}
      >
        {/* Header */}
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border-subtle, rgba(0,0,0,0.08))", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "32px", height: "32px", borderRadius: "10px", background: "var(--accent-primary, #e27c59)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Plug size={16} color="#fff" weight="bold" />
            </div>
            <div>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary, #111)" }}>Allternit Connectors</div>
              <div style={{ fontSize: "11px", color: "var(--text-secondary, #666)", marginTop: "1px" }}>
                Owned in-process · one-click connect · no third-party key
              </div>
            </div>
          </div>
          <button type="button" onClick={onClose} style={{ width: "28px", height: "28px", borderRadius: "8px", background: "rgba(0,0,0,0.05)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <X size={14} />
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: "12px 24px", borderBottom: "1px solid var(--border-subtle, rgba(0,0,0,0.08))" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 10, border: "1px solid var(--border-default, rgba(0,0,0,0.12))", background: "var(--bg-secondary, #f9f9f9)" }}>
            <MagnifyingGlass size={14} color="var(--text-tertiary, #888)" />
            <input
              aria-label="Search connectors"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${connectors.length || 181} connectors…`}
              style={{ flex: 1, border: "none", background: "transparent", fontSize: 12, outline: "none", color: "var(--text-primary, #111)" }}
            />
          </div>
        </div>

        {/* List */}
        <div style={{ padding: "16px 24px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ fontSize: 12, color: "var(--text-secondary, #666)", padding: 12 }}>
                Loading Allternit connectors…
              </motion.div>
            ) : (
              <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {visible.map((c) => {
                  const connected = isConnected(c);
                  const localCli = c.auth_type === "local_cli";
                  const ready = localCli && c.availability?.installed && c.availability?.authed;
                  return (
                    <div key={c.id} style={{ padding: 12, borderRadius: 12, border: "1px solid var(--border-subtle, rgba(0,0,0,0.08))", background: connected ? "rgba(34,197,94,0.04)" : "transparent" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary, #111)" }}>{c.name}</span>
                            <span style={{ fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 999, background: "rgba(226,124,89,0.12)", color: "var(--accent-primary, #e27c59)" }}>Allternit</span>
                            <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 999, background: "var(--bg-secondary, #f0f0f0)", color: "var(--text-tertiary, #777)" }}>{c.auth_type}</span>
                            {c.category && <span style={{ fontSize: 10, color: "var(--text-tertiary, #999)" }}>{c.category}</span>}
                          </div>
                          {localCli && c.availability && (
                            <div style={{ fontSize: 10, color: ready ? "#16a34a" : "var(--text-tertiary, #888)", marginTop: 3 }}>
                              {c.availability.installed
                                ? c.availability.authed
                                  ? `${c.availability.cmd} ready${c.availability.account ? ` · ${c.availability.account}` : ""}`
                                  : `${c.availability.cmd} installed · run its login once`
                                : `${c.availability.cmd} not installed on this machine`}
                            </div>
                          )}
                        </div>
                        <div style={{ flexShrink: 0 }}>
                          {connected ? (
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: "#16a34a" }}>
                                <CheckCircle size={14} weight="fill" /> Connected
                              </span>
                              <button type="button" onClick={() => handleDisconnect(c)} disabled={busy === c.id} title="Disconnect" style={{ padding: 6, borderRadius: 8, border: "1px solid #fecaca", background: "#fef2f2", color: "#dc2626", cursor: "pointer", display: "flex", alignItems: "center" }}>
                                <Trash size={13} />
                              </button>
                            </div>
                          ) : (
                            <button type="button" onClick={() => handleConnect(c)} disabled={busy === c.id} style={{ padding: "6px 12px", borderRadius: 8, border: "none", background: "var(--accent-primary, #e27c59)", color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, opacity: busy === c.id ? 0.6 : 1 }}>
                              {busy === c.id ? "…" : <Circle size={12} />} Connect
                            </button>
                          )}
                        </div>
                      </div>
                      {note[c.id] && (
                        <div style={{ marginTop: 8, fontSize: 11, lineHeight: 1.5, color: "var(--text-secondary, #555)", background: "var(--bg-secondary, #f7f7f7)", border: "1px solid var(--border-subtle, rgba(0,0,0,0.06))", borderRadius: 8, padding: "8px 10px", wordBreak: "break-word" }}>
                          {note[c.id]}
                        </div>
                      )}
                    </div>
                  );
                })}
                {filtered.length === 0 && (
                  <div style={{ fontSize: 12, color: "var(--text-secondary, #666)", padding: 12 }}>No connectors match “{query}”.</div>
                )}
                {!isSearching && remaining > 0 && (
                  <button
                    type="button"
                    onClick={() => setVisibleCount((n) => n + VISIBLE_COUNT_STEP)}
                    style={{ width: "100%", padding: 8, borderRadius: 10, border: "1px dashed var(--border-default, rgba(0,0,0,0.12))", background: "transparent", fontSize: 11, fontWeight: 600, cursor: "pointer", color: "var(--text-secondary, #666)" }}
                  >
                    Show {Math.min(remaining, VISIBLE_COUNT_STEP)} more ({remaining} left) — or search above
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <button type="button" onClick={refresh} disabled={loading} style={{ width: "100%", padding: 8, borderRadius: 10, border: "1px solid var(--border-default, rgba(0,0,0,0.12))", background: "transparent", fontSize: 11, fontWeight: 600, cursor: "pointer", color: "var(--text-secondary, #666)", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <Key size={12} /> Refresh
          </button>
          <button type="button" onClick={onClose} style={{ width: "100%", padding: 10, borderRadius: 10, border: "1px solid var(--border-default, rgba(0,0,0,0.12))", background: "transparent", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "var(--text-secondary, #666)" }}>
            Done
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
