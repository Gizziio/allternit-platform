import React, { useState } from 'react';
import { FolderOpen, ChevronRight, List, Grid3x3 } from 'lucide-react';
import GlassSurface from '@/design/GlassSurface';

interface FileNode {
  id: string;
  name: string;
  type: 'folder' | 'file';
  icon?: string;
  size?: string;
  modified?: string;
  color?: string;
}

interface Folder {
  id: string;
  name: string;
  expanded: boolean;
  children: FileNode[];
}

const mockFileTree: Folder[] = [
  {
    id: 'root-docs',
    name: 'Documents',
    expanded: true,
    children: [
      { id: 'doc-1', name: 'Strategy.md', type: 'file', icon: 'MD', size: '245 KB', modified: '2 days ago', color: '#9ca3af' },
      { id: 'doc-2', name: 'Meeting Notes.md', type: 'file', icon: 'MD', size: '128 KB', modified: '5 hours ago', color: '#9ca3af' },
      {
        id: 'folder-1',
        name: 'Archive',
        type: 'folder',
      },
    ],
  },
  {
    id: 'root-data',
    name: 'Data',
    expanded: false,
    children: [
      { id: 'csv-1', name: 'users.csv', type: 'file', icon: 'CSV', size: '1.2 MB', modified: '1 day ago', color: '#22c55e' },
      { id: 'csv-2', name: 'analytics.csv', type: 'file', icon: 'CSV', size: '856 KB', modified: '12 hours ago', color: '#22c55e' },
    ],
  },
  {
    id: 'root-code',
    name: 'Code',
    expanded: false,
    children: [
      { id: 'ts-1', name: 'index.tsx', type: 'file', icon: 'TS', size: '4.2 KB', modified: '3 hours ago', color: '#3b82f6' },
      { id: 'ts-2', name: 'utils.ts', type: 'file', icon: 'TS', size: '2.8 KB', modified: '1 day ago', color: '#3b82f6' },
      { id: 'pdf-1', name: 'spec.pdf', type: 'file', icon: 'PDF', size: '2.1 MB', modified: '1 week ago', color: '#ef4444' },
    ],
  },
];

type ViewMode = 'grid' | 'list';

export const FilesView: React.FC = () => {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['root-docs']));
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [currentPath, setCurrentPath] = useState<string[]>(['workspace']);

  const toggleFolder = (folderId: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
  };

  const getFileIcon = (fileType: string) => {
    return (
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '32px',
          height: '32px',
          borderRadius: '4px',
          backgroundColor: fileType === 'PDF' ? 'rgba(239, 68, 68, 0.1)' : 
                           fileType === 'CSV' ? 'rgba(34, 197, 94, 0.1)' : 
                           fileType === 'TS' ? 'rgba(59, 130, 246, 0.1)' : 
                           'rgba(156, 163, 175, 0.1)',
          color: fileType === 'PDF' ? '#ef4444' : 
                 fileType === 'CSV' ? '#22c55e' : 
                 fileType === 'TS' ? '#3b82f6' : 
                 '#9ca3af',
          fontSize: '10px',
          fontWeight: 600,
        }}
      >
        {fileType}
      </div>
    );
  };

  return (
    <div style={{ padding: 'var(--spacing-lg)' }}>
      {/* Header */}
      <div style={{ marginBottom: 'var(--spacing-lg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-md)' }}>
          <FolderOpen size={24} color="#af52de" />
          <h1 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '24px', fontWeight: 600 }}>Files</h1>
        </div>
        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '14px' }}>Workspace file storage</p>
      </div>

      {/* Breadcrumb Navigation */}
      <div style={{ marginBottom: 'var(--spacing-lg)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: 'var(--text-secondary)' }}>
        {currentPath.map((segment, idx) => (
          <React.Fragment key={idx}>
            {idx > 0 && <span>/</span>}
            <button
              onClick={() => setCurrentPath(currentPath.slice(0, idx + 1))}
              style={{
                background: 'none',
                border: 'none',
                color: '#af52de',
                cursor: 'pointer',
                textDecoration: 'none',
                padding: 0,
                fontSize: '13px',
                fontWeight: 500,
              }}
            >
              {segment}
            </button>
          </React.Fragment>
        ))}
      </div>

      {/* Main Layout - Two Pane */}
      <div style={{ display: 'grid', gridTemplateColumns: '30% 70%', gap: 'var(--spacing-lg)', minHeight: '600px' }}>
        {/* LEFT: Folder Tree */}
        <GlassSurface style={{ padding: 'var(--spacing-md)', overflowY: 'auto' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {mockFileTree.map((folder) => (
              <div key={folder.id}>
                <button
                  onClick={() => toggleFolder(folder.id)}
                  style={{
                    width: '100%',
                    padding: '8px 8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-secondary)',
                    fontSize: '13px',
                    fontWeight: 500,
                    borderRadius: '4px',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
                    e.currentTarget.style.color = 'var(--text-primary)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }}
                >
                  <ChevronRight
                    size={16}
                    style={{
                      transform: expandedFolders.has(folder.id) ? 'rotate(90deg)' : 'rotate(0deg)',
                      transition: 'transform 0.2s ease',
                      flexShrink: 0,
                    }}
                  />
                  {folder.name}
                </button>

                {/* Folder Children */}
                {expandedFolders.has(folder.id) && (
                  <div style={{ marginLeft: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {folder.children.map((child) => (
                      <div
                        key={child.id}
                        style={{
                          padding: '6px 8px',
                          fontSize: '13px',
                          color: 'var(--text-tertiary)',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
                          e.currentTarget.style.color = 'var(--text-secondary)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                          e.currentTarget.style.color = 'var(--text-tertiary)';
                        }}
                      >
                        {child.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </GlassSurface>

        {/* RIGHT: File List/Grid */}
        <div>
          {/* View Mode Toggle */}
          <div style={{ marginBottom: 'var(--spacing-md)', display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setViewMode('list')}
              style={{
                padding: '6px 12px',
                borderRadius: '4px',
                border: 'none',
                backgroundColor: viewMode === 'list' ? '#af52de' : 'var(--bg-secondary)',
                color: viewMode === 'list' ? '#fff' : 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '13px',
                fontWeight: 500,
              }}
            >
              <List size={16} />
              List
            </button>
            <button
              onClick={() => setViewMode('grid')}
              style={{
                padding: '6px 12px',
                borderRadius: '4px',
                border: 'none',
                backgroundColor: viewMode === 'grid' ? '#af52de' : 'var(--bg-secondary)',
                color: viewMode === 'grid' ? '#fff' : 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '13px',
                fontWeight: 500,
              }}
            >
              <Grid3x3 size={16} />
              Grid
            </button>
          </div>

          {/* Files Display */}
          {viewMode === 'list' ? (
            // List View
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {mockFileTree.flatMap((folder) =>
                folder.children.map((file) => (
                  <GlassSurface
                    key={file.id}
                    style={{
                      padding: 'var(--spacing-md)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--spacing-md)',
                      cursor: 'pointer',
                    }}
                  >
                    {getFileIcon(file.icon || 'FILE')}
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, color: 'var(--text-primary)', fontSize: '14px', fontWeight: 500 }}>
                        {file.name}
                      </p>
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--spacing-lg)', fontSize: '13px', color: 'var(--text-secondary)' }}>
                      <span>{file.size}</span>
                      <span>{file.modified}</span>
                    </div>
                  </GlassSurface>
                ))
              )}
            </div>
          ) : (
            // Grid View
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
                gap: 'var(--spacing-md)',
              }}
            >
              {mockFileTree.flatMap((folder) =>
                folder.children.map((file) => (
                  <GlassSurface
                    key={file.id}
                    style={{
                      padding: 'var(--spacing-md)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '8px',
                      cursor: 'pointer',
                      textAlign: 'center',
                    }}
                  >
                    {getFileIcon(file.icon || 'FILE')}
                    <p
                      style={{
                        margin: 0,
                        color: 'var(--text-primary)',
                        fontSize: '12px',
                        fontWeight: 500,
                        wordBreak: 'break-word',
                      }}
                    >
                      {file.name}
                    </p>
                  </GlassSurface>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FilesView;
