import React, { useRef, useEffect } from 'react';
import { generateSelectors, getXPath } from '../hooks/useAgentation';

interface AnnotationToolProps {
  element: Element;
  notes: string;
  onNotesChange: (notes: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

/**
 * AnnotationTool - Panel for adding notes to selected element
 */
export function AnnotationTool({
  element,
  notes,
  onNotesChange,
  onSave,
  onCancel,
}: AnnotationToolProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus textarea on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Get element info
  const selectors = generateSelectors(element);
  const xpath = getXPath(element);
  const tagName = element.tagName.toLowerCase();
  const elementId = element.id || 'none';
  const elementClass = element.className?.toString() || 'none';
  const elementText = element.textContent?.trim().substring(0, 100) || 'none';

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Save with Cmd/Ctrl + Enter
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        onSave();
      }
      // Cancel with Escape
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSave, onCancel]);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>Annotate Element</h3>
        <button onClick={onCancel} style={styles.closeButton}>
          ✕
        </button>
      </div>

      {/* Element info */}
      <div style={styles.elementInfo}>
        <div style={styles.infoRow}>
          <span style={styles.infoLabel}>Tag:</span>
          <code style={styles.code}>{tagName}</code>
        </div>
        <div style={styles.infoRow}>
          <span style={styles.infoLabel}>ID:</span>
          <code style={styles.code}>{elementId}</code>
        </div>
        <div style={styles.infoRow}>
          <span style={styles.infoLabel}>Class:</span>
          <code style={styles.codeShort}>{elementClass}</code>
        </div>
        {elementText !== 'none' && (
          <div style={styles.infoRow}>
            <span style={styles.infoLabel}>Text:</span>
            <span style={styles.textPreview}>"{elementText}"</span>
          </div>
        )}
      </div>

      {/* Selectors */}
      <div style={styles.selectorsSection}>
        <div style={styles.sectionTitle}>Selectors (click to copy)</div>
        <div style={styles.selectorsList}>
          {selectors.map((selector, index) => (
            <button
              key={index}
              onClick={() => navigator.clipboard.writeText(selector)}
              style={styles.selectorButton}
              title="Click to copy"
            >
              {selector}
            </button>
          ))}
          <div style={styles.selectorXPath}>
            <span style={styles.xpathLabel}>XPath:</span>
            <code style={styles.codeShort}>{xpath}</code>
          </div>
        </div>
      </div>

      {/* Notes input */}
      <div style={styles.notesSection}>
        <label style={styles.notesLabel}>
          Your Notes
          <span style={styles.notesHint}>
            Describe what should change. Be specific.
          </span>
        </label>
        <textarea
          ref={textareaRef}
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          placeholder="E.g., Change button color to blue, increase padding to 16px, add hover state..."
          style={styles.textarea}
          rows={6}
        />
      </div>

      {/* Actions */}
      <div style={styles.actions}>
        <button onClick={onCancel} style={styles.cancelButton}>
          Cancel
        </button>
        <button
          onClick={onSave}
          disabled={!notes.trim()}
          style={{
            ...styles.saveButton,
            ...(notes.trim() ? {} : styles.saveButtonDisabled),
          }}
        >
          💾 Save & Copy
        </button>
      </div>

      {/* Keyboard shortcuts hint */}
      <div style={styles.shortcuts}>
        <kbd style={styles.kbd}>Cmd/Ctrl</kbd> + <kbd style={styles.kbd}>Enter</kbd> to save
        <span style={styles.shortcutSeparator}>•</span>
        <kbd style={styles.kbd}>Esc</kbd> to cancel
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: 500,
    maxHeight: '80vh',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    border: '2px solid #e2e8f0',
    boxShadow: '0 25px 50px rgba(0, 0, 0, 0.25)',
    zIndex: 1000000,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    padding: '16px 20px',
    borderBottom: '1px solid #e2e8f0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8fafc',
  },
  title: {
    margin: 0,
    fontSize: 18,
    fontWeight: 600,
    color: '#1e293b',
  },
  closeButton: {
    padding: '4px 8px',
    fontSize: 18,
    border: 'none',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    borderRadius: 4,
    color: '#64748b',
    transition: 'all 0.2s',
  },
  elementInfo: {
    padding: '16px 20px',
    backgroundColor: '#f0f9ff',
    borderBottom: '1px solid #e0f2fe',
  },
  infoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
    fontSize: 13,
  },
  infoLabel: {
    fontWeight: 600,
    color: '#0369a1',
    minWidth: 50,
  },
  code: {
    padding: '2px 6px',
    backgroundColor: '#e0f2fe',
    borderRadius: 4,
    fontSize: 12,
    fontFamily: 'var(--font-mono)',
    color: '#0369a1',
  },
  codeShort: {
    padding: '2px 6px',
    backgroundColor: '#e0f2fe',
    borderRadius: 4,
    fontSize: 11,
    fontFamily: 'var(--font-mono)',
    color: '#0369a1',
    maxWidth: 300,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  textPreview: {
    fontSize: 12,
    color: '#64748b',
    fontStyle: 'italic',
    maxWidth: 300,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  selectorsSection: {
    padding: '16px 20px',
    borderBottom: '1px solid #e2e8f0',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: '#475569',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  selectorsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  selectorButton: {
    padding: '8px 12px',
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: 6,
    fontSize: 12,
    fontFamily: 'var(--font-mono)',
    color: '#1e293b',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all 0.2s',
  },
  selectorXPath: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 8,
  },
  xpathLabel: {
    fontWeight: 600,
    marginRight: 8,
  },
  notesSection: {
    padding: '16px 20px',
    flex: 1,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  notesLabel: {
    display: 'block',
    fontSize: 13,
    fontWeight: 600,
    color: '#475569',
    marginBottom: 8,
  },
  notesHint: {
    fontWeight: 400,
    color: '#94a3b8',
    marginLeft: 8,
    fontSize: 12,
  },
  textarea: {
    flex: 1,
    padding: 12,
    border: '1px solid #e2e8f0',
    borderRadius: 6,
    fontSize: 14,
    fontFamily: 'inherit',
    resize: 'none',
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  actions: {
    padding: '16px 20px',
    borderTop: '1px solid #e2e8f0',
    display: 'flex',
    gap: 12,
    justifyContent: 'flex-end',
  },
  cancelButton: {
    padding: '10px 20px',
    backgroundColor: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: 6,
    fontSize: 14,
    fontWeight: 500,
    color: '#475569',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  saveButton: {
    padding: '10px 20px',
    backgroundColor: '#8b5cf6',
    border: '1px solid #7c3aed',
    borderRadius: 6,
    fontSize: 14,
    fontWeight: 500,
    color: '#ffffff',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  saveButtonDisabled: {
    backgroundColor: '#cbd5e1',
    borderColor: '#94a3b8',
    cursor: 'not-allowed',
  },
  shortcuts: {
    padding: '12px 20px',
    borderTop: '1px solid #e2e8f0',
    backgroundColor: '#f8fafc',
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
  },
  kbd: {
    padding: '2px 6px',
    backgroundColor: '#e2e8f0',
    borderRadius: 4,
    fontSize: 11,
    fontFamily: 'var(--font-mono)',
    fontWeight: 600,
    margin: '0 4px',
  },
  shortcutSeparator: {
    margin: '0 8px',
    color: '#cbd5e1',
  },
};
