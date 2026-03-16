/**
 * WorkspaceTab — Active agent switcher for AgentHub
 *
 * Answers: "Which agent is running in my gizzi-code sessions right now,
 * and how do I switch?"
 *
 * Layout:
 *   1. Active agent card — who owns ~/.gizzi/ right now
 *   2. Your agents — all registry agents as cards
 *      Each card: Set Active (pushes identity to ~/.gizzi/) + Open Dashboard
 *   3. No connection state — gizzi-code sidecar not running
 *
 * How switching works:
 *   Platform reads agent's workspace files via agentWorkspaceService
 *   → POST /v1/workspace/activate to gizzi-code sidecar
 *   → Sidecar writes files to ~/.gizzi/
 *   → Next session picks up the new identity
 */

import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Zap,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Radio,
  ExternalLink,
  Plus,
} from 'lucide-react';
import { useAgentStore, agentWorkspaceService } from '../lib/agents';
import type { Agent } from '../lib/agents/agent.types';

export interface WorkspaceTabProps {
  /** Called when the user clicks "Dashboard" on an agent — lets the parent switch to the registry tab */
  onSwitchToRegistry?: () => void;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface ActiveWorkspace {
  name?: string;
  emoji?: string;
  vibe?: string;
  format: 'layered' | 'flat';
  path: string;
  hasSoul: boolean;
  hasMemory: boolean;
  agentID?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function discoverSidecar(): Promise<string | null> {
  const ports = [4096, 4097, 4098];
  for (const port of ports) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(800) });
      if (r.ok) return `http://127.0.0.1:${port}`;
    } catch {}
  }
  return null;
}

async function fetchActiveWorkspace(baseUrl: string): Promise<ActiveWorkspace | null> {
  try {
    const r = await fetch(`${baseUrl}/v1/workspace`, { signal: AbortSignal.timeout(3000) });
    return r.ok ? r.json() : null;
  } catch {
    return null;
  }
}

async function activateAgent(baseUrl: string, payload: Record<string, string>): Promise<void> {
  const r = await fetch(`${baseUrl}/v1/workspace/activate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(5000),
  });
  if (!r.ok) throw new Error(await r.text());
}

/** Pull identity file content from agentWorkspaceService if available */
async function readAgentIdentityFiles(agentId: string): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  const names = ['IDENTITY.md', 'SOUL.md', 'USER.md', 'MEMORY.md', 'AGENTS.md', 'VOICE.md'];
  await Promise.all(
    names.map(async (f) => {
      try {
        const content = await agentWorkspaceService.readFile(agentId, `.a2r/identity/${f}`)
          .catch(() => agentWorkspaceService.readFile(agentId, `.a2r/${f}`))
          .catch(() => null);
        if (content) files[f.replace('.md', '').toLowerCase()] = content;
      } catch {}
    })
  );
  return files;
}

/** Build an IDENTITY.md from an Agent record if workspace files aren't available */
function buildIdentityMd(agent: Agent): string {
  return `# IDENTITY.md

- **Name:** ${agent.name}
- **Emoji:** 🤖
- **Vibe:** ${agent.description || 'AI assistant'}

---

*${agent.name} — ${agent.type} agent*
`;
}

function buildSoulMd(agent: Agent): string {
  return agent.systemPrompt
    ? `# SOUL.md\n\n${agent.systemPrompt}\n`
    : `# SOUL.md\n\n*${agent.name}'s core values and personality to be defined.*\n`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function AgentCard({
  agent,
  isActive,
  onActivate,
  onOpen,
  activating,
}: {
  agent: Agent;
  isActive: boolean;
  onActivate: () => void;
  onOpen: () => void;
  activating: boolean;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        background: isActive
          ? 'rgba(212,149,106,0.07)'
          : 'rgba(255,255,255,0.02)',
        border: isActive
          ? '1px solid rgba(212,149,106,0.25)'
          : '1px solid rgba(255,255,255,0.06)',
        borderRadius: 12,
        padding: '14px 16px',
        position: 'relative',
      }}
    >
      {/* Active badge */}
      {isActive && (
        <div
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            background: 'rgba(212,149,106,0.15)',
            border: '1px solid rgba(212,149,106,0.3)',
            borderRadius: 20,
            padding: '3px 9px',
            fontSize: 11,
            color: '#f0c7a3',
            fontWeight: 500,
          }}
        >
          <Radio size={10} />
          Active
        </div>
      )}

      {/* Agent header */}
      <div className="flex items-center gap-3 mb-3">
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: isActive ? 'rgba(212,149,106,0.18)' : 'rgba(255,255,255,0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 18,
            flexShrink: 0,
          }}
        >
          {(agent.config as any)?.avatar?.emoji ?? '🤖'}
        </div>
        <div className="flex-1 min-w-0 pr-16">
          <div
            style={{ fontSize: 14, fontWeight: 500, color: isActive ? '#f0c7a3' : '#e0e0e0' }}
            className="truncate"
          >
            {agent.name}
          </div>
          <div style={{ fontSize: 12, color: '#666' }} className="truncate">
            {agent.type} · {agent.model}
          </div>
        </div>
      </div>

      {/* Description */}
      {agent.description && (
        <p style={{ fontSize: 12, color: '#666', marginBottom: 12, lineHeight: 1.5 }} className="line-clamp-2">
          {agent.description}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        {!isActive && (
          <button
            onClick={onActivate}
            disabled={activating}
            style={{
              background: 'rgba(212,149,106,0.12)',
              border: '1px solid rgba(212,149,106,0.25)',
              borderRadius: 7,
              padding: '5px 12px',
              fontSize: 12,
              color: '#f0c7a3',
              cursor: activating ? 'not-allowed' : 'pointer',
              opacity: activating ? 0.5 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            {activating ? (
              <RefreshCw size={11} className="animate-spin" />
            ) : (
              <Zap size={11} />
            )}
            {activating ? 'Activating…' : 'Set Active'}
          </button>
        )}
        <button
          onClick={onOpen}
          style={{
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 7,
            padding: '5px 12px',
            fontSize: 12,
            color: '#888',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 5,
          }}
        >
          <ExternalLink size={11} />
          Dashboard
        </button>
      </div>
    </motion.div>
  );
}

function ActiveCard({ workspace }: { workspace: ActiveWorkspace }) {
  return (
    <div
      style={{
        background: 'rgba(212,149,106,0.06)',
        border: '1px solid rgba(212,149,106,0.2)',
        borderRadius: 12,
        padding: '16px 20px',
        marginBottom: 24,
      }}
    >
      <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
        Active in gizzi-code sessions
      </div>
      <div className="flex items-center gap-3">
        {workspace.emoji && (
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: 'rgba(212,149,106,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 22,
              flexShrink: 0,
            }}
          >
            {workspace.emoji}
          </div>
        )}
        <div>
          <div style={{ fontSize: 15, fontWeight: 500, color: '#f0c7a3' }}>
            {workspace.name ?? 'Unnamed Agent'}
          </div>
          {workspace.vibe && (
            <div style={{ fontSize: 13, color: '#888', marginTop: 2 }}>{workspace.vibe}</div>
          )}
          <div className="flex items-center gap-3 mt-2">
            <span
              style={{
                fontSize: 11,
                background: 'rgba(212,149,106,0.12)',
                border: '1px solid rgba(212,149,106,0.2)',
                borderRadius: 20,
                padding: '2px 8px',
                color: '#d4956a',
              }}
            >
              {workspace.format === 'layered' ? '5-layer' : 'flat'}
            </span>
            {workspace.hasSoul && (
              <span style={{ fontSize: 11, color: '#86efac' }}>
                <CheckCircle2 size={11} className="inline mr-1" />soul
              </span>
            )}
            {workspace.hasMemory && (
              <span style={{ fontSize: 11, color: '#86efac' }}>
                <CheckCircle2 size={11} className="inline mr-1" />memory
              </span>
            )}
          </div>
        </div>
      </div>
      <div style={{ fontSize: 11, color: '#555', marginTop: 10, fontFamily: 'monospace' }}>
        {workspace.path}
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function WorkspaceTab({ onSwitchToRegistry }: WorkspaceTabProps = {}) {
  const { agents, fetchAgents, selectAgent } = useAgentStore();
  const [sidecarUrl, setSidecarUrl] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const [activeWorkspace, setActiveWorkspace] = useState<ActiveWorkspace | null>(null);
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  // Discover sidecar and load data
  useEffect(() => {
    const init = async () => {
      setChecking(true);
      const [url] = await Promise.all([discoverSidecar(), fetchAgents()]);
      setSidecarUrl(url);
      if (url) {
        const ws = await fetchActiveWorkspace(url);
        setActiveWorkspace(ws);
      }
      setChecking(false);
    };
    init();
  }, []);

  const refresh = useCallback(async () => {
    if (!sidecarUrl) return;
    const ws = await fetchActiveWorkspace(sidecarUrl);
    setActiveWorkspace(ws);
  }, [sidecarUrl]);

  const handleActivate = useCallback(
    async (agent: Agent) => {
      if (!sidecarUrl) return;
      setActivatingId(agent.id);
      setMessage(null);
      try {
        // Read identity files from the agent's workspace
        const files = await readAgentIdentityFiles(agent.id);

        // Fall back to generated content if workspace files don't exist
        const payload = {
          name: agent.name,
          emoji: (agent.config as any)?.avatar?.emoji ?? '🤖',
          identity: files.identity ?? buildIdentityMd(agent),
          soul: files.soul ?? buildSoulMd(agent),
          user: files.user,
          memory: files.memory,
          agents: files.agents,
          voice: files.voice,
          agentID: agent.id,
        };

        await activateAgent(sidecarUrl, payload);
        await refresh();
        setMessage({ text: `${agent.name} is now the active agent`, ok: true });
      } catch (e: any) {
        setMessage({ text: `Failed: ${e.message}`, ok: false });
      } finally {
        setActivatingId(null);
      }
    },
    [sidecarUrl, refresh],
  );

  const handleOpenDashboard = useCallback(
    (agent: Agent) => {
      selectAgent(agent.id);
      onSwitchToRegistry?.();
    },
    [selectAgent, onSwitchToRegistry],
  );

  // ── Loading ──────────────────────────────────────────────────────────────
  if (checking) {
    return (
      <div
        className="flex items-center justify-center"
        style={{ height: 240, color: '#555', fontSize: 13 }}
      >
        <RefreshCw size={15} className="animate-spin mr-2" />
        Connecting…
      </div>
    );
  }

  // ── No sidecar ───────────────────────────────────────────────────────────
  if (!sidecarUrl) {
    return (
      <div className="max-w-lg mx-auto py-10">
        <div
          style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 12,
            padding: '20px 24px',
          }}
        >
          <div className="flex items-start gap-3">
            <AlertCircle size={16} color="#888" className="flex-shrink-0 mt-0.5" />
            <div>
              <div style={{ fontSize: 14, color: '#ccc', marginBottom: 6 }}>
                gizzi-code not running
              </div>
              <div style={{ fontSize: 13, color: '#666', lineHeight: 1.6 }}>
                The Workspace tab syncs agents to your gizzi-code sessions. Start gizzi-code
                to enable agent switching.
              </div>
              <div style={{ fontSize: 12, color: '#555', marginTop: 12, fontFamily: 'monospace' }}>
                Expected on port 4096
              </div>
            </div>
          </div>
        </div>
        <div style={{ marginTop: 24 }}>
          <AgentList
            agents={agents}
            activeWorkspace={null}
            activatingId={null}
            onActivate={() => {}}
            onOpen={handleOpenDashboard}
            noSidecar
          />
        </div>
      </div>
    );
  }

  // ── Connected ─────────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto py-6">

      {/* Active agent */}
      {activeWorkspace ? (
        <ActiveCard workspace={activeWorkspace} />
      ) : (
        <div
          style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 12,
            padding: '16px 20px',
            marginBottom: 24,
            fontSize: 13,
            color: '#666',
          }}
        >
          No workspace initialized. Pick an agent below to activate, or create a new one.
        </div>
      )}

      {/* Action message */}
      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{
              fontSize: 13,
              color: message.ok ? '#86efac' : '#f87171',
              marginBottom: 16,
              textAlign: 'center',
            }}
          >
            {message.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Agent list */}
      <div style={{ fontSize: 11, color: '#666', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
        Your Agents
      </div>

      <AgentList
        agents={agents}
        activeWorkspace={activeWorkspace}
        activatingId={activatingId}
        onActivate={handleActivate}
        onOpen={handleOpenDashboard}
        noSidecar={false}
      />
    </div>
  );
}

function AgentList({
  agents,
  activeWorkspace,
  activatingId,
  onActivate,
  onOpen,
  noSidecar,
}: {
  agents: Agent[];
  activeWorkspace: ActiveWorkspace | null;
  activatingId: string | null;
  onActivate: (agent: Agent) => void;
  onOpen: (agent: Agent) => void;
  noSidecar: boolean;
}) {
  if (agents.length === 0) {
    return (
      <div
        style={{
          textAlign: 'center',
          padding: '40px 20px',
          color: '#555',
          fontSize: 13,
          border: '1px dashed rgba(255,255,255,0.08)',
          borderRadius: 12,
        }}
      >
        No agents yet. Create one in Agent Studio.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {agents.map((agent) => {
        const isActive =
          !noSidecar &&
          activeWorkspace != null &&
          (activeWorkspace.agentID === agent.id ||
            activeWorkspace.name === agent.name ||
            activeWorkspace.path?.includes(agent.id));

        return (
          <AgentCard
            key={agent.id}
            agent={agent}
            isActive={isActive}
            activating={activatingId === agent.id}
            onActivate={() => onActivate(agent)}
            onOpen={() => onOpen(agent)}
          />
        );
      })}
    </div>
  );
}
