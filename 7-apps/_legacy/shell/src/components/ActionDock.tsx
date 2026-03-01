import * as React from 'react';
import type { ActionSpec } from '../../../types/capsule-spec';
import { SnapZone } from './SnapZone';
import type { TemplateSuggestion } from './TemplateSuggestions';

interface ActionDockProps {
  actions: ActionSpec[];
  onActionClick?: (actionId: string) => void;
  templateSuggestions?: TemplateSuggestion[];
  activeTemplateType?: string | null;
  onTemplateSelect?: (capsuleType: string) => void;
  onToggleConsole?: () => void;
}

export const ActionDock: React.FC<ActionDockProps> = ({
  actions,
  onActionClick,
  templateSuggestions = [],
  activeTemplateType,
  onTemplateSelect,
  onToggleConsole,
}) => {
  return (
    <div className="action-dock">
      {templateSuggestions.length > 0 && (
        <div className="action-dock-section">
          <h4 className="action-dock-title">Refine Capsule</h4>
          <div className="template-chips">
            {templateSuggestions.map((template) => (
              <SnapZone
                key={template.capsuleType}
                label={template.label}
                capsuleType={template.capsuleType}
                icon={template.icon}
                active={template.capsuleType === activeTemplateType}
                onActivate={onTemplateSelect}
              />
            ))}
          </div>
        </div>
      )}

      {actions.length > 0 && (
        <div className="action-dock-section">
          <h4 className="action-dock-title">Suggested Actions</h4>
          <div className="action-list">
            {actions.map((action) => {
              const getActionVariant = (tier: string): string => {
                switch (tier) {
                  case 'read': return 'primary';
                  case 'write': return 'secondary';
                  case 'exec': return 'danger';
                  case 'danger': return 'danger';
                  default: return 'ghost';
                }
              };

              return (
                <button
                  key={action.actionId}
                  className={`action-btn action-btn-${getActionVariant(action.safetyTier)}`}
                  onClick={() => onActionClick?.(action.actionId)}
                  type="button"
                >
                  <span className="action-label">{action.label}</span>
                  <span className="action-tier" title={`Safety tier: ${action.safetyTier}`}>
                    {action.safetyTier}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Console Access Button */}
      <div className="action-dock-section">
        <h4 className="action-dock-title">Utilities</h4>
        <div className="action-list">
          <button
            className="action-btn action-btn-primary"
            onClick={onToggleConsole}
            type="button"
          >
            <span className="action-label">Terminal</span>
            <span className="action-tier" title="Access terminal console">CLI</span>
          </button>
        </div>
      </div>
    </div>
  );
};
