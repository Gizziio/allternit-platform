import React from 'react';
import { Suggestion } from '../../shared/contracts';

interface Props {
  suggestions: Suggestion[];
}

export const SuggestionWidget: React.FC<Props> = ({ suggestions }) => {
  if (suggestions.length === 0) return null;

  return (
    <div className="suggestion-widget">
      <div className="widget-header">
        <h4>Suggestions</h4>
        <span className="badge">{suggestions.length}</span>
      </div>
      <div className="suggestion-list">
        {suggestions.map(s => (
          <div key={s.id} className={`suggestion-item ${s.priority}`}>
            <h5>{s.title}</h5>
            <p>{s.description}</p>
            <button className="btn-action">Act</button>
          </div>
        ))}
      </div>
    </div>
  );
};
