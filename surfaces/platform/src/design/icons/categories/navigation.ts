/**
 * Navigation Icons
 * 
 * Icons for navigation, wayfinding, and directional UI elements.
 * 
 * @module @allternit/platform/icons/categories/navigation
 */

export const navigationIcons = [
  'home',
  'dashboard',
  'settings',
  'profile',
  'menu',
  'close',
  'back',
  'forward',
  'chevron-up',
  'chevron-down',
  'chevron-left',
  'chevron-right',
  'arrow-up',
  'arrow-down',
  'arrow-left',
  'arrow-right',
  'navigation',
  'sidebar',
  'fullscreen',
  'exit-fullscreen',
  'external-link',
] as const;

export type NavigationIcon = typeof navigationIcons[number];
