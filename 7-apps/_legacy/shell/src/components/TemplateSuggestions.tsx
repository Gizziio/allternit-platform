import * as React from 'react';
import { SnapZone } from './SnapZone';

export interface TemplateSuggestion {
  label: string;
  capsuleType: string;
  icon: string;
}

interface TemplateSuggestionsProps {
  suggestions: TemplateSuggestion[];
  activeType?: string | null;
  recommendedType?: string | null;
  visible?: boolean;
  onSelect?: (capsuleType: string) => void;
}

export const TemplateSuggestions: React.FC<TemplateSuggestionsProps> = ({
  suggestions,
  activeType,
  recommendedType,
  visible = true,
  onSelect,
}) => {
  if (!visible || suggestions.length === 0) {
    return null;
  }

  return (
    <div className="template-suggestions">
      <div className="template-suggestions-header">
        <h4>Template Suggestions</h4>
        <span className="template-suggestions-hint">Snap or click to refine</span>
      </div>
      <div className="template-suggestions-row">
        {suggestions.map((template) => (
          <SnapZone
            key={template.capsuleType}
            label={template.label}
            capsuleType={template.capsuleType}
            icon={template.icon}
            active={template.capsuleType === activeType}
            recommended={template.capsuleType === recommendedType}
            onActivate={onSelect}
          />
        ))}
      </div>
    </div>
  );
};
