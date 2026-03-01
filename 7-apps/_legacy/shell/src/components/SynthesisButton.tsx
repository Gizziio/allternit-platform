import * as React from 'react';

interface SynthesisButtonProps {
  onSynthesize: () => void;
  disabled?: boolean;
  evidenceCount?: number;
}

export const SynthesisButton: React.FC<SynthesisButtonProps> = ({
  onSynthesize,
  disabled = false,
  evidenceCount = 0,
}) => {
  const isReady = evidenceCount >= 2;

  return (
    <button
      className="synthesis-button"
      onClick={onSynthesize}
      disabled={disabled || !isReady}
      title={!isReady ? 'Add at least 2 evidence items to synthesize' : 'Generate capsule from evidence'}
    >
      <span className="synthesis-icon">✨</span>
      <span className="synthesis-label">Synthesize</span>
      {evidenceCount > 0 && (
        <span className="synthesis-count">({evidenceCount})</span>
      )}
    </button>
  );
};
