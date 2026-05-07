import type { Icon as PhosphorIcon } from '@phosphor-icons/react';

/**
 * Unified icon type that accepts both Phosphor Icons (ForwardRefExoticComponent)
 * and custom icon components (ComponentType).
 */
export type ShellIcon = PhosphorIcon | React.ComponentType<{ size?: number | string; weight?: string; color?: string }>;
