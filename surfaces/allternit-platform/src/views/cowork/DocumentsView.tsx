import React, { useState, useEffect } from 'react';
import {
  FileText,
  MagnifyingGlass,
  DotsThreeVertical,
} from '@phosphor-icons/react';
import GlassSurface from '@/design/GlassSurface';

interface Document {
  id: string;
  title: string;
  type: 'doc' | 'table' | 'code';
  size: string;
  pages: number;
  path: string;
  modified: string;
}

type DocType = 'All' | 'Doc' | 'Table' | 'Code';
type SortOption = 'Recent' | 'Name' | 'Size';

const getDocIcon = (type: Document['type']) => {
  switch (type) {
    case 'doc':
      return <FileText size={18} color="#3b82f6" />;
    case 'table':
      return <FileText size={18} color="#8b5cf6" />;
    case 'code':
      return <FileText size={18} color="#06b6d4" />;
    default:
      return <FileText size={18} />;
  }
};

export const DocumentsView: React.FC = () => {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<DocType>('All');
  const [sortBy, setSortBy] = useState<SortOption>('Recent');
  const [hoveredDocId, setHoveredDocId] = useState<string | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);

  useEffect(() => {
    fetch('/api/v1/workspace/documents').then(r => r.json()).then(setDocuments).catch(() => {});
  }, []);

  const filteredDocs = documents
    .filter((doc) => {
      const matchesSearch = doc.title.toLowerCase().includes(search.toLowerCase());
      const matchesType = typeFilter === 'All' || doc.type === typeFilter.toLowerCase();
      return matchesSearch && matchesType;
    })
    .sort((a, b) => {
      if (sortBy === 'Name') return a.title.localeCompare(b.title);
      if (sortBy === 'Size') {
        const sizeA = parseFloat(a.size);
        const sizeB = parseFloat(b.size);
        return sizeB - sizeA;
      }
      return 0; // 'Recent' is default order
    });

  return (
    <div style={{ padding: 'var(--spacing-lg)' }}>
      {/* Header */}
      <div style={{ marginBottom: 'var(--spacing-xl)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-md)' }}>
          <FileText size={24} color="#af52de" />
          <h1 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '24px', fontWeight: 600 }}>Documents</h1>
        </div>
        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '14px' }}>All workspace documents</p>
      </div>

      {/* Controls Bar */}
      <div style={{ display: 'flex', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-lg)', alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Search Input */}
        <div style={{ flex: 1, minWidth: '250px', position: 'relative' }}>
          <MagnifyingGlass size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
          <input
            type="text"
            placeholder="Search documents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px 10px 40px',
              borderRadius: '8px',
              border: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              fontSize: '14px',
              outline: 'none',
            }}
          />
        </div>

        {/* Type Filter Chips */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {(['All', 'Doc', 'Table', 'Code'] as DocType[]).map((type) => (
            <button
              key={type}
              onClick={() => setTypeFilter(type)}
              style={{
                padding: '8px 12px',
                borderRadius: '6px',
                border: 'none',
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                backgroundColor: typeFilter === type ? 'var(--accent-cowork)' : 'var(--bg-secondary)',
                color: typeFilter === type ? '#fff' : 'var(--text-secondary)',
                transition: 'all 0.2s ease',
              }}
            >
              {type}
            </button>
          ))}
        </div>

        {/* Sort Dropdown */}
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as SortOption)}
          style={{
            padding: '8px 12px',
            borderRadius: '6px',
            border: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-secondary)',
            color: 'var(--text-secondary)',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
            outline: 'none',
          }}
        >
          <option value="Recent">Recent</option>
          <option value="Name">Name</option>
          <option value="Size">Size</option>
        </select>
      </div>

      {/* Documents List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
        {filteredDocs.map((doc) => (
          <GlassSurface
            key={doc.id}
            style={{
              padding: 'var(--spacing-md)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={() => setHoveredDocId(doc.id)}
            onMouseLeave={() => setHoveredDocId(null)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
              {/* Icon */}
              <div style={{ flexShrink: 0 }}>{getDocIcon(doc.type)}</div>

              {/* Title and Path */}
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: '0 0 4px 0', color: 'var(--text-primary)', fontSize: '14px', fontWeight: 500 }}>
                  {doc.title}
                </h3>
                <p style={{ margin: 0, color: 'var(--text-tertiary)', fontSize: '12px' }}>
                  {doc.path}
                </p>
              </div>

              {/* Size and Pages */}
              <div style={{ display: 'flex', gap: 'var(--spacing-lg)', alignItems: 'center', color: 'var(--text-secondary)', fontSize: '13px', minWidth: '200px' }}>
                <span>{doc.size}</span>
                <span>{doc.pages} page{doc.pages !== 1 ? 's' : ''}</span>
              </div>

              {/* Modified Time */}
              <div style={{ color: 'var(--text-secondary)', fontSize: '13px', minWidth: '120px', textAlign: 'right' }}>
                {doc.modified}
              </div>

              {/* Actions */}
              {hoveredDocId === doc.id && (
                <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                  <button
                    style={{
                      padding: '6px 12px',
                      borderRadius: '4px',
                      border: 'none',
                      backgroundColor: 'var(--accent-cowork)',
                      color: '#fff',
                      fontSize: '12px',
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    Open
                  </button>
                  <button
                    style={{
                      padding: '6px 8px',
                      borderRadius: '4px',
                      border: 'none',
                      backgroundColor: 'var(--bg-secondary)',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <DotsThreeVertical size={16} />
                  </button>
                </div>
              )}
            </div>
          </GlassSurface>
        ))}

        {filteredDocs.length === 0 && (
          <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)', color: 'var(--text-secondary)' }}>
            <p style={{ fontSize: '14px' }}>No documents found</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentsView;
