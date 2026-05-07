import React, { useCallback, useRef, useState } from 'react';
import { Cube, DownloadSimple, UploadSimple, Copy, Check } from '@phosphor-icons/react';
import * as Y from 'yjs';
import GlassSurface from '@/design/GlassSurface';
import BlockSuiteEditor from '@/components/artifact/BlockSuiteEditor';

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToUint8Array(base64: string): Uint8Array | undefined {
  try {
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return undefined;
  }
}

export const BlockSuiteTestView: React.FC = () => {
  const [dumpedState, setDumpedState] = useState<string>('');
  const [loadInput, setLoadInput] = useState<string>('');
  const [loadedState, setLoadedState] = useState<Uint8Array | undefined>(undefined);
  const [loadKey, setLoadKey] = useState<number>(0);
  const [copied, setCopied] = useState(false);
  const updatesRef = useRef<Uint8Array[]>([]);

  const handleUpdate = useCallback((update: Uint8Array) => {
    updatesRef.current.push(new Uint8Array(update));
  }, []);

  const handleDump = useCallback(() => {
    try {
      const doc = new Y.Doc();
      for (const update of updatesRef.current) {
        Y.applyUpdate(doc, update);
      }
      const fullState = Y.encodeStateAsUpdate(doc);
      const base64 = uint8ArrayToBase64(fullState);
      setDumpedState(base64);
      doc.destroy();
    } catch (err) {
      setDumpedState(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, []);

  const handleLoad = useCallback(() => {
    const bytes = base64ToUint8Array(loadInput.trim());
    if (bytes) {
      setLoadedState(bytes);
      setLoadKey((k) => k + 1);
    } else {
      setLoadedState(undefined);
      setLoadKey((k) => k + 1);
    }
  }, [loadInput]);

  const handleCopy = useCallback(() => {
    if (!dumpedState) return;
    navigator.clipboard.writeText(dumpedState).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [dumpedState]);

  return (
    <div style={{ padding: 'var(--spacing-lg)', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
        <Cube size={24} color="#af52de" />
        <h1 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '24px', fontWeight: 600 }}>
          BlockSuite Test
        </h1>
      </div>
      <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '14px' }}>
        Runtime verification surface for the BlockSuite editor integration. Type in the editor below, dump the Yjs
        state, then load it into the second editor to verify round-trip persistence.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-lg)' }}>
        {/* Source editor */}
        <GlassSurface style={{ padding: 'var(--spacing-lg)', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: 600 }}>Editor A — Source</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>docId: blocksuite-test-doc</div>
          </div>
          <BlockSuiteEditor
            docId="blocksuite-test-doc"
            onChange={handleUpdate}
          />
          <button
            onClick={handleDump}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 12px',
              borderRadius: 8,
              border: 'none',
              background: 'var(--accent-cowork)',
              color: '#fff',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 600,
              alignSelf: 'flex-start',
            }}
          >
            <DownloadSimple size={14} />
            Dump Yjs State
          </button>

          {dumpedState && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600 }}>Dumped State (base64)</span>
                <button
                  onClick={handleCopy}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '4px 8px',
                    borderRadius: 6,
                    border: '1px solid var(--border-subtle)',
                    background: 'transparent',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <textarea
                readOnly
                value={dumpedState}
                rows={4}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  fontSize: '12px',
                  fontFamily: 'var(--font-mono)',
                  resize: 'vertical',
                }}
              />
            </div>
          )}
        </GlassSurface>

        {/* Target editor */}
        <GlassSurface style={{ padding: 'var(--spacing-lg)', display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: 600 }}>Editor B — Restore</div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>docId: blocksuite-test-doc-restore</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600 }}>Paste base64 state to load</span>
            <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
              <textarea
                value={loadInput}
                onChange={(e) => setLoadInput(e.target.value)}
                placeholder="Paste base64-encoded Yjs state here..."
                rows={3}
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  fontSize: '12px',
                  fontFamily: 'var(--font-mono)',
                  resize: 'vertical',
                }}
              />
            </div>
            <button
              onClick={handleLoad}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 12px',
                borderRadius: 8,
                border: 'none',
                background: 'var(--accent-cowork)',
                color: '#fff',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
                alignSelf: 'flex-start',
              }}
            >
              <UploadSimple size={14} />
              Load State
            </button>
          </div>

          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--spacing-md)' }}>
            <BlockSuiteEditor
              key={loadKey}
              docId="blocksuite-test-doc-restore"
              initialYjsState={loadedState}
              readOnly={false}
            />
          </div>
        </GlassSurface>
      </div>
    </div>
  );
};

export default BlockSuiteTestView;
