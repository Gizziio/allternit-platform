'use client';

import React, { useState } from 'react';
import { FolderTree, ChevronRight, ChevronDown, FileText, Code2, FileJson, Palette, BookOpen } from 'lucide-react';
import GlassSurface from '@/design/GlassSurface';

interface FileNode {
  name: string;
  type: 'file' | 'folder';
  children?: FileNode[];
  language?: 'tsx' | 'ts' | 'json' | 'css' | 'md';
  path: string;
}

const mockFileTree: FileNode[] = [
  {
    name: 'src',
    type: 'folder',
    path: 'src',
    children: [
      {
        name: 'views',
        type: 'folder',
        path: 'src/views',
        children: [
          {
            name: 'ChatView.tsx',
            type: 'file',
            language: 'tsx',
            path: 'src/views/ChatView.tsx',
          },
          {
            name: 'EvolutionLayerView.tsx',
            type: 'file',
            language: 'tsx',
            path: 'src/views/EvolutionLayerView.tsx',
          },
        ],
      },
      {
        name: 'shell',
        type: 'folder',
        path: 'src/shell',
        children: [
          {
            name: 'ShellApp.tsx',
            type: 'file',
            language: 'tsx',
            path: 'src/shell/ShellApp.tsx',
          },
          {
            name: 'ShellRail.tsx',
            type: 'file',
            language: 'tsx',
            path: 'src/shell/ShellRail.tsx',
          },
        ],
      },
      {
        name: 'design',
        type: 'folder',
        path: 'src/design',
        children: [
          {
            name: 'tokens',
            type: 'folder',
            path: 'src/design/tokens',
            children: [
              {
                name: 'colors.ts',
                type: 'file',
                language: 'ts',
                path: 'src/design/tokens/colors.ts',
              },
            ],
          },
          {
            name: 'glass',
            type: 'folder',
            path: 'src/design/glass',
            children: [],
          },
        ],
      },
    ],
  },
  {
    name: 'package.json',
    type: 'file',
    language: 'json',
    path: 'package.json',
  },
  {
    name: 'tsconfig.json',
    type: 'file',
    language: 'json',
    path: 'tsconfig.json',
  },
  {
    name: 'vite.config.ts',
    type: 'file',
    language: 'ts',
    path: 'vite.config.ts',
  },
];

interface FileTreeItemProps {
  node: FileNode;
  expandedFolders: Set<string>;
  onToggleExpand: (path: string) => void;
  selectedFile: string | null;
  onSelectFile: (path: string) => void;
  level: number;
}

const FileTreeItem: React.FC<FileTreeItemProps> = ({
  node,
  expandedFolders,
  onToggleExpand,
  selectedFile,
  onSelectFile,
  level,
}) => {
  const getLanguageIcon = (language?: string) => {
    switch (language) {
      case 'tsx':
        return <Code2 size={16} color="#3b82f6" />;
      case 'ts':
        return <Code2 size={16} color="#3b82f6" />;
      case 'json':
        return <FileJson size={16} color="#f59e0b" />;
      case 'css':
        return <Palette size={16} color="#a855f7" />;
      case 'md':
        return <BookOpen size={16} color="#6b7280" />;
      default:
        return <FileText size={16} color="var(--text-secondary)" />;
    }
  };

  const isExpanded = expandedFolders.has(node.path);
  const isSelected = node.type === 'file' && selectedFile === node.path;

  if (node.type === 'folder') {
    return (
      <div>
        <div
          onClick={() => onToggleExpand(node.path)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 12px',
            paddingLeft: `${12 + level * 16}px`,
            cursor: 'pointer',
            userSelect: 'none',
            color: 'var(--text-primary)',
            fontSize: '14px',
            fontWeight: '500',
            transition: 'background-color 0.15s ease',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
          }}
        >
          {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
          <FolderTree size={16} color="var(--text-secondary)" />
          <span>{node.name}</span>
          {node.children && (
            <span style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--text-tertiary)' }}>
              {node.children.length} items
            </span>
          )}
        </div>
        {isExpanded && node.children && (
          <div>
            {node.children.map((child) => (
              <FileTreeItem
                key={child.path}
                node={child}
                expandedFolders={expandedFolders}
                onToggleExpand={onToggleExpand}
                selectedFile={selectedFile}
                onSelectFile={onSelectFile}
                level={level + 1}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      onClick={() => onSelectFile(node.path)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 12px',
        paddingLeft: `${12 + level * 16}px`,
        cursor: 'pointer',
        userSelect: 'none',
        backgroundColor: isSelected ? 'rgba(52, 199, 89, 0.1)' : 'transparent',
        borderLeft: isSelected ? '2px solid var(--accent-primary)' : '2px solid transparent',
        color: isSelected ? 'var(--accent-primary)' : 'var(--text-primary)',
        fontSize: '14px',
        fontWeight: isSelected ? '600' : '400',
        transition: 'all 0.15s ease',
      }}
      onMouseEnter={(e) => {
        if (!isSelected) {
          (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
        }
      }}
    >
      {getLanguageIcon(node.language)}
      <span style={{ fontFamily: node.language ? "'JetBrains Mono', ui-monospace, monospace" : 'inherit' }}>
        {node.name}
      </span>
    </div>
  );
};

export const ExplorerView: React.FC = () => {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['src', 'src/views', 'src/shell']));
  const [selectedFile, setSelectedFile] = useState<string | null>('src/views/ChatView.tsx');
  const [filterText, setFilterText] = useState('');

  const handleToggleExpand = (path: string) => {
    setExpandedFolders((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  };

  const handleSelectFile = (path: string) => {
    setSelectedFile(path);
  };

  return (
    <GlassSurface>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: 'var(--bg-secondary)' }}>
        {/* Header */}
        <div style={{ padding: '16px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <FolderTree size={20} color="var(--accent-primary)" />
            <div>
              <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)' }}>Explorer</div>
              <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Project file structure</div>
            </div>
          </div>

          {/* Search Input */}
          <input
            type="text"
            placeholder="Search files..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              fontSize: '13px',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '6px',
              color: 'var(--text-primary)',
              outline: 'none',
              transition: 'all 0.2s ease',
            }}
            onFocus={(e) => {
              (e.target as HTMLElement).style.backgroundColor = 'rgba(255, 255, 255, 0.12)';
              (e.target as HTMLElement).style.borderColor = 'var(--accent-primary)';
            }}
            onBlur={(e) => {
              (e.target as HTMLElement).style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
              (e.target as HTMLElement).style.borderColor = 'var(--border-subtle)';
            }}
          />
        </div>

        {/* File Tree */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
          {mockFileTree.map((node) => (
            <FileTreeItem
              key={node.path}
              node={node}
              expandedFolders={expandedFolders}
              onToggleExpand={handleToggleExpand}
              selectedFile={selectedFile}
              onSelectFile={handleSelectFile}
              level={0}
            />
          ))}
        </div>
      </div>
    </GlassSurface>
  );
};

export default ExplorerView;
