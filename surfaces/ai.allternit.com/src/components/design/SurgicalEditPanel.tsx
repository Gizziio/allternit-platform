"use client";
import React, { useEffect, useRef, useState } from 'react';
import { ChatTeardropText, Check, X, Warning } from '@phosphor-icons/react';
import type { SurgicalComment } from '../../lib/design/surgical-edit';
import { generateCommentId } from '../../lib/design/surgical-edit';
import {
  locateElement,
  extractInnerText,
  type AstElementEdit,
} from '../../lib/design/ast-binding';
import type { Agent } from '@/lib/agents/agent.types';

/**
 * Click-target currently offered for in-place (AST) editing — set when the
 * user click-targets an element (`nonce` changes per targeting click, even
 * when the same element is re-targeted).
 */
export interface InPlaceEditTarget {
  aioId: string;
  tag: string;
  nonce: number;
}

interface InPlaceStatus {
  kind: 'ok' | 'error';
  message: string;
}

interface SurgicalEditPanelProps {
  comments: SurgicalComment[];
  onChange: (comments: SurgicalComment[]) => void;
  onApply: () => void;
  agent?: Agent;
  artifactHtml?: string;
  /**
   * Click-to-target seed (mapping doc §3 port #5): when a new seed arrives
   * (nonce changes), the target field is pre-filled with the clicked
   * element's description and focused.
   */
  targetSeed?: { target: string; nonce: number } | null;
  /**
   * AST two-way binding (onlook-ast-0912): the click-targeted element,
   * offered for deterministic in-place edits that patch the artifact source
   * without an agent round-trip.
   */
  inPlaceTarget?: InPlaceEditTarget | null;
  /** Apply an in-place edit against the artifact source. */
  onApplyInPlace?: (edit: AstElementEdit) => InPlaceStatus;
}

type InPlaceMode = 'text' | 'attribute' | 'html';

export function SurgicalEditPanel({ comments, onChange, onApply, agent, artifactHtml, targetSeed, inPlaceTarget, onApplyInPlace }: SurgicalEditPanelProps) {
  const canSurgicalEdit = !agent || (agent.capabilities ?? []).includes('surgical-edit');
  const hasArtifact = Boolean(artifactHtml && artifactHtml.trim().length > 0);
  const [target, setTarget] = useState('');
  const [body, setBody] = useState('');
  const targetInputRef = useRef<HTMLInputElement>(null);
  const openCount = comments.filter((c) => !c.resolved).length;

  // In-place (AST) edit state.
  const [inPlaceMode, setInPlaceMode] = useState<InPlaceMode>('text');
  const [inPlaceText, setInPlaceText] = useState('');
  const [inPlaceAttrName, setInPlaceAttrName] = useState('');
  const [inPlaceAttrValue, setInPlaceAttrValue] = useState('');
  const [inPlaceAttrRemove, setInPlaceAttrRemove] = useState(false);
  const [inPlaceHtml, setInPlaceHtml] = useState('');
  const [inPlaceStatus, setInPlaceStatus] = useState<InPlaceStatus | null>(null);

  useEffect(() => {
    if (!targetSeed) return;
    setTarget(targetSeed.target);
    targetInputRef.current?.focus();
  }, [targetSeed]);

  // Pre-fill the in-place editor whenever a new element is targeted.
  const inPlaceLoc = inPlaceTarget && artifactHtml ? locateElement(artifactHtml, inPlaceTarget.aioId) : null;
  useEffect(() => {
    if (!inPlaceTarget) return;
    setInPlaceMode('text');
    setInPlaceAttrName('');
    setInPlaceAttrValue('');
    setInPlaceAttrRemove(false);
    setInPlaceStatus(null);
    if (artifactHtml) {
      const loc = locateElement(artifactHtml, inPlaceTarget.aioId);
      setInPlaceText(loc ? extractInnerText(artifactHtml, loc).trim() : '');
      setInPlaceHtml(loc ? artifactHtml.slice(loc.innerRange.start, loc.innerRange.end) : '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inPlaceTarget?.nonce]);

  function addComment() {
    if (!target.trim() || !body.trim()) return;
    const comment: SurgicalComment = {
      id: generateCommentId(),
      target: target.trim(),
      body: body.trim(),
      resolved: false,
      createdAt: new Date().toISOString(),
    };
    onChange([...comments, comment]);
    setTarget('');
    setBody('');
  }

  function applyInPlace() {
    if (!onApplyInPlace || !inPlaceTarget) return;
    let edit: AstElementEdit;
    if (inPlaceMode === 'text') {
      edit = { setText: inPlaceText };
    } else if (inPlaceMode === 'html') {
      edit = { innerHtml: inPlaceHtml };
    } else {
      const name = inPlaceAttrName.trim();
      if (!name) {
        setInPlaceStatus({ kind: 'error', message: 'Attribute name is required.' });
        return;
      }
      edit = inPlaceAttrRemove
        ? { removeAttributes: [name] }
        : { setAttributes: { [name]: inPlaceAttrValue } };
    }
    const result = onApplyInPlace(edit);
    setInPlaceStatus(result);
  }

  function resolve(id: string) {
    onChange(comments.map((c) => (c.id === id ? { ...c, resolved: true } : c)));
  }

  function remove(id: string) {
    onChange(comments.filter((c) => c.id !== id));
  }

  return (
    <div style={{
      background: 'var(--surface-panel)', border: '1px solid var(--border-subtle)',
      borderRadius: 12, padding: '12px 14px', marginBottom: 16,
      opacity: canSurgicalEdit ? 1 : 0.75,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <ChatTeardropText size={16} color="var(--accent-primary)" weight="bold" />
        <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)' }}>Surgical edits</span>
        {openCount > 0 && (
          <span style={{ fontSize: 10, fontWeight: 700, color: '#fff', background: 'var(--accent-primary)', borderRadius: 10, padding: '2px 8px' }}>
            {openCount}
          </span>
        )}
      </div>

      {!canSurgicalEdit && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, background: 'rgba(234,179,8,0.12)', marginBottom: 12 }}>
          <Warning size={14} color="#eab308" weight="fill" />
          <span style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
            {agent?.name ?? 'This agent'} does not have the <strong>surgical-edit</strong> capability. Add it in the agent harness to enable targeted edits.
          </span>
        </div>
      )}

      {!hasArtifact && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, background: 'var(--surface-hover)', marginBottom: 12 }}>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
            Generate an artifact first to attach surgical edits.
          </span>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
        <input
          aria-label="Target selector"
          ref={targetInputRef}
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          disabled={!canSurgicalEdit || !hasArtifact}
          placeholder="Target: e.g. hero heading, pricing card"
          style={{
            width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8,
            border: '1px solid var(--border-subtle)', background: 'var(--bg-primary)',
            color: 'var(--text-primary)', fontSize: 12,
          }}
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          disabled={!canSurgicalEdit || !hasArtifact}
          placeholder="Instruction: e.g. make this 48px and use the accent color"
          style={{
            width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8,
            border: '1px solid var(--border-subtle)', background: 'var(--bg-primary)',
            color: 'var(--text-primary)', fontSize: 12, minHeight: 60, resize: 'vertical',
          }}
        />
        <button
          type="button"
          onClick={addComment}
          disabled={!canSurgicalEdit || !hasArtifact || !target.trim() || !body.trim()}
          style={{
            padding: '8px 12px', borderRadius: 8, border: 'none',
            background: canSurgicalEdit && hasArtifact && target.trim() && body.trim() ? 'var(--accent-primary)' : 'var(--surface-hover)',
            color: canSurgicalEdit && hasArtifact && target.trim() && body.trim() ? '#fff' : 'var(--text-tertiary)',
            fontSize: 12, fontWeight: 700, cursor: canSurgicalEdit && hasArtifact && target.trim() && body.trim() ? 'pointer' : 'default',
          }}
        >
          Add comment
        </button>
      </div>

      {inPlaceTarget && onApplyInPlace && (
        <div style={{
          border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '10px 12px',
          marginBottom: 14, background: 'var(--bg-primary)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', flex: 1 }}>
              Edit in place: &lt;{inPlaceTarget.tag}&gt; ({inPlaceTarget.aioId})
            </span>
            {(['text', 'attribute', 'html'] as InPlaceMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setInPlaceMode(mode)}
                style={{
                  padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700,
                  border: '1px solid var(--border-subtle)', cursor: 'pointer',
                  background: inPlaceMode === mode ? 'var(--accent-primary)' : 'transparent',
                  color: inPlaceMode === mode ? '#fff' : 'var(--text-tertiary)',
                }}
              >
                {mode === 'text' ? 'Text' : mode === 'attribute' ? 'Attribute' : 'Inner HTML'}
              </button>
            ))}
          </div>

          {!inPlaceLoc && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <Warning size={13} color="#eab308" weight="fill" />
              <span style={{ fontSize: 10, color: 'var(--text-tertiary)', lineHeight: 1.4 }}>
                Element not found in the current source — it may have been renumbered by a
                previous in-place edit. Re-target it in the preview.
              </span>
            </div>
          )}

          {inPlaceMode === 'text' && (
            <textarea
              aria-label="In-place text"
              value={inPlaceText}
              onChange={(e) => setInPlaceText(e.target.value)}
              disabled={!inPlaceLoc}
              placeholder="New text content"
              style={{
                width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8,
                border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)',
                color: 'var(--text-primary)', fontSize: 12, minHeight: 48, resize: 'vertical',
                marginBottom: 8,
              }}
            />
          )}

          {inPlaceMode === 'attribute' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
              <input
                aria-label="In-place attribute name"
                value={inPlaceAttrName}
                onChange={(e) => setInPlaceAttrName(e.target.value)}
                disabled={!inPlaceLoc}
                placeholder="Attribute name (e.g. class, style, data-x)"
                style={{
                  width: '100%', boxSizing: 'border-box', padding: '7px 10px', borderRadius: 8,
                  border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)', fontSize: 12,
                }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  aria-label="In-place attribute value"
                  value={inPlaceAttrValue}
                  onChange={(e) => setInPlaceAttrValue(e.target.value)}
                  disabled={!inPlaceLoc || inPlaceAttrRemove}
                  placeholder={inPlaceAttrRemove ? 'Attribute will be removed' : 'Attribute value'}
                  style={{
                    flex: 1, boxSizing: 'border-box', padding: '7px 10px', borderRadius: 8,
                    border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)', fontSize: 12,
                  }}
                />
                <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text-tertiary)', cursor: 'pointer', flexShrink: 0 }}>
                  <input
                    aria-label="Remove attribute"
                    type="checkbox"
                    checked={inPlaceAttrRemove}
                    onChange={(e) => setInPlaceAttrRemove(e.target.checked)}
                    disabled={!inPlaceLoc}
                  />
                  Remove
                </label>
              </div>
            </div>
          )}

          {inPlaceMode === 'html' && (
            <textarea
              aria-label="In-place inner HTML"
              value={inPlaceHtml}
              onChange={(e) => setInPlaceHtml(e.target.value)}
              disabled={!inPlaceLoc}
              placeholder="Replacement inner HTML"
              spellCheck={false}
              style={{
                width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8,
                border: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)',
                color: 'var(--text-primary)', fontSize: 11, fontFamily: 'var(--font-mono, monospace)',
                minHeight: 72, resize: 'vertical', marginBottom: 8,
              }}
            />
          )}

          <button
            type="button"
            onClick={applyInPlace}
            disabled={!inPlaceLoc}
            style={{
              width: '100%', padding: '7px 12px', borderRadius: 8, border: 'none',
              background: inPlaceLoc ? 'var(--status-success, #22c55e)' : 'var(--surface-hover)',
              color: inPlaceLoc ? '#fff' : 'var(--text-tertiary)', fontSize: 12, fontWeight: 700,
              cursor: inPlaceLoc ? 'pointer' : 'default',
            }}
          >
            Apply in place (no agent round-trip)
          </button>

          {inPlaceStatus && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, marginTop: 8,
              padding: '6px 8px', borderRadius: 6,
              background: inPlaceStatus.kind === 'ok' ? 'rgba(34,197,94,0.12)' : 'rgba(234,179,8,0.12)',
            }}>
              {inPlaceStatus.kind === 'ok'
                ? <Check size={13} color="#22c55e" weight="bold" />
                : <Warning size={13} color="#eab308" weight="fill" />}
              <span style={{ fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                {inPlaceStatus.message}
                {inPlaceStatus.kind === 'ok' ? ' — ids after this element may have renumbered; re-target for the next edit.' : ''}
              </span>
            </div>
          )}
        </div>
      )}

      {comments.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
          {comments.map((comment) => (
            <div
              key={comment.id}
              style={{
                padding: 10, borderRadius: 8,
                border: '1px solid var(--border-subtle)',
                background: comment.resolved ? 'var(--surface-hover)' : 'var(--bg-primary)',
                opacity: comment.resolved ? 0.6 : 1,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>{comment.target}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-primary)', marginTop: 4 }}>{comment.body}</div>
                </div>
                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                  {!comment.resolved && canSurgicalEdit && (
                    <button
                      type="button"
                      onClick={() => resolve(comment.id)}
                      style={{ width: 22, height: 22, borderRadius: 5, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--status-success)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                    ><Check size={12} weight="bold" /></button>
                  )}
                  <button
                    type="button"
                    onClick={() => remove(comment.id)}
                    style={{ width: 22, height: 22, borderRadius: 5, border: '1px solid var(--border-subtle)', background: 'transparent', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                  ><X size={12} weight="bold" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {openCount > 0 && (
        <button
          type="button"
          onClick={onApply}
          disabled={!canSurgicalEdit || !hasArtifact}
          style={{
            width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--accent-primary)',
            background: canSurgicalEdit && hasArtifact ? 'var(--accent-primary)' : 'var(--surface-hover)',
            color: canSurgicalEdit && hasArtifact ? '#fff' : 'var(--text-tertiary)', fontSize: 12, fontWeight: 700,
            cursor: canSurgicalEdit && hasArtifact ? 'pointer' : 'default',
          }}
        >
          Apply {openCount} surgical edit{openCount === 1 ? '' : 's'}
        </button>
      )}
    </div>
  );
}
