import React, { useCallback, useState, useEffect } from 'react';
import {
  FolderOpen,
  CaretRight,
  List,
  SquaresFour,
} from '@phosphor-icons/react';
import GlassSurface from '@/design/GlassSurface';
import { useDropTarget, type FileWithData } from '@/components/GlobalDropzone';
import { AttachmentPreview, AttachmentPreviewModal, type AttachmentPreviewItem } from '@/components/chat/AttachmentPreview';

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


type ViewMode = 'grid' | 'list';

export const FilesView: React.FC = () => {
  const [fileTree, setFileTree] = useState<Folder[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [currentPath, setCurrentPath] = useState<string[]>(['workspace']);
  const [droppedFiles, setDroppedFiles] = useState<AttachmentPreviewItem[]>([]);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewItem, setPreviewItem] = useState<AttachmentPreviewItem | null>(null);

  const toggleFolder = (folderId: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
  };

  const handleDroppedFiles = useCallback(async (files: FileWithData[]) => {
    const extToType = (filename: string): AttachmentPreviewItem['type'] => {
      const ext = filename.split('.').pop()?.toLowerCase() || '';
      if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return 'image';
      if (['pdf'].includes(ext)) return 'document';
      if (['docx', 'doc', 'txt', 'md'].includes(ext)) return 'document';
      if (['ts', 'tsx', 'js', 'jsx', 'py', 'rs', 'go'].includes(ext)) return 'code';
      if (['json'].includes(ext)) return 'json';
      if (['csv', 'xlsx', 'xls'].includes(ext)) return 'spreadsheet';
      return 'other';
    };
    
    const newFiles: AttachmentPreviewItem[] = files.map(({ file, dataUrl, extractedText }) => ({
      id: `drop-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: file.name,
      type: extToType(file.name),
      dataUrl,
      size: file.size,
      extractedText,
    }));
    setDroppedFiles(prev => [...prev, ...newFiles]);
  }, []);
  
  const handlePreview = useCallback((item: AttachmentPreviewItem) => {
    setPreviewItem(item);
    setPreviewModalOpen(true);
  }, []);

  useEffect(() => {
    fetch('/api/v1/workspace/files')
      .then(r => r.json())
      .then((data: Folder[]) => setFileTree(data))
      .catch(() => {});
  }, []);

  // Register as drop target for cowork files
  useDropTarget('cowork', handleDroppedFiles);

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
          color: fileType === 'PDF' ? 'var(--status-error)' : 
                 fileType === 'CSV' ? 'var(--status-success)' : 
                 fileType === 'TS' ? 'var(--status-info)' : 
                 'var(--ui-text-muted)',
          fontSize: '10px',
          fontWeight: 600,
        }}
      >
        {fileType}
      </div>
    );
  };


  return (
    <div style={{ padding: 'var(--spacing-lg)', position: 'relative' }}>
      {/* Header */}
      <div style={{ marginBottom: 'var(--spacing-lg)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-md)' }}>
          <FolderOpen size={24} color="#af52de" />
          <h1 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '24px', fontWeight: 600 }}>Files</h1>
        </div>
        <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '14px' }}>Workspace file storage — drag and drop files to upload</p>
      </div>

      {/* Breadcrumb Navigation */}
      <div style={{ marginBottom: 'var(--spacing-lg)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: 'var(--text-secondary)' }}>
        {currentPath.map((segment, idx) => (
          <React.Fragment key={`${segment}-${idx}`}>
            {idx > 0 && <span>/</span>}
            <button
              onClick={() => setCurrentPath(currentPath.slice(0, idx + 1))}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--accent-cowork)',
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
            {fileTree.map((folder) => (
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
                  <CaretRight
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
                backgroundColor: viewMode === 'list' ? 'var(--accent-cowork)' : 'var(--bg-secondary)',
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
                backgroundColor: viewMode === 'grid' ? 'var(--accent-cowork)' : 'var(--bg-secondary)',
                color: viewMode === 'grid' ? '#fff' : 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '13px',
                fontWeight: 500,
              }}
            >
              <SquaresFour size={16} />
              Grid
            </button>
          </div>

          {/* Dropped Files Section */}
          {droppedFiles.length > 0 && (
            <div style={{ marginBottom: 'var(--spacing-lg)' }}>
              <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '12px' }}>
                Recently Uploaded ({droppedFiles.length})
              </h3>
              <AttachmentPreview
                attachments={droppedFiles}
                onRemove={(id) => setDroppedFiles(prev => prev.filter(f => f.id !== id))}
                onPreview={handlePreview}
                variant="detailed"
                maxHeight={200}
              />
              
              {/* Preview Modal */}
              <AttachmentPreviewModal
                item={previewItem}
                isOpen={previewModalOpen}
                onClose={() => setPreviewModalOpen(false)}
              />
            </div>
          )}

          {/* Files Display */}
          {viewMode === 'list' ? (
            // List View
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {fileTree.flatMap((folder) =>
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
              {fileTree.flatMap((folder) =>
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
