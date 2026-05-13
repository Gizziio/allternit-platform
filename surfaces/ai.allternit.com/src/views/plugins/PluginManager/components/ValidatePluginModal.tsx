import React from 'react';

interface ValidatePluginModalProps {
  onClose: () => void;
  onValidate: () => void;
}

export const ValidatePluginModal: React.FC<ValidatePluginModalProps> = ({
  onClose,
  onValidate,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-[var(--surface-panel)] rounded-xl p-6 max-w-md w-full mx-4">
        <h2 className="text-lg font-semibold mb-4">Validate Plugin</h2>
        <p className="text-sm text-[var(--text-secondary)] mb-6">
          Plugin validation is temporarily unavailable.
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg bg-[var(--surface-hover)] hover:bg-[var(--ui-border-muted)] transition-colors"
          >
            Close
          </button>
          <button
            onClick={onValidate}
            className="px-4 py-2 text-sm rounded-lg bg-[var(--accent-primary)] text-white hover:opacity-90 transition-opacity"
          >
            Validate
          </button>
        </div>
      </div>
    </div>
  );
};
