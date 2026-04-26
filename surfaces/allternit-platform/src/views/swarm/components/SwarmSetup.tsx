/**
 * SwarmSetup - Launch panel for creating a new agent swarm.
 *
 * Shown when no swarm is running (replaces the empty state).
 * Flow:
 *   1. Describe the goal
 *   2. Pick a role template
 *   3. Assign a provider/model to each role
 *   4. Set execution limits
 *   5. Launch
 */

import React, { useState } from 'react';
import {
  Cpu,
  Play,
  ArrowRight,
  Robot,
  Eye,
  TestTube,
  Pencil,
  Plus,
  Minus,
  CaretDown,
} from '@phosphor-icons/react';
import { BACKGROUND, BORDER, TEXT, MODE_COLORS, STATUS } from '@/design/allternit.tokens';
import { swarmApi } from '../../../lib/swarm/swarm.api';

// ─── Constants ────────────────────────────────────────────────────────────────

const ACCENT = '#c17817';
const ACCENT_DIM = 'rgba(193, 120, 23, 0.15)';
const ACCENT_BORDER = 'rgba(193, 120, 23, 0.3)';
const BG_CARD = 'rgba(255,255,255,0.03)';
const BG_INPUT = 'rgba(255,255,255,0.05)';
const BORDER_COLOR = 'rgba(255,255,255,0.07)';
const BORDER_FOCUS = 'rgba(193, 120, 23, 0.5)';

// ─── Provider catalogue ───────────────────────────────────────────────────────

interface ProviderOption {
  id: string;
  label: string;
  models: { id: string; label: string }[];
}

const PROVIDERS: ProviderOption[] = [
  {
    id: 'claude',
    label: 'Claude',
    models: [
      { id: 'claude-opus-4-7', label: 'Opus 4.7' },
      { id: 'claude-sonnet-4-6', label: 'Sonnet 4.6' },
      { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5' },
    ],
  },
  {
    id: 'gemini',
    label: 'Gemini',
    models: [
      { id: 'gemini-2.5-pro', label: '2.5 Pro' },
      { id: 'gemini-2.0-flash', label: '2.0 Flash' },
    ],
  },
  {
    id: 'kimi',
    label: 'Kimi',
    models: [
      { id: 'moonshot-v1-128k', label: 'v1 128k' },
      { id: 'moonshot-v1-8k', label: 'v1 8k' },
    ],
  },
  {
    id: 'qwen',
    label: 'Qwen',
    models: [
      { id: 'qwen-max', label: 'Qwen Max' },
      { id: 'qwen-plus', label: 'Qwen Plus' },
      { id: 'qwen-turbo', label: 'Qwen Turbo' },
    ],
  },
  {
    id: 'codex',
    label: 'Codex',
    models: [
      { id: 'codex-mini-latest', label: 'Codex Mini' },
    ],
  },
  {
    id: 'minimax',
    label: 'MiniMax',
    models: [
      { id: 'abab6.5-chat', label: 'ABAB 6.5' },
      { id: 'abab5.5-chat', label: 'ABAB 5.5' },
    ],
  },
  {
    id: 'glm',
    label: 'GLM',
    models: [
      { id: 'glm-4-plus', label: 'GLM-4 Plus' },
      { id: 'glm-4-flash', label: 'GLM-4 Flash' },
    ],
  },
  {
    id: 'local',
    label: 'Local (Ollama)',
    models: [
      { id: 'llama3.1:8b', label: 'Llama 3.1 8B' },
      { id: 'llama3.1:70b', label: 'Llama 3.1 70B' },
      { id: 'deepseek-coder-v2', label: 'DeepSeek Coder v2' },
      { id: 'qwen2.5-coder:7b', label: 'Qwen 2.5 Coder 7B' },
    ],
  },
];

const EXEC_MODES = [
  { id: 'api', label: 'API' },
  { id: 'cli', label: 'CLI subprocess' },
  { id: 'local', label: 'Local' },
  { id: 'oauth', label: 'OAuth' },
] as const;

type ExecMode = typeof EXEC_MODES[number]['id'];

// ─── Role templates ───────────────────────────────────────────────────────────

interface RoleConfig {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  providerId: string;
  modelId: string;
  execMode: ExecMode;
}

interface Template {
  id: string;
  label: string;
  description: string;
  roles: Omit<RoleConfig, 'providerId' | 'modelId' | 'execMode'>[];
}

const TEMPLATES: Template[] = [
  {
    id: 'code-pipeline',
    label: 'Code Pipeline',
    description: 'Worker builds · Reviewer checks · Tester validates',
    roles: [
      { id: 'worker', label: 'Worker', description: 'Implements the task', icon: Pencil },
      { id: 'reviewer', label: 'Reviewer', description: 'Reviews quality and correctness', icon: Eye },
      { id: 'tester', label: 'Tester', description: 'Writes and runs tests', icon: TestTube },
    ],
  },
  {
    id: 'research-synthesis',
    label: 'Research & Synthesis',
    description: 'Researcher gathers · Analyst processes · Writer reports',
    roles: [
      { id: 'researcher', label: 'Researcher', description: 'Gathers information', icon: Robot },
      { id: 'analyst', label: 'Analyst', description: 'Extracts insights', icon: Eye },
      { id: 'writer', label: 'Writer', description: 'Compiles final output', icon: Pencil },
    ],
  },
  {
    id: 'custom',
    label: 'Custom',
    description: 'Define your own roles and pipeline',
    roles: [
      { id: 'agent-1', label: 'Agent 1', description: 'Primary agent', icon: Robot },
    ],
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

interface ModelSelectProps {
  providerId: string;
  modelId: string;
  execMode: ExecMode;
  onChange: (providerId: string, modelId: string, execMode: ExecMode) => void;
}

const SELECT_STYLE: React.CSSProperties = {
  appearance: 'none' as const,
  WebkitAppearance: 'none' as const,
  paddingLeft: 10,
  paddingRight: 22,
  paddingTop: 6,
  paddingBottom: 6,
  borderRadius: 6,
  fontSize: 11,
  outline: 'none',
  cursor: 'pointer',
  background: BG_INPUT,
  border: `1px solid ${BORDER_COLOR}`,
  fontFamily: 'inherit',
};

function ModelSelect({ providerId, modelId, execMode, onChange }: ModelSelectProps) {
  const provider = PROVIDERS.find(p => p.id === providerId) ?? PROVIDERS[0];

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {/* Provider */}
      <div style={{ position: 'relative' }}>
        <select
          value={providerId}
          onChange={e => {
            const next = PROVIDERS.find(p => p.id === e.target.value) ?? PROVIDERS[0];
            onChange(next.id, next.models[0].id, execMode);
          }}
          style={{ ...SELECT_STYLE, color: TEXT.primary, fontWeight: 500 }}
        >
          {PROVIDERS.map(p => (
            <option key={p.id} value={p.id}>{p.label}</option>
          ))}
        </select>
        <CaretDown size={10} color={TEXT.tertiary} style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
      </div>

      {/* Model */}
      <div style={{ position: 'relative' }}>
        <select
          value={modelId}
          onChange={e => onChange(providerId, e.target.value, execMode)}
          style={{ ...SELECT_STYLE, color: TEXT.secondary }}
        >
          {provider.models.map(m => (
            <option key={m.id} value={m.id}>{m.label}</option>
          ))}
        </select>
        <CaretDown size={10} color={TEXT.tertiary} style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
      </div>

      {/* Exec mode */}
      <div style={{ position: 'relative' }}>
        <select
          value={execMode}
          onChange={e => onChange(providerId, modelId, e.target.value as ExecMode)}
          style={{ ...SELECT_STYLE, color: TEXT.tertiary }}
        >
          {EXEC_MODES.map(m => (
            <option key={m.id} value={m.id}>{m.label}</option>
          ))}
        </select>
        <CaretDown size={10} color={TEXT.tertiary} style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface SwarmSetupProps {
  onLaunched?: (executionId: string) => void;
}

export function SwarmSetup({ onLaunched }: SwarmSetupProps) {
  const [goal, setGoal] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('code-pipeline');
  const [roles, setRoles] = useState<RoleConfig[]>(() =>
    buildDefaultRoles('code-pipeline')
  );
  const [maxIterations, setMaxIterations] = useState(3);
  const [escalate, setEscalate] = useState(true);
  const [isLaunching, setIsLaunching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function buildDefaultRoles(templateId: string): RoleConfig[] {
    const tpl = TEMPLATES.find(t => t.id === templateId) ?? TEMPLATES[0];
    return tpl.roles.map(r => ({
      ...r,
      providerId: 'claude',
      modelId: 'claude-sonnet-4-6',
      execMode: 'api' as ExecMode,
    }));
  }

  function selectTemplate(id: string) {
    setSelectedTemplate(id);
    setRoles(buildDefaultRoles(id));
  }

  function updateRole(roleId: string, providerId: string, modelId: string, execMode: ExecMode) {
    setRoles(prev =>
      prev.map(r => r.id === roleId ? { ...r, providerId, modelId, execMode } : r)
    );
  }

  function addCustomRole() {
    const n = roles.length + 1;
    setRoles(prev => [
      ...prev,
      {
        id: `agent-${n}`,
        label: `Agent ${n}`,
        description: 'Custom agent',
        icon: Robot,
        providerId: 'claude',
        modelId: 'claude-sonnet-4-6',
        execMode: 'api',
      },
    ]);
  }

  function removeRole(roleId: string) {
    setRoles(prev => prev.filter(r => r.id !== roleId));
  }

  async function launch() {
    if (!goal.trim() || roles.length === 0) return;
    setIsLaunching(true);
    setError(null);
    try {
      const { id: swarmId } = await swarmApi.createSwarm({
        name: goal.slice(0, 60),
        description: goal,
        agents: roles.map(r => ({
          agent_id: r.id,
          role: r.id,
          provider_id: r.providerId,
          model_id: r.modelId,
          exec_mode: r.execMode,
          role_label: r.label,
          role_description: r.description,
        })),
        strategy: 'hierarchical',
        communication: { pattern: 'mailbox' },
        max_rounds: maxIterations,
        escalate_on_failure: escalate,
      });
      const { execution_id } = await swarmApi.startExecution(swarmId, {
        input: goal,
        stream: true,
      });
      onLaunched?.(execution_id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to launch swarm');
    } finally {
      setIsLaunching(false);
    }
  }

  const canLaunch = goal.trim().length > 0 && roles.length > 0 && !isLaunching;

  return (
    <div
      style={{
        minHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '48px 24px',
        background: '#0a0908',
      }}
    >
      <div style={{ width: '100%', maxWidth: 672, display: 'flex', flexDirection: 'column', gap: 32 }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, textAlign: 'center' }}>
          <div style={{ width: 48, height: 48, borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', background: ACCENT_DIM, border: `1px solid ${ACCENT_BORDER}` }}>
            <Cpu size={22} color={ACCENT} weight="duotone" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: TEXT.primary }}>Launch Agent Swarm</h2>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: TEXT.secondary }}>Define a goal, assign models to each role, and run.</p>
          </div>
        </div>

        {/* ── Goal input ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', color: TEXT.tertiary }}>Goal</label>
          <textarea
            value={goal}
            onChange={e => setGoal(e.target.value)}
            placeholder="Describe what the swarm should accomplish..."
            rows={3}
            style={{
              width: '100%',
              resize: 'none',
              borderRadius: 12,
              padding: '12px 16px',
              fontSize: 13,
              outline: 'none',
              background: BG_INPUT,
              border: `1px solid ${goal ? BORDER_FOCUS : BORDER_COLOR}`,
              color: TEXT.primary,
              lineHeight: 1.6,
              boxSizing: 'border-box',
              fontFamily: 'inherit',
            }}
            onFocus={e => { e.target.style.borderColor = BORDER_FOCUS; }}
            onBlur={e => { e.target.style.borderColor = goal ? BORDER_FOCUS : BORDER_COLOR; }}
          />
        </div>

        {/* ── Template selector ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', color: TEXT.tertiary }}>Template</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            {TEMPLATES.map(tpl => {
              const isSelected = selectedTemplate === tpl.id;
              return (
                <button
                  key={tpl.id}
                  onClick={() => selectTemplate(tpl.id)}
                  style={{
                    textAlign: 'left',
                    padding: 16,
                    borderRadius: 12,
                    background: isSelected ? ACCENT_DIM : BG_CARD,
                    border: `1px solid ${isSelected ? ACCENT_BORDER : BORDER_COLOR}`,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, color: isSelected ? ACCENT : TEXT.primary }}>{tpl.label}</div>
                  <div style={{ fontSize: 11, lineHeight: 1.5, color: TEXT.tertiary }}>{tpl.description}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Role assignment ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <label style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.08em', color: TEXT.tertiary }}>Roles</label>
            {selectedTemplate === 'custom' && (
              <button
                onClick={addCustomRole}
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, padding: '4px 10px', borderRadius: 8, background: ACCENT_DIM, color: ACCENT, border: `1px solid ${ACCENT_BORDER}`, cursor: 'pointer' }}
              >
                <Plus size={10} weight="bold" />
                Add role
              </button>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {roles.map((role, index) => {
              const Icon = role.icon;
              const isLast = index === roles.length - 1;
              return (
                <React.Fragment key={role.id}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, background: BG_CARD, border: `1px solid ${BORDER_COLOR}` }}>
                    <div style={{ width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: 'rgba(255,255,255,0.05)' }}>
                      <Icon size={14} color={TEXT.secondary} />
                    </div>
                    <div style={{ width: 96, flexShrink: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: TEXT.primary }}>{role.label}</div>
                      <div style={{ fontSize: 10, marginTop: 2, color: TEXT.tertiary }}>{role.description}</div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <ModelSelect
                        providerId={role.providerId}
                        modelId={role.modelId}
                        execMode={role.execMode}
                        onChange={(pid, mid, em) => updateRole(role.id, pid, mid, em)}
                      />
                    </div>
                    {selectedTemplate === 'custom' && roles.length > 1 && (
                      <button onClick={() => removeRole(role.id)} style={{ padding: 4, borderRadius: 4, background: 'none', border: 'none', cursor: 'pointer', opacity: 0.4 }}>
                        <Minus size={12} color={TEXT.secondary} />
                      </button>
                    )}
                  </div>
                  {!isLast && (
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      <ArrowRight size={12} color={TEXT.tertiary} weight="bold" />
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* ── Execution config ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, padding: 16, borderRadius: 12, background: BG_CARD, border: `1px solid ${BORDER_COLOR}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 12, color: TEXT.secondary }}>Max iterations</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <button onClick={() => setMaxIterations(v => Math.max(1, v - 1))} style={{ width: 24, height: 24, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', border: 'none', cursor: 'pointer' }}>
                <Minus size={10} color={TEXT.secondary} />
              </button>
              <span style={{ width: 24, textAlign: 'center', fontSize: 13, fontWeight: 500, color: TEXT.primary, fontVariantNumeric: 'tabular-nums' }}>{maxIterations}</span>
              <button onClick={() => setMaxIterations(v => Math.min(10, v + 1))} style={{ width: 24, height: 24, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', border: 'none', cursor: 'pointer' }}>
                <Plus size={10} color={TEXT.secondary} />
              </button>
            </div>
          </div>
          <div style={{ width: 1, height: 20, background: BORDER_COLOR }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={() => setEscalate(v => !v)}
              style={{ position: 'relative', width: 32, height: 18, borderRadius: 9, background: escalate ? ACCENT : 'rgba(255,255,255,0.1)', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              <span style={{ position: 'absolute', top: 2, width: 14, height: 14, borderRadius: '50%', background: '#fff', left: escalate ? 16 : 2, transition: 'left 0.15s ease' }} />
            </button>
            <span style={{ fontSize: 12, color: TEXT.secondary }}>Auto-escalate on failure</span>
          </div>
        </div>

        {/* ── Error ── */}
        {error && (
          <div style={{ padding: '12px 16px', borderRadius: 12, fontSize: 13, background: `${STATUS.error}15`, border: `1px solid ${STATUS.error}30`, color: STATUS.error }}>
            {error}
          </div>
        )}

        {/* ── Launch button ── */}
        <button
          onClick={launch}
          disabled={!canLaunch}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            width: '100%', padding: '14px 0', borderRadius: 12,
            fontWeight: 600, fontSize: 13, border: 'none',
            background: canLaunch ? ACCENT : 'rgba(255,255,255,0.05)',
            color: canLaunch ? '#000' : TEXT.tertiary,
            cursor: canLaunch ? 'pointer' : 'not-allowed',
            opacity: isLaunching ? 0.7 : 1,
            transition: 'all 0.15s ease',
            fontFamily: 'inherit',
          }}
        >
          {isLaunching ? (
            <>
              <span style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(0,0,0,0.3)', borderTopColor: 'transparent', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
              Launching…
            </>
          ) : (
            <>
              <Play size={14} weight="fill" />
              Launch Swarm
            </>
          )}
        </button>

      </div>
    </div>
  );
}

export default SwarmSetup;
