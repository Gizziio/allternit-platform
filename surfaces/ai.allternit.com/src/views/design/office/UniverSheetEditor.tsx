"use client";
import React, { useEffect, useRef, useState } from 'react';

interface Props {
  projectName: string;
}

export function UniverSheetEditor({ projectName }: Props) {
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
          { UniverSheetsCorePreset },
          sheetLocaleModule,
        ] = await Promise.all([
          import('@univerjs/presets'),
          import('@univerjs/presets/preset-sheets-core'),
          import('@univerjs/presets/preset-sheets-core/locales/en-US'),
        ]);

        if (cancelled || !containerRef.current) return;

        const sheetLocale = (sheetLocaleModule as any).default ?? sheetLocaleModule;

        const { univerAPI } = createUniver({
          locale: LocaleType.EN_US,
          locales: { [LocaleType.EN_US]: merge({}, sheetLocale) },
          theme: defaultTheme,
          presets: [
            UniverSheetsCorePreset({
              container: containerRef.current,
            }),
          ],
        });

        univerRef.current = univerAPI;

        univerAPI.createUniverSheet({
          id: 'sheet-1',
          name: projectName,
          sheets: {
            sheet1: {
              id: 'sheet1',
              name: 'Sheet1',
              cellData: {
                0: { 0: { v: 'Metric' }, 1: { v: 'Q1' }, 2: { v: 'Q2' }, 3: { v: 'Q3' }, 4: { v: 'Q4' } },
                1: { 0: { v: 'Revenue' }, 1: { v: 42000 }, 2: { v: 67500 }, 3: { v: 98000 }, 4: { v: 142000 } },
                2: { 0: { v: 'COGS' }, 1: { v: 8400 }, 2: { v: 12150 }, 3: { v: 16660 }, 4: { v: 21300 } },
                3: { 0: { v: 'Gross Profit' }, 1: { v: 33600 }, 2: { v: 55350 }, 3: { v: 81340 }, 4: { v: 120700 } },
                4: { 0: { v: 'OpEx' }, 1: { v: 22000 }, 2: { v: 31000 }, 3: { v: 40000 }, 4: { v: 52000 } },
                5: { 0: { v: 'EBITDA' }, 1: { v: 11600 }, 2: { v: 24350 }, 3: { v: 41340 }, 4: { v: 68700 } },
              },
            },
          },
        });

        if (!cancelled) setStatus('ready');
      } catch (err) {
        console.warn('[UniverSheetEditor] init failed', err);
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
          Loading spreadsheet editor…
        </div>
      )}
      {status === 'error' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8, background: 'var(--bg-primary)', color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600 }}>
          <span style={{ fontSize: 28 }}>📊</span>
          <span>Spreadsheet editor unavailable</span>
          <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-tertiary)' }}>Run <code style={{ background: 'var(--surface-hover)', padding: '2px 6px', borderRadius: 4 }}>pnpm install</code> to enable Univer</span>
        </div>
      )}
      <div ref={containerRef} style={{ width: '100%', height: '100%', visibility: status === 'ready' ? 'visible' : 'hidden' }} />
    </div>
  );
}
