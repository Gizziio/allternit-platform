"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { ArtifactPreviewPane } from "../../components/design/ArtifactPreviewPane";
import { generateOrbitDigest, type OrbitDigestConfig } from "../../lib/design/orbit-engine";
import { ComposioSetupModal } from "./ComposioSetupModal";
import { Lightning, Gear, Play, Clock, CheckCircle } from "@phosphor-icons/react";
import { useDesignSessionStore } from "./DesignSessionStore";

const STORAGE_KEY = 'allternit-design-orbit-config';
const DIGESTS_KEY = 'allternit-design-orbit-digests';

interface SavedDigest {
  id: string;
  generatedAt: string;
  html: string;
  summary: string;
}

function loadConfig(): OrbitDigestConfig | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveConfig(config: OrbitDigestConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

function loadDigests(): SavedDigest[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(DIGESTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveDigests(digests: SavedDigest[]) {
  localStorage.setItem(DIGESTS_KEY, JSON.stringify(digests));
}

interface Props {
  projectName?: string;
  sessionSendMessage?: (text: string) => Promise<void>;
  activeSessionId?: string | null;
}

export function OrbitView({ projectName = "Untitled Project", sessionSendMessage, activeSessionId }: Props) {
  const [config, setConfig] = useState<OrbitDigestConfig>(() => loadConfig() ?? { projectName, sources: [] });
  const [digests, setDigests] = useState<SavedDigest[]>(loadDigests);
  const [generating, setGenerating] = useState(false);
  const [selectedDigest, setSelectedDigest] = useState<SavedDigest | null>(null);
  const [showSetup, setShowSetup] = useState(() => {
    // Auto-show on first orbit visit if not skipped and no connections cached
    if (typeof window === 'undefined') return false;
    const skipped = localStorage.getItem('composio-setup-skipped') === '1';
    return !skipped;
  });
  const [enabled, setEnabled] = useState(false);

  // Subscribe to session messages to capture orbit artifacts
  const sessionMessages = useDesignSessionStore(
    useCallback(
      (s) => {
        const session = s.sessions.find((x) => x.id === activeSessionId);
        return session?.messages ?? [];
      },
      [activeSessionId]
    )
  );

  // Extract orbit digests from session messages
  useEffect(() => {
    if (!sessionMessages.length) return;
    const lastAsst = [...sessionMessages].reverse().find((m) => m.role === "assistant");
    if (!lastAsst?.content) return;
    const content = lastAsst.content;

    // Look for orbit artifact blocks
    const artifactMatch = content.match(/<artifact[^>]*type="text\/html"[^>]*title="([^"]*)"[^>]*>([\s\S]*?)<\/artifact>/);
    if (!artifactMatch) return;

    const title = artifactMatch[1];
    const html = artifactMatch[2].trim();
    if (!html.includes("[ORBIT DIGEST REQUEST]") && !title.toLowerCase().includes("orbit")) return;

    const newDigest: SavedDigest = {
      id: `orbit-${Date.now()}`,
      generatedAt: new Date().toISOString(),
      html,
      summary: `Orbit digest for ${config.projectName}`,
    };

    setDigests((prev) => {
      // Avoid duplicates by checking HTML hash
      const exists = prev.some((d) => d.html === html);
      if (exists) return prev;
      const next = [newDigest, ...prev].slice(0, 50); // Keep last 50
      saveDigests(next);
      return next;
    });
    setGenerating(false);
  }, [sessionMessages, config.projectName]);

  useEffect(() => {
    setConfig((prev) => ({ ...prev, projectName }));
  }, [projectName]);

  const handleGenerate = useCallback(async () => {
    if (!sessionSendMessage) return;
    setGenerating(true);
    saveConfig(config);
    await generateOrbitDigest(config, sessionSendMessage);
    // Digest will be captured via sessionMessages effect above
  }, [config, sessionSendMessage]);

  const toggleSource = (source: OrbitDigestConfig["sources"][number]) => {
    setConfig((prev) => {
      const has = prev.sources.includes(source);
      const next = has ? prev.sources.filter((s) => s !== source) : [...prev.sources, source];
      return { ...prev, sources: next };
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: 32, gap: 24, overflowY: "auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)", letterSpacing: "-0.02em" }}>Orbit</div>
          <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 4 }}>Autonomous daily design briefings</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setShowSetup(true)}
            style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 12px", borderRadius: 6, border: "1px solid var(--border-subtle)", background: "transparent", fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", cursor: "pointer" }}
          >
            <Gear size={12} /> Connections
          </button>
          <button
            onClick={handleGenerate}
            disabled={generating || config.sources.length === 0 || !sessionSendMessage}
            style={{
              display: "flex", alignItems: "center", gap: 4, padding: "6px 14px", borderRadius: 6, border: "none",
              background: "var(--accent-primary)", color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer",
              opacity: generating || config.sources.length === 0 || !sessionSendMessage ? 0.5 : 1,
            }}
          >
            {generating ? <Clock size={12} /> : <Play size={12} />}
            {generating ? "Generating…" : "Generate now"}
          </button>
        </div>
      </div>

      {/* Config */}
      <div style={{ display: "flex", gap: 16, alignItems: "center", padding: 16, borderRadius: 12, border: "1px solid var(--border-subtle)", background: "var(--bg-secondary)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Lightning size={16} color="var(--accent-primary)" />
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)" }}>Daily auto-generate</span>
        </div>
        <button
          onClick={() => setEnabled(!enabled)}
          style={{
            width: 36, height: 20, borderRadius: 10, border: "none", cursor: "pointer",
            background: enabled ? "var(--accent-primary)" : "var(--border-subtle)",
            position: "relative", transition: "background 0.2s",
          }}
        >
          <div style={{ width: 16, height: 16, borderRadius: "50%", background: "#fff", position: "absolute", top: 2, left: enabled ? 18 : 2, transition: "left 0.2s" }} />
        </button>
        <div style={{ flex: 1 }} />
        {(["github", "linear", "notion", "gmail"] as const).map((s) => (
          <button
            key={s}
            onClick={() => toggleSource(s)}
            style={{
              padding: "4px 10px", borderRadius: 6,
              border: `1px solid ${config.sources.includes(s) ? "var(--accent-primary)" : "var(--border-subtle)"}`,
              background: config.sources.includes(s) ? "rgba(226,124,89,0.08)" : "transparent",
              fontSize: 11, fontWeight: 700, color: config.sources.includes(s) ? "var(--accent-primary)" : "var(--text-tertiary)",
              cursor: "pointer", textTransform: "capitalize",
            }}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Status */}
      {!sessionSendMessage && (
        <div style={{ padding: 12, borderRadius: 8, background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.2)", fontSize: 12, color: "#ca8a04" }}>
          Start a design session to enable Orbit generation.
        </div>
      )}

      {/* Digests */}
      {selectedDigest ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
          <button
            onClick={() => setSelectedDigest(null)}
            style={{ alignSelf: "flex-start", padding: "6px 12px", borderRadius: 6, border: "1px solid var(--border-subtle)", background: "transparent", fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", cursor: "pointer" }}
          >
            ← Back to digests
          </button>
          <ArtifactPreviewPane html={selectedDigest.html} title={`Orbit — ${new Date(selectedDigest.generatedAt).toLocaleString()}`} identifier={`orbit-${selectedDigest.id}`} />
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {digests.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--text-tertiary)", fontSize: 13 }}>
              No digests yet. Connect tools, pick sources, and generate your first briefing.
            </div>
          ) : (
            digests.map((d) => (
              <button
                key={d.id}
                onClick={() => setSelectedDigest(d)}
                style={{ padding: 12, borderRadius: 10, border: "1px solid var(--border-subtle)", background: "var(--bg-secondary)", textAlign: "left", cursor: "pointer" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <CheckCircle size={14} color="#22c55e" weight="fill" />
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>{new Date(d.generatedAt).toLocaleString()}</span>
                </div>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>{d.summary}</div>
              </button>
            ))
          )}
        </div>
      )}

      {showSetup && <ComposioSetupModal onClose={() => setShowSetup(false)} />}
    </div>
  );
}
