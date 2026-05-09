"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ArtifactPreviewPane } from "../../components/design/ArtifactPreviewPane";
import {
  fetchOrbitData,
  getStoredTokens,
  type ConnectorApp,
  type OrbitDataPayload,
} from "../../lib/design/direct-connectors";
import { ConnectorModal } from "./ConnectorModal";
import { Lightning, Key, Play, Clock, CheckCircle, WarningCircle, CalendarBlank, Bell } from "@phosphor-icons/react";
import { useOrbitScheduler, saveSchedule as saveOrbitSchedule, loadSchedule } from "./useOrbitScheduler";

const STORAGE_KEY = "allternit-design-orbit-config";
const DIGESTS_KEY = "allternit-design-orbit-digests";

interface SavedDigest {
  id: string;
  generatedAt: string;
  html: string;
  summary: string;
  sources: string[];
}

function loadConfig(): { projectName: string; sources: ConnectorApp[] } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveConfig(config: { projectName: string; sources: ConnectorApp[] }) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

function loadDigests(): SavedDigest[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(DIGESTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveDigests(digests: SavedDigest[]) {
  localStorage.setItem(DIGESTS_KEY, JSON.stringify(digests));
}

function buildOrbitPrompt(projectName: string, data: OrbitDataPayload): string {
  const parts: string[] = [
    `[ORBIT DIGEST REQUEST]`,
    `Generate a daily design briefing for project: "${projectName}".`,
    ``,
    `Real data from connected sources:`,
  ];

  if (data.github?.length) {
    parts.push(`\nGitHub activity:`);
    data.github.slice(0, 5).forEach((g) => {
      parts.push(`- [${g.type}] ${g.title} (${g.repo}) — ${g.author}`);
    });
  }

  if (data.linear?.length) {
    parts.push(`\nLinear issues in progress:`);
    data.linear.slice(0, 5).forEach((l) => {
      parts.push(`- ${l.title}${l.assignee ? ` — assigned to ${l.assignee}` : ""} [${l.state}]`);
    });
  }

  if (data.notion?.length) {
    parts.push(`\nNotion pages recently updated:`);
    data.notion.slice(0, 5).forEach((n) => {
      parts.push(`- ${n.title}`);
    });
  }

  if (data.slack?.length) {
    parts.push(`\nSlack activity:`);
    data.slack.slice(0, 5).forEach((s) => {
      parts.push(`- #${s.channel}: ${s.text.slice(0, 80)}${s.text.length > 80 ? "…" : ""}`);
    });
  }

  parts.push(
    `\nThe briefing should be a complete HTML artifact with:`,
    `- A header with today's date and project name`,
    `- A "What shipped" section (GitHub commits/PRs)`,
    `- A "In progress" section (Linear issues)`,
    `- A "Design decisions" section (key choices)`,
    `- A "Focus for today" section with 3 prioritized next actions`,
    `\nUse the active design system's palette. Make it scannable and dense.`,
    `Include an EDITMODE config block with at least: primary color, accent color, font family.`
  );

  return parts.join("\n");
}

interface ChatMessage {
  role: string;
  content?: string;
  id?: string;
}

interface Props {
  projectName?: string;
  sessionSendMessage?: (text: string) => Promise<void>;
  messages?: ChatMessage[];
}

export function OrbitView({ projectName = "Untitled Project", sessionSendMessage, messages = [] }: Props) {
  const storedTokens = getStoredTokens();
  const hasAnyToken = storedTokens.length > 0;

  const [config, setConfig] = useState<{ projectName: string; sources: ConnectorApp[] }>(
    () =>
      loadConfig() ?? {
        projectName,
        sources: storedTokens.map((t) => t.app),
      }
  );
  const [digests, setDigests] = useState<SavedDigest[]>(loadDigests);
  const [generating, setGenerating] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [selectedDigest, setSelectedDigest] = useState<SavedDigest | null>(null);
  const [showSetup, setShowSetup] = useState(!hasAnyToken);
  const [schedule, setSchedule] = useState(() => loadSchedule());
  const pendingDigestId = useRef<string | null>(null);
  const lastMessageCount = useRef(messages.length);

  // Backfill pending digest HTML when the agent responds with an artifact
  useEffect(() => {
    if (!pendingDigestId.current) return;
    if (messages.length <= lastMessageCount.current) return;
    lastMessageCount.current = messages.length;
    const lastAsst = [...messages].reverse().find(m => m.role === 'assistant');
    if (!lastAsst?.content) return;
    const artifactMatch = lastAsst.content.match(/<artifact[^>]*>([\s\S]*?)<\/artifact>/i);
    if (!artifactMatch) return;
    const html = artifactMatch[1].trim();
    const id = pendingDigestId.current;
    pendingDigestId.current = null;
    setDigests(prev => {
      const next = prev.map(d => d.id === id ? { ...d, html, summary: `Orbit digest for ${projectName}` } : d);
      saveDigests(next);
      return next;
    });
  }, [messages, projectName]);

  useEffect(() => {
    setConfig((prev) => ({ ...prev, projectName }));
  }, [projectName]);

  // Auto-generate scheduler
  useOrbitScheduler(async () => {
    if (!sessionSendMessage || config.sources.length === 0) return;
    setGenerating(true);
    setFetchError(null);
    try {
      const data = await fetchOrbitData(config.sources);
      const prompt = buildOrbitPrompt(config.projectName, data);
      await sessionSendMessage(prompt);
      const autoId = `orbit-auto-${Date.now()}`;
      pendingDigestId.current = autoId;
      lastMessageCount.current = messages.length;
      const pendingDigest: SavedDigest = {
        id: autoId,
        generatedAt: new Date().toISOString(),
        html: "<p>Generating…</p>",
        summary: `Auto digest for ${config.projectName}`,
        sources: config.sources,
      };
      setDigests((prev) => {
        const next = [pendingDigest, ...prev].slice(0, 50);
        saveDigests(next);
        return next;
      });
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : "Auto-generation failed");
    } finally {
      setGenerating(false);
    }
  });

  const toggleSchedule = (enabled: boolean) => {
    const updated = { ...schedule, enabled };
    saveOrbitSchedule(updated);
    setSchedule(updated);
  };

  const setScheduleTime = (hour: number, minute: number) => {
    const updated = { ...schedule, hour, minute };
    saveOrbitSchedule(updated);
    setSchedule(updated);
  };

  const toggleSource = (source: ConnectorApp) => {
    setConfig((prev) => {
      const has = prev.sources.includes(source);
      const next = has ? prev.sources.filter((s) => s !== source) : [...prev.sources, source];
      const updated = { ...prev, sources: next };
      saveConfig(updated);
      return updated;
    });
  };

  const handleGenerate = useCallback(async () => {
    if (!sessionSendMessage || config.sources.length === 0) return;
    setGenerating(true);
    setFetchError(null);

    try {
      const data = await fetchOrbitData(config.sources);
      const prompt = buildOrbitPrompt(config.projectName, data);
      await sessionSendMessage(prompt);

      // Optimistically save a pending digest entry; backfilled when agent responds
      const pendingId = `orbit-pending-${Date.now()}`;
      pendingDigestId.current = pendingId;
      lastMessageCount.current = messages.length;
      const pendingDigest: SavedDigest = {
        id: pendingId,
        generatedAt: new Date().toISOString(),
        html: "<p>Generating…</p>",
        summary: `Digest requested for ${config.projectName}`,
        sources: config.sources,
      };
      setDigests((prev) => {
        const next = [pendingDigest, ...prev].slice(0, 50);
        saveDigests(next);
        return next;
      });
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : "Failed to fetch source data");
    } finally {
      setGenerating(false);
    }
  }, [config, sessionSendMessage]);

  const connectedApps = new Set(getStoredTokens().map((t) => t.app));

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        padding: 32,
        gap: 24,
        overflowY: "auto",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div
            style={{
              fontSize: 20,
              fontWeight: 800,
              color: "var(--text-primary)",
              letterSpacing: "-0.02em",
            }}
          >
            Orbit
          </div>
          <div style={{ fontSize: 12, color: "var(--text-tertiary)", marginTop: 4 }}>
            Autonomous daily design briefings with real data
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {/* Auto-generate toggle */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 10px",
              borderRadius: 6,
              border: "1px solid var(--border-subtle)",
              background: "var(--bg-secondary)",
            }}
            title="Auto-generate daily digest at scheduled time"
          >
            <Bell size={12} color={schedule.enabled ? "var(--accent-primary)" : "var(--text-tertiary)"} />
            <button
              onClick={() => toggleSchedule(!schedule.enabled)}
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: schedule.enabled ? "var(--accent-primary)" : "var(--text-tertiary)",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
              }}
            >
              {schedule.enabled ? "ON" : "OFF"}
            </button>
            {schedule.enabled && (
              <>
                <span style={{ color: "var(--border-subtle)", fontSize: 10 }}>|</span>
                <input
                  type="time"
                  value={`${String(schedule.hour).padStart(2, "0")}:${String(schedule.minute).padStart(2, "0")}`}
                  onChange={(e) => {
                    const [h, m] = e.target.value.split(":").map(Number);
                    setScheduleTime(h, m);
                  }}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: "var(--text-secondary)",
                    fontSize: 11,
                    fontWeight: 700,
                    padding: 0,
                    width: 52,
                  }}
                />
                <CalendarBlank size={10} color="var(--text-tertiary)" />
              </>
            )}
          </div>
          <button
            onClick={() => setShowSetup(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "6px 12px",
              borderRadius: 6,
              border: "1px solid var(--border-subtle)",
              background: "transparent",
              fontSize: 11,
              fontWeight: 700,
              color: "var(--text-secondary)",
              cursor: "pointer",
            }}
          >
            <Key size={12} /> Connections
          </button>
          <button
            onClick={handleGenerate}
            disabled={generating || config.sources.length === 0 || !sessionSendMessage}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "6px 14px",
              borderRadius: 6,
              border: "none",
              background: "var(--accent-primary)",
              color: "#fff",
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
              opacity:
                generating || config.sources.length === 0 || !sessionSendMessage ? 0.5 : 1,
            }}
          >
            {generating ? <Clock size={12} /> : <Play size={12} />}
            {generating ? "Generating…" : "Generate now"}
          </button>
        </div>
      </div>

      {/* Source toggles */}
      <div
        style={{
          display: "flex",
          gap: 16,
          alignItems: "center",
          padding: 16,
          borderRadius: 12,
          border: "1px solid var(--border-subtle)",
          background: "var(--bg-secondary)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Lightning size={16} color="var(--accent-primary)" />
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)" }}>
            Sources
          </span>
        </div>
        <div style={{ flex: 1 }} />
        {(["github", "linear", "notion", "slack"] as const).map((s) => {
          const connected = connectedApps.has(s);
          return (
            <button
              key={s}
              onClick={() => connected && toggleSource(s)}
              disabled={!connected}
              style={{
                padding: "4px 10px",
                borderRadius: 6,
                border: `1px solid ${
                  config.sources.includes(s) && connected
                    ? "var(--accent-primary)"
                    : "var(--border-subtle)"
                }`,
                background:
                  config.sources.includes(s) && connected
                    ? "rgba(226,124,89,0.08)"
                    : "transparent",
                fontSize: 11,
                fontWeight: 700,
                color: !connected
                  ? "var(--border-subtle)"
                  : config.sources.includes(s)
                  ? "var(--accent-primary)"
                  : "var(--text-tertiary)",
                cursor: connected ? "pointer" : "not-allowed",
                textTransform: "capitalize",
              }}
            >
              {s}
              {!connected && " (no token)"}
            </button>
          );
        })}
      </div>

      {/* Error */}
      {fetchError && (
        <div
          style={{
            padding: 12,
            borderRadius: 8,
            background: "#fef2f2",
            border: "1px solid #fecaca",
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 12,
            color: "#dc2626",
          }}
        >
          <WarningCircle size={14} weight="fill" />
          {fetchError}
        </div>
      )}

      {/* No session warning */}
      {!sessionSendMessage && (
        <div
          style={{
            padding: 12,
            borderRadius: 8,
            background: "rgba(234,179,8,0.08)",
            border: "1px solid rgba(234,179,8,0.2)",
            fontSize: 12,
            color: "#ca8a04",
          }}
        >
          Start a design session to enable Orbit generation.
        </div>
      )}

      {/* Digests */}
      {selectedDigest ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
          <button
            onClick={() => setSelectedDigest(null)}
            style={{
              alignSelf: "flex-start",
              padding: "6px 12px",
              borderRadius: 6,
              border: "1px solid var(--border-subtle)",
              background: "transparent",
              fontSize: 11,
              fontWeight: 700,
              color: "var(--text-secondary)",
              cursor: "pointer",
            }}
          >
            ← Back to digests
          </button>
          <ArtifactPreviewPane
            html={selectedDigest.html}
            title={`Orbit — ${new Date(selectedDigest.generatedAt).toLocaleString()}`}
            identifier={`orbit-${selectedDigest.id}`}
          />
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {digests.length === 0 ? (
            <div
              style={{
                padding: 40,
                textAlign: "center",
                color: "var(--text-tertiary)",
                fontSize: 13,
              }}
            >
              No digests yet. Connect tools, pick sources, and generate your first
              briefing with real data.
            </div>
          ) : (
            digests.map((d) => (
              <button
                key={d.id}
                onClick={() => setSelectedDigest(d)}
                style={{
                  padding: 12,
                  borderRadius: 10,
                  border: "1px solid var(--border-subtle)",
                  background: "var(--bg-secondary)",
                  textAlign: "left",
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <CheckCircle size={14} color="#22c55e" weight="fill" />
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: "var(--text-primary)",
                    }}
                  >
                    {new Date(d.generatedAt).toLocaleString()}
                  </span>
                  <span style={{ fontSize: 10, color: "var(--text-tertiary)" }}>
                    {d.sources.join(", ")}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>
                  {d.summary}
                </div>
              </button>
            ))
          )}
        </div>
      )}

      {showSetup && (
        <ConnectorModal
          onClose={() => setShowSetup(false)}
          onConnect={() => {
            const tokens = getStoredTokens();
            setConfig((prev) => {
              const connected = tokens.map((t) => t.app);
              const next = { ...prev, sources: connected };
              saveConfig(next);
              return next;
            });
          }}
        />
      )}
    </div>
  );
}
