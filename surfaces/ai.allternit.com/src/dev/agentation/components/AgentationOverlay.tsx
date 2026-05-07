import React, { useEffect, useState } from 'react';
import { useAgentation } from '../hooks/useAgentation';
import { AnnotationTool } from './AnnotationTool';
import { DEFAULT_CONFIG } from '../types';

/**
 * AgentationOverlay - Main overlay component
 * 
 * DEV-ONLY: This component is never included in production builds.
 * It provides the visual annotation interface for UI development.
 */
export function AgentationOverlay() {
  const {
    isEnabled,
    toggleEnabled,
    annotations,
    selectedElement,
    notes,
    setNotes,
    selectElement,
    clearSelection,
    saveAnnotation,
    deleteAnnotation,
    getOutput,
    clearAll,
    config,
  } = useAgentation();

  const [isSelecting, setIsSelecting] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const [copiedOutput, setCopiedOutput] = useState<string | null>(null);

  // Handle hotkey toggle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle with 'A' key (when not in input)
      if (e.key.toLowerCase() === config.hotkey && !isInputFocused()) {
        e.preventDefault();
        toggleEnabled();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleEnabled, config.hotkey]);

  // Start selecting mode
  const handleStartSelect = () => {
    setIsSelecting(true);
    setShowPanel(false);
  };

  // Handle element selection
  const handleElementSelected = (element: Element) => {
    selectElement(element);
    setIsSelecting(false);
    setShowPanel(true);
  };

  // Handle save annotation
  const handleSave = () => {
    const annotation = saveAnnotation();
    if (annotation) {
      const output = getOutput(annotation);
      const formatted = formatOutput(output);
      navigator.clipboard.writeText(formatted);
      setCopiedOutput(formatted);
      setTimeout(() => setCopiedOutput(null), 3000);
    }
  };

  // Copy all annotations
  const handleCopyAll = () => {
    const allOutput = annotations
      .map(ann => formatOutput(getOutput(ann)))
      .join('\n\n---\n\n');
    navigator.clipboard.writeText(allOutput);
    setCopiedOutput(allOutput);
    setTimeout(() => setCopiedOutput(null), 3000);
  };

  if (!isEnabled) {
    return (
      <button
        onClick={toggleEnabled}
        style={styles.toggleButton}
        title="Enable Agentation (Press 'A')"
      >
        🎨
      </button>
    );
  }

  return (
    <div style={styles.container}>
      {/* Toggle button */}
      <button
        onClick={toggleEnabled}
        style={{ ...styles.toggleButton, ...styles.toggleButtonActive }}
        title="Disable Agentation (Press 'A')"
      >
        🎨
      </button>

      {/* Selection mode button */}
      <button
        onClick={handleStartSelect}
        style={{
          ...styles.actionButton,
          ...(isSelecting ? styles.actionButtonActive : {}),
        }}
        title="Select element to annotate"
      >
        🎯 Select
      </button>

      {/* Show annotations panel */}
      <button
        onClick={() => setShowPanel(!showPanel)}
        style={styles.actionButton}
        title="View all annotations"
      >
        📋 {annotations.length}
      </button>

      {/* Copy all button */}
      {annotations.length > 0 && (
        <button
          onClick={handleCopyAll}
          style={styles.actionButton}
          title="Copy all annotations"
        >
          📋 Copy All
        </button>
      )}

      {/* Selection mode overlay */}
      {isSelecting && (
        <div style={styles.selectionOverlay}>
          <div style={styles.selectionHint}>
            Click an element to annotate (ESC to cancel)
          </div>
        </div>
      )}

      {/* Annotation panel */}
      {showPanel && selectedElement && (
        <AnnotationTool
          element={selectedElement}
          notes={notes}
          onNotesChange={setNotes}
          onSave={handleSave}
          onCancel={clearSelection}
        />
      )}

      {/* Annotations list panel */}
      {showPanel && !selectedElement && (
        <div style={styles.listPanel}>
          <div style={styles.listPanelHeader}>
            <h3 style={styles.listPanelTitle}>Annotations ({annotations.length})</h3>
            <button onClick={() => setShowPanel(false)} style={styles.closeButton}>
              ✕
            </button>
          </div>
          
          {annotations.length === 0 ? (
            <p style={styles.emptyState}>No annotations yet. Click "Select" to annotate an element.</p>
          ) : (
            <div style={styles.annotationList}>
              {annotations.map((ann, index) => (
                <div key={ann.id} style={styles.annotationItem}>
                  <div style={styles.annotationHeader}>
                    <span style={styles.annotationTag}>{ann.element.tagName}</span>
                    <span style={styles.annotationIndex}>#{index + 1}</span>
                  </div>
                  <p style={styles.annotationNotes}>{ann.notes}</p>
                  <div style={styles.annotationActions}>
                    <button
                      onClick={() => {
                        const output = formatOutput(getOutput(ann));
                        navigator.clipboard.writeText(output);
                        setCopiedOutput(output);
                        setTimeout(() => setCopiedOutput(null), 3000);
                      }}
                      style={styles.smallButton}
                    >
                      📋 Copy
                    </button>
                    <button
                      onClick={() => deleteAnnotation(ann.id)}
                      style={{ ...styles.smallButton, ...styles.deleteButton }}
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {copiedOutput && (
            <div style={styles.copiedToast}>
              ✓ Copied to clipboard! Paste into your Allternit agent.
            </div>
          )}
        </div>
      )}

      {/* Selection mode click handler */}
      {isSelecting && (
        <div
          style={styles.clickCapture}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.target instanceof Element) {
              handleElementSelected(e.target);
            }
          }}
        />
      )}
    </div>
  );
}

/**
 * Format output for Allternit agent
 */
function formatOutput(output: { notes: string; selectors: string[]; context: string }) {
  return `
# UI Annotation

## Notes
${output.notes}

## Selectors
${output.selectors.map(s => `- \`${s}\``).join('\n')}

## Context
${output.context}
`.trim();
}

/**
 * Check if focus is in an input element
 */
function isInputFocused(): boolean {
  const active = document.activeElement;
  return (
    active instanceof HTMLInputElement ||
    active instanceof HTMLTextAreaElement ||
    active instanceof HTMLSelectElement ||
    active?.getAttribute('contenteditable') === 'true'
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'fixed',
    top: 20,
    right: 20,
    zIndex: 999999,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  toggleButton: {
    padding: '12px 16px',
    fontSize: 20,
    borderRadius: 8,
    border: '2px solid #e2e8f0',
    backgroundColor: '#ffffff',
    cursor: 'pointer',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
    transition: 'all 0.2s',
  },
  toggleButtonActive: {
    backgroundColor: '#8b5cf6',
    borderColor: '#7c3aed',
    color: '#ffffff',
  },
  actionButton: {
    padding: '8px 12px',
    fontSize: 14,
    borderRadius: 6,
    border: '2px solid #e2e8f0',
    backgroundColor: '#ffffff',
    cursor: 'pointer',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
    transition: 'all 0.2s',
  },
  actionButtonActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#2563eb',
    color: '#ffffff',
  },
  selectionOverlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 999998,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectionHint: {
    padding: '16px 24px',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    fontSize: 16,
    fontWeight: 600,
    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
  },
  listPanel: {
    position: 'fixed',
    top: 80,
    right: 20,
    width: 350,
    maxHeight: 'calc(100vh - 100px)',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    border: '2px solid #e2e8f0',
    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 999997,
  },
  listPanelHeader: {
    padding: '12px 16px',
    borderBottom: '1px solid #e2e8f0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
  },
  listPanelTitle: {
    margin: 0,
    fontSize: 16,
    fontWeight: 600,
    color: '#1e293b',
  },
  closeButton: {
    padding: '4px 8px',
    fontSize: 14,
    border: 'none',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    borderRadius: 4,
    color: '#64748b',
  },
  emptyState: {
    padding: 24,
    textAlign: 'center',
    color: '#64748b',
    fontSize: 14,
  },
  annotationList: {
    flex: 1,
    overflowY: 'auto',
    padding: 16,
  },
  annotationItem: {
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 6,
    marginBottom: 12,
    border: '1px solid #e2e8f0',
  },
  annotationHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  annotationTag: {
    padding: '2px 8px',
    backgroundColor: '#8b5cf6',
    color: '#ffffff',
    borderRadius: 4,
    fontSize: 12,
    fontWeight: 600,
    textTransform: 'uppercase',
  },
  annotationIndex: {
    fontSize: 12,
    color: '#64748b',
  },
  annotationNotes: {
    margin: '0 0 12px 0',
    fontSize: 14,
    color: '#1e293b',
    lineHeight: 1.5,
  },
  annotationActions: {
    display: 'flex',
    gap: 8,
  },
  smallButton: {
    flex: 1,
    padding: '6px 12px',
    fontSize: 12,
    borderRadius: 4,
    border: '1px solid #e2e8f0',
    backgroundColor: '#ffffff',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  deleteButton: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
    color: '#dc2626',
  },
  clickCapture: {
    position: 'fixed',
    inset: 0,
    zIndex: 999999,
    cursor: 'crosshair',
  },
  copiedToast: {
    position: 'fixed',
    bottom: 20,
    right: 20,
    padding: '12px 20px',
    backgroundColor: '#22c55e',
    color: '#ffffff',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 500,
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    zIndex: 1000000,
  },
};
