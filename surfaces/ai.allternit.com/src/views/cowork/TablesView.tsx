import React, { useState, useEffect } from 'react';
import {
  Table as Table2,
} from '@phosphor-icons/react';
import GlassSurface from '@/design/GlassSurface';

interface DataTable {
  id: string;
  name: string;
  rowCount: number;
  columnCount: number;
  columns: string[];
  lastUpdated: string;
}

export const TablesView: React.FC = () => {
  const [hoveredTableId, setHoveredTableId] = useState<string | null>(null);
  const [tables, setTables] = useState<DataTable[]>([]);

  useEffect(() => {
    fetch('/api/v1/workspace/tables').then(r => r.json()).then(setTables).catch(() => {});
  }, []);

  return (
    <div style={{ padding: 'var(--spacing-lg)' }}>
      {/* Header */}
      <div style={{ marginBottom: 'var(--spacing-xl)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-md)' }}>
          <Table2 size={24} color="#af52de" />
          <h1 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '24px', fontWeight: 600 }}>Tables</h1>
        </div>
        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '14px' }}>Structured data tables</p>
      </div>

      {/* Table Cards Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))',
          gap: 'var(--spacing-lg)',
        }}
      >
        {tables.map((table) => (
          <GlassSurface
            key={table.id}
            style={{
              padding: 'var(--spacing-lg)',
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--spacing-md)',
              position: 'relative',
              overflow: 'hidden',
            }}
            onMouseEnter={() => setHoveredTableId(table.id)}
            onMouseLeave={() => setHoveredTableId(null)}
          >
            {/* Table Name */}
            <div>
              <h3 style={{ margin: '0 0 4px 0', color: 'var(--text-primary)', fontSize: '16px', fontWeight: 600 }}>
                {table.name}
              </h3>
            </div>

            {/* Row and Column Count */}
            <div style={{ display: 'flex', gap: 'var(--spacing-lg)', fontSize: '13px', color: 'var(--text-secondary)' }}>
              <span>{table.rowCount.toLocaleString()} rows</span>
              <span>{table.columnCount} columns</span>
            </div>

            {/* Schema Preview */}
            <div>
              <p style={{ margin: '0 0 8px 0', fontSize: '12px', color: 'var(--text-tertiary)', fontWeight: 500, textTransform: 'uppercase' }}>
                Schema
              </p>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {table.columns.slice(0, 4).map((col, idx) => (
                  <span
                    key={idx}
                    style={{
                      fontSize: '12px',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      backgroundColor: 'var(--bg-secondary)',
                      color: 'var(--text-tertiary)',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {col}
                  </span>
                ))}
                {table.columns.length > 4 && (
                  <span
                    style={{
                      fontSize: '12px',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      backgroundColor: 'var(--bg-secondary)',
                      color: 'var(--text-tertiary)',
                    }}
                  >
                    +{table.columns.length - 4}
                  </span>
                )}
              </div>
            </div>

            {/* Last Updated */}
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>
              Updated {table.lastUpdated}
            </p>

            {/* Open Table Button - appears on hover */}
            {hoveredTableId === table.id && (
              <button
                style={{
                  marginTop: 'var(--spacing-sm)',
                  padding: '10px 16px',
                  width: '100%',
                  borderRadius: '6px',
                  border: '1px solid var(--border-subtle)',
                  backgroundColor: 'transparent',
                  color: 'var(--accent-cowork)',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  const target = e.currentTarget;
                  target.style.backgroundColor = 'rgba(175, 82, 222, 0.1)';
                  target.style.borderColor = 'var(--accent-cowork)';
                }}
                onMouseLeave={(e) => {
                  const target = e.currentTarget;
                  target.style.backgroundColor = 'transparent';
                  target.style.borderColor = 'var(--border-subtle)';
                }}
              >
                Open Table
              </button>
            )}
          </GlassSurface>
        ))}
      </div>
    </div>
  );
};

export default TablesView;
