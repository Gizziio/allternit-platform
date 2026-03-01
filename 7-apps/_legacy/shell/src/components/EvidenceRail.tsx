import * as React from 'react';
import type { EvidenceObject } from '../../../types/capsule-spec';
import { SynthesisButton } from './SynthesisButton';
import { GoalTokens, GoalToken } from './GoalTokens';
import { TemplateSuggestions, TemplateSuggestion } from './TemplateSuggestions';

interface EvidenceRailProps {
  evidence: EvidenceObject[];
  onPinToggle?: (evidenceId: string) => void;
  onExclude?: (evidenceId: string) => void;
  onAddEvidence?: (input: string) => void;
  onSynthesize?: () => void;
  canSynthesize?: boolean;
  goalTokens?: GoalToken[];
  onGoalTokensUpdate?: (tokens: GoalToken[]) => void;
  onGoalTokensRemove?: (tokens: GoalToken[]) => void;
  templateSuggestions?: TemplateSuggestion[];
  selectedTemplateType?: string | null;
  recommendedTemplateType?: string | null;
  onTemplateSelect?: (capsuleType: string) => void;
  showGoalTools?: boolean;
  showSynthesize?: boolean;
  showComposer?: boolean;
  highlightEvidenceId?: string | null;
}

export const EvidenceRail: React.FC<EvidenceRailProps> = ({
  evidence,
  onPinToggle,
  onExclude,
  onAddEvidence,
  onSynthesize,
  canSynthesize,
  goalTokens = [],
  onGoalTokensUpdate,
  onGoalTokensRemove,
  templateSuggestions = [],
  selectedTemplateType,
  recommendedTemplateType,
  onTemplateSelect,
  showGoalTools = false,
  showSynthesize,
  showComposer = true,
  highlightEvidenceId,
}) => {
  const shouldShowSynthesize = showSynthesize ?? showGoalTools;
  const [draftEvidence, setDraftEvidence] = React.useState('');

  const submitEvidence = () => {
    const trimmed = draftEvidence.trim();
    if (!trimmed || !onAddEvidence) return;
    onAddEvidence(trimmed);
    setDraftEvidence('');
  };

  return (
    <div className="evidence-rail">
      <div className="evidence-rail-header">
        <h3>Evidence</h3>
      </div>
      {showGoalTools && (
        <div className="evidence-rail-goal">
          <GoalTokens
            tokens={goalTokens}
            onUpdate={onGoalTokensUpdate}
            onRemove={onGoalTokensRemove}
          />
          <TemplateSuggestions
            suggestions={templateSuggestions}
            activeType={selectedTemplateType}
            recommendedType={recommendedTemplateType}
            visible={showGoalTools}
            onSelect={onTemplateSelect}
          />
        </div>
      )}
      {showComposer && (
        <div className="evidence-composer">
          <input
            className="evidence-input"
            value={draftEvidence}
            onChange={(event) => setDraftEvidence(event.target.value)}
            placeholder="Add URL or quick note"
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                submitEvidence();
              }
            }}
          />
          <button className="evidence-add-btn" onClick={submitEvidence} type="button">
            Add
          </button>
        </div>
      )}
      <div className="evidence-list">
        {evidence.map((evidence) => (
          <EvidenceCard
            key={evidence.evidenceId}
            evidence={evidence}
            onPinToggle={onPinToggle}
            onExclude={onExclude}
            isHighlighted={highlightEvidenceId === evidence.evidenceId}
          />
        ))}
        {evidence.length === 0 && (
          <div className="evidence-empty">
            <p>No evidence added yet</p>
            <p className="evidence-empty-hint">Add URLs, documents, or artifacts to get started</p>
          </div>
        )}
      </div>
      {shouldShowSynthesize && onSynthesize && canSynthesize && (
        <SynthesisButton
          onSynthesize={onSynthesize}
          evidenceCount={evidence.length}
        />
      )}
    </div>
  );
};

interface EvidenceCardProps {
  evidence: EvidenceObject;
  onPinToggle?: (evidenceId: string) => void;
  onExclude?: (evidenceId: string) => void;
  isHighlighted?: boolean;
}

const EvidenceCard: React.FC<EvidenceCardProps> = ({ evidence, onPinToggle, onExclude, isHighlighted }) => {
  const getBadgeColor = (kind: string): string => {
    switch (kind) {
      case 'url': return 'info';
      case 'pdf': return 'warn';
      case 'diff': return 'danger';
      case 'testRun': return 'success';
      default: return 'neutral';
    }
  };

  const getFreshnessColor = (freshness: string): string => {
    return freshness === 'recent' ? '#10b981' : '#6b7280';
  };

  let uriLabel: string | null = null;
  let uriHref: string | null = null;

  if (evidence.uri) {
    try {
      const parsed = new URL(evidence.uri);
      uriLabel = parsed.hostname;
      uriHref = parsed.toString();
    } catch {
      uriLabel = evidence.uri;
    }
  }

  return (
    <div
      id={`evidence-${evidence.evidenceId}`}
      className={`evidence-card evidence-card-${evidence.extractionStatus} ${evidence.pinState === 'excluded' ? 'evidence-card-excluded' : ''} ${isHighlighted ? 'highlighted-section' : ''}`}
    >
      {evidence.extractionStatus === 'loading' && (
        <div className="evidence-shimmer" />
      )}
      {evidence.favicon && (
        <div className="evidence-favicon">
          <img src={evidence.favicon} alt="" />
        </div>
      )}
      <div className="evidence-content">
        <div className="evidence-header">
          <h4 className="evidence-title">{evidence.title}</h4>
          <div className="evidence-actions">
            <button
              className={`evidence-pin-btn ${evidence.pinState === 'pinned' ? 'pinned' : ''}`}
              onClick={() => onPinToggle?.(evidence.evidenceId)}
              aria-label={evidence.pinState === 'pinned' ? 'Unpin' : 'Pin'}
            >
              {evidence.pinState === 'pinned' ? '📌' : '📎'}
            </button>
            <button
              className="evidence-exclude-btn"
              onClick={() => onExclude?.(evidence.evidenceId)}
              aria-label={evidence.pinState === 'excluded' ? 'Restore' : 'Exclude'}
            >
              {evidence.pinState === 'excluded' ? '↩︎' : '✕'}
            </button>
          </div>
        </div>
        <div className="evidence-badges">
          <span className={`badge badge-${getBadgeColor(evidence.kind)}`}>
            {evidence.kind.toUpperCase()}
          </span>
          {evidence.extractionStatus !== 'loading' && (
            <>
              <span className="badge badge-neutral" style={{ color: getFreshnessColor(evidence.freshness) }}>
                {evidence.freshness === 'recent' ? '🟢' : '🟡'}
              </span>
              {evidence.confidence !== undefined && (
                <span className="badge badge-neutral">
                  {(evidence.confidence * 100).toFixed(0)}%
                </span>
              )}
            </>
          )}
        </div>
        {uriLabel && (
          uriHref ? (
            <a href={uriHref} target="_blank" rel="noopener noreferrer" className="evidence-uri">
              {uriLabel}
            </a>
          ) : (
            <span className="evidence-uri">{uriLabel}</span>
          )
        )}
      </div>
    </div>
  );
};
