import React from 'react';

interface SynthesisScaffoldProps {
  goal?: string;
  isSynthesizing: boolean;
}

export const SynthesisScaffold: React.FC<SynthesisScaffoldProps> = ({ goal, isSynthesizing }) => {
  return (
    <div className="synthesis-scaffold">
      <div className="scaffold-background">
        <div className="mesh-gradient"></div>
      </div>
      <div className="scaffold-content">
        {isSynthesizing ? (
          <div className="synthesis-active">
            <div className="spinner-orb"></div>
            <h2 className="animate-pulse">Synthesizing Capsule...</h2>
            <p className="scaffold-goalVerbatim">"{goal || 'Unstructured Intent'}"</p>
            <div className="synthesis-steps">
              <div className="step-item active">Analyzing Evidence...</div>
              <div className="step-item">Routing to Framework...</div>
              <div className="step-item">Compiling A2UI Payload...</div>
            </div>
          </div>
        ) : (
          <div className="synthesis-idle">
            <div className="intent-anchor">
              <span className="anchor-icon">✨</span>
              <h2>Ready to Materialize</h2>
              <p>Enter your goal and gather evidence to begin synthesis.</p>
            </div>
            <div className="skeleton-grid">
              <div className="skeleton-card"></div>
              <div className="skeleton-card"></div>
              <div className="skeleton-card"></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
