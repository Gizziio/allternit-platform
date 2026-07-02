import React from "react";

export const OllamaWarning = ({ 
  isLocalBrainSelected, 
  ollamaRunning, 
  startSelection 
}: { 
  isLocalBrainSelected: boolean, 
  ollamaRunning: boolean, 
  startSelection: () => void 
}) => {
  if (!(isLocalBrainSelected && !ollamaRunning)) return null;

  return (
    <div className="absolute bottom-20 left-0 right-0 flex justify-center px-5 z-[41] pointer-events-none">
      <div className="max-w-[640px] w-full p-[9px_14px] rounded-[10px] flex items-center gap-2.5 border border-solid border-[color-mix(in_srgb,#f59e0b_30%,transparent)] bg-[color-mix(in_srgb,#f59e0b_10%,var(--surface-panel,var(--bg-secondary)))] pointer-events-auto">
        <span className="text-[13px]">⚠️</span>
        <span className="text-[12px] text-[var(--ui-text-primary,var(--text-primary))]">
          <strong>Local Brain is offline.</strong> Make sure Ollama is running, then{' '}
          <button type="button"
            onClick={() => { window.dispatchEvent(new Event('focus')); }}
            className="bg-transparent border-none cursor-pointer text-[var(--accent-chat)] text-[12px] font-semibold p-0 underline"
          >
            retry
          </button>
          {' '}or{' '}
          <button type="button"
            onClick={startSelection}
            className="bg-transparent border-none cursor-pointer text-[var(--accent-chat)] text-[12px] font-semibold p-0 underline"
          >
            switch model
          </button>.
        </span>
      </div>
    </div>
  );
};
