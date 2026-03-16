/**
 * Status Icons
 * 
 * Icons for status indication, feedback, and alerts.
 * 
 * @module @a2r/platform/icons/categories/status
 */

export const statusIcons = [
  'success',
  'error',
  'warning',
  'info',
  'loading',
  'pending',
  'check',
  'check-circle',
  'x',
  'x-circle',
  'alert',
  'alert-triangle',
  'alert-circle',
  'help',
  'help-circle',
  'question',
  'question-circle',
  'clock',
  'history',
  'timer',
  'verified',
  'shield',
  'shield-check',
  'lock',
  'unlock',
] as const;

export type StatusIcon = typeof statusIcons[number];
