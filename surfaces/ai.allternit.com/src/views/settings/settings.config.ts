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
  SlidersHorizontal,
  Lock,
  Sparkle,
  PlugsConnected,
  Package,
  DeviceMobile,
  Devices,
  CloudArrowUp,
  Buildings,
  ChatCircleText,
  Database,
  Image,
  FilmStrip,
} from '@phosphor-icons/react';

export type SettingsGroup = 'account' | 'platform' | 'products' | 'infrastructure' | 'customize' | 'about';

export interface SettingsNavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  group: SettingsGroup;
}

export const SETTINGS_NAV_ITEMS: SettingsNavItem[] = [
  { id: 'signin', label: 'Account', icon: React.createElement(User, { size: 18 }), group: 'account' },
  { id: 'organization', label: 'Organization & access', icon: React.createElement(Buildings, { size: 18 }), group: 'account' },
  { id: 'usage', label: 'Usage', icon: React.createElement(CreditCard, { size: 18 }), group: 'account' },
  { id: 'billing', label: 'Plans & compute', icon: React.createElement(CreditCard, { size: 18 }), group: 'account' },
  { id: 'privacy', label: 'Privacy', icon: React.createElement(Lock, { size: 18 }), group: 'account' },
  { id: 'general', label: 'General', icon: React.createElement(GearSix, { size: 18 }), group: 'platform' },
  { id: 'appearance', label: 'Appearance', icon: React.createElement(Palette, { size: 18 }), group: 'platform' },
  { id: 'models', label: 'Models', icon: React.createElement(Cpu, { size: 18 }), group: 'platform' },
  { id: 'image-providers', label: 'Image providers', icon: React.createElement(Image, { size: 18 }), group: 'platform' },
  { id: 'video-providers', label: 'Video providers', icon: React.createElement(FilmStrip, { size: 18 }), group: 'platform' },
  { id: 'api-keys', label: 'API Keys', icon: React.createElement(Key, { size: 18 }), group: 'platform' },
  { id: 'shortcuts', label: 'Shortcuts', icon: React.createElement(Keyboard, { size: 18 }), group: 'platform' },
  { id: 'permissions', label: 'Permissions', icon: React.createElement(ShieldCheck, { size: 18 }), group: 'platform' },
  { id: 'dispatch', label: 'Dispatch', icon: React.createElement(DeviceMobile, { size: 18 }), group: 'platform' },
  { id: 'devices', label: 'Devices', icon: React.createElement(Devices, { size: 18 }), group: 'platform' },
  { id: 'cloud-instances', label: 'Cloud instances', icon: React.createElement(CloudArrowUp, { size: 18 }), group: 'platform' },
  { id: 'diagnostics', label: 'Diagnostics', icon: React.createElement(Activity, { size: 18 }), group: 'platform' },
  { id: 'gizziio-code', label: 'Gizziio Code', icon: React.createElement(Code, { size: 18 }), group: 'products' },
  { id: 'cowork', label: 'Cowork', icon: React.createElement(Briefcase, { size: 18 }), group: 'products' },
  { id: 'extensions', label: 'Extensions', icon: React.createElement(PuzzlePiece, { size: 18 }), group: 'products' },
  { id: 'infrastructure', label: 'Infrastructure', icon: React.createElement(Cloud, { size: 18 }), group: 'infrastructure' },
  { id: 'vps', label: 'VPS & servers', icon: React.createElement(HardDrives, { size: 18 }), group: 'infrastructure' },
  { id: 'cloud-credentials', label: 'Enterprise BYOC', icon: React.createElement(Cloud, { size: 18 }), group: 'infrastructure' },
  { id: 'environment', label: 'Environment', icon: React.createElement(SlidersHorizontal, { size: 18 }), group: 'infrastructure' },
  { id: 'security', label: 'Security', icon: React.createElement(Shield, { size: 18 }), group: 'infrastructure' },
  { id: 'agents', label: 'Agents', icon: React.createElement(Robot, { size: 18 }), group: 'infrastructure' },
  { id: 'skills', label: 'Skills', icon: React.createElement(Sparkle, { size: 18 }), group: 'customize' },
  { id: 'response-style', label: 'Response style', icon: React.createElement(ChatCircleText, { size: 18 }), group: 'customize' },
  { id: 'connectors', label: 'Connectors', icon: React.createElement(PlugsConnected, { size: 18 }), group: 'customize' },
  { id: 'lens', label: 'Lens Context', icon: React.createElement(Database, { size: 18 }), group: 'customize' },
  { id: 'plugins', label: 'Allternit Plugins', icon: React.createElement(Package, { size: 18 }), group: 'customize' },
  { id: 'about', label: 'About', icon: React.createElement(Info, { size: 18 }), group: 'about' },
];

/**
 * Derive the union type from the nav items array.
 * This ensures the type stays in sync with the config.
 */
export type SettingsSection = typeof SETTINGS_NAV_ITEMS[number]['id'];

export interface SettingsNavGroup {
  group: SettingsGroup;
  /** Sentence-case sidebar label; null renders the group without a label. */
  label: string | null;
}

/**
 * Sidebar group order + labels. Keeps `SETTINGS_NAV_ITEMS` as the single
 * source of truth for items while centralizing group presentation.
 */
export const SETTINGS_NAV_GROUPS: SettingsNavGroup[] = [
  { group: 'account', label: 'Account' },
  { group: 'platform', label: 'Platform' },
  { group: 'products', label: 'Products' },
  { group: 'infrastructure', label: 'Infrastructure' },
  { group: 'customize', label: 'Customize' },
  { group: 'about', label: null },
];

/**
 * Valid section IDs as a runtime Set for O(1) lookups.
 */
const SETTINGS_SECTION_IDS: Set<string> = new Set(
  SETTINGS_NAV_ITEMS.map((i) => i.id)
);

/**
 * Build the event-to-section map dynamically from the config.
 * This eliminates the manual Record that used to drift out of sync.
 */
export const SETTINGS_SECTION_MAP: Record<string, SettingsSection> =
  Object.fromEntries(SETTINGS_NAV_ITEMS.map((i) => [i.id, i.id]));
