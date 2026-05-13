/**
 * Allternit BlockSuite Editor Wrapper
 * Derived from AFFiNE / BlockSuite (MPL-2.0).
 *
 * This component mounts the BlockSuite block-based editor into an Allternit
 * ArtifactSection. It expects the BlockSuite packages to be installed:
 *   @blocksuite/presets @blocksuite/blocks @blocksuite/store
 *
 * Installation:
 *   cd surfaces/allternit-platform
 *   npm install @blocksuite/presets @blocksuite/blocks @blocksuite/store
 */

import React, { useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';

interface BlockSuiteEditorProps {
  docId: string;
  initialYjsState?: Uint8Array;
  onChange?: (yjsUpdate: Uint8Array) => void;
  readOnly?: boolean;
}

export const BlockSuiteEditor: React.FC<BlockSuiteEditorProps> = ({
  docId,
  initialYjsState,
  onChange,
  readOnly = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<any>(null);
  const onChangeRef = useRef(onChange);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);

  // Keep callback ref fresh without remounting the editor
  onChangeRef.current = onChange;

  useEffect(() => {
    let cancelled = false;
    const cleanupFns: Array<() => void> = [];

    const mount = async () => {
      try {
        // Dynamic import keeps the bundle light when BlockSuite isn't used
        const { DocCollection, Schema } = await import('@blocksuite/store');
        const { AffineSchemas } = await import('@blocksuite/blocks');
        const { PageEditor } = await import('@blocksuite/presets');

        if (cancelled || !containerRef.current) return;

        const schema = new Schema().register(AffineSchemas);
        const collection = new DocCollection({ schema });
        const doc = collection.createDoc({ id: docId });

        // Load the doc (initialises internal Yjs document)
        doc.load();
        doc.awarenessStore.setReadonly((doc as any)._blockCollection, readOnly);

        // Apply existing Yjs state if provided
        const ydoc = (doc as any).spaceDoc ?? (doc as any).yDoc;
        if (ydoc && initialYjsState && initialYjsState.length > 0) {
          Y.applyUpdate(ydoc, new Uint8Array(initialYjsState));
        }

        const editor = new PageEditor();
        editor.doc = doc;

        // Inject Allternit CSS variables into BlockSuite shadow DOM
        const style = document.createElement('style');
        style.textContent = `
          :host {
            --affine-brand-color: var(--accent-cowork, #af52de);
            --affine-background-primary-color: var(--bg-secondary, #0f0f0f);
            --affine-background-secondary-color: var(--surface-panel, #1a1a1a);
            --affine-text-primary-color: var(--text-primary, #e8e8e8);
            --affine-text-secondary-color: var(--text-secondary, #a0a0a0);
            --affine-border-color: var(--border-subtle, #2a2a2a);
            --affine-font-family: inherit;
          }
        `;
        editor.appendChild(style);

        containerRef.current.innerHTML = '';
        containerRef.current.appendChild(editor);
        editorRef.current = editor;

        // Subscribe to Yjs updates for persistence
        if (ydoc && !readOnly) {
          const handleUpdate = (update: Uint8Array) => {
            onChangeRef.current?.(update);
          };
          ydoc.on('update', handleUpdate);
          cleanupFns.push(() => {
            ydoc.off('update', handleUpdate);
          });
        }

        if (!cancelled) setLoadState('ready');
      } catch (err) {
        console.error('Failed to mount BlockSuite editor:', err);
        if (!cancelled) {
          setLoadState('error');
          setLoadError(err instanceof Error ? err.message : String(err));
        }
      }
    };

    void mount();

    return () => {
      cancelled = true;
      cleanupFns.forEach((fn) => fn());
      if (editorRef.current) {
        try {
          editorRef.current.remove();
        } catch {
          // ignore
        }
        editorRef.current = null;
      }
    };
  }, [docId, readOnly, initialYjsState]);

  return (
    <div
      ref={containerRef}
      style={{
        border: '1px solid var(--border-subtle)',
        borderRadius: '10px',
        minHeight: '300px',
        background: 'var(--bg-secondary)',
        padding: 'var(--spacing-sm)',
      }}
    >
      {loadState === 'loading' && (
        <div style={{ padding: 'var(--spacing-md)', color: 'var(--text-secondary)', fontSize: '13px' }}>
          Loading BlockSuite editor…
        </div>
      )}
      {loadState === 'error' && (
        <div style={{ padding: 'var(--spacing-md)', color: 'var(--status-error)', fontSize: '13px' }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Failed to load BlockSuite editor</div>
          <div style={{ fontSize: '12px', opacity: 0.8 }}>{loadError}</div>
          <div style={{ marginTop: 8, fontSize: '12px', color: 'var(--text-secondary)' }}>
            Ensure <code>@blocksuite/presets</code>, <code>@blocksuite/blocks</code>, and{' '}
            <code>@blocksuite/store</code> are installed.
          </div>
        </div>
      )}
    </div>
  );
};

export default BlockSuiteEditor;
