import * as React from 'react';

export type GoalTokenKind = 'intent' | 'entity' | 'constraint' | 'risk' | 'confidence';

export interface GoalToken {
  kind: GoalTokenKind;
  value: string;
  weight?: number;
}

interface GoalTokensProps {
  tokens: GoalToken[];
  onUpdate?: (tokens: GoalToken[]) => void;
  onRemove?: (tokens: GoalToken[]) => void;
}

const TOKEN_KINDS: GoalTokenKind[] = ['intent', 'entity', 'constraint', 'risk', 'confidence'];

export const GoalTokens: React.FC<GoalTokensProps> = ({ tokens, onUpdate, onRemove }) => {
  const [editingIndex, setEditingIndex] = React.useState<number | null>(null);
  const [draftToken, setDraftToken] = React.useState<GoalToken | null>(null);
  const [localTokens, setLocalTokens] = React.useState<GoalToken[]>(tokens);
  const isControlled = Boolean(onUpdate || onRemove);
  const displayTokens = isControlled ? tokens : localTokens;

  React.useEffect(() => {
    if (!isControlled) {
      setLocalTokens(tokens);
    }
  }, [tokens, isControlled]);

  const getTokenColor = (kind: GoalTokenKind): string => {
    switch (kind) {
      case 'intent': return 'var(--token-intent)';
      case 'entity': return 'var(--token-entity)';
      case 'constraint': return 'var(--token-constraint)';
      case 'risk': return 'var(--token-risk)';
      case 'confidence': return 'var(--token-confidence)';
      default: return 'var(--token-default)';
    }
  };

  const getTokenWeight = (weight?: number): string => {
    if (typeof weight !== 'number') return '0.15';
    const clamped = Math.max(0, Math.min(1, weight));
    return (0.15 + clamped * 0.35).toFixed(2);
  };

  const applyTokens = (nextTokens: GoalToken[], reason: 'update' | 'remove') => {
    if (reason === 'remove') {
      if (onRemove) {
        onRemove(nextTokens);
      } else {
        onUpdate?.(nextTokens);
      }
    } else {
      onUpdate?.(nextTokens);
    }
    if (!isControlled) {
      setLocalTokens(nextTokens);
    }
  };

  const startEdit = (index: number) => {
    const token = displayTokens[index];
    if (!token) return;
    setEditingIndex(index);
    setDraftToken({ ...token });
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setDraftToken(null);
  };

  const saveEdit = () => {
    if (editingIndex === null || !draftToken) return;
    const trimmed = draftToken.value.trim();
    if (!trimmed) return;
    const nextTokens = displayTokens.map((token, index) =>
      index === editingIndex ? { ...draftToken, value: trimmed } : token
    );
    applyTokens(nextTokens, 'update');
    cancelEdit();
  };

  const removeToken = (index: number) => {
    const nextTokens = displayTokens.filter((_, i) => i !== index);
    applyTokens(nextTokens, 'remove');
    if (editingIndex === index) {
      cancelEdit();
    }
  };

  const [dragOverIndex, setDragOverIndex] = React.useState<number | null>(null);

  const handleDragStart = (event: React.DragEvent<HTMLDivElement>, index: number) => {
    event.dataTransfer.setData('text/plain', index.toString());
    event.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault(); // Necessary to allow dropping
  };

  const handleDragEnter = (event: React.DragEvent<HTMLDivElement>, index: number) => {
    event.preventDefault();
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>, targetIndex: number) => {
    event.preventDefault();
    setDragOverIndex(null);
    const sourceIndex = parseInt(event.dataTransfer.getData('text/plain'));

    if (isNaN(sourceIndex) || sourceIndex === targetIndex) return;

    const reorderedTokens = [...displayTokens];
    const [movedToken] = reorderedTokens.splice(sourceIndex, 1);
    reorderedTokens.splice(targetIndex, 0, movedToken);

    applyTokens(reorderedTokens, 'update');
  };

  return (
    <div className="goal-tokens">
      <div className="goal-tokens-header">
        <h3>Goal</h3>
        <span className="goal-tokens-subtitle">Edit tokens to refine the capsule intent</span>
      </div>
      <div className="tokens-list">
        {displayTokens.length === 0 && (
          <div className="token-empty">No goal tokens yet</div>
        )}
        {displayTokens.map((token, index) => (
          <div
            key={`${token.kind}-${token.value}-${index}`}
            className={`token ${editingIndex === index ? 'editing' : ''} ${dragOverIndex === index ? 'drag-over' : ''}`}
            style={{
              '--token-color': getTokenColor(token.kind),
              '--token-weight': getTokenWeight(token.weight),
            } as React.CSSProperties}
            role="button"
            tabIndex={0}
            onClick={() => startEdit(index)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                startEdit(index);
              }
            }}
            draggable
            onDragStart={(event) => handleDragStart(event, index)}
            onDragOver={handleDragOver}
            onDragEnter={(event) => handleDragEnter(event, index)}
            onDragLeave={handleDragLeave}
            onDrop={(event) => handleDrop(event, index)}
            aria-label={`Edit ${token.kind} token`}
          >
            <span className="token-text">{token.value}</span>
            <span className="token-kind">{token.kind}</span>
            <button
              className="token-edit"
              onClick={(event) => {
                event.stopPropagation();
                startEdit(index);
              }}
              aria-label="Edit token"
              type="button"
            >
              ✏️
            </button>
            <button
              className="token-remove"
              onClick={(event) => {
                event.stopPropagation();
                removeToken(index);
              }}
              aria-label="Remove token"
              type="button"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      {editingIndex !== null && draftToken && (
        <div className="token-editor" role="dialog" aria-label="Edit goal token">
          <div className="token-editor-fields">
            <label className="token-editor-label">
              Value
              <input
                className="token-editor-input"
                value={draftToken.value}
                onChange={(event) => setDraftToken({ ...draftToken, value: event.target.value })}
              />
            </label>
            <label className="token-editor-label">
              Type
              <select
                className="token-editor-select"
                value={draftToken.kind}
                onChange={(event) =>
                  setDraftToken({ ...draftToken, kind: event.target.value as GoalTokenKind })
                }
              >
                {TOKEN_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {kind}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="token-editor-actions">
            <button className="token-editor-btn ghost" onClick={cancelEdit} type="button">
              Cancel
            </button>
            <button className="token-editor-btn primary" onClick={saveEdit} type="button">
              Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
