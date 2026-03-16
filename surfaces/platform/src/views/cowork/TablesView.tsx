import React, { useState } from 'react';
import { Table2 } from 'lucide-react';
import GlassSurface from '@/design/GlassSurface';

interface DataTable {
  id: string;
  name: string;
  rowCount: number;
  columnCount: number;
  columns: string[];
  lastUpdated: string;
}

const mockTables: DataTable[] = [
  {
    id: '1',
    name: 'User Analytics',
    rowCount: 15247,
    columnCount: 12,
    columns: ['user_id', 'email', 'signup_date', 'last_active'],
    lastUpdated: '2 hours ago',
  },
  {
    id: '2',
    name: 'Agent Runs',
    rowCount: 3482,
    columnCount: 8,
    columns: ['run_id', 'status', 'duration', 'timestamp'],
    lastUpdated: '30 mins ago',
  },
  {
    id: '3',
    name: 'Document Index',
    rowCount: 8934,
    columnCount: 15,
    columns: ['doc_id', 'title', 'content', 'tags', 'created_at'],
    lastUpdated: '1 day ago',
  },
  {
    id: '4',
    name: 'Performance Metrics',
    rowCount: 45123,
    columnCount: 10,
    columns: ['timestamp', 'cpu_usage', 'memory', 'response_time'],
    lastUpdated: '5 mins ago',
  },
];

export const TablesView: React.FC = () => {
  const [hoveredTableId, setHoveredTableId] = useState<string | null>(null);

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
        {mockTables.map((table) => (
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
                      fontFamily: 'Monaco, monospace',
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
                  color: '#af52de',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  const target = e.currentTarget;
                  target.style.backgroundColor = 'rgba(175, 82, 222, 0.1)';
                  target.style.borderColor = '#af52de';
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
