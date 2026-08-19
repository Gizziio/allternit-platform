import React, { useCallback, useState } from 'react';
import { getAgentCliIconPath } from '@/lib/agent-cli-icons';

export interface AgentCliIconProps {
  /** Agent CLI icon key (e.g. `claude`, `codex`, `kimi`). */
  icon: string;
  /** Render size in pixels. Defaults to 24. */
  size?: number;
  /** Additional CSS classes for the image element. */
  className?: string;
  /** Optional alt text for accessibility. */
  alt?: string;
}

/**
 * Renders an agent CLI icon as an `<img>` loaded from the public icon set.
 * Unknown icon keys fall back to the generic `default.svg` asset, and a broken
 * image also falls back to `default.svg` via `onError`.
 */
export function AgentCliIcon({
  icon,
  size = 24,
  className,
  alt,
}: AgentCliIconProps): React.ReactElement {
  const [src, setSrc] = useState<string>(getAgentCliIconPath(icon));

  const handleError = useCallback(() => {
    setSrc('/icons/agent-clis/default.svg');
  }, []);

  return (
    <img
      src={src}
      alt={alt ?? `${icon} agent CLI icon`}
      width={size}
      height={size}
      className={className}
      onError={handleError}
      style={{ display: 'block' }}
    />
  );
}
