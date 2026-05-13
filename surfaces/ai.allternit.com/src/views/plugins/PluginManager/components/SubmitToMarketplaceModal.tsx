import React from 'react';

interface SubmitToMarketplaceModalProps {
  onClose: () => void;
  onSubmit: () => void;
  showInfo?: boolean;
}

export const SubmitToMarketplaceModal: React.FC<SubmitToMarketplaceModalProps> = ({
  onClose,
  onSubmit,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-[var(--surface-panel)] rounded-xl p-6 max-w-md w-full mx-4">
        <h2 className="text-lg font-semibold mb-4">Submit to Marketplace</h2>
        <p className="text-sm text-[var(--text-secondary)] mb-6">
          Marketplace submission is temporarily unavailable.
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg bg-[var(--surface-hover)] hover:bg-[var(--ui-border-muted)] transition-colors"
          >
            Close
          </button>
          <button
            onClick={onSubmit}
            className="px-4 py-2 text-sm rounded-lg bg-[var(--accent-primary)] text-white hover:opacity-90 transition-opacity"
          >
            Submit
          </button>
        </div>
      </div>
    </div>
  );
};
