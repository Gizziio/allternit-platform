/**
 * InlineRename — production inline-edit component.
 *
 * Renders the label as plain text normally.  When the parent calls
 * `ref.current.startEdit()` (triggered from a menu's "Rename" action) the
 * label is replaced with a focused, auto-selected input field.
 *
 * - Enter  → save
 * - Escape → cancel (restore original value)
 * - Blur   → save (matches ChatGPT / Claude behaviour)
 */

import React, {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
  useCallback,
  useEffect,
} from 'react';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface InlineRenameHandle {
  /** Switch the label into edit mode immediately. */
  startEdit: () => void;
}

export interface InlineRenameProps {
  /** Current value displayed as the label. */
  value: string;
  /** Called with the new name when the user commits (Enter / blur). */
  onSave: (newValue: string) => void;
  /** Optional CSS class for the wrapper span. */
  className?: string;
  /** Optional style for both the label and the input. */
  style?: React.CSSProperties;
  /** Optional style applied only to the input element. */
  inputStyle?: React.CSSProperties;
  /** Placeholder shown when the input is empty. Defaults to value. */
  placeholder?: string;
  /** Max length enforced on the input (default 200). */
  maxLength?: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const InlineRename = forwardRef<InlineRenameHandle, InlineRenameProps>(
  function InlineRename(
    {
      value,
      onSave,
      className,
      style,
      inputStyle,
      placeholder,
      maxLength = 200,
    },
    ref,
  ) {
    const [isEditing, setIsEditing] = useState(false);
    const [draft, setDraft] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    // Track whether we are already committing to prevent double-save on
    // blur-after-Enter.
    const committingRef = useRef(false);

    const startEdit = useCallback(() => {
      setDraft(value);
      setIsEditing(true);
    }, [value]);

    useImperativeHandle(ref, () => ({ startEdit }), [startEdit]);

    // Auto-focus + select-all when entering edit mode.
    useEffect(() => {
      if (isEditing && inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
      }
    }, [isEditing]);

    const commit = useCallback(() => {
      if (committingRef.current) return;
      committingRef.current = true;
      const trimmed = draft.trim();
      setIsEditing(false);
      if (trimmed && trimmed !== value) {
        onSave(trimmed);
      }
      committingRef.current = false;
    }, [draft, value, onSave]);

    const cancel = useCallback(() => {
      setIsEditing(false);
      setDraft(value);
    }, [value]);

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          commit();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          cancel();
        }
      },
      [commit, cancel],
    );

    const baseStyle: React.CSSProperties = {
      flex: 1,
      minWidth: 0,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      ...style,
    };

    if (isEditing) {
      return (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={commit}
          placeholder={placeholder ?? value}
          maxLength={maxLength}
          className={className}
          style={{
            flex: 1,
            minWidth: 0,
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border-default)',
            borderRadius: 4,
            color: 'var(--text-primary)',
            fontSize: 'inherit',
            fontWeight: 'inherit',
            fontFamily: 'inherit',
            padding: '1px 4px',
            outline: 'none',
            ...style,
            ...inputStyle,
          }}
          // Prevent click-through to parent row
          onClick={(e) => e.stopPropagation()}
        />
      );
    }

    return (
      <span className={className} style={baseStyle}>
        {value}
      </span>
    );
  },
);
