import * as React from 'react';
import type { CapsuleInstance } from '../../../shared/contracts';

interface TabBarProps {
  capsules: CapsuleInstance[];
  activeCapsuleId?: string | null;
  onActivate: (capsuleId: string) => void;
  onClose: (capsuleId: string) => void;
}

export const TabBar: React.FC<TabBarProps> = ({
  capsules,
  activeCapsuleId,
  onActivate,
  onClose,
}) => {
  return (
    <div className="ax-tabs">
      {capsules.map((capsule) => {
        let prefix = '';
        if (capsule.persistenceMode === 'pinned') prefix = '📌 ';
        if (capsule.persistenceMode === 'docked') prefix = '⚓ ';

        return (
          <button
            key={capsule.capsuleId}
            className={`ax-tab${capsule.capsuleId === activeCapsuleId ? ' ax-tab-active' : ''}`}
            onClick={() => onActivate(capsule.capsuleId)}
            type="button"
          >
            {prefix}
            {capsule.title}
            <span
              className="ax-tab-close"
              onClick={(event) => {
                event.stopPropagation();
                onClose(capsule.capsuleId);
              }}
              role="presentation"
            >
              ×
            </span>
          </button>
        );
      })}
    </div>
  );
};
