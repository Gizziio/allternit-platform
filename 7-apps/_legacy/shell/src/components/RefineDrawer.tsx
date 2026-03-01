import * as React from 'react';
import { ActionDock } from './ActionDock';
import type { ActionSpec } from '../../../types/capsule-spec';
import type { TemplateSuggestion } from './TemplateSuggestions';

interface RefineDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  actions: ActionSpec[];
  templateSuggestions?: TemplateSuggestion[];
  activeTemplateType?: string | null;
  onTemplateSelect?: (capsuleType: string) => void;
  onActionClick?: (actionId: string, payload?: Record<string, unknown>) => void;
  onToggleConsole?: () => void;
}

export const RefineDrawer: React.FC<RefineDrawerProps> = ({
  isOpen,
  onClose,
  actions,
  templateSuggestions = [],
  activeTemplateType,
  onTemplateSelect,
  onActionClick,
  onToggleConsole,
}) => {
  return (
    <>
      {isOpen && <div className="drawer-backdrop drawer-backdrop-right" onClick={onClose} />}
      <div className={`refine-drawer ${isOpen ? 'open' : ''}`}>
        <div className="drawer-header">
          <h3>Refine & Actions</h3>
          <button className="drawer-close" onClick={onClose} type="button">
            ✕
          </button>
        </div>
        <div className="drawer-content">
          <ActionDock
            actions={actions}
            templateSuggestions={templateSuggestions}
            activeTemplateType={activeTemplateType}
            onTemplateSelect={onTemplateSelect}
            onActionClick={onActionClick}
            onToggleConsole={onToggleConsole}
          />
        </div>
      </div>
    </>
  );
};
