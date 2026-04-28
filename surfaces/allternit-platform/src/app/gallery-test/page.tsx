'use client';

import React, { useState } from 'react';
import { ArtifactTemplateGallery } from '@/components/chat/ArtifactTemplateGallery';
import type { ArtifactTemplate } from '@/lib/ai/tools/templates/artifact-templates';

/**
 * Minimal isolation harness for ArtifactTemplateGallery.
 * No auth, no backend, no ShellApp required.
 * Visit /gallery-test to verify the gallery renders correctly.
 */
export default function GalleryTestPage() {
  const [log, setLog] = useState<string[]>([]);

  const addLog = (msg: string) =>
    setLog(prev => [`${new Date().toLocaleTimeString()} — ${msg}`, ...prev.slice(0, 19)]);

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--surface-canvas)',
      color: 'var(--ui-text-primary)',
      fontFamily: 'system-ui, sans-serif',
      padding: '32px',
    }}>
      <h1 style={{ fontSize: '14px', color: 'var(--ui-text-muted)', marginBottom: '32px', fontWeight: 500 }}>
        Gallery isolation harness · /gallery-test
      </h1>

      <div style={{ maxWidth: '900px' }}>
        <ArtifactTemplateGallery
          onOpenDirect={(template: ArtifactTemplate) => {
            addLog(`OPEN: ${template.id} (${template.kind})`);
          }}
          onSendPrompt={(prompt: string) => {
            addLog(`REMIX: "${prompt.slice(0, 60)}..."`);
          }}
        />
      </div>

      {log.length > 0 && (
        <div style={{
          marginTop: '48px',
          padding: '16px',
          background: 'var(--surface-panel)',
          borderRadius: '8px',
          fontFamily: 'monospace',
          fontSize: '12px',
          color: 'var(--status-success)',
        }}>
          <div style={{ color: 'var(--ui-text-muted)', marginBottom: '8px' }}>Event log:</div>
          {log.map((entry, i) => <div key={i}>{entry}</div>)}
        </div>
      )}
    </div>
  );
}
