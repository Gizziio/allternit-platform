import React from "react";

export const SendErrorBanner = ({
  message,
  onDismiss,
}: {
  message: string | null;
  onDismiss: () => void;
}) => {
  if (!message) return null;

  return (
    <div className="absolute bottom-20 left-0 right-0 flex justify-center px-5 z-[41] pointer-events-none">
      <div className="max-w-[640px] w-full p-[9px_14px] rounded-[10px] flex items-center gap-2.5 border border-solid border-[color-mix(in_srgb,var(--status-error)_30%,transparent)] bg-[color-mix(in_srgb,var(--status-error)_10%,var(--surface-panel,var(--bg-secondary)))] pointer-events-auto">
        <span className="text-[13px]">⚠️</span>
        <span className="text-[12px] text-[var(--ui-text-primary,var(--text-primary))] flex-1">
          {message}
        </span>
        <button type="button"
          onClick={onDismiss}
          className="bg-transparent border-none cursor-pointer text-[var(--accent-chat)] text-[12px] font-semibold p-0 underline shrink-0"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
};
