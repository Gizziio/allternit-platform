"use client";
import React, { useEffect, useRef, useState } from 'react';

interface Props {
  projectName: string;
}

export function UniverDocEditor({ projectName }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const univerRef = useRef<any>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    if (!containerRef.current || univerRef.current) return;

    let cancelled = false;

    async function init() {
      try {
        const [
          { createUniver, defaultTheme, LocaleType, merge },
          { UniverDocsCorePreset },
          docsLocaleModule,
        ] = await Promise.all([
          import('@univerjs/presets'),
          import('@univerjs/presets/preset-docs-core'),
          import('@univerjs/presets/preset-docs-core/locales/en-US'),
        ]);

        if (cancelled || !containerRef.current) return;

        const docsLocale = (docsLocaleModule as any).default ?? docsLocaleModule;

        const { univerAPI } = createUniver({
          locale: LocaleType.EN_US,
          locales: { [LocaleType.EN_US]: merge({}, docsLocale) },
          theme: defaultTheme,
          presets: [
            UniverDocsCorePreset({
              container: containerRef.current,
            }),
          ],
        });

        univerRef.current = univerAPI;

        univerAPI.createUniverDoc({
          id: 'doc-1',
          body: {
            dataStream: `${projectName}\rStrategic Design Brief\rThis document captures the design intent, scope, and objectives for ${projectName}. Use the Allternit AI add-in panel to draft, rewrite, and structure content.\rObjectives\r• Define the visual language and component hierarchy\r• Validate user flows with stakeholders\r• Produce handoff-ready assets for engineering\r• Establish design tokens for cross-platform consistency\r`,
            textRuns: [
              { st: 0, ed: projectName.length, ts: { fs: 24, bl: 1 } },
              { st: projectName.length + 1, ed: projectName.length + 24, ts: { fs: 14, bl: 1 } },
            ],
            paragraphs: [
              { startIndex: projectName.length },
              { startIndex: projectName.length + 24 },
            ],
          },
        });

        if (!cancelled) setStatus('ready');
      } catch (err) {
        console.warn('[UniverDocEditor] init failed', err);
        if (!cancelled) setStatus('error');
      }
    }

    init();

    return () => {
      cancelled = true;
      try { univerRef.current?.dispose?.(); } catch {}
      univerRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ width: '100%', height: '100%', minHeight: 400, position: 'relative' }}>
      {status === 'loading' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 10, background: 'var(--bg-primary)', color: 'var(--text-tertiary)', fontSize: 13, fontWeight: 600 }}>
          <div style={{ width: 24, height: 24, border: '2px solid var(--border-default)', borderTopColor: 'var(--accent-primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          Loading document editor…
        </div>
      )}
      {status === 'error' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8, background: 'var(--bg-primary)', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600 }}>
          <span style={{ fontSize: 28 }}>📝</span>
          <span>Document editor unavailable</span>
          <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-tertiary)' }}>Run <code style={{ background: 'var(--surface-hover)', padding: '2px 6px', borderRadius: 4 }}>pnpm install</code> to enable Univer</span>
        </div>
      )}
      <div ref={containerRef} style={{ width: '100%', height: '100%', visibility: status === 'ready' ? 'visible' : 'hidden' }} />
    </div>
  );
}
