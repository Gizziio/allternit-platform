/**
 * Avatar Preview Component
 * 
 * Real-time preview of the avatar with emotion testing controls.
 * Used in the avatar creator wizard.
 */

import React, { useState, useCallback } from 'react';
import { AgentAvatar } from './AgentAvatar';
import { useAvatarCreatorStore } from '../../stores/avatar-creator.store';
import type { AvatarEmotion } from '../../lib/agents/character.types';
import { STUDIO_THEME } from '../../views/AgentView';

const EMOTIONS: { id: AvatarEmotion; label: string; emoji: string }[] = [
  { id: 'steady', label: 'Steady', emoji: '😌' },
  { id: 'alert', label: 'Alert', emoji: '⚡' },
  { id: 'curious', label: 'Curious', emoji: '🤔' },
  { id: 'focused', label: 'Focused', emoji: '🎯' },
  { id: 'pleased', label: 'Pleased', emoji: '😊' },
  { id: 'skeptical', label: 'Skeptical', emoji: '🤨' },
  { id: 'mischief', label: 'Mischief', emoji: '😏' },
  { id: 'proud', label: 'Proud', emoji: '😎' },
];

const SIZE_OPTIONS = [
  { value: 120, label: 'Small' },
  { value: 200, label: 'Medium' },
  { value: 280, label: 'Large' },
];

interface AvatarPreviewProps {
  className?: string;
}

export const AvatarPreview: React.FC<AvatarPreviewProps> = ({ className = '' }) => {
  const {
    currentConfig,
    previewEmotion,
    previewSize,
    isPreviewAnimating,
    setPreviewEmotion,
    setPreviewSize,
    setPreviewAnimating,
    exportConfig,
    importConfig,
    randomize,
  } = useAvatarCreatorStore();

  const [importJson, setImportJson] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  const handleExport = useCallback(() => {
    const json = exportConfig();
    navigator.clipboard.writeText(json);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  }, [exportConfig]);

  const handleImport = useCallback(() => {
    const success = importConfig(importJson);
    if (success) {
      setShowImport(false);
      setImportJson('');
    }
  }, [importConfig, importJson]);

  return (
    <div 
      className={`avatar-preview ${className}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '24px',
        padding: '24px',
        backgroundColor: STUDIO_THEME.bgCard,
        borderRadius: '12px',
        border: `1px solid ${STUDIO_THEME.border}`,
      }}
    >
      {/* Preview Area */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '320px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: STUDIO_THEME.bg,
          borderRadius: '8px',
          overflow: 'hidden',
        }}
      >
        {/* Grid background */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `
              linear-gradient(${STUDIO_THEME.border} 1px, transparent 1px),
              linear-gradient(90deg, ${STUDIO_THEME.border} 1px, transparent 1px)
            `,
            backgroundSize: '20px 20px',
            opacity: 0.3,
          }}
        />
        
        {/* Avatar */}
        <AgentAvatar
          config={currentConfig}
          emotion={previewEmotion}
          size={previewSize}
          isAnimating={isPreviewAnimating}
          showGlow
        />
      </div>

      {/* Emotion Controls */}
      <div style={{ width: '100%' }}>
        <label
          style={{
            display: 'block',
            fontSize: '12px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: STUDIO_THEME.textSecondary,
            marginBottom: '12px',
          }}
        >
          Test Emotions
        </label>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '8px',
          }}
        >
          {EMOTIONS.map((emotion) => (
            <button
              key={emotion.id}
              onClick={() => setPreviewEmotion(emotion.id)}
              style={{
                padding: '10px 8px',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: previewEmotion === emotion.id 
                  ? STUDIO_THEME.accent 
                  : STUDIO_THEME.bg,
                color: previewEmotion === emotion.id 
                  ? STUDIO_THEME.bg 
                  : STUDIO_THEME.textPrimary,
                fontSize: '13px',
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span style={{ fontSize: '16px' }}>{emotion.emoji}</span>
              <span>{emotion.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Size & Animation Controls */}
      <div
        style={{
          display: 'flex',
          gap: '16px',
          width: '100%',
          alignItems: 'center',
        }}
      >
        {/* Size selector */}
        <div style={{ flex: 1 }}>
          <label
            style={{
              display: 'block',
              fontSize: '11px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: STUDIO_THEME.textSecondary,
              marginBottom: '6px',
            }}
          >
            Preview Size
          </label>
          <select
            value={previewSize}
            onChange={(e) => setPreviewSize(Number(e.target.value))}
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: '6px',
              border: `1px solid ${STUDIO_THEME.border}`,
              backgroundColor: STUDIO_THEME.bg,
              color: STUDIO_THEME.textPrimary,
              fontSize: '13px',
            }}
          >
            {SIZE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Animation toggle */}
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 12px',
            borderRadius: '6px',
            backgroundColor: STUDIO_THEME.bg,
            border: `1px solid ${STUDIO_THEME.border}`,
            cursor: 'pointer',
            fontSize: '13px',
            color: STUDIO_THEME.textPrimary,
          }}
        >
          <input
            type="checkbox"
            checked={isPreviewAnimating}
            onChange={(e) => setPreviewAnimating(e.target.checked)}
            style={{ cursor: 'pointer' }}
          />
          Animate
        </label>
      </div>

      {/* Action Buttons */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          width: '100%',
        }}
      >
        <button
          onClick={() => setShowImport(!showImport)}
          style={{
            flex: 1,
            padding: '10px 16px',
            borderRadius: '8px',
            border: `1px solid ${STUDIO_THEME.border}`,
            backgroundColor: 'transparent',
            color: STUDIO_THEME.textPrimary,
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Import
        </button>
        
        <button
          onClick={handleExport}
          style={{
            flex: 1,
            padding: '10px 16px',
            borderRadius: '8px',
            border: 'none',
            backgroundColor: STUDIO_THEME.accent,
            color: STUDIO_THEME.bg,
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          {copySuccess ? 'Copied!' : 'Export JSON'}
        </button>
        
        <button
          onClick={randomize}
          style={{
            padding: '10px 16px',
            borderRadius: '8px',
            border: `1px solid ${STUDIO_THEME.border}`,
            backgroundColor: 'transparent',
            color: STUDIO_THEME.textPrimary,
            fontSize: '13px',
            cursor: 'pointer',
          }}
          title="Randomize Avatar"
        >
          🎲
        </button>
      </div>

      {/* Import Panel */}
      {showImport && (
        <div
          style={{
            width: '100%',
            padding: '16px',
            backgroundColor: STUDIO_THEME.bg,
            borderRadius: '8px',
            border: `1px solid ${STUDIO_THEME.border}`,
          }}
        >
          <textarea
            value={importJson}
            onChange={(e) => setImportJson(e.target.value)}
            placeholder="Paste avatar config JSON here..."
            style={{
              width: '100%',
              height: '100px',
              padding: '12px',
              borderRadius: '6px',
              border: `1px solid ${STUDIO_THEME.border}`,
              backgroundColor: STUDIO_THEME.bgCard,
              color: STUDIO_THEME.textPrimary,
              fontSize: '12px',
              fontFamily: 'monospace',
              resize: 'vertical',
              marginBottom: '12px',
            }}
          />
          <button
            onClick={handleImport}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: STUDIO_THEME.accent,
              color: STUDIO_THEME.bg,
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Import Configuration
          </button>
        </div>
      )}
    </div>
  );
};

AvatarPreview.displayName = 'AvatarPreview';
