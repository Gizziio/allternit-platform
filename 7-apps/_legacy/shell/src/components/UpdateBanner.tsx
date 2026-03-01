import * as React from 'react';

interface UpdateBannerProps {
  message: string;
  onClick?: () => void;
  isVisible?: boolean;
  onDismiss?: () => void;
}

export const UpdateBanner: React.FC<UpdateBannerProps> = ({
  message,
  onClick,
  isVisible = true,
  onDismiss,
}) => {
  if (!isVisible) {
    return null;
  }

  return (
    <div
      className="update-banner"
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick?.();
        }
      }}
      role="button"
      tabIndex={0}
    >
      <div className="update-banner-content">
        <span className="update-icon">📢</span>
        <span className="update-message">{message}</span>
      </div>
      <button
        className="update-banner-close"
        onClick={(event) => {
          event.stopPropagation();
          onDismiss?.();
        }}
        aria-label="Close"
        type="button"
      >
        ×
      </button>
    </div>
  );
};
