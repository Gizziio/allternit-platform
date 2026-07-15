'use client';

import React, { useState } from 'react';
import { X } from '@phosphor-icons/react';

interface CodeEnvironmentDialogProps {
  open: boolean;
  mode: 'local' | 'cloud';
  initialName?: string;
  onClose: () => void;
  onSave?: (values: { name?: string; envVars?: string; setupScript?: string; networkAccess?: string }) => void;
}

export function CodeEnvironmentDialog({
  open,
  mode,
  initialName = mode === 'local' ? 'Local' : 'Default',
  onClose,
  onSave,
}: CodeEnvironmentDialogProps): React.ReactNode {
  const [name, setName] = useState(initialName);
  const [envVars, setEnvVars] = useState('');
  const [setupScript, setSetupScript] = useState('');
  const [networkAccess, setNetworkAccess] = useState('Full');

  if (!open) return null;

  const isCloud = mode === 'cloud';
  const title = isCloud ? 'Update cloud environment' : 'Update local environment';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.45)',
        padding: 20,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 520,
          maxHeight: '90vh',
          overflow: 'auto',
          borderRadius: 16,
          border: '1px solid rgba(255, 255, 255, 0.1)',
          background: 'var(--surface-floating, #1a1d21)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.45)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 16,
            padding: '20px 20px 12px',
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: 17,
                fontWeight: 600,
                color: 'var(--text-primary)',
              }}
            >
              {title}
            </h2>
            <p
              style={{
                margin: '6px 0 0',
                fontSize: 13,
                color: 'var(--text-secondary)',
                lineHeight: 1.4,
              }}
            >
              {isCloud
                ? 'Changes to your environment will apply to new sessions.'
                : 'These are stored securely and passed to code sessions.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'transparent',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: '8px 20px 20px', display: 'flex', flexDirection: 'column', gap: 18 }}>
          {isCloud && (
            <Field label="Name">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={inputStyle}
              />
            </Field>
          )}

          {isCloud && (
            <Field
              label="Network access"
              hint={
                <>
                  Learn more about our <a href="#" style={{ color: 'var(--accent-primary)' }}>network policy</a> and{' '}
                  <a href="#" style={{ color: 'var(--accent-primary)' }}>access levels</a>.
                </>
              }
            >
              <select
                value={networkAccess}
                onChange={(e) => setNetworkAccess(e.target.value)}
                style={inputStyle}
              >
                <option>Full</option>
                <option>Restricted</option>
                <option>None</option>
              </select>
            </Field>
          )}

          <Field
            label="Environment variables"
            hint={
              <>
                In <code style={{ fontSize: 12 }}>.env</code> format.{' '}
                {isCloud
                  ? "These are visible to anyone using this environment — don't add secrets or credentials."
                  : 'These are stored securely and passed to code sessions.'}
              </>
            }
          >
            <textarea
              value={envVars}
              onChange={(e) => setEnvVars(e.target.value)}
              placeholder={'NODE_ENV=production\nGIT_AUTHOR_NAME=Your Name\n\n# Multiline values - wrap in quotes\nCONFIG="key1=val1\nkey2=val2"'}
              style={{
                ...inputStyle,
                minHeight: 120,
                resize: 'vertical',
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: 12,
                lineHeight: 1.5,
              }}
            />
          </Field>

          {isCloud && (
            <Field label="Setup script" hint="Bash script that runs when a new session starts, before the code agent launches.">
              <textarea
                value={setupScript}
                onChange={(e) => setSetupScript(e.target.value)}
                placeholder={'#!/bin/bash\nnpm install'}
                style={{
                  ...inputStyle,
                  minHeight: 100,
                  resize: 'vertical',
                  fontFamily: 'var(--font-mono, monospace)',
                  fontSize: 12,
                  lineHeight: 1.5,
                }}
              />
            </Field>
          )}

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              paddingTop: 8,
            }}
          >
            {isCloud ? (
              <button
                type="button"
                onClick={onClose}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--status-error)',
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Archive
              </button>
            ) : (
              <span />
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '8px 14px',
                  borderRadius: 8,
                  border: '1px solid rgba(255,255,255,0.1)',
                  background: 'transparent',
                  color: 'var(--text-secondary)',
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onSave?.({
                    name,
                    envVars,
                    setupScript,
                    networkAccess,
                  });
                  onClose();
                }}
                style={{
                  padding: '8px 14px',
                  borderRadius: 8,
                  border: 'none',
                  background: 'var(--text-primary)',
                  color: 'var(--surface-floating)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Save changes
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{label}</span>
      {hint ? (
        <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>{hint}</span>
      ) : null}
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(255,255,255,0.03)',
  color: 'var(--text-primary)',
  fontSize: 13,
  outline: 'none',
  boxSizing: 'border-box',
};
