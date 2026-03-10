"use client";

import { useState, useCallback } from 'react';
import { uploadFile } from '@/lib/blob';
import { extractTextFromFile, supportsTextExtraction, formatFileSize } from '@/lib/attachments/extract-text';
import { createModuleLogger } from '@/lib/logger';

const log = createModuleLogger('hooks:attachment-upload');

export interface AttachmentUpload {
  id: string;
  file: File;
  name: string;
  size: number;
  type: string;
  progress: number;
  status: 'pending' | 'uploading' | 'processing' | 'complete' | 'error';
  error?: string;
  url?: string;
  extractedText?: string;
  metadata?: {
    pageCount?: number;
    title?: string;
  };
}

export interface UseAttachmentUploadOptions {
  onUploadComplete?: (attachment: AttachmentUpload) => void;
  onUploadError?: (attachment: AttachmentUpload, error: Error) => void;
  extractText?: boolean; // Whether to extract text from documents
}

export function useAttachmentUpload(options: UseAttachmentUploadOptions = {}) {
  const { onUploadComplete, onUploadError, extractText = true } = options;
  const [attachments, setAttachments] = useState<AttachmentUpload[]>([]);

  const generateId = () => `att-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  /**
   * Add files to the upload queue
   */
  const addFiles = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newAttachments: AttachmentUpload[] = Array.from(files).map((file) => ({
      id: generateId(),
      file,
      name: file.name,
      size: file.size,
      type: file.type,
      progress: 0,
      status: 'pending',
    }));

    setAttachments((prev) => [...prev, ...newAttachments]);

    // Start uploading each file
    for (const attachment of newAttachments) {
      uploadAttachment(attachment);
    }
  }, []);

  /**
   * Upload a single attachment
   */
  const uploadAttachment = async (attachment: AttachmentUpload) => {
    try {
      // Update status to uploading
      updateAttachment(attachment.id, { status: 'uploading' });

      // Simulate progress updates (in real implementation, this would track actual upload)
      const progressInterval = setInterval(() => {
        setAttachments((prev) =>
          prev.map((att) =>
            att.id === attachment.id && att.progress < 90
              ? { ...att, progress: att.progress + 10 }
              : att
          )
        );
      }, 200);

      // Extract text if it's a document and extraction is enabled
      let extractedText: string | undefined;
      let metadata: { pageCount?: number; title?: string } | undefined;

      if (extractText && supportsTextExtraction(attachment.file)) {
        updateAttachment(attachment.id, { status: 'processing' });
        
        try {
          const extraction = await extractTextFromFile(attachment.file);
          if (extraction) {
            extractedText = extraction.text;
            metadata = extraction.metadata;
            log.info({ 
              id: attachment.id, 
              filename: attachment.name,
              textLength: extractedText.length 
            }, 'Text extracted from file');
          }
        } catch (error) {
          log.warn({ error, filename: attachment.name }, 'Text extraction failed, continuing with upload');
        }
      }

      // Read file as data URL for images, or upload to blob storage
      let url: string;
      
      if (attachment.type.startsWith('image/')) {
        // For images, read as data URL for preview
        url = await readFileAsDataURL(attachment.file);
      } else {
        // For other files, upload to blob storage
        const buffer = await attachment.file.arrayBuffer();
        const result = await uploadFile(
          `${Date.now()}-${attachment.name}`,
          Buffer.from(buffer)
        );
        url = result.url;
      }

      clearInterval(progressInterval);

      const completedAttachment: AttachmentUpload = {
        ...attachment,
        progress: 100,
        status: 'complete',
        url,
        extractedText,
        metadata,
      };

      updateAttachment(attachment.id, completedAttachment);
      onUploadComplete?.(completedAttachment);

      log.info({ id: attachment.id, filename: attachment.name }, 'Attachment uploaded');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      
      updateAttachment(attachment.id, {
        status: 'error',
        error: errorMessage,
      });

      onUploadError?.(attachment, error instanceof Error ? error : new Error(errorMessage));
      log.error({ error, filename: attachment.name }, 'Attachment upload failed');
    }
  };

  /**
   * Update an attachment in state
   */
  const updateAttachment = (id: string, updates: Partial<AttachmentUpload>) => {
    setAttachments((prev) =>
      prev.map((att) => (att.id === id ? { ...att, ...updates } : att))
    );
  };

  /**
   * Remove an attachment
   */
  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => prev.filter((att) => att.id !== id));
  }, []);

  /**
   * Clear all attachments
   */
  const clearAttachments = useCallback(() => {
    setAttachments([]);
  }, []);

  /**
   * Retry a failed upload
   */
  const retryUpload = useCallback((id: string) => {
    const attachment = attachments.find((att) => att.id === id);
    if (attachment) {
      updateAttachment(id, { status: 'pending', progress: 0, error: undefined });
      uploadAttachment({ ...attachment, status: 'pending', progress: 0, error: undefined });
    }
  }, [attachments]);

  return {
    attachments,
    addFiles,
    removeAttachment,
    clearAttachments,
    retryUpload,
    formatFileSize,
  };
}

/**
 * Read a file as a data URL
 */
function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
