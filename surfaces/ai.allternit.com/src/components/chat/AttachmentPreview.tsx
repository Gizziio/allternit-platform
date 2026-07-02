'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
import { cn } from '@/lib/utils';

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
    <div className="p-3 px-4 border-t border-solid border-[var(--ui-border-muted)]">
      <div className="flex gap-3 overflow-x-auto pb-2" style={{ maxHeight }}>
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
      className={cn(
        "relative w-[140px] shrink-0 bg-[var(--surface-hover)] border border-solid rounded-xl overflow-hidden transition-all duration-200",
        isHovered ? "border-[var(--accent-primary)] shadow-sm" : "border-[var(--ui-border-muted)]"
      )}
      style={isHovered ? { borderColor: color } : undefined}
    >
      {/* Preview Area */}
      <div
        className="h-[100px] flex items-center justify-center relative overflow-hidden"
        style={{
          background: isImage && !imageError 
            ? 'transparent' 
            : `linear-gradient(135deg, ${color}10, ${color}05)`,
        }}
      >
        {isImage && !imageError ? (
          <img
            src={item.dataUrl}
            alt={item.name}
            onError={() => setImageError(true)}
            className="size-full object-cover"
          />
        ) : (
          <div className="text-center">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-2"
              style={{ background: `${color}20` }}
            >
              <Icon size={24} style={{ color }} />
            </div>
            <span
              className="text-[12px] font-bold uppercase tracking-wider"
              style={{ color: `${color}CC` }}
            >
              {ext}
            </span>
          </div>
        )}

        {/* Hover Overlay with actions */}
        <AnimatePresence>
          {isHovered && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/65 flex items-center justify-center gap-2 z-[1]"
            >
              {canPreview && onPreview && (
                <button type="button"
                  onClick={() => onPreview(item)}
                  aria-label={`Preview ${item.name}`}
                  className="w-8 h-8 rounded-lg border-none bg-[var(--ui-border-strong)] text-[var(--ui-text-inverse)] cursor-pointer flex items-center justify-center hover:scale-105 transition-transform"
                >
                  <Maximize2 size={16} aria-hidden="true" />
                </button>
              )}

              <a
                href={item.dataUrl}
                download={item.name}
                aria-label={`Download ${item.name}`}
                className="w-8 h-8 rounded-lg border-none bg-[var(--ui-border-strong)] text-[var(--ui-text-inverse)] cursor-pointer flex items-center justify-center no-underline hover:scale-105 transition-transform"
              >
                <Download size={16} aria-hidden="true" />
              </a>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Remove button */}
        {onRemove && (
          <button type="button"
            onClick={() => onRemove(item.id)}
            className={cn(
              "absolute top-1.5 right-1.5 w-5.5 h-5.5 rounded-md border-none text-[var(--ui-text-inverse)] cursor-pointer flex items-center justify-center transition-all duration-150 z-[2]",
              isHovered ? "bg-[var(--shell-overlay-backdrop)] opacity-100" : "bg-[var(--surface-panel)] opacity-0"
            )}
          >
            <X size={12} />
          </button>
        )}

        {/* File type badge */}
        <div
          className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/40 text-[var(--ui-text-inverse)] text-[11px] font-bold uppercase tracking-wide backdrop-blur-sm"
          style={{ backgroundColor: color }}
        >
          {item.type === 'screenshot' ? 'SCREEN' : ext}
        </div>
      </div>

      {/* Info Area */}
      <div className="p-2.5">
        <p className="m-0 text-[12px] font-semibold text-zinc-100/90 whitespace-nowrap overflow-hidden text-ellipsis mb-1" title={item.name}>
          {item.name}
        </p>
        {size && (
          <p className="m-0 text-[11px] text-zinc-100/40 font-medium">
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
    <div className="flex items-center gap-2 p-1.5 px-2.5 bg-[var(--surface-hover)] border border-solid border-[var(--ui-border-muted)] rounded-xl min-w-0">
      {isImage && !imageError ? (
        <img
          src={item.dataUrl}
          alt={item.name}
          onError={() => setImageError(true)}
          className="w-8 h-8 rounded-lg object-cover shrink-0"
        />
      ) : (
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: `${color}15` }}
        >
          <Icon size={16} style={{ color }} />
        </div>
      )}

      <span className="text-[12px] text-zinc-100/80 font-medium whitespace-nowrap overflow-hidden text-ellipsis max-w-[120px]">
        {item.name}
      </span>

      {size && (
        <span className="text-[11px] text-zinc-100/40 font-medium shrink-0">
          {size}
        </span>
      )}

      {onRemove && (
        <button type="button"
          onClick={() => onRemove(item.id)}
          aria-label={`Remove ${item.name}`}
          className="p-0.5 border-none bg-transparent text-zinc-100/40 cursor-pointer flex shrink-0 rounded-md hover:bg-white/5 hover:text-zinc-100/60 transition-all"
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
      role="button" tabIndex={0}
      className="fixed inset-0 bg-black/90 z-[165] flex items-center justify-center p-10 outline-none"
      onClick={onClose}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="attachment-preview-title"
        className="w-full max-w-[90vw] max-h-[90vh] bg-[var(--surface-panel)] rounded-2xl overflow-hidden flex flex-col shadow-2xl"
        style={{ boxShadow: `0 25px 50px -12px ${color}40` }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 px-5 border-b border-solid border-[var(--ui-border-muted)] shrink-0">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: `${color}20` }}
            >
              <Icon size={18} style={{ color }} aria-hidden="true" />
            </div>
            <div>
              <p id="attachment-preview-title" className="m-0 text-[14px] font-bold text-[var(--ui-text-inverse)]">
                {item.name}
              </p>
              {item.size && (
                <p className="m-0 text-[12px] text-white/40 font-medium">
                  {formatFileSize(item.size)}
                </p>
              )}
            </div>
          </div>
          
          <div className="flex gap-2">
            <a
              href={item.dataUrl}
              download={item.name}
              className="p-2 px-4 rounded-lg bg-[var(--ui-border-default)] text-[var(--ui-text-inverse)] text-[13px] font-bold no-underline flex items-center gap-1.5 transition-opacity hover:opacity-90"
            >
              <Download size={16} aria-hidden="true" />
              Download
            </a>
            <button type="button"
              onClick={onClose}
              aria-label="Close preview"
              className="p-2 rounded-lg border-none bg-transparent text-white/50 cursor-pointer hover:bg-white/5 hover:text-white transition-all"
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6 flex flex-col items-center">
          {isImage ? (
            <img
              src={item.dataUrl}
              alt={item.name}
              className="max-w-full max-h-full rounded-lg object-contain shadow-lg"
            />
          ) : isCode && item.extractedText ? (
            <pre className="m-0 p-5 bg-[var(--surface-canvas)] rounded-xl text-[13px] leading-relaxed text-[var(--ui-text-primary)] font-mono w-full overflow-auto border border-solid border-white/5 shadow-inner">
              <code>{item.extractedText.slice(0, 5000)}{item.extractedText.length > 5000 ? '\n\n… (truncated)' : ''}</code>
            </pre>
          ) : item.extractedText ? (
            <div className="p-6 bg-[var(--surface-canvas)] rounded-xl max-w-2xl w-full text-[var(--ui-text-primary)] text-[14px] leading-relaxed whitespace-pre-wrap border border-solid border-white/5 shadow-inner font-sans">
              {item.extractedText.slice(0, 3000)}{item.extractedText.length > 3000 ? '\n\n... (truncated)' : ''}
            </div>
          ) : (
            <div className="text-center py-20">
              <div
                className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-5"
                style={{ background: `${color}20` }}
              >
                <Icon size={40} style={{ color }} aria-hidden="true" />
              </div>
              <p className="text-white/60 font-medium m-0">
                Preview not available for this file type
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
