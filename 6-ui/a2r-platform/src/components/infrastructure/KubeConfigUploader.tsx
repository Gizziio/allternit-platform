/**
 * KubeConfigUploader.tsx
 * 
 * Component for uploading and managing Kubernetes configuration files.
 */

import React, { useState, useCallback, useRef } from 'react';

export interface KubeConfigUploaderProps {
  onUpload?: (config: KubeConfigData) => void;
  onError?: (error: string) => void;
  maxSize?: number; // in bytes
  acceptedTypes?: string[];
}

export interface KubeConfigData {
  name: string;
  content: string;
  context: string;
  clusters: string[];
  contexts: string[];
}

export function KubeConfigUploader({
  onUpload,
  onError,
  maxSize = 1024 * 1024, // 1MB default
  acceptedTypes = ['.yaml', '.yml', '.kubeconfig'],
}: KubeConfigUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File | undefined): string | null => {
    if (!file) {
      return 'No file selected';
    }

    if (file.size > maxSize) {
      return `File too large. Max size is ${maxSize / 1024}KB`;
    }

    const extension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!acceptedTypes.some(type => file.name.toLowerCase().endsWith(type))) {
      return `Invalid file type. Accepted: ${acceptedTypes.join(', ')}`;
    }

    return null;
  };

  const parseKubeConfig = (content: string): KubeConfigData | null => {
    try {
      // Basic YAML parsing for kubeconfig structure
      // In a real implementation, you'd use a proper YAML parser
      const lines = content.split('\n');
      let currentContext = '';
      const clusters: string[] = [];
      const contexts: string[] = [];

      for (const line of lines) {
        const contextMatch = line.match(/^current-context:\s*(.+)$/);
        if (contextMatch) {
          currentContext = contextMatch[1].trim();
        }

        const clusterMatch = line.match(/^-\s*name:\s*(.+)$/);
        if (clusterMatch && lines[lines.indexOf(line) - 1]?.includes('clusters:')) {
          clusters.push(clusterMatch[1].trim());
        }

        const ctxMatch = line.match(/^-\s*name:\s*(.+)$/);
        if (ctxMatch && lines[lines.indexOf(line) - 1]?.includes('contexts:')) {
          contexts.push(ctxMatch[1].trim());
        }
      }

      return {
        name: currentContext || 'unknown',
        content,
        context: currentContext,
        clusters,
        contexts,
      };
    } catch (err) {
      return null;
    }
  };

  const handleFile = useCallback(async (file: File | undefined) => {
    // Add null check before calling function
    if (!file) {
      onError?.('No file provided');
      return;
    }

    const validationError = validateFile(file);
    if (validationError) {
      onError?.(validationError);
      return;
    }

    setLoading(true);

    try {
      const content = await file.text();
      const config = parseKubeConfig(content);

      if (!config) {
        onError?.('Invalid kubeconfig file format');
        return;
      }

      onUpload?.(config);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Failed to read file');
    } finally {
      setLoading(false);
    }
  }, [onUpload, onError, maxSize, acceptedTypes]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    handleFile(file);
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    handleFile(file);
  }, [handleFile]);

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return (
    <div
      className={`kube-config-uploader ${isDragging ? 'dragging' : ''}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          handleClick();
        }
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptedTypes.join(',')}
        onChange={handleInputChange}
        style={{ display: 'none' }}
        aria-label="Upload kubeconfig file"
      />

      <div className="upload-content">
        {loading ? (
          <div className="loading">Processing...</div>
        ) : (
          <>
            <div className="upload-icon">📁</div>
            <p className="upload-text">
              {isDragging
                ? 'Drop your kubeconfig file here'
                : 'Drag and drop your kubeconfig file here, or click to browse'}
            </p>
            <p className="upload-hint">
              Accepted formats: {acceptedTypes.join(', ')} (max {maxSize / 1024}KB)
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default KubeConfigUploader;
