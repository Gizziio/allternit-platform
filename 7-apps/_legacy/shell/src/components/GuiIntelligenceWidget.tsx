import React, { useState } from 'react';
import type { ActionProposal } from '../../../shared/contracts';

interface GuiIntelligenceWidgetProps {
  proposals: ActionProposal[];
  reasoning?: string; // Added reasoning
  onProposalClick: (proposal: ActionProposal) => void;
  onProposalHover?: (proposal: ActionProposal | null) => void;
  onProposeRequested: (task: string) => void;
  isVisible: boolean;
}

export const GuiIntelligenceWidget: React.FC<GuiIntelligenceWidgetProps> = ({
  proposals,
  reasoning,
  onProposalClick,
  onProposalHover,
  onProposeRequested,
  isVisible,
}) => {
  const [task, setTask] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  if (!isVisible) return null;

  return (
    <div className={`gui-intelligence-widget ${isOpen ? 'open' : 'closed'}`}>
      <div className="widget-header" onClick={() => setIsOpen(!isOpen)}>
        <span className="widget-icon">🤖</span>
        <span className="widget-title">GUI Intelligence</span>
        <span className="widget-toggle">{isOpen ? '▼' : '▲'}</span>
      </div>
      
      {isOpen && (
        <div className="widget-body">
          <div className="proposal-history">
            {proposals.length === 0 ? (
              <div className="no-proposals">Describe a task to get GUI action proposals.</div>
            ) : (
              <div className="proposals-list">
                {reasoning && (
                  <div className="proposal-reasoning">
                    <strong>Reasoning:</strong> {reasoning}
                  </div>
                )}
                <div className="proposal-separator">Suggested Actions</div>
                {proposals.map((proposal, index) => (
                  <div 
                    key={index} 
                    className="proposal-item" 
                    onClick={() => onProposalClick(proposal)}
                    onMouseEnter={() => onProposalHover?.(proposal)}
                    onMouseLeave={() => onProposalHover?.(null)}
                  >
                    <div className="proposal-desc">{proposal.description}</div>
                    <div className="proposal-meta">
                      <span className="proposal-type">{proposal.type}</span>
                      <button className="execute-link">Approve & Execute</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <div className="widget-footer">
            <input 
              type="text" 
              placeholder="How can I help with the GUI?" 
              value={task}
              onChange={(e) => setTask(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && task.trim()) {
                  onProposeRequested(task);
                  setTask('');
                }
              }}
            />
            <button 
              onClick={() => {
                if (task.trim()) {
                  onProposeRequested(task);
                  setTask('');
                }
              }}
              disabled={!task.trim()}
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
