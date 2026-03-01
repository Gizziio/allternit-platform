/**
 * Avatar Components
 *
 * Visual representation of agent state using A2R Visual State Protocol (AVSP).
 *
 * @example
 * ```tsx
 * import { Avatar, AvatarDisplay } from './Avatar';
 * import { Mood } from '@a2r/visual-state';
 *
 * // Low-level Avatar component
 * <Avatar
 *   visualState={{
 *     mood: Mood.Thinking,
 *     intensity: 7,
 *     confidence: 0.8,
 *     reliability: 0.9,
 *     timestamp: new Date(),
 *     source: 'task_processor',
 *   }}
 *   size="lg"
 *   animate
 * />
 *
 * // High-level AvatarDisplay (recommended)
 * <AvatarDisplay agentId="agent-123" size="lg" showLabel />
 * ```
 */

export { Avatar } from './Avatar';
export type { AvatarProps } from './Avatar';

export { AvatarDisplay, AvatarDisplayInline } from './AvatarDisplay';
export type { AvatarDisplayProps, AvatarDisplayInlineProps } from './AvatarDisplay';

export { default } from './Avatar';
