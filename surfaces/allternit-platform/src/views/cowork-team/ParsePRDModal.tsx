'use client';

import React, { useState } from 'react';
import { Sparkle, X, ArrowRight, Warning } from '@phosphor-icons/react';
import GlassSurface from '@/design/GlassSurface';
import { useBoardStore } from '@/stores/board.store';
import { parsePRD, bulkCreateFromPRD, type ParsePRDResult } from '@/lib/cowork-team/coworkTeamBridge';

interface Props {
  workspaceId: string;
  onClose: () => void;
  onCreated?: (count: number) => void;
}

type Phase = 'input' | 'loading' | 'preview' | 'creating' | 'done';

const PRIORITY_LABEL: Record<number, { label: string; color: string }> = {
  75: { label: 'High', color: '#ef4444' },
  50: { label: 'Medium', color: '#f59e0b' },
  25: { label: 'Low', color: '#22c55e' },
};

export function ParsePRDModal({ workspaceId, onClose, onCreated }: Props): JSX.Element {
  const { createItem, updateItem, items: existingItems } = useBoardStore();

  const [phase, setPhase] = useState<Phase>('input');
  const [description, setDescription] = useState('');
  const [result, setResult] = useState<ParsePRDResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createdCount, setCreatedCount] = useState(0);

  async function handleGenerate() {
    if (description.trim().length < 10) return;
    setPhase('loading');
    setError(null);
    try {
      const existing = existingItems.map((i) => i.title);
      const parsed = await parsePRD(description, { existingTitles: existing });
      setResult(parsed);
      setPhase('preview');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed');
      setPhase('input');
    }
  }

  async function handleConfirm() {
    if (!result) return;
    setPhase('creating');
    try {
      const created = await bulkCreateFromPRD(workspaceId, result.items, createItem, updateItem);
      setCreatedCount(created.length);
      setPhase('done');
      onCreated?.(created.length);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Creation failed');
      setPhase('preview');
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px',
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <GlassSurface
        style={{
          borderRadius: '16px', padding: '28px',
          width: '100%', maxWidth: '640px',
          display: 'flex', flexDirection: 'column', gap: '20px',
          maxHeight: '80vh', overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Sparkle size={22} color="#af52de" weight="duotone" />
            <span style={{ fontWeight: 700, fontSize: 17, color: 'var(--text-primary)' }}>
              Generate Tasks from Description
            </span>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}>
            <X size={18} />
          </button>
        </div>

        {/* Input phase */}
        {(phase === 'input' || phase === 'loading') && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Describe the work
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Build a user authentication system with email/password and OAuth. Include password reset, email verification, and session management..."
                rows={6}
                disabled={phase === 'loading'}
                style={{
                  width: '100%', padding: '12px', borderRadius: '8px',
                  background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)',
                  color: 'var(--text-primary)', fontSize: 14, lineHeight: 1.6,
                  resize: 'vertical', outline: 'none', fontFamily: 'inherit',
                  opacity: phase === 'loading' ? 0.6 : 1,
                  boxSizing: 'border-box',
                }}
              />
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                Paste a PRD, feature brief, or plain description. The AI will generate atomic tasks with dependencies.
              </span>
            </div>

            {error && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderRadius: '8px', background: '#ef444418', border: '1px solid #ef444433', color: '#ef4444', fontSize: 13 }}>
                <Warning size={15} />
                {error}
              </div>
            )}

            <button
              onClick={handleGenerate}
              disabled={description.trim().length < 10 || phase === 'loading'}
              style={{
                padding: '10px 20px', borderRadius: '8px',
                background: description.trim().length >= 10 ? '#af52de' : 'var(--bg-secondary)',
                color: description.trim().length >= 10 ? '#fff' : 'var(--text-secondary)',
                border: 'none', fontWeight: 600, fontSize: 14, cursor: description.trim().length >= 10 ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', gap: '8px', alignSelf: 'flex-end',
                transition: 'background 0.15s',
              }}
            >
              {phase === 'loading' ? (
                <>
                  <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span>
                  Generating…
                </>
              ) : (
                <>
                  <Sparkle size={15} />
                  Generate Tasks
                </>
              )}
            </button>
          </>
        )}

        {/* Preview phase */}
        {phase === 'preview' && result && (
          <>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', padding: '8px 12px', borderRadius: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
              {result.summary}
            </div>

            <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
              {result.items.map((item, idx) => {
                const pc = PRIORITY_LABEL[item.priority ?? 50] ?? { label: 'Medium', color: '#f59e0b' };
                return (
                  <div
                    key={item.tempId}
                    style={{
                      padding: '10px 14px', borderRadius: '8px',
                      background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)',
                      display: 'flex', gap: '12px', alignItems: 'flex-start',
                    }}
                  >
                    <span style={{ color: 'var(--text-secondary)', fontSize: 12, fontWeight: 700, minWidth: '22px', paddingTop: 2 }}>
                      {idx + 1}
                    </span>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{item.title}</span>
                      {item.description && (
                        <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>{item.description}</span>
                      )}
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                        <span style={{ fontSize: 11, fontWeight: 600, color: pc.color, background: `${pc.color}18`, padding: '1px 7px', borderRadius: 4 }}>
                          {pc.label}
                        </span>
                        {item.estimatedMinutes && (
                          <span style={{ fontSize: 11, color: 'var(--text-secondary)', background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', padding: '1px 7px', borderRadius: 4 }}>
                            ~{item.estimatedMinutes}m
                          </span>
                        )}
                        {item.dependencyTempIds.length > 0 && (
                          <span style={{ fontSize: 11, color: '#06b6d4', background: '#06b6d418', border: '1px solid #06b6d433', padding: '1px 7px', borderRadius: 4 }}>
                            {item.dependencyTempIds.length} dep{item.dependencyTempIds.length !== 1 ? 's' : ''}
                          </span>
                        )}
                        {item.labels?.map((lbl) => (
                          <span key={lbl} style={{ fontSize: 11, color: 'var(--text-secondary)', background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', padding: '1px 7px', borderRadius: 4 }}>
                            {lbl}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {error && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', borderRadius: '8px', background: '#ef444418', border: '1px solid #ef444433', color: '#ef4444', fontSize: 13 }}>
                <Warning size={15} />
                {error}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                onClick={() => { setPhase('input'); setResult(null); }}
                style={{ padding: '8px 16px', borderRadius: '8px', background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', fontWeight: 500, fontSize: 13, cursor: 'pointer' }}
              >
                ← Edit
              </button>
              <button
                onClick={handleConfirm}
                style={{ padding: '10px 22px', borderRadius: '8px', background: '#af52de', color: '#fff', border: 'none', fontWeight: 600, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                Create {result.items.length} Tasks
                <ArrowRight size={15} />
              </button>
            </div>
          </>
        )}

        {/* Creating phase */}
        {phase === 'creating' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '32px 0' }}>
            <span style={{ fontSize: 28, animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span>
            <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Creating tasks and wiring dependencies…</span>
          </div>
        )}

        {/* Done phase */}
        {phase === 'done' && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '32px 0' }}>
            <span style={{ fontSize: 36 }}>✓</span>
            <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>
              {createdCount} task{createdCount !== 1 ? 's' : ''} created
            </span>
            <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
              Dependencies wired. IntelliSchedule will order them on next optimize.
            </span>
            <button
              onClick={onClose}
              style={{ padding: '10px 24px', borderRadius: '8px', background: '#af52de', color: '#fff', border: 'none', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
            >
              View Board
            </button>
          </div>
        )}
      </GlassSurface>
    </div>
  );
}

export default ParsePRDModal;
