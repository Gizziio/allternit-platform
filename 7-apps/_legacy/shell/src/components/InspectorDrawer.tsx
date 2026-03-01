import * as React from 'react';
import { EvidenceRail } from './EvidenceRail';
import type { EvidenceObject } from '../../../types/capsule-spec';
import type { GoalToken } from './GoalTokens';
import type { TemplateSuggestion } from './TemplateSuggestions';

interface InspectorDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  evidence: EvidenceObject[];
  onPinToggle?: (evidenceId: string) => void;
  onExclude?: (evidenceId: string) => void;
  onAddEvidence?: (input: string) => void;
  onObserve?: () => void;
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
  highlightEvidenceId?: string | null;
}

export const InspectorDrawer: React.FC<InspectorDrawerProps> = ({
  isOpen,
  onClose,
  evidence,
  ...evidenceRailProps
}) => {
  const [showContent, setShowContent] = React.useState(false);

  // Delay content render for animation
  React.useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => setShowContent(true), 100);
      return () => clearTimeout(timer);
    } else {
      setShowContent(false);
    }
  }, [isOpen]);

  return (
    <>
      {isOpen && <div className="drawer-backdrop" onClick={onClose} />}
      <div className={`inspector-drawer ${isOpen ? 'open' : ''}`}>
        <div className="drawer-header">
          <div className="drawer-header-left">
            <span className="drawer-status-dot" />
            <h3>Chat</h3>
          </div>
          <div className="drawer-header-right">
            {evidence.length > 0 && (
              <span className="drawer-badge">{evidence.length} sources</span>
            )}
            <button className="drawer-close" onClick={onClose} type="button">
              ✕
            </button>
          </div>
        </div>
        <div className={`drawer-content ${showContent ? 'visible' : ''}`}>
          <EvidenceRail
            evidence={evidence}
            {...evidenceRailProps}
            showComposer
          />
        </div>
      </div>
    </>
  );
};
