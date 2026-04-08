"use client";

import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { X, FileText, ImageIcon, File, Loader2, AlertTriangle, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAttachmentUpload, AttachmentUpload } from '@/hooks/useAttachmentUpload';
import { formatFileSize, getFileIcon } from '@/lib/attachments/extract-text';

interface AttachmentDropzoneProps {
  onAttachmentsChange?: (attachments: AttachmentUpload[]) => void;
  className?: string;
  maxFiles?: number;
  maxSize?: number; // in bytes
}

const THEME = {
  bg: '#2B2520',
  inputBg: '#352F29',
  inputBorder: 'rgba(255,255,255,0.08)',
  textPrimary: '#ECECEC',
  textSecondary: '#9B9B9B',
  textMuted: '#6B6B6B',
  accent: '#D4956A',
  hoverBg: 'rgba(255,255,255,0.05)',
  error: '#ef4444',
  success: '#22c55e',
};

export function AttachmentDropzone({
  onAttachmentsChange,
  className,
  maxFiles = 10,
  maxSize = 50 * 1024 * 1024, // 50MB default
}: AttachmentDropzoneProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  
  const { attachments, addFiles, removeAttachment, retryUpload } = useAttachmentUpload({
    onUploadComplete: (att) => {
      // Notify parent of changes
      onAttachmentsChange?.(
        attachments.map((a) => (a.id === att.id ? att : a))
      );
    },
    extractText: true,
  });

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      setIsDragActive(false);
      const dataTransfer = new DataTransfer();
      acceptedFiles.forEach((file) => dataTransfer.items.add(file));
      addFiles(dataTransfer.files);
    },
    [addFiles]
  );

  const { getRootProps, getInputProps, isDragReject, fileRejections } = useDropzone({
    onDrop,
    maxFiles,
    maxSize,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp'],
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/*': ['.txt', '.md', '.csv'],
      'application/json': ['.json'],
    },
    onDragEnter: () => setIsDragActive(true),
    onDragLeave: () => setIsDragActive(false),
    noClick: attachments.length > 0, // Don't open file dialog if there are attachments
  });

  const getFileIconComponent = (type: string, name: string) => {
    const iconType = getFileIcon({ type, name } as File);
    
    switch (iconType) {
      case 'image':
        return <ImageIcon size={16} style={{ color: THEME.accent }} aria-hidden="true" />;
      case 'pdf':
        return <FileText size={16} style={{ color: '#ef4444' }} aria-hidden="true" />;
      case 'word':
        return <FileText size={16} style={{ color: '#3b82f6' }} aria-hidden="true" />;
      case 'text':
        return <FileText size={16} style={{ color: THEME.textSecondary }} aria-hidden="true" />;
      default:
        return <File size={16} style={{ color: THEME.textSecondary }} aria-hidden="true" />;
    }
  };

  const getStatusIcon = (status: AttachmentUpload['status']) => {
    switch (status) {
      case 'uploading':
      case 'processing':
        return <Loader2 size={14} style={{ color: THEME.accent }} className="motion-safe:animate-spin" aria-hidden="true" />;
      case 'complete':
        return <Check size={14} style={{ color: THEME.success }} aria-hidden="true" />;
      case 'error':
        return <AlertTriangle size={14} style={{ color: THEME.error }} aria-hidden="true" />;
      default:
        return null;
    }
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {/* Dropzone Area */}
      <div
        {...getRootProps()}
        style={{
          border: `2px dashed ${isDragActive ? THEME.accent : isDragReject ? THEME.error : THEME.inputBorder}`,
          borderRadius: 12,
          padding: attachments.length > 0 ? '12px' : '24px',
          background: isDragActive ? 'rgba(212,149,106,0.05)' : THEME.inputBg,
          transition: 'border-color 0.2s, background-color 0.2s',
          cursor: attachments.length > 0 ? 'default' : 'pointer',
        }}
      >
        <input {...getInputProps()} />
        
        {attachments.length === 0 ? (
          // Empty state
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: 'rgba(255,255,255,0.05)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 12px',
              }}
            >
              <ImageIcon size={24} style={{ color: THEME.textSecondary }} aria-hidden="true" />
            </div>
            <p style={{ fontSize: 14, color: THEME.textPrimary, margin: '0 0 4px' }}>
              Drop files here or click to upload
            </p>
            <p style={{ fontSize: 12, color: THEME.textMuted, margin: 0 }}>
              Supports images, PDFs, DOCX, TXT (max {formatFileSize(maxSize)})
            </p>
          </div>
        ) : (
          // Files list
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {attachments.map((att) => (
              <div
                key={att.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 12px',
                  borderRadius: 8,
                  background: 'rgba(255,255,255,0.03)',
                  border: `1px solid ${att.status === 'error' ? 'rgba(239,68,68,0.2)' : 'transparent'}`,
                }}
              >
                {/* File icon or preview */}
                {att.type.startsWith('image/') && att.url ? (
                  <img
                    src={att.url}
                    alt={att.name}
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 6,
                      objectFit: 'cover',
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 6,
                      background: 'rgba(255,255,255,0.05)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {getFileIconComponent(att.type, att.name)}
                  </div>
                )}

                {/* File info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      fontSize: 13,
                      color: THEME.textPrimary,
                      margin: '0 0 2px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {att.name}
                  </p>
                  <p style={{ fontSize: 11, color: THEME.textMuted, margin: 0 }}>
                    {formatFileSize(att.size)}
                    {att.metadata?.pageCount && ` • ${att.metadata.pageCount} pages`}
                    {att.extractedText && ` • ${att.extractedText.length.toLocaleString()} chars`}
                  </p>

                  {/* Progress bar */}
                  {(att.status === 'uploading' || att.status === 'processing') && (
                    <div
                      style={{
                        height: 2,
                        background: 'rgba(255,255,255,0.1)',
                        borderRadius: 1,
                        marginTop: 4,
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${att.progress}%`,
                          background: THEME.accent,
                          borderRadius: 1,
                          transition: 'width 0.3s',
                        }}
                      />
                    </div>
                  )}

                  {/* Error message */}
                  {att.status === 'error' && att.error && (
                    <p style={{ fontSize: 11, color: THEME.error, margin: '4px 0 0' }}>
                      {att.error}
                    </p>
                  )}
                </div>

                {/* Status icon */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {getStatusIcon(att.status)}

                  {/* Retry button for errors */}
                  {att.status === 'error' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        retryUpload(att.id);
                      }}
                      style={{
                        fontSize: 11,
                        color: THEME.accent,
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '2px 6px',
                      }}
                    >
                      Retry
                    </button>
                  )}

                  {/* Remove button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeAttachment(att.id);
                    }}
                    aria-label={`Remove ${att.name}`}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 6,
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: THEME.textMuted,
                      transition: 'color 0.15s, background-color 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = THEME.error;
                      e.currentTarget.style.background = 'rgba(239,68,68,0.1)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = THEME.textMuted;
                      e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))}

            {/* Add more files hint */}
            <p
              style={{
                fontSize: 12,
                color: THEME.textMuted,
                margin: '4px 0 0',
                textAlign: 'center',
              }}
            >
              Drop more files or click to add
            </p>
          </div>
        )}
      </div>

      {/* File rejections */}
      {fileRejections.length > 0 && (
        <div
          style={{
            padding: '8px 12px',
            borderRadius: 8,
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.2)',
          }}
        >
          {fileRejections.map(({ file, errors }) => (
            <p key={file.name} style={{ fontSize: 12, color: THEME.error, margin: '2px 0' }}>
              {file.name}: {errors.map((e) => e.message).join(', ')}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

export type { AttachmentUpload };
