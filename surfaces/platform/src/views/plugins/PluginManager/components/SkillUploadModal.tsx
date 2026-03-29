import React, { useState, useRef } from 'react';
import { X } from '@phosphor-icons/react';
import { THEME } from '../constants';

export function SkillUploadModal({
  onClose,
  onUpload,
  isUploading,
}: {
  onClose: () => void;
  onUpload: (file: File) => Promise<void>;
  isUploading: boolean;
}) {
  const [isDragActive, setIsDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File | null) => {
    if (!file || isUploading) return;
    void onUpload(file);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 220,
        backgroundColor: 'rgba(0,0,0,0.72)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
      role="dialog"
      aria-label="Upload skill"
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragActive(true);
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        setIsDragActive(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragActive(false);
        handleFile(event.dataTransfer.files?.[0] || null);
      }}
    >
      <div
        style={{
          width: 'min(560px, 100%)',
          borderRadius: 12,
          border: `1px solid ${THEME.borderStrong}`,
          backgroundColor: THEME.bgElevated,
          padding: 18,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <h3 style={{ margin: 0, fontSize: 20, color: THEME.textPrimary }}>Upload skill</h3>
          <button
            onClick={onClose}
            style={{ border: 'none', background: 'transparent', color: THEME.textTertiary, cursor: 'pointer' }}
            aria-label="Close upload skill"
          >
            <X size={18} />
          </button>
        </div>
        <p style={{ margin: 0, marginBottom: 12, fontSize: 13, color: THEME.textSecondary }}>
          Drop a `SKILL.md` file or choose one from disk.
        </p>

        <button
          onClick={() => inputRef.current?.click()}
          style={{
            width: '100%',
            borderRadius: 10,
            border: `1px dashed ${isDragActive ? THEME.accent : THEME.borderStrong}`,
            backgroundColor: isDragActive ? THEME.accentMuted : 'rgba(255,255,255,0.02)',
            padding: '28px 14px',
            textAlign: 'center',
            color: THEME.textSecondary,
            cursor: 'pointer',
            fontSize: 13,
          }}
          disabled={isUploading}
        >
          {isUploading ? 'Importing skill...' : 'Drag and drop SKILL.md here or click to choose a file'}
        </button>

        <div style={{ marginTop: 12, fontSize: 12, color: THEME.textTertiary, lineHeight: 1.6 }}>
          Requirements: `.md` and `.zip` supported. Zip archives must include a `SKILL.md` file.
        </div>
        <div style={{ marginTop: 6, fontSize: 12, color: THEME.textTertiary }}>
          Include clear instructions and optional `LICENSE` file alongside your skill content.
        </div>

        <input
          ref={inputRef}
          type="file"
          accept=".md,.zip"
          style={{ display: 'none' }}
          onChange={(event) => {
            handleFile(event.target.files?.[0] || null);
            event.target.value = '';
          }}
          aria-label="Select skill file"
        />
      </div>
    </div>
  );
}
