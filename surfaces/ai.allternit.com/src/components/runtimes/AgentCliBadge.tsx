import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { getAgentCliDisplayName } from '@/lib/agent-cli-icons';
import { AgentCliIcon } from './AgentCliIcon';

export interface AgentCliBadgeProps {
  /** Short agent or CLI name. */
  name: string;
  /** Agent CLI icon key. */
  icon: string;
  /** Render size in pixels. Defaults to 24. */
  size?: number;
  /** Additional CSS classes for the root chip element. */
  className?: string;
}

/**
 * Compact chip that displays an agent CLI icon alongside a short display name.
 * Built for the Allternit runtime board using dark-theme Tailwind tokens.
 */
export function AgentCliBadge({
  name,
  icon,
  size = 24,
  className,
}: AgentCliBadgeProps): React.ReactElement {
  const displayName = useMemo(() => getAgentCliDisplayName(icon) || name, [icon, name]);

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs',
        'bg-[#18181b] text-[#e5e5e5] border border-white/10',
        className
      )}
      title={displayName}
    >
      <AgentCliIcon icon={icon} size={size} className="shrink-0" />
      <span className="truncate max-w-[10ch]">{displayName}</span>
    </span>
  );
}
