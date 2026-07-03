// @ts-nocheck
/**
 * CoworkRightRail — Progress panel matching claude.ai Cowork reference UI.
 *
 * Structure:
 *  Header  — "Progress" label + "N of M" completion counter + close
 *  Body    — numbered task steps (inline, primary content)
 *  Working folder — files written/created by the agent
 *  Context — Connectors (web/browser tools) + Skills (file types produced)
 *  Artifacts — code blocks extracted from messages
 *
 * All content derived from liveMessages — zero hardcoded placeholders.
 */

import React, { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  CaretRight,
  CaretDown,
  FileText,
  FilePdf,
  FileCode,
  FileImage,
  FileCsv,
  Globe,
  FolderOpen,
  Check,
  Copy,
  X,
  ClockCounterClockwise,
} from '@phosphor-icons/react';
import type { ChatMessage } from '@/lib/ai/rust-stream-adapter';
import { useTaskStore } from './useTaskStore';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ToolEntry {
  toolName: string;
  state: 'running' | 'done' | 'error';
  input?: unknown;
  result?: unknown;
}

interface TodoEntry {
  id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
}

interface ArtifactEntry {
  id: string;
  lang: string;
  code: string;
  preview: string;
}

// ─── Message parsing ──────────────────────────────────────────────────────────

function parseToolsFromMessages(messages: ChatMessage[]): ToolEntry[] {
  const out: ToolEntry[] = [];
  for (const m of messages) {
    if (m.role !== 'assistant') continue;
    const content = m.content;
    if (!Array.isArray(content)) continue;
    for (const part of content as any[]) {
      if (part.type !== 'dynamic-tool') continue;
      out.push({
        toolName: part.toolName ?? part.type,
        state: part.state === 'input-available' || part.state === 'running' || part.state === 'streaming' ? 'running'
          : part.state === 'output-error' || part.state === 'error' ? 'error'
          : 'done',
        input: part.input,
        result: part.result ?? part.output,
      });
    }
  }
  return out;
}

export function parseTodosFromMessages(messages: ChatMessage[]): TodoEntry[] {
  const out: TodoEntry[] = [];
  for (const m of messages) {
    if (m.role !== 'assistant') continue;
    const content = m.content;
    if (!Array.isArray(content)) continue;
    for (const part of content as any[]) {

      // Native TaskUIPart — emitted by `task` SSE events from the backend
      if (part.type === 'task' && part.taskId) {
        const mapStatus = (s: string): TodoEntry['status'] =>
          s === 'complete' || s === 'completed' ? 'completed'
          : s === 'running' || s === 'in-progress' ? 'in_progress'
          : 'pending';
        const existing = out.findIndex(t => t.id === part.taskId);
        const entry: TodoEntry = {
          id: part.taskId,
          content: part.title ?? part.description ?? part.taskId,
          status: mapStatus(part.status ?? 'pending'),
        };
        if (existing >= 0) out[existing] = entry;
        else out.push(entry);
        continue;
      }

      // Native PlanUIPart — emitted by `plan` / `plan_update` SSE events
      if (part.type === 'plan' && Array.isArray(part.steps)) {
        for (const step of part.steps as any[]) {
          const mapStatus = (s: string): TodoEntry['status'] =>
            s === 'complete' || s === 'completed' ? 'completed'
            : s === 'in-progress' || s === 'running' ? 'in_progress'
            : 'pending';
          const existing = out.findIndex(t => t.id === step.id);
          const entry: TodoEntry = {
            id: step.id ?? `plan-step-${out.length}`,
            content: step.description ?? step.title ?? step.id,
            status: mapStatus(step.status ?? 'pending'),
          };
          if (existing >= 0) out[existing] = entry;
          else out.push(entry);
        }
        continue;
      }

      // Dynamic tool calls — TodoWrite, TaskCreate, TaskUpdate from explicit tool use
      if (part.type !== 'dynamic-tool') continue;
      const name = (part.toolName ?? '').toLowerCase();
      if (!name.includes('todo') && !name.includes('task')) continue;
      const input = part.input;
      const items: any[] = Array.isArray(input)
        ? input
        : Array.isArray(input?.todos)
        ? input.todos
        : [];
      for (const item of items) {
        const text = typeof item === 'string' ? item : item?.content ?? item?.text ?? JSON.stringify(item);
        const status = item?.status ?? (item?.done ? 'completed' : 'pending');
        out.push({ id: `${m.id}-${out.length}`, content: text, status });
      }
    }
  }
  return out;
}

const FILE_PATH_RE = /(?:^|\s|"|')((?:\.\/|\/)?[\w/.\-]+\.(?:ts|tsx|js|jsx|py|rs|go|json|toml|yaml|yml|md|txt|sh|css|html|sql|env|docx|pdf|xlsx|png|jpg|jpeg))/g;
const CODE_FENCE_RE = /```(\w*)\n([\s\S]*?)```/g;

function parseArtifactsFromMessages(messages: ChatMessage[]): ArtifactEntry[] {
  const out: ArtifactEntry[] = [];
  for (const m of messages) {
    if (m.role !== 'assistant') continue;
    const text = typeof m.content === 'string'
      ? m.content
      : Array.isArray(m.content)
      ? (m.content as any[]).filter(p => p.type === 'text').map(p => p.text ?? '').join('\n')
      : '';
    if (!text) continue;
    CODE_FENCE_RE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = CODE_FENCE_RE.exec(text)) !== null) {
      const lang = match[1] || 'text';
      const code = match[2].trim();
      if (code.length < 15) continue;
      out.push({
        id: `${m.id}-art-${out.length}`,
        lang,
        code,
        preview: code.split('\n')[0].slice(0, 52) || lang,
      });
    }
  }
  return out;
}

function toolKind(rawName: string): 'bash' | 'file' | 'write' | 'todos' | 'plan' | 'question' | 'web' | 'text' {
  switch (rawName) {
    case 'Bash': case 'BashTool': case 'bash': case 'terminal': case 'execute':
      return 'bash';
    case 'Read': case 'read_file': case 'filesystem':
      return 'file';
    case 'Write': case 'Edit': case 'MultiEdit': case 'NotebookEdit':
    case 'write_file': case 'edit_file': case 'create_file':
      return 'write';
    case 'TodoWrite': case 'TaskCreate': case 'TaskUpdate': case 'TaskGet': case 'TaskList': case 'TaskStop':
    case 'todo_write': case 'todo_read':
      return 'todos';
    case 'ExitPlanMode':
      return 'plan';
    case 'AskUserQuestion':
      return 'question';
    default:
      if (rawName.toLowerCase().includes('search') || rawName.toLowerCase().includes('web') || rawName.toLowerCase().includes('browser'))
        return 'web';
      return 'text';
  }
}

/** Files that the agent actually wrote/created (Write, Edit, create_file) */
function parseWorkingFolderFiles(tools: ToolEntry[]): string[] {
  const seen = new Set<string>();
  for (const t of tools) {
    if (toolKind(t.toolName) !== 'write') continue;
    const src = typeof t.input === 'string' ? t.input : JSON.stringify(t.input ?? '');
    for (const m of src.matchAll(FILE_PATH_RE)) seen.add(m[1]);
    const res = typeof t.result === 'string' ? t.result : JSON.stringify(t.result ?? '');
    for (const m of res.matchAll(FILE_PATH_RE)) seen.add(m[1]);
  }
  // Also scan Bash outputs for written files
  for (const t of tools) {
    if (toolKind(t.toolName) !== 'bash') continue;
    const res = typeof t.result === 'string' ? t.result : JSON.stringify(t.result ?? '');
    for (const m of res.matchAll(FILE_PATH_RE)) seen.add(m[1]);
  }
  return [...seen];
}

/** Active connectors = web/browser tool names + mcp-app connectors actually called */
function parseConnectors(tools: ToolEntry[], messages: ChatMessage[]): string[] {
  const seen = new Map<string, string>();
  // From tool entries
  for (const t of tools) {
    const kind = toolKind(t.toolName);
    if (kind === 'web') {
      const label = t.toolName.toLowerCase().includes('chrome') || t.toolName.toLowerCase().includes('browser')
        ? 'Claude in Chrome'
        : 'Web search';
      seen.set(label, label);
    }
  }
  // From mcp-app parts (real connector calls)
  for (const m of messages) {
    if (m.role !== 'assistant' || !Array.isArray(m.content)) continue;
    for (const part of m.content as any[]) {
      if (part.type === 'mcp-app' && part.connectorName) {
        seen.set(part.connectorName, part.connectorName);
      }
    }
  }
  return [...seen.keys()];
}

/** Skills = unique file extensions produced by write tools */
function parseSkills(files: string[]): string[] {
  const seen = new Set<string>();
  for (const f of files) {
    const ext = f.split('.').pop()?.toLowerCase() ?? '';
    if (ext && ext !== 'tmp' && ext !== 'log') seen.add(ext);
  }
  return [...seen].slice(0, 6);
}

// ─── Style constants ──────────────────────────────────────────────────────────

const RAIL_TEXT   = 'rgba(210,185,148,0.75)';
const RAIL_MUTED  = 'rgba(210,185,148,0.38)';
const RAIL_BORDER = 'rgba(210,185,148,0.08)';
const RAIL_AMBER  = 'rgba(210,185,148,0.9)';

// ─── Primitives ───────────────────────────────────────────────────────────────

function LiveDot() {
  return (
    <span style={{ position: 'relative', display: 'inline-flex', width: 8, height: 8, flexShrink: 0 }}>
      <style>{`
        @keyframes crPing{75%,100%{transform:scale(2);opacity:0}}
        @keyframes crPulse{0%,100%{opacity:1}50%{opacity:.5}}
      `}</style>
      <span style={{ position:'absolute', inset:0, borderRadius:'50%', background:'var(--accent-cowork,#c8a96e)', animation:'crPing 1.2s cubic-bezier(0,0,.2,1) infinite', opacity:.5 }} />
      <span style={{ position:'relative', width:8, height:8, borderRadius:'50%', background:'var(--accent-cowork,#c8a96e)', animation:'crPulse 2s ease infinite' }} />
    </span>
  );
}

function Section({ title, icon, open, onToggle, children }: {
  title: string;
  icon?: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div style={{ borderBottom: `1px solid ${RAIL_BORDER}` }}>
      <button
        type="button"
        onClick={onToggle}
        style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px', background:'transparent', border:'none', cursor:'pointer' }}
      >
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          {icon}
          <span style={{ fontSize:10, fontWeight:700, color:RAIL_MUTED, letterSpacing:'0.08em', textTransform:'uppercase' }}>
            {title}
          </span>
        </div>
        {open
          ? <CaretDown size={11} style={{ color:RAIL_MUTED, flexShrink:0 }} />
          : <CaretRight size={11} style={{ color:RAIL_MUTED, flexShrink:0 }} />
        }
      </button>
      {open && <div style={{ padding:'0 14px 12px' }}>{children}</div>}
    </div>
  );
}

// ─── Numbered step list ───────────────────────────────────────────────────────

function StepNumber({ n, status }: { n: number; status: TodoEntry['status'] }) {
  if (status === 'completed') {
    return (
      <span style={{
        width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
        background: 'rgba(210,185,148,0.18)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <Check size={11} style={{ color: RAIL_AMBER }} />
      </span>
    );
  }
  if (status === 'in_progress') {
    return (
      <span style={{
        width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
        background: 'var(--accent-cowork, #c8a96e)',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 10, fontWeight: 700, color: '#1a1208',
        animation: 'crPulse 2s ease infinite',
      }}>
        {n}
      </span>
    );
  }
  return (
    <span style={{
      width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
      border: `1.5px solid ${RAIL_BORDER}`, boxSizing: 'border-box',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 10, fontWeight: 600, color: RAIL_MUTED,
    }}>
      {n}
    </span>
  );
}

function StepList({ todos, isStreaming }: { todos: TodoEntry[]; isStreaming: boolean }) {
  if (todos.length === 0) {
    return (
      <div style={{ padding: '12px 14px', fontSize: 12, color: RAIL_MUTED, fontStyle: 'italic' }}>
        {isStreaming ? 'Building task plan…' : 'No tasks created yet.'}
      </div>
    );
  }
  return (
    <div style={{ padding: '8px 14px 4px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {todos.map((t, i) => {
        const done = t.status === 'completed';
        const active = t.status === 'in_progress';
        return (
          <div key={t.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <StepNumber n={i + 1} status={t.status} />
            <span style={{
              fontSize: 12,
              color: done ? RAIL_MUTED : active ? RAIL_AMBER : RAIL_TEXT,
              textDecoration: done ? 'line-through' : 'none',
              lineHeight: 1.45,
              flex: 1,
              minWidth: 0,
            }}>
              {t.content}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Working folder ───────────────────────────────────────────────────────────

function FileIcon({ filename }: { filename: string }) {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  const s = { flexShrink: 0, color: RAIL_MUTED };
  if (ext === 'pdf') return <FilePdf size={13} style={s} />;
  if (['png','jpg','jpeg','gif','webp','svg'].includes(ext)) return <FileImage size={13} style={s} />;
  if (['ts','tsx','js','jsx','py','rs','go','json','toml','yaml','yml','sh','sql','css','html'].includes(ext)) return <FileCode size={13} style={s} />;
  if (['csv','xlsx','docx','doc'].includes(ext)) return <FileCsv size={13} style={s} />;
  return <FileText size={13} style={s} />;
}

function WorkingFolder({ files, isStreaming }: { files: string[]; isStreaming: boolean }) {
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const handleCopy = useCallback(async (p: string) => {
    try { await navigator.clipboard.writeText(p); setCopiedPath(p); setTimeout(() => setCopiedPath(x => x === p ? null : x), 1400); } catch {}
  }, []);

  if (files.length === 0) {
    return (
      <span style={{ fontSize: 12, color: RAIL_MUTED }}>
        {isStreaming ? 'Watching for output files…' : 'No files written yet.'}
      </span>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {files.slice(0, 12).map(p => {
        const name = p.split('/').pop() ?? p;
        return (
          <button
            key={p}
            type="button"
            onClick={() => handleCopy(p)}
            title={p}
            style={{ display:'flex', alignItems:'center', gap:8, padding:'4px 6px', background:'rgba(210,185,148,0.04)', border:'1px solid rgba(210,185,148,0.07)', borderRadius:6, cursor:'pointer', width:'100%', textAlign:'left' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(210,185,148,0.09)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(210,185,148,0.04)')}
          >
            <FileIcon filename={name} />
            <span style={{ flex:1, minWidth:0, fontSize:12, color:RAIL_TEXT, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {name}
            </span>
            {copiedPath === p
              ? <Check size={11} style={{ color:'rgba(120,200,120,0.7)', flexShrink:0 }} />
              : <Copy size={11} style={{ color:RAIL_MUTED, flexShrink:0, opacity:0.5 }} />
            }
          </button>
        );
      })}
      {files.length > 12 && <span style={{ fontSize:11, color:RAIL_MUTED, paddingLeft:6 }}>+{files.length - 12} more</span>}
    </div>
  );
}

// ─── Context section ──────────────────────────────────────────────────────────

function ConnectorIcon({ label }: { label: string }) {
  const s = { flexShrink: 0, color: RAIL_MUTED };
  if (label.toLowerCase().includes('chrome') || label.toLowerCase().includes('browser'))
    return <Globe size={13} style={{ ...s, color: 'rgba(66,133,244,0.6)' }} />;
  return <Globe size={13} style={s} />;
}

function SkillIcon({ ext }: { ext: string }) {
  const s = { flexShrink: 0, color: RAIL_MUTED };
  if (['pdf'].includes(ext)) return <FilePdf size={13} style={s} />;
  if (['docx','doc','xlsx'].includes(ext)) return <FileCsv size={13} style={s} />;
  return <FileText size={13} style={s} />;
}

function ContextSection({ connectors, skills }: { connectors: string[]; skills: string[] }) {
  const empty = connectors.length === 0 && skills.length === 0;
  if (empty) {
    return <span style={{ fontSize: 12, color: RAIL_MUTED }}>No connectors or skills used yet.</span>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {connectors.length > 0 && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, color: RAIL_MUTED, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>
            Connectors
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {connectors.map(label => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0' }}>
                <ConnectorIcon label={label} />
                <span style={{ fontSize: 12, color: RAIL_TEXT }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {skills.length > 0 && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, color: RAIL_MUTED, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>
            Skills
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {skills.map(ext => (
              <div key={ext} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0' }}>
                <SkillIcon ext={ext} />
                <span style={{ fontSize: 12, color: RAIL_TEXT }}>{ext}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Artifacts section ────────────────────────────────────────────────────────

const LANG_COLORS: Record<string, string> = {
  ts: '#3b82f6', tsx: '#3b82f6', js: '#eab308', jsx: '#eab308',
  py: '#22c55e', rs: '#f97316', go: '#06b6d4',
  json: '#a78bfa', css: '#f472b6', html: '#fb923c',
  sh: '#94a3b8', sql: '#67e8f9', md: '#94a3b8',
};

function langColor(lang: string) {
  return LANG_COLORS[lang.toLowerCase()] ?? 'rgba(210,185,148,0.5)';
}

function ArtifactsSection({ artifacts, isStreaming }: { artifacts: ArtifactEntry[]; isStreaming: boolean }) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const handleCopy = useCallback(async (id: string, code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(id);
      setTimeout(() => setCopiedId(x => x === id ? null : x), 1400);
    } catch {}
  }, []);

  if (artifacts.length === 0) {
    return <span style={{ fontSize: 12, color: RAIL_MUTED }}>{isStreaming ? 'Watching for code…' : 'No code artifacts yet.'}</span>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {artifacts.slice(-8).reverse().map(a => (
        <button
          key={a.id}
          type="button"
          onClick={() => handleCopy(a.id, a.code)}
          title={a.code.slice(0, 120)}
          style={{
            display: 'flex', alignItems: 'center', gap: 7,
            padding: '5px 8px', borderRadius: 6, width: '100%', textAlign: 'left',
            background: 'rgba(210,185,148,0.04)', border: '1px solid rgba(210,185,148,0.08)',
            cursor: 'pointer',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(210,185,148,0.09)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(210,185,148,0.04)')}
        >
          <span style={{
            fontSize: 9, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
            color: langColor(a.lang), flexShrink: 0, minWidth: 24,
          }}>
            {a.lang || 'txt'}
          </span>
          <span style={{
            flex: 1, minWidth: 0, fontSize: 11, color: RAIL_TEXT,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            fontFamily: 'monospace',
          }}>
            {a.preview}
          </span>
          {copiedId === a.id
            ? <Check size={11} style={{ color: 'rgba(120,200,120,0.7)', flexShrink: 0 }} />
            : <Copy size={11} style={{ color: RAIL_MUTED, flexShrink: 0, opacity: 0.5 }} />
          }
        </button>
      ))}
      {artifacts.length > 8 && (
        <span style={{ fontSize: 11, color: RAIL_MUTED, paddingLeft: 4 }}>
          +{artifacts.length - 8} more
        </span>
      )}
    </div>
  );
}

function AuditLogsSection({ auditLogs }: { auditLogs: any[] }) {
  if (auditLogs.length === 0) {
    return <span style={{ fontSize: 11, color: RAIL_MUTED }}>No activity history logged.</span>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {auditLogs.slice(0, 10).map((log) => (
        <div
          key={log.id}
          style={{
            padding: '6px 8px',
            borderRadius: 6,
            background: 'rgba(210,185,148,0.03)',
            border: '1px solid rgba(210,185,148,0.06)',
            fontSize: '11px',
            color: RAIL_TEXT,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', color: RAIL_MUTED, fontSize: '10px', marginBottom: 2 }}>
            <span style={{ fontWeight: 600 }}>{log.actor_type || 'system'}</span>
            <span>{new Date(log.created_at || log.timestamp || Date.now()).toLocaleTimeString()}</span>
          </div>
          <p style={{ margin: 0, fontWeight: 500 }}>{log.action}</p>
          {log.payload && (
            <p style={{ margin: '2px 0 0', color: RAIL_MUTED, fontSize: '10px', fontFamily: 'monospace', overflowX: 'auto' }}>
              {typeof log.payload === 'string' ? log.payload : JSON.stringify(log.payload)}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export const CoworkRightRail = memo(function CoworkRightRail({
  onClose,
  liveMessages = [],
  liveIsStreaming = false,
}: {
  onClose?: () => void;
  liveMessages?: ChatMessage[];
  liveIsStreaming?: boolean;
}) {
  const tools     = useMemo(() => parseToolsFromMessages(liveMessages), [liveMessages]);
  const todos     = useMemo(() => parseTodosFromMessages(liveMessages), [liveMessages]);
  const files     = useMemo(() => parseWorkingFolderFiles(tools), [tools]);
  const artifacts = useMemo(() => parseArtifactsFromMessages(liveMessages), [liveMessages]);
  const connectors = useMemo(() => parseConnectors(tools, liveMessages), [tools, liveMessages]);
  const skills     = useMemo(() => parseSkills(files), [files]);
  const { activeTaskId } = useTaskStore();
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  useEffect(() => {
    let active = true;
    const loadLogs = async () => {
      if (!activeTaskId) {
        if (active) setAuditLogs([]);
        return;
      }
      try {
        const res = await fetch(`/api/v1/tasks/${activeTaskId}/audit-logs`);
        if (res.ok) {
          const data = await res.json();
          if (active) {
            setAuditLogs(Array.isArray(data) ? data : data?.audit_logs || []);
          }
        }
      } catch (err) {
        console.error(err);
      }
    };
    loadLogs();
    const interval = setInterval(loadLogs, 6000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [activeTaskId]);

  const completedCount = todos.filter(t => t.status === 'completed').length;
  const totalCount     = todos.length;

  const [open, setOpen] = useState({ folder: true, context: true, artifacts: false, audit: false });
  const toggle = useCallback((k: keyof typeof open) => setOpen(o => ({ ...o, [k]: !o[k] })), []);

  return (
    <div style={{ height:'100%', display:'flex', flexDirection:'column', overflow:'hidden', background:'transparent', color:RAIL_TEXT }}>
      {/* ── Header ── */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'11px 14px 10px', borderBottom:`1px solid ${RAIL_BORDER}`, flexShrink:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, minWidth:0 }}>
          {liveIsStreaming && <LiveDot />}
          <span style={{ fontSize:13, fontWeight:600, color:RAIL_AMBER }}>
            Progress
          </span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
          {totalCount > 0 && (
            <span style={{ fontSize:11, color:RAIL_MUTED, background:'rgba(210,185,148,0.08)', borderRadius:8, padding:'1px 7px', lineHeight:'18px' }}>
              {completedCount} of {totalCount}
            </span>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              title="Close panel"
              style={{ background:'transparent', border:'none', cursor:'pointer', padding:3, borderRadius:4, color:RAIL_MUTED, display:'flex', alignItems:'center' }}
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* ── Scrollable body ── */}
      <div style={{ flex:1, overflowY:'auto' }}>

        {/* Numbered steps — primary content, always visible */}
        <StepList todos={todos} isStreaming={liveIsStreaming} />

        {/* Working folder */}
        <Section
          title="Working folder"
          icon={<FolderOpen size={11} style={{ color:RAIL_MUTED }} />}
          open={open.folder}
          onToggle={() => toggle('folder')}
        >
          <WorkingFolder files={files} isStreaming={liveIsStreaming} />
        </Section>

        {/* Context — connectors + skills */}
        <Section
          title="Context"
          open={open.context}
          onToggle={() => toggle('context')}
        >
          <ContextSection connectors={connectors} skills={skills} />
        </Section>

        {/* Artifacts — code blocks */}
        {artifacts.length > 0 && (
          <Section
            title="Artifacts"
            open={open.artifacts}
            onToggle={() => toggle('artifacts')}
          >
            <ArtifactsSection artifacts={artifacts} isStreaming={liveIsStreaming} />
          </Section>
        )}

        {/* Audit Trail */}
        <Section
          title="Audit Trail"
          icon={<ClockCounterClockwise size={11} style={{ color:RAIL_MUTED }} />}
          open={open.audit}
          onToggle={() => toggle('audit')}
        >
          <AuditLogsSection auditLogs={auditLogs} />
        </Section>
      </div>
    </div>
  );
});

export default CoworkRightRail;
