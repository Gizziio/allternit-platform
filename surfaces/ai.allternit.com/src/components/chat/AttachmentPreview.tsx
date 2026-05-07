'use client';

import React, { useState, useEffect } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  X,
  FileText,
  ImageIcon,
  FileCode,
  Table,
  File,
  Film,
  Music,
  Download,
  Maximize2,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface AttachmentPreviewItem {
  id: string;
  name: string;
  dataUrl: string;
  type: 'image' | 'document' | 'code' | 'spreadsheet' | 'json' | 'video' | 'audio' | 'gif' | 'screenshot' | 'other';
  size?: number;
  extractedText?: string;
}

interface AttachmentPreviewProps {
  attachments: AttachmentPreviewItem[];
  onRemove?: (id: string) => void;
  onPreview?: (item: AttachmentPreviewItem) => void;
  variant?: 'compact' | 'detailed' | 'grid';
  maxHeight?: number;
}

// ============================================================================
// File Type Helpers
// ============================================================================

function getFileCategory(filename: string, type: string): AttachmentPreviewItem['type'] {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  
  if (type === 'gif' || ext === 'gif') return 'gif';
  if (type === 'screenshot') return 'screenshot';
  if (type.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'svg'].includes(ext)) return 'image';
  if (type.startsWith('video/') || ['mp4', 'mov', 'avi', 'webm'].includes(ext)) return 'video';
  if (type.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) return 'audio';
  if (ext === 'json' || type.includes('json')) return 'json';
  if (['csv', 'xlsx', 'xls'].includes(ext)) return 'spreadsheet';
  if (['pdf', 'docx', 'doc', 'txt', 'md'].includes(ext)) return 'document';
  if (['ts', 'tsx', 'js', 'jsx', 'py', 'rs', 'go', 'java', 'cpp', 'c', 'h', 'css', 'html'].includes(ext)) return 'code';
  
  return 'other';
}

function getFileIcon(type: AttachmentPreviewItem['type']): LucideIcon {
  switch (type) {
    case 'image':
    case 'gif':
    case 'screenshot':
      return ImageIcon;
    case 'document':
      return FileText;
    case 'code':
      return FileCode;
    case 'spreadsheet':
      return Table;
    case 'json':
      return FileText;
    case 'video':
      return Film;
    case 'audio':
      return Music;
    default:
      return File;
  }
}

function getFileColor(type: AttachmentPreviewItem['type']): string {
  switch (type) {
    case 'image':
    case 'gif':
    case 'screenshot':
      return 'var(--accent-primary)';
    case 'document':
      return 'var(--status-error)';
    case 'code':
      return 'var(--status-info)';
    case 'spreadsheet':
      return 'var(--status-success)';
    case 'json':
      return 'var(--status-warning)';
    case 'video':
      return '#a855f7';
    case 'audio':
      return '#ec4899';
    default:
      return 'var(--ui-text-secondary)';
  }
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileExtension(name: string): string {
  return name.split('.').pop()?.toUpperCase() || 'FILE';
}

export { getFileCategory, getFileIcon, getFileColor, formatFileSize, getFileExtension };

// ============================================================================
// Components
// ============================================================================

export function AttachmentPreview({ 
  attachments, 
  onRemove, 
  onPreview,
  variant = 'detailed',
  maxHeight = 300 
}: AttachmentPreviewProps) {
  if (attachments.length === 0) return null;

  return (
    <div style={{
      padding: '12px 16px',
      borderTop: '1px solid var(--ui-border-muted)',
    }}>
      <div style={{
        display: 'flex',
        gap: 12,
        overflowX: 'auto',
        paddingBottom: 8,
        maxHeight,
      }}>
        {attachments.map((att) => (
          <AttachmentCard 
            key={att.id} 
            item={att} 
            onRemove={onRemove}
            onPreview={onPreview}
            variant={variant}
          />
        ))}
      </div>
    </div>
  );
}

interface AttachmentCardProps {
  item: AttachmentPreviewItem;
  onRemove?: (id: string) => void;
  onPreview?: (item: AttachmentPreviewItem) => void;
  variant: 'compact' | 'detailed' | 'grid';
}

function AttachmentCard({ item, onRemove, onPreview, variant }: AttachmentCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [imageError, setImageError] = useState(false);
  
  const isImage = item.type === 'image' || item.type === 'gif' || item.type === 'screenshot';
  const canPreview = isImage || item.type === 'video' || item.dataUrl.startsWith('data:image');
  const color = getFileColor(item.type);
  const Icon = getFileIcon(item.type);
  const size = formatFileSize(item.size);
  const ext = getFileExtension(item.name);

  if (variant === 'compact') {
    return (
      <CompactCard 
        item={item} 
        isImage={isImage}
        color={color}
        Icon={Icon}
        size={size}
        onRemove={onRemove}
        imageError={imageError}
        setImageError={setImageError}
      />
    );
  }

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position: 'relative',
        width: 140,
        flexShrink: 0,
        background: 'var(--surface-hover)',
        border: `1px solid ${isHovered ? color : 'var(--ui-border-muted)'}`,
        borderRadius: 12,
        overflow: 'hidden',
        transition: 'border-color 0.2s',
      }}
    >
      {/* Preview Area */}
      <div
        style={{
          height: 100,
          background: isImage && !imageError 
            ? 'transparent' 
            : `linear-gradient(135deg, ${color}10, ${color}05)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {isImage && !imageError ? (
          <img
            src={item.dataUrl}
            alt={item.name}
            onError={() => setImageError(true)}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        ) : (
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: `${color}20`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 8px',
              }}
            >
              <Icon size={24} color={color} />
            </div>
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: `${color}CC`,
                letterSpacing: '0.05em',
              }}
            >
              {ext}
            </span>
          </div>
        )}

        {/* Hover Overlay with actions */}
        {isHovered && (
          <div
            className="allternit-hover-overlay"
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0,0,0,0.65)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              animation: 'fadeIn 0.15s ease',
            }}
          >
            <style>{`@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } } @media (prefers-reduced-motion: reduce) { .allternit-hover-overlay { animation: none !important; } }`}</style>
            
            {canPreview && onPreview && (
              <button
                onClick={() => onPreview(item)}
                aria-label={`Preview ${item.name}`}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  border: 'none',
                  background: 'var(--ui-border-strong)',
                  color: 'var(--ui-text-inverse)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Maximize2 size={16} aria-hidden="true" />
              </button>
            )}

            <a
              href={item.dataUrl}
              download={item.name}
              aria-label={`Download ${item.name}`}
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                border: 'none',
                background: 'var(--ui-border-strong)',
                color: 'var(--ui-text-inverse)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textDecoration: 'none',
              }}
            >
              <Download size={16} aria-hidden="true" />
            </a>
          </div>
        )}

        {/* Remove button */}
        {onRemove && (
          <button
            onClick={() => onRemove(item.id)}
            style={{
              position: 'absolute',
              top: 6,
              right: 6,
              width: 22,
              height: 22,
              borderRadius: 6,
              border: 'none',
              background: isHovered ? 'var(--shell-overlay-backdrop)' : 'var(--surface-panel)',
              color: 'var(--ui-text-inverse)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: isHovered ? 1 : 0,
              transition: 'opacity 0.15s, background-color 0.15s',
              zIndex: 2,
            }}
          >
            <X size={12} />
          </button>
        )}

        {/* File type badge */}
        <div
          style={{
            position: 'absolute',
            top: 6,
            left: 6,
            padding: '2px 6px',
            borderRadius: 4,
            background: color,
            fontSize: 9,
            fontWeight: 700,
            color: 'var(--ui-text-inverse)',
            textTransform: 'uppercase',
          }}
        >
          {item.type === 'screenshot' ? 'SCREEN' : ext}
        </div>
      </div>

      {/* Info Area */}
      <div style={{ padding: 10 }}>
        <p
          style={{
            margin: 0,
            fontSize: 12,
            fontWeight: 500,
            color: 'rgba(245,240,232,0.9)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            marginBottom: 4,
          }}
          title={item.name}
        >
          {item.name}
        </p>
        {size && (
          <p style={{ margin: 0, fontSize: 10, color: 'rgba(245,240,232,0.4)' }}>
            {size}
          </p>
        )}
      </div>
    </div>
  );
}

// Compact card (horizontal layout)
interface CompactCardProps {
  item: AttachmentPreviewItem;
  isImage: boolean;
  color: string;
  Icon: LucideIcon;
  size: string;
  onRemove?: (id: string) => void;
  imageError: boolean;
  setImageError: (v: boolean) => void;
}

function CompactCard({ item, isImage, color, Icon, size, onRemove, imageError, setImageError }: CompactCardProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 10px',
        background: 'var(--surface-hover)',
        border: '1px solid var(--ui-border-muted)',
        borderRadius: 10,
        minWidth: 0,
      }}
    >
      {isImage && !imageError ? (
        <img
          src={item.dataUrl}
          alt={item.name}
          onError={() => setImageError(true)}
          style={{
            width: 32,
            height: 32,
            borderRadius: 6,
            objectFit: 'cover',
            flexShrink: 0,
          }}
        />
      ) : (
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 6,
            background: `${color}15`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon size={16} color={color} />
        </div>
      )}

      <span
        style={{
          fontSize: 12,
          color: 'rgba(245,240,232,0.8)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          maxWidth: 120,
        }}
      >
        {item.name}
      </span>

      {size && (
        <span style={{ fontSize: 10, color: 'rgba(245,240,232,0.4)', flexShrink: 0 }}>
          {size}
        </span>
      )}

      {onRemove && (
        <button
          onClick={() => onRemove(item.id)}
          aria-label={`Remove ${item.name}`}
          style={{
            padding: 2,
            border: 'none',
            background: 'transparent',
            color: 'rgba(245,240,232,0.4)',
            cursor: 'pointer',
            display: 'flex',
            flexShrink: 0,
            borderRadius: 4,
          }}
        >
          <X size={14} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

// ============================================================================
// Full Screen Preview Modal
// ============================================================================

interface AttachmentPreviewModalProps {
  item: AttachmentPreviewItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export function AttachmentPreviewModal({ item, isOpen, onClose }: AttachmentPreviewModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !item) return null;

  const isImage = item.type === 'image' || item.type === 'gif' || item.type === 'screenshot';
  const isCode = item.type === 'code' || item.type === 'json';
  const color = getFileColor(item.type);
  const Icon = getFileIcon(item.type);

  return (
    <div
      role="presentation"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.9)',
        zIndex: 165,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="attachment-preview-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '90vw',
          maxHeight: '90vh',
          background: 'var(--surface-panel)',
          borderRadius: 16,
          overflow: 'hidden',
          boxShadow: `0 25px 50px -12px ${color}40`,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid var(--ui-border-muted)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: `${color}20`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon size={18} color={color} aria-hidden="true" />
            </div>
            <div>
              <p id="attachment-preview-title" style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--ui-text-inverse)' }}>
                {item.name}
              </p>
              {item.size && (
                <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
                  {formatFileSize(item.size)}
                </p>
              )}
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: 8 }}>
            <a
              href={item.dataUrl}
              download={item.name}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                background: 'var(--ui-border-default)',
                color: 'var(--ui-text-inverse)',
                fontSize: 13,
                fontWeight: 500,
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Download size={16} aria-hidden="true" />
              Download
            </a>
            <button
              onClick={onClose}
              aria-label="Close preview"
              style={{
                padding: 8,
                borderRadius: 8,
                border: 'none',
                background: 'transparent',
                color: 'rgba(255,255,255,0.5)',
                cursor: 'pointer',
              }}
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div
          style={{
            padding: 24,
            maxHeight: 'calc(90vh - 100px)',
            overflow: 'auto',
          }}
        >
          {isImage ? (
            <img
              src={item.dataUrl}
              alt={item.name}
              style={{
                maxWidth: '100%',
                maxHeight: 'calc(90vh - 150px)',
                borderRadius: 8,
              }}
            />
          ) : isCode && item.extractedText ? (
            <pre
              style={{
                margin: 0,
                padding: 20,
                background: 'var(--surface-canvas)',
                borderRadius: 8,
                fontSize: 13,
                lineHeight: 1.6,
                color: 'var(--ui-text-primary)',
                fontFamily: "var(--font-mono)",
                maxHeight: 'calc(90vh - 200px)',
                overflow: 'auto',
              }}
            >
              <code>{item.extractedText.slice(0, 5000)}{item.extractedText.length > 5000 ? '\n\n... (truncated)' : ''}</code>
            </pre>
          ) : item.extractedText ? (
            <div
              style={{
                padding: 20,
                background: 'var(--surface-canvas)',
                borderRadius: 8,
                maxWidth: 600,
                color: 'var(--ui-text-primary)',
                fontSize: 14,
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
              }}
            >
              {item.extractedText.slice(0, 3000)}{item.extractedText.length > 3000 ? '\n\n... (truncated)' : ''}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: 40 }}>
              <div
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 20,
                  background: `${color}20`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 20px',
                }}
              >
                <Icon size={40} color={color} aria-hidden="true" />
              </div>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>
                Preview not available for this file type
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
