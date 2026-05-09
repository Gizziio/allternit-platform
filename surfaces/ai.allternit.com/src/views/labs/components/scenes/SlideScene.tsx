'use client';

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { GlassSurfaceBase } from '@/design/glass/GlassSurface';
import { Text } from '@/components/typography/Text';

const ACCENT = 'var(--accent-primary)';
const TEXT_PRIMARY = 'var(--ui-text-primary)';
const TEXT_SECONDARY = 'var(--ui-text-secondary)';
const BORDER_SUBTLE = 'var(--ui-border-muted)';

interface SlideSceneProps {
  title: string;
  content: string;
}

export function SlideScene({ title, content }: SlideSceneProps) {
  return (
    <GlassSurfaceBase
      blur="md"
      border="subtle"
      style={{
        maxWidth: 720,
        margin: '0 auto',
        padding: '40px 48px',
        minHeight: '50vh',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Text variant="heading" as="h2" style={{ fontSize: 24, fontWeight: 700, margin: '0 0 24px', color: TEXT_PRIMARY, letterSpacing: '-0.02em' }}>
        {title}
      </Text>

      <div className="lesson-markdown" style={{ flex: 1 }}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h2: ({ children }) => (
              <Text variant="subheading" as="h2" style={{ fontSize: 18, fontWeight: 600, margin: '24px 0 12px', color: ACCENT, letterSpacing: '-0.01em', borderBottom: `1px solid ${BORDER_SUBTLE}`, paddingBottom: 8 }}>
                {children}
              </Text>
            ),
            h3: ({ children }) => (
              <Text variant="subheading" as="h3" style={{ fontSize: 15, fontWeight: 600, margin: '20px 0 8px', color: 'rgba(212,176,140,0.8)' }}>
                {children}
              </Text>
            ),
            p: ({ children }) => (
              <Text variant="body" as="p" style={{ fontSize: 15, lineHeight: 1.7, color: TEXT_PRIMARY, margin: '10px 0' }}>
                {children}
              </Text>
            ),
            blockquote: ({ children }) => (
              <blockquote style={{ margin: '16px 0', padding: '12px 16px', borderLeft: `3px solid ${ACCENT}`, background: 'color-mix(in srgb, var(--accent-primary) 5%, transparent)', borderRadius: 8 }}>
                {children}
              </blockquote>
            ),
            a: ({ href, children }) => (
              <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: ACCENT, textDecoration: 'none', fontWeight: 500 }}>
                {children}
              </a>
            ),
            strong: ({ children }) => (
              <strong style={{ color: TEXT_PRIMARY, fontWeight: 600 }}>{children}</strong>
            ),
            em: ({ children }) => (
              <em style={{ color: TEXT_SECONDARY }}>{children}</em>
            ),
            ul: ({ children }) => (
              <ul style={{ paddingLeft: 20, margin: '10px 0' }}>{children}</ul>
            ),
            ol: ({ children }) => (
              <ol style={{ paddingLeft: 20, margin: '10px 0' }}>{children}</ol>
            ),
            li: ({ children }) => (
              <li style={{ fontSize: 15, lineHeight: 1.7, color: TEXT_PRIMARY, margin: '6px 0' }}>{children}</li>
            ),
            code: ({ children }) => (
              <code style={{ fontSize: 13, background: 'color-mix(in srgb, var(--accent-primary) 8%, transparent)', padding: '2px 6px', borderRadius: 4, color: 'rgba(212,176,140,0.9)', border: '1px solid color-mix(in srgb, var(--accent-primary) 15%, transparent)', fontFamily: 'var(--font-mono)' }}>
                {children}
              </code>
            ),
            pre: ({ children }) => (
              <pre style={{ background: 'rgba(0,0,0,0.3)', padding: 16, borderRadius: 10, overflow: 'auto', border: `1px solid ${BORDER_SUBTLE}`, fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                {children}
              </pre>
            ),
            hr: () => <hr style={{ border: 'none', borderTop: `1px solid ${BORDER_SUBTLE}`, margin: '24px 0' }} />,
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </GlassSurfaceBase>
  );
}
