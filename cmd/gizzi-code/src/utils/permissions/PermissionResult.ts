/**
 * Permission Result Types
 */

export type PermissionResult = 
  | { type: 'allowed' }
  | { type: 'denied'; reason: string }
  | { type: 'pending' }

export const PermissionResult = {
  allowed: (): PermissionResult => ({ type: 'allowed' }),
  denied: (reason: string): PermissionResult => ({ type: 'denied', reason }),
  pending: (): PermissionResult => ({ type: 'pending' }),
}
