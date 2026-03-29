'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { filesApi } from '@/lib/agents/files-api';
import {
  FolderOpen,
  CaretRight,
  CaretDown,
  FileText,
  Code,
  FileCode,
  Palette,
  BookOpen,
  UploadSimple,
} from '@phosphor-icons/react';
import GlassSurface from '@/design/GlassSurface';
import { useDropTarget, type FileWithData } from '@/components/GlobalDropzone';

interface FileNode {
  name: string;
  type: 'file' | 'folder';
  children?: FileNode[];
  language?: 'tsx' | 'ts' | 'json' | 'css' | 'md';
  path: string;
}

interface DroppedFile {
  id: string;
  name: string;
  type: 'code' | 'document' | 'image' | 'other';
  dataUrl: string;
  size: number;
  extractedText?: string;
}


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
        return <Code size={16} color="#3b82f6" />;
      case 'ts':
        return <Code size={16} color="#3b82f6" />;
      case 'json':
        return <FileCode size={16} color="#f59e0b" />;
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
          {isExpanded ? <CaretDown size={18} /> : <CaretRight size={18} />}
          <FolderOpen size={16} color="var(--text-secondary)" />
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
  const [fileTree, setFileTree] = useState<FileNode[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [filterText, setFilterText] = useState('');
  const [droppedFiles, setDroppedFiles] = useState<DroppedFile[]>([]);

  useEffect(() => {
    filesApi.listDirectory({ path: '.' })
      .then((entries) => {
        const toNode = (entry: (typeof entries)[number]): FileNode => ({
          name: entry.name,
          path: entry.path,
          type: entry.type === 'directory' ? 'folder' : 'file',
          language: entry.name.match(/\.tsx$/) ? 'tsx'
            : entry.name.match(/\.ts$/) ? 'ts'
            : entry.name.match(/\.json$/) ? 'json'
            : entry.name.match(/\.css$/) ? 'css'
            : entry.name.match(/\.md$/) ? 'md'
            : undefined,
        });
        setFileTree(entries.map(toNode));
      })
      .catch(() => {});
  }, []);

  const handleDroppedFiles = useCallback(async (files: FileWithData[]) => {
    const newFiles: DroppedFile[] = files.map(({ file, dataUrl, extractedText }) => {
      // Determine file type
      let fileType: DroppedFile['type'] = 'other';
      if (file.name.match(/\.(tsx?|jsx?|json|css|html|md|py|rs|go)$/)) {
        fileType = 'code';
      } else if (file.type.includes('pdf') || file.name.endsWith('.docx')) {
        fileType = 'document';
      }
      
      return {
        id: `code-drop-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: file.name,
        type: fileType,
        dataUrl,
        size: file.size,
        extractedText,
      };
    });
    
    setDroppedFiles(prev => [...prev, ...newFiles]);
  }, []);

  // Register as drop target for code
  useDropTarget('code', handleDroppedFiles);

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

  const getDroppedFileIcon = (file: DroppedFile) => {
    if (file.type === 'code') {
      return <FileCode size={16} color="#3b82f6" />;
    }
    if (file.type === 'document') {
      return <FileText size={16} color="#ef4444" />;
    }
    return <UploadSimple size={16} color="var(--text-secondary)" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <GlassSurface>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: 'var(--bg-secondary)' }}>
        {/* Header */}
        <div style={{ padding: '16px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <FolderOpen size={20} color="var(--accent-primary)" />
            <div>
              <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)' }}>Explorer</div>
              <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>Project file structure — drag & drop to upload</div>
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

        {/* Dropped Files Section */}
        {droppedFiles.length > 0 && (
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', background: 'rgba(52,199,89,0.05)' }}>
            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: '8px', textTransform: 'uppercase' }}>
              Uploaded Files
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {droppedFiles.slice(-5).map((file) => (
                <div
                  key={file.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 8px',
                    borderRadius: '4px',
                    background: 'rgba(255,255,255,0.05)',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.1)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)';
                  }}
                >
                  {getDroppedFileIcon(file)}
                  <span style={{ fontSize: '12px', color: 'var(--text-primary)', flex: 1 }}>{file.name}</span>
                  <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>{formatFileSize(file.size)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* File Tree */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
          {fileTree.map((node) => (
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
