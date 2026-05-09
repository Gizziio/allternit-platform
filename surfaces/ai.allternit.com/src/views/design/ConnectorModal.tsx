"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Key, Cloud, ArrowRight, CheckCircle, Circle, Trash, Sparkle } from "@phosphor-icons/react";
import {
  getStoredTokens,
  saveToken,
  removeToken,
  type ConnectorApp,
  fetchGitHubActivity,
  fetchLinearIssues,
  fetchNotionPages,
} from "../../lib/design/direct-connectors";
import { getComposioConnections, initiateComposioConnect, type ComposioApp } from "../../lib/design/composio-connector";

interface Props {
  onClose: () => void;
  onConnect?: () => void;
}

type Tab = "direct" | "composio";

const DIRECT_APPS: { id: ConnectorApp; label: string; placeholder: string; helpUrl: string }[] = [
  { id: "github", label: "GitHub", placeholder: "ghp_xxxxxxxxxxxx", helpUrl: "https://github.com/settings/tokens" },
  { id: "linear", label: "Linear", placeholder: "lin_api_xxxxxxxxxxxx", helpUrl: "https://linear.app/settings/api" },
  { id: "notion", label: "Notion", placeholder: "secret_xxxxxxxxxxxx", helpUrl: "https://www.notion.so/my-integrations" },
  { id: "slack", label: "Slack", placeholder: "xoxb-xxxxxxxxxxxx", helpUrl: "https://api.slack.com/apps" },
];

const COMPOSIO_APPS: { id: ComposioApp; label: string }[] = [
  { id: "github", label: "GitHub" },
  { id: "linear", label: "Linear" },
  { id: "notion", label: "Notion" },
  { id: "gmail", label: "Gmail" },
  { id: "slack", label: "Slack" },
];

export function ConnectorModal({ onClose, onConnect }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("direct");
  const [tokens, setTokens] = useState<Record<ConnectorApp, string>>({ github: "", linear: "", notion: "", slack: "", gmail: "" });
  const [stored, setStored] = useState(getStoredTokens());
  const [testing, setTesting] = useState<ConnectorApp | null>(null);
  const [testResult, setTestResult] = useState<Record<ConnectorApp, "ok" | "error" | null>>({ github: null, linear: null, notion: null, slack: null, gmail: null });
  const [composioConnections, setComposioConnections] = useState<Record<string, boolean>>({});
  const [composioLoading, setComposioLoading] = useState<ComposioApp | null>(null);
  const [composioAvailable, setComposioAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    const map: Record<string, string> = {};
    for (const t of stored) map[t.app] = t.token;
    setTokens((prev) => ({ ...prev, ...map }));
  }, [stored]);

  useEffect(() => {
    // Check if Composio is configured
    getComposioConnections()
      .then((list) => {
        const map: Record<string, boolean> = {};
        for (const c of list) map[c.app] = c.connected;
        setComposioConnections(map);
        setComposioAvailable(true);
      })
      .catch(() => setComposioAvailable(false));
  }, []);

  async function handleTest(app: ConnectorApp) {
    const token = tokens[app];
    if (!token) return;
    setTesting(app);
    setTestResult((prev) => ({ ...prev, [app]: null }));
    try {
      if (app === "github") await fetchGitHubActivity(token);
      if (app === "linear") await fetchLinearIssues(token);
      if (app === "notion") await fetchNotionPages(token);
      setTestResult((prev) => ({ ...prev, [app]: "ok" }));
    } catch {
      setTestResult((prev) => ({ ...prev, [app]: "error" }));
    } finally {
      setTesting(null);
    }
  }

  function handleSave(app: ConnectorApp) {
    const token = tokens[app];
    if (!token) return;
    saveToken({ app, token, connectedAt: new Date().toISOString() });
    setStored(getStoredTokens());
    onConnect?.();
  }

  function handleRemove(app: ConnectorApp) {
    removeToken(app);
    setTokens((prev) => ({ ...prev, [app]: "" }));
    setStored(getStoredTokens());
    setTestResult((prev) => ({ ...prev, [app]: null }));
  }

  async function handleComposioConnect(app: ComposioApp) {
    setComposioLoading(app);
    try {
      const { authUrl } = await initiateComposioConnect(app);
      const popup = window.open(authUrl, "_blank", "width=600,height=700");
      if (!popup) {
        setComposioLoading(null);
        return;
      }
      const timer = setInterval(() => {
        if (popup.closed) {
          clearInterval(timer);
          getComposioConnections().then((list) => {
            const map: Record<string, boolean> = {};
            for (const c of list) map[c.app] = c.connected;
            setComposioConnections(map);
          });
          setComposioLoading(null);
        }
      }, 500);
      setTimeout(() => { clearInterval(timer); setComposioLoading(null); }, 300_000);
    } catch {
      setComposioLoading(null);
    }
  }

  const connectedDirect = new Set(stored.map((t) => t.app));

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
        style={{ background: "var(--bg-primary, #fff)", border: "1px solid var(--border-subtle, rgba(0,0,0,0.08))", borderRadius: "24px", width: "100%", maxWidth: "480px", overflow: "hidden", boxShadow: "0 32px 80px rgba(0,0,0,0.2)" }}
      >
        {/* Header */}
        <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border-subtle, rgba(0,0,0,0.08))", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "32px", height: "32px", borderRadius: "10px", background: "var(--accent-primary, #e27c59)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Key size={16} color="#fff" weight="bold" />
            </div>
            <div>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary, #111)" }}>Connect Work Tools</div>
              <div style={{ fontSize: "11px", color: "var(--text-secondary, #666)", marginTop: "1px" }}>Choose your connection method</div>
            </div>
          </div>
          <button onClick={onClose} style={{ width: "28px", height: "28px", borderRadius: "8px", background: "rgba(0,0,0,0.05)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <X size={14} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid var(--border-subtle, rgba(0,0,0,0.08))" }}>
          <button
            onClick={() => setActiveTab("direct")}
            style={{
              flex: 1, padding: "12px", border: "none", background: activeTab === "direct" ? "var(--bg-secondary, #f9f9f9)" : "transparent",
              fontSize: "12px", fontWeight: 700, color: activeTab === "direct" ? "var(--text-primary, #111)" : "var(--text-secondary, #666)",
              cursor: "pointer", borderBottom: activeTab === "direct" ? "2px solid var(--accent-primary, #e27c59)" : "2px solid transparent",
            }}
          >
            <Key size={12} style={{ marginRight: 4, verticalAlign: "middle" }} /> Direct Tokens
          </button>
          <button
            onClick={() => setActiveTab("composio")}
            style={{
              flex: 1, padding: "12px", border: "none", background: activeTab === "composio" ? "var(--bg-secondary, #f9f9f9)" : "transparent",
              fontSize: "12px", fontWeight: 700, color: activeTab === "composio" ? "var(--text-primary, #111)" : "var(--text-secondary, #666)",
              cursor: "pointer", borderBottom: activeTab === "composio" ? "2px solid var(--accent-primary, #e27c59)" : "2px solid transparent",
            }}
          >
            <Cloud size={12} style={{ marginRight: 4, verticalAlign: "middle" }} /> Composio
          </button>
        </div>

        <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "16px" }}>
          <AnimatePresence mode="wait">
            {activeTab === "direct" && (
              <motion.div key="direct" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <div style={{ fontSize: "12px", color: "var(--text-secondary, #666)", marginBottom: 12, lineHeight: 1.5 }}>
                  Paste your own API tokens. Free, no third-party service required. Tokens are stored locally in your browser.
                </div>
                {DIRECT_APPS.map((app) => (
                  <div key={app.id} style={{ padding: "12px", borderRadius: "12px", border: "1px solid var(--border-subtle, rgba(0,0,0,0.08))", background: connectedDirect.has(app.id) ? "rgba(34,197,94,0.04)" : "transparent", marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary, #111)" }}>{app.label}</span>
                      {connectedDirect.has(app.id) ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "11px", fontWeight: 700, color: "#16a34a" }}>
                          <CheckCircle size={14} weight="fill" /> Connected
                        </div>
                      ) : (
                        <span style={{ fontSize: "11px", color: "var(--text-tertiary, #666)" }}>Not connected</span>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input
                        type="password"
                        value={tokens[app.id]}
                        onChange={(e) => setTokens((prev) => ({ ...prev, [app.id]: e.target.value }))}
                        placeholder={app.placeholder}
                        style={{ flex: 1, padding: "8px 10px", borderRadius: "8px", border: "1px solid var(--border-default, rgba(0,0,0,0.12))", fontSize: "12px", outline: "none", fontFamily: "var(--font-mono, monospace)", background: "var(--bg-secondary, #f9f9f9)" }}
                      />
                      {connectedDirect.has(app.id) ? (
                        <button onClick={() => handleRemove(app.id)} style={{ padding: "8px", borderRadius: "8px", border: "1px solid #fecaca", background: "#fef2f2", color: "#dc2626", cursor: "pointer", display: "flex", alignItems: "center" }} title="Disconnect">
                          <Trash size={14} />
                        </button>
                      ) : (
                        <>
                          <button onClick={() => handleTest(app.id)} disabled={!tokens[app.id] || testing === app.id} style={{ padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--border-default, rgba(0,0,0,0.12))", background: "transparent", fontSize: "11px", fontWeight: 700, cursor: "pointer", opacity: !tokens[app.id] ? 0.4 : 1 }}>
                            {testing === app.id ? "…" : testResult[app.id] === "ok" ? "✓" : testResult[app.id] === "error" ? "✗" : "Test"}
                          </button>
                          <button onClick={() => handleSave(app.id)} disabled={!tokens[app.id] || testResult[app.id] === "error"} style={{ padding: "8px 12px", borderRadius: "8px", border: "none", background: "var(--accent-primary, #e27c59)", color: "#fff", fontSize: "11px", fontWeight: 700, cursor: "pointer", opacity: !tokens[app.id] || testResult[app.id] === "error" ? 0.4 : 1 }}>
                            <ArrowRight size={12} />
                          </button>
                        </>
                      )}
                    </div>
                    <a href={app.helpUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: "10px", color: "var(--text-tertiary, #666)", marginTop: 6, display: "inline-flex", alignItems: "center", gap: 2 }}>
                      <Sparkle size={10} /> Get your {app.label} token →
                    </a>
                  </div>
                ))}
              </motion.div>
            )}

            {activeTab === "composio" && (
              <motion.div key="composio" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {composioAvailable === false && (
                  <div style={{ padding: 16, borderRadius: 10, background: "#fef2f2", border: "1px solid #fecaca", fontSize: 12, color: "#dc2626", marginBottom: 12 }}>
                    Composio is not configured. Add <code>COMPOSIO_API_KEY</code> to your <code>.env.local</code> to enable managed OAuth connections.
                  </div>
                )}
                <div style={{ fontSize: "12px", color: "var(--text-secondary, #666)", marginBottom: 12, lineHeight: 1.5 }}>
                  Managed OAuth via Composio. No tokens to paste — just click Connect and authorize.
                </div>
                {COMPOSIO_APPS.map((app) => (
                  <div key={app.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", borderRadius: "10px", border: "1px solid var(--border-subtle, rgba(0,0,0,0.08))", marginBottom: 8 }}>
                    <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary, #111)" }}>{app.label}</span>
                    {composioConnections[app.id] ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "11px", fontWeight: 700, color: "#16a34a" }}>
                        <CheckCircle size={14} weight="fill" /> Connected
                      </div>
                    ) : (
                      <button
                        onClick={() => handleComposioConnect(app.id)}
                        disabled={composioLoading === app.id || composioAvailable === false}
                        style={{ padding: "5px 12px", borderRadius: "6px", border: "1px solid var(--border-default, rgba(0,0,0,0.12))", background: "transparent", fontSize: "11px", fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4, opacity: composioAvailable === false ? 0.4 : 1 }}
                      >
                        {composioLoading === app.id ? "…" : <Circle size={12} />} Connect
                      </button>
                    )}
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          <button onClick={onClose} style={{ width: "100%", padding: "10px", borderRadius: "10px", border: "1px solid var(--border-default, rgba(0,0,0,0.12))", background: "transparent", fontSize: "13px", fontWeight: 600, cursor: "pointer", color: "var(--text-secondary, #666)" }}>
            Done
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
