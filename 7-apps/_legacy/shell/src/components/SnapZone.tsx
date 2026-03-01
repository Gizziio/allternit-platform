import * as React from 'react';

interface SnapZoneProps {
  label: string;
  capsuleType: string;
  icon: string;
  recommended?: boolean;
  active?: boolean;
  disabled?: boolean;
  onActivate?: (capsuleType: string) => void;
}

export const SnapZone: React.FC<SnapZoneProps> = ({
  label,
  capsuleType,
  icon,
  recommended = false,
  active = false,
  disabled = false,
  onActivate,
}) => {
  return (
    <button
      className={`snap-zone ${recommended ? 'recommended' : ''} ${active ? 'active' : ''}`}
      onClick={() => onActivate?.(capsuleType)}
      aria-label={`Apply ${label} template`}
      aria-pressed={active}
      disabled={disabled}
      type="button"
    >
      <span className="snap-zone-icon">{icon}</span>
      <span className="snap-zone-label">{label}</span>
      {recommended && <span className="recommended-badge">Recommended</span>}
    </button>
  );
};
