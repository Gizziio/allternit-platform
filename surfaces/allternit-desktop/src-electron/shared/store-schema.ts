/**
 * Store Schema Definitions
 *
 * Type-safe schema for electron-store with validation helpers.
 * All store keys must be defined here for security and consistency.
 */

/**
 * Notification category settings
 */
export interface NotificationCategorySettings {
  message: boolean;
  workflow: boolean;
  'agent-mail': boolean;
  system: boolean;
  update: boolean;
}

/**
 * Notification settings structure
 */
export interface NotificationSettings {
  enabled: boolean;
  soundEnabled: boolean;
  doNotDisturb: boolean;
  categorySettings: NotificationCategorySettings;
}

/**
 * Window bounds structure
 */
export interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Theme options
 */
export type ThemeMode = 'dark' | 'light' | 'system';

/**
 * User preferences structure
 */
export interface UserPreferences {
  language?: string;
  fontSize?: number;
  reduceMotion?: boolean;
  [key: string]: unknown;
}

/**
 * Update channel type
 */
export type UpdateChannel = 'stable' | 'beta' | 'alpha';

/**
 * Update strategy type
 */
export type UpdateStrategy = 'silent' | 'prompt' | 'force';

/**
 * Complete store schema interface
 * All stored values must conform to this structure
 */
export interface StoreSchema {
  'window.bounds': WindowBounds;
  'window.fullscreen': boolean;
  'window.maximized': boolean;
  'app.theme': ThemeMode;
  'app.lastSessionId': string | null;
  'app.launchCount': number;
  'notifications.enabled': boolean;
  'notifications.soundEnabled': boolean;
  'notifications.doNotDisturb': boolean;
  'notifications.categorySettings': NotificationCategorySettings;
  'user.preferences': UserPreferences;
  'updates.autoCheck': boolean;
  'updates.autoDownload': boolean;
  'updates.channel': UpdateChannel;
  'updates.strategy': UpdateStrategy;
  'updates.skipVersion': string | null;
}

/**
 * Default notification category settings
 */
const DEFAULT_CATEGORY_SETTINGS: NotificationCategorySettings = {
  message: true,
  workflow: true,
  'agent-mail': true,
  system: true,
  update: true,
};

/**
 * Default notification settings
 */
const DEFAULT_NOTIFICATION_SETTINGS = {
  'notifications.enabled': true,
  'notifications.soundEnabled': true,
  'notifications.doNotDisturb': false,
  'notifications.categorySettings': DEFAULT_CATEGORY_SETTINGS,
};

/**
 * Store key type - union of all valid store keys
 */
export type StoreKey = keyof StoreSchema;

/**
 * Default values for all store keys
 */
export const STORE_DEFAULTS: { [K in StoreKey]: StoreSchema[K] } = {
  'window.bounds': { x: 0, y: 0, width: 1200, height: 800 },
  'window.fullscreen': false,
  'window.maximized': false,
  'app.theme': 'system',
  'app.lastSessionId': null,
  'app.launchCount': 0,
  ...DEFAULT_NOTIFICATION_SETTINGS,
  'user.preferences': {},
  'updates.autoCheck': true,
  'updates.autoDownload': false,
  'updates.channel': 'stable',
  'updates.strategy': 'prompt',
  'updates.skipVersion': null,
};

/**
 * Set of all valid store keys for O(1) lookup
 */
export const VALID_STORE_KEYS: Set<string> = new Set(Object.keys(STORE_DEFAULTS));

/**
 * Validates if a key is a valid store key
 * @param key - The key to validate
 * @returns True if the key is valid
 */
export function isValidStoreKey(key: string): key is StoreKey {
  return VALID_STORE_KEYS.has(key);
}

/**
 * Gets the default value for a store key
 * @param key - The store key
 * @returns The default value for the key
 */
export function getStoreDefault<K extends StoreKey>(key: K): StoreSchema[K] {
  return STORE_DEFAULTS[key];
}

/**
 * Type guard for window bounds validation
 * @param value - Value to check
 * @returns True if value is valid WindowBounds
 */
export function isValidWindowBounds(value: unknown): value is WindowBounds {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const bounds = value as Record<string, unknown>;
  return (
    typeof bounds.x === 'number' &&
    typeof bounds.y === 'number' &&
    typeof bounds.width === 'number' &&
    typeof bounds.height === 'number' &&
    bounds.width > 0 &&
    bounds.height > 0
  );
}

/**
 * Type guard for theme mode validation
 * @param value - Value to check
 * @returns True if value is valid ThemeMode
 */
export function isValidThemeMode(value: unknown): value is ThemeMode {
  return value === 'dark' || value === 'light' || value === 'system';
}

/**
 * Type guard for notification category settings validation
 * @param value - Value to check
 * @returns True if value is valid NotificationCategorySettings
 */
export function isValidCategorySettings(
  value: unknown
): value is NotificationCategorySettings {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const settings = value as Record<string, unknown>;
  return (
    typeof settings.message === 'boolean' &&
    typeof settings.workflow === 'boolean' &&
    typeof settings['agent-mail'] === 'boolean' &&
    typeof settings.system === 'boolean' &&
    typeof settings.update === 'boolean'
  );
}

/**
 * Type guard for user preferences validation
 * @param value - Value to check
 * @returns True if value is valid UserPreferences
 */
export function isValidUserPreferences(value: unknown): value is UserPreferences {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Type guard for update channel validation
 * @param value - Value to check
 * @returns True if value is valid UpdateChannel
 */
export function isValidUpdateChannel(value: unknown): value is UpdateChannel {
  return value === 'stable' || value === 'beta' || value === 'alpha';
}

/**
 * Type guard for update strategy validation
 * @param value - Value to check
 * @returns True if value is valid UpdateStrategy
 */
export function isValidUpdateStrategy(value: unknown): value is UpdateStrategy {
  return value === 'silent' || value === 'prompt' || value === 'force';
}

/**
 * Validates a store value against its key's expected type
 * @param key - The store key
 * @param value - The value to validate
 * @returns True if the value is valid for the key
 */
export function isValidStoreValue<K extends StoreKey>(
  key: K,
  value: unknown
): value is StoreSchema[K] {
  switch (key) {
    case 'window.bounds':
      return isValidWindowBounds(value);
    case 'window.fullscreen':
    case 'window.maximized':
    case 'notifications.enabled':
    case 'notifications.soundEnabled':
    case 'notifications.doNotDisturb':
    case 'updates.autoCheck':
    case 'updates.autoDownload':
      return typeof value === 'boolean';
    case 'app.theme':
      return isValidThemeMode(value);
    case 'app.lastSessionId':
    case 'updates.skipVersion':
      return value === null || typeof value === 'string';
    case 'app.launchCount':
      return typeof value === 'number' && Number.isInteger(value) && value >= 0;
    case 'notifications.categorySettings':
      return isValidCategorySettings(value);
    case 'user.preferences':
      return isValidUserPreferences(value);
    case 'updates.channel':
      return isValidUpdateChannel(value);
    case 'updates.strategy':
      return isValidUpdateStrategy(value);
    default:
      return false;
  }
}
