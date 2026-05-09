"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle, Circle, Spinner } from "@phosphor-icons/react";
import { getComposioConnections, initiateComposioConnect, type ComposioApp } from "../../lib/design/composio-connector";

interface Props {
  onClose: () => void;
}

const APPS: { id: ComposioApp; label: string }[] = [
  { id: "github", label: "GitHub" },
  { id: "linear", label: "Linear" },
  { id: "notion", label: "Notion" },
  { id: "gmail", label: "Gmail" },
  { id: "slack", label: "Slack" },
];

export function ComposioSetupModal({ onClose }: Props) {
  const [connections, setConnections] = useState<Record<ComposioApp, boolean>>({
    github: false, linear: false, notion: false, gmail: false, slack: false,
  });
  const [loading, setLoading] = useState<ComposioApp | null>(null);

  const refresh = useCallback(async () => {
    const list = await getComposioConnections();
    const map: Record<string, boolean> = {};
    for (const c of list) map[c.app] = c.connected;
    setConnections(prev => ({ ...prev, ...map }));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  useEffect(() => {
    // Clean up any stray popup timers on unmount
    return () => { /* any global timers would go here */ };
  }, []);

  async function handleConnect(app: ComposioApp) {
    setLoading(app);
    try {
      const { authUrl } = await initiateComposioConnect(app);
      const popup = window.open(authUrl, '_blank', 'width=600,height=700');
      if (!popup) {
        setLoading(null);
        return;
      }
      const timer = setInterval(() => {
        if (popup.closed) {
          clearInterval(timer);
          refresh();
          setLoading(null);
        }
      }, 500);
      // Safety cleanup after 5 minutes
      setTimeout(() => { clearInterval(timer); setLoading(null); }, 300_000);
    } catch {
      setLoading(null);
    }
  }

  function handleSkip() {
    localStorage.setItem('composio-setup-skipped', '1');
    onClose();
  }

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
        onClick={e => e.stopPropagation()}
        style={{ background: "var(--bg-primary, #fff)", border: "1px solid var(--border-subtle, rgba(0,0,0,0.08))", borderRadius: "24px", width: "100%", maxWidth: "420px", overflow: "hidden", boxShadow: "0 32px 80px rgba(0,0,0,0.2)" }}
      >
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border-subtle, rgba(0,0,0,0.08))", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary, #111)" }}>Connect Work Tools</div>
            <div style={{ fontSize: "11px", color: "var(--text-secondary, #666)", marginTop: "1px" }}>Link your tools for Orbit daily briefings</div>
          </div>
          <button onClick={onClose} style={{ width: "28px", height: "28px", borderRadius: "8px", background: "rgba(0,0,0,0.05)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <X size={14} />
          </button>
        </div>

        <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "12px" }}>
          {APPS.map(app => (
            <div key={app.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: "10px", border: "1px solid var(--border-subtle, rgba(0,0,0,0.08))" }}>
              <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary, #111)" }}>{app.label}</span>
              {connections[app.id] ? (
                <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "11px", fontWeight: 700, color: "#16a34a" }}>
                  <CheckCircle size={14} weight="fill" /> Connected
                </div>
              ) : (
                <button
                  onClick={() => handleConnect(app.id)}
                  disabled={loading === app.id}
                  style={{ padding: "5px 12px", borderRadius: "6px", border: "1px solid var(--border-default, rgba(0,0,0,0.12))", background: "transparent", fontSize: "11px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
                >
                  {loading === app.id ? <Spinner size={12} className="spin" /> : <Circle size={12} />}
                  Connect
                </button>
              )}
            </div>
          ))}

          <button
            onClick={handleSkip}
            style={{ marginTop: 4, padding: "10px", borderRadius: "10px", border: "1px solid var(--border-default, rgba(0,0,0,0.12))", background: "transparent", fontSize: "13px", fontWeight: 600, cursor: "pointer", color: "var(--text-secondary, #666)" }}
          >
            Skip for now
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
