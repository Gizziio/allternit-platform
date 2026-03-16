/**
 * VM Controls Component
 * 
 * Buttons for controlling VM lifecycle (start, stop, restart).
 */

import React from 'react';

export interface VMControlsProps {
  isRunning: boolean;
  isStarting: boolean;
  isStopping: boolean;
  onStart: () => void;
  onStop: () => void;
  onRestart: () => void;
  disabled?: boolean;
}

export const VMControls: React.FC<VMControlsProps> = ({
  isRunning,
  isStarting,
  isStopping,
  onStart,
  onStop,
  onRestart,
  disabled = false,
}) => {
  return (
    <div className="vm-controls">
      {!isRunning ? (
        <button
          className="vm-button start"
          onClick={onStart}
          disabled={disabled || isStarting}
        >
          {isStarting ? (
            <>
              <span className="spinner" />
              Starting...
            </>
          ) : (
            <>
              <span className="icon">▶️</span>
              Start VM
            </>
          )}
        </button>
      ) : (
        <button
          className="vm-button stop"
          onClick={onStop}
          disabled={isStopping}
        >
          {isStopping ? (
            <>
              <span className="spinner" />
              Stopping...
            </>
          ) : (
            <>
              <span className="icon">⏹️</span>
              Stop VM
            </>
          )}
        </button>
      )}

      <button
        className="vm-button restart"
        onClick={onRestart}
        disabled={disabled || isStarting || isStopping || !isRunning}
      >
        <span className="icon">🔄</span>
        Restart
      </button>
    </div>
  );
};

export default VMControls;
