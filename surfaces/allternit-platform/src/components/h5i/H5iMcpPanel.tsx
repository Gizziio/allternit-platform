"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Plugs, X, Check, Copy } from '@phosphor-icons/react';
import { fetchMcpConfig, type McpConfigResponse } from '@/lib/h5i/client';

interface H5iMcpPanelProps {
  onClose: () => void;
}

export function H5iMcpPanel({ onClose }: H5iMcpPanelProps) {
  const [config, setConfig] = useState<McpConfigResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchMcpConfig();
      setConfig(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load MCP config');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCopy = useCallback(() => {
    if (!config) return;
    const json = JSON.stringify(config.claudeSettings, null, 2);
    navigator.clipboard.writeText(json).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [config]);

  const settingsJson = config ? JSON.stringify(config.claudeSettings, null, 2) : '';

  return (
    <div
      style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 10001,
        width: 480,
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 16,
        border: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(11,14,16,0.96)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Plugs size={18} color="#8b5cf6" />
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
            h5i MCP Server
          </span>
        </div>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}>
          <X size={16} />
        </button>
      </div>

      {/* Body */}
      <div style={{ padding: 16 }}>
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 30, color: 'var(--text-muted)' }}>
            <span className="animate-spin" style={{ display: 'inline-block', marginRight: 8 }}>⟳</span>
            Loading...
          </div>
        )}

        {error && (
          <div
            style={{
              padding: 10,
              borderRadius: 8,
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.2)',
              fontSize: 12,
              color: '#ef4444',
            }}
          >
            {error}
          </div>
        )}

        {config && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Status */}
            <div
              style={{
                padding: 10,
                borderRadius: 8,
                background: config.mcpAvailable ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.08)',
                border: `1px solid ${config.mcpAvailable ? 'rgba(16,185,129,0.2)' : 'rgba(245,158,11,0.2)'}`,
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>MCP Server</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: config.mcpAvailable ? '#10b981' : '#f59e0b' }}>
                {config.mcpAvailable ? 'Available' : 'Not Available'}
              </div>
            </div>

            {/* Config snippet */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>
                  Claude Code Settings
                </span>
                <button
                  onClick={handleCopy}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '4px 8px',
                    borderRadius: 6,
                    border: '1px solid rgba(255,255,255,0.08)',
                    background: 'rgba(255,255,255,0.03)',
                    color: 'var(--text-secondary)',
                    fontSize: 11,
                    cursor: 'pointer',
                  }}
                >
                  {copied ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <pre
                style={{
                  padding: 12,
                  borderRadius: 8,
                  background: 'rgba(0,0,0,0.2)',
                  fontSize: 11,
                  fontFamily: 'monospace',
                  color: 'var(--text-secondary)',
                  overflow: 'auto',
                  maxHeight: 200,
                }}
              >
                {settingsJson}
              </pre>
            </div>

            {/* Instructions */}
            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--text-secondary)' }}>Setup:</strong>
              <ol style={{ margin: '6px 0 0 16px', padding: 0 }}>
                <li>Copy the config above</li>
                <li>Paste into <code style={{ fontFamily: 'monospace', background: 'rgba(255,255,255,0.04)', padding: '1px 4px', borderRadius: 3 }}>~/.claude/settings.json</code></li>
                <li>Restart Claude Code</li>
                <li>Agents can now use h5i tools: <code style={{ fontFamily: 'monospace', background: 'rgba(255,255,255,0.04)', padding: '1px 4px', borderRadius: 3 }}>h5i_log</code>, <code style={{ fontFamily: 'monospace', background: 'rgba(255,255,255,0.04)', padding: '1px 4px', borderRadius: 3 }}>h5i_blame</code>, <code style={{ fontFamily: 'monospace', background: 'rgba(255,255,255,0.04)', padding: '1px 4px', borderRadius: 3 }}>h5i_context_trace</code></li>
              </ol>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
