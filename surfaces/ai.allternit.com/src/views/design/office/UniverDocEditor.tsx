"use client";
import React, { useEffect, useRef } from 'react';

interface Props {
  projectName: string;
}

export function UniverDocEditor({ projectName }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const univerRef = useRef<any>(null);

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

        // Seed with a starter document
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
      } catch (err) {
        console.warn('[UniverDocEditor] init failed', err);
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
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', minHeight: 400 }}
    />
  );
}
