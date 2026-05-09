'use client';

import React, { Component } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { GlassSurfaceBase } from '@/design/glass/GlassSurface';
import { Text } from '@/components/typography/Text';

interface Props {
  children: React.ReactNode;
  onClose: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class LessonPlayerErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[LessonPlayer] Render error:', error);
    console.error('[LessonPlayer] Component stack:', errorInfo.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(20px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 24,
        }}>
          <GlassSurfaceBase
            blur="lg"
            border="subtle"
            style={{ maxWidth: 480, width: '100%', padding: '40px 36px', textAlign: 'center' }}
          >
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: 'var(--status-error-bg, rgba(239,68,68,0.1))',
              border: '1px solid var(--status-error, #ef4444)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px',
            }}>
              <AlertTriangle size={28} color="var(--status-error, #ef4444)" />
            </div>
            <Text variant="heading" style={{ fontSize: 22, fontWeight: 700, margin: '0 0 8px', color: 'var(--ui-text-primary)' }}>
              Lesson Player Error
            </Text>
            <Text variant="body" style={{ fontSize: 14, color: 'var(--ui-text-secondary)', margin: '0 0 20px', lineHeight: 1.6 }}>
              Something went wrong while loading this lesson. The lesson data may be corrupted or incompatible.
            </Text>
            {this.state.error && (
              <Text variant="caption" style={{
                fontSize: 12, color: 'var(--ui-text-muted)',
                background: 'rgba(0,0,0,0.3)', padding: '10px 14px',
                borderRadius: 8, marginBottom: 20, display: 'block',
                fontFamily: 'var(--font-mono)', textAlign: 'left',
                overflow: 'auto', maxHeight: 120,
              }}>
                {this.state.error.message}
              </Text>
            )}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button
                onClick={() => this.setState({ hasError: false, error: null })}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '10px 18px', background: 'rgba(255,255,255,.06)',
                  border: '1px solid var(--ui-border-muted)', borderRadius: 10,
                  color: 'var(--ui-text-primary)', fontWeight: 600, fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                <RotateCcw size={14} /> Retry
              </button>
              <button
                onClick={this.props.onClose}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '10px 18px', background: 'var(--accent-primary)',
                  border: 'none', borderRadius: 10,
                  color: 'var(--surface-canvas)', fontWeight: 600, fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Close Player
              </button>
            </div>
          </GlassSurfaceBase>
        </div>
      );
    }

    return this.props.children;
  }
}
