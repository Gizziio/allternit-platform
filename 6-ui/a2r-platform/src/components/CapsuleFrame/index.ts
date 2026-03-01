/**
 * CapsuleFrame Component
 * 
 * Hardened iframe container for interactive capsules (MCP Apps).
 * Provides sandboxed execution with bidirectional postMessage bridge.
 * 
 * @example
 * ```tsx
 * <CapsuleFrame
 *   capsuleId="capsule-123"
 *   surface={{
 *     html: '<div>Hello World</div>',
 *     permissions: [{ permission_type: 'invoke_tools', resource: '*' }]
 *   }}
 *   onEvent={(e) => console.log('Event:', e)}
 *   onToolInvoke={(tool, params) => console.log('Invoke:', tool, params)}
 * />
 * ```
 */

export { CapsuleFrame } from './CapsuleFrame';
export type {
  CapsuleFrameProps,
  ToolUISurface,
  CapsulePermission,
  CapsuleEvent,
} from './CapsuleFrame';

export { default } from './CapsuleFrame';
