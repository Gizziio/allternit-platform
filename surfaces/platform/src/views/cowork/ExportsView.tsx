import React, { useState, useEffect } from 'react';
import {
  DownloadSimple,
  CircleNotch,
} from '@phosphor-icons/react';
import GlassSurface from '@/design/GlassSurface';

interface Export {
  id: string;
  format: 'PDF' | 'CSV' | 'JSON' | 'XLSX';
  name: string;
  source: string;
  fileSize: string;
  created: string;
  status: 'ready' | 'processing';
}

const getFormatColor = (format: Export['format']) => {
  switch (format) {
    case 'PDF':
      return { bg: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' };
    case 'CSV':
      return { bg: 'rgba(34, 197, 94, 0.1)', color: '#22c55e' };
    case 'JSON':
      return { bg: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' };
    case 'XLSX':
      return { bg: 'rgba(168, 85, 247, 0.1)', color: '#a855f7' };
    default:
      return { bg: 'var(--bg-secondary)', color: 'var(--text-secondary)' };
  }
};

export const ExportsView: React.FC = () => {
  const [hoveredExportId, setHoveredExportId] = useState<string | null>(null);
  const [exports_, setExports] = useState<Export[]>([]);

  useEffect(() => {
    fetch('/api/v1/workspace/exports').then(r => r.json()).then(setExports).catch(() => {});
  }, []);

  return (
    <div style={{ padding: 'var(--spacing-lg)' }}>
      {/* Header */}
      <div style={{ marginBottom: 'var(--spacing-xl)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-md)' }}>
          <DownloadSimple size={24} color="#af52de" />
          <h1 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '24px', fontWeight: 600 }}>Exports</h1>
        </div>
        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '14px' }}>Generated and exported files</p>
      </div>

      {/* Exports List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
        {exports_.map((exp) => {
          const formatColor = getFormatColor(exp.format);

          return (
            <GlassSurface
              key={exp.id}
              style={{
                padding: 'var(--spacing-md)',
                cursor: 'pointer',
              }}
              onMouseEnter={() => setHoveredExportId(exp.id)}
              onMouseLeave={() => setHoveredExportId(null)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
                {/* Format Badge */}
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: '48px',
                    height: '48px',
                    borderRadius: '8px',
                    backgroundColor: formatColor.bg,
                    color: formatColor.color,
                    fontSize: '12px',
                    fontWeight: 700,
                    flexShrink: 0,
                  }}
                >
                  {exp.format}
                </div>

                {/* Export Info */}
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: '0 0 4px 0', color: 'var(--text-primary)', fontSize: '15px', fontWeight: 500 }}>
                    {exp.name}
                  </h3>
                  <div style={{ display: 'flex', gap: 'var(--spacing-lg)', fontSize: '13px', color: 'var(--text-secondary)' }}>
                    <span>{exp.source}</span>
                    <span>{exp.fileSize}</span>
                    <span>{exp.created}</span>
                  </div>
                </div>

                {/* Status and Action */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', flexShrink: 0 }}>
                  {exp.status === 'processing' ? (
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        borderRadius: '4px',
                        backgroundColor: 'var(--bg-secondary)',
                        color: 'var(--text-secondary)',
                        fontSize: '13px',
                        fontWeight: 500,
                      }}
                    >
                      <CircleNotch size={16} style={{ animation: 'spin 1s linear infinite' }} />
                      Processing
                    </div>
                  ) : (
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        borderRadius: '4px',
                        backgroundColor: 'rgba(34, 197, 94, 0.1)',
                        color: '#22c55e',
                        fontSize: '13px',
                        fontWeight: 500,
                      }}
                    >
                      <DownloadSimple size={16} />
                      Ready
                    </div>
                  )}

                  {/* Download Button - appears on hover for ready items */}
                  {exp.status === 'ready' && hoveredExportId === exp.id && (
                    <button
                      style={{
                        padding: '8px 12px',
                        borderRadius: '4px',
                        border: 'none',
                        backgroundColor: '#af52de',
                        color: '#fff',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.opacity = '0.9';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.opacity = '1';
                      }}
                    >
                      <DownloadSimple size={16} />
                      Download
                    </button>
                  )}
                </div>
              </div>
            </GlassSurface>
          );
        })}
      </div>

      {/* Spin Animation */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default ExportsView;
