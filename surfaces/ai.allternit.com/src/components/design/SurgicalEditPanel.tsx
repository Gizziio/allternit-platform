"use client";
import React, { useState } from 'react';
import { ChatTeardropText, Check, X } from '@phosphor-icons/react';
import type { SurgicalComment } from '../../lib/design/surgical-edit';
import { generateCommentId } from '../../lib/design/surgical-edit';

interface SurgicalEditPanelProps {
  comments: SurgicalComment[];
  onChange: (comments: SurgicalComment[]) => void;
  onApply: () => void;
}

export function SurgicalEditPanel({ comments, onChange, onApply }: SurgicalEditPanelProps) {
  const [target, setTarget] = useState('');
  const [body, setBody] = useState('');
  const openCount = comments.filter((c) => !c.resolved).length;

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

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
        <input
          aria-label="Target selector"
          value={target}
          onChange={(e) => setTarget(e.target.value)}
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
          disabled={!target.trim() || !body.trim()}
          style={{
            padding: '8px 12px', borderRadius: 8, border: 'none',
            background: target.trim() && body.trim() ? 'var(--accent-primary)' : 'var(--surface-hover)',
            color: target.trim() && body.trim() ? '#fff' : 'var(--text-tertiary)',
            fontSize: 12, fontWeight: 700, cursor: target.trim() && body.trim() ? 'pointer' : 'default',
          }}
        >
          Add comment
        </button>
      </div>

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
                  {!comment.resolved && (
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
          style={{
            width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--accent-primary)',
            background: 'var(--accent-primary)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
          }}
        >
          Apply {openCount} surgical edit{openCount === 1 ? '' : 's'}
        </button>
      )}
    </div>
  );
}
