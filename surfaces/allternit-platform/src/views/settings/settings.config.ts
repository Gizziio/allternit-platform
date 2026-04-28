/**
 * Settings Configuration
 *
 * Central source of truth for settings sections. Adding a new section
 * requires only one change: adding an entry to `SETTINGS_NAV_ITEMS`.
 *
 * The SettingsSection type is derived from the nav items array,
 * so TypeScript will enforce that all section references are valid.
 */

import React from 'react';
import {
  User,
  CreditCard,
  GearSix,
  Palette,
  Cpu,
  Key,
  Keyboard,
  ShieldCheck,
  Pulse as Activity,
  Code,
  Briefcase,
  PuzzlePiece,
  Cloud,
  HardDrives,
  Shield,
  Robot,
  Info,
} from '@phosphor-icons/react';

export type SettingsGroup = 'account' | 'platform' | 'products' | 'infrastructure' | 'about';

export interface SettingsNavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  group: SettingsGroup;
}

export const SETTINGS_NAV_ITEMS: SettingsNavItem[] = [
  { id: 'signin', label: 'Account', icon: React.createElement(User, { size: 18 }), group: 'account' },
  { id: 'usage', label: 'Usage', icon: React.createElement(CreditCard, { size: 18 }), group: 'account' },
  { id: 'billing', label: 'Billing', icon: React.createElement(CreditCard, { size: 18 }), group: 'account' },
  { id: 'general', label: 'General', icon: React.createElement(GearSix, { size: 18 }), group: 'platform' },
  { id: 'appearance', label: 'Appearance', icon: React.createElement(Palette, { size: 18 }), group: 'platform' },
  { id: 'models', label: 'Models', icon: React.createElement(Cpu, { size: 18 }), group: 'platform' },
  { id: 'api-keys', label: 'API Keys', icon: React.createElement(Key, { size: 18 }), group: 'platform' },
  { id: 'shortcuts', label: 'Shortcuts', icon: React.createElement(Keyboard, { size: 18 }), group: 'platform' },
  { id: 'permissions', label: 'Permissions', icon: React.createElement(ShieldCheck, { size: 18 }), group: 'platform' },
  { id: 'diagnostics', label: 'Diagnostics', icon: React.createElement(Activity, { size: 18 }), group: 'platform' },
  { id: 'gizziio-code', label: 'Gizziio Code', icon: React.createElement(Code, { size: 18 }), group: 'products' },
  { id: 'cowork', label: 'Cowork', icon: React.createElement(Briefcase, { size: 18 }), group: 'products' },
  { id: 'extensions', label: 'Extensions', icon: React.createElement(PuzzlePiece, { size: 18 }), group: 'products' },
  { id: 'infrastructure', label: 'Infrastructure', icon: React.createElement(Cloud, { size: 18 }), group: 'infrastructure' },
  { id: 'vps', label: 'VPS Connections', icon: React.createElement(HardDrives, { size: 18 }), group: 'infrastructure' },
  { id: 'security', label: 'Security', icon: React.createElement(Shield, { size: 18 }), group: 'infrastructure' },
  { id: 'agents', label: 'Agents', icon: React.createElement(Robot, { size: 18 }), group: 'infrastructure' },
  { id: 'about', label: 'About', icon: React.createElement(Info, { size: 18 }), group: 'about' },
];

/**
 * Derive the union type from the nav items array.
 * This ensures the type stays in sync with the config.
 */
export type SettingsSection = typeof SETTINGS_NAV_ITEMS[number]['id'];

/**
 * Valid section IDs as a runtime Set for O(1) lookups.
 */
export const SETTINGS_SECTION_IDS: Set<string> = new Set(
  SETTINGS_NAV_ITEMS.map((i) => i.id)
);

/**
 * Build the event-to-section map dynamically from the config.
 * This eliminates the manual Record that used to drift out of sync.
 */
export const SETTINGS_SECTION_MAP: Record<string, SettingsSection> =
  Object.fromEntries(SETTINGS_NAV_ITEMS.map((i) => [i.id, i.id]));
