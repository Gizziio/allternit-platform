/**
 * Shared Module Exports
 *
 * Central export point for all shared IPC types and constants.
 */

// IPC Channels
export { IPC_CHANNELS, IPC_CATEGORIES } from './ipc-channels';
export type { IPCChannelValue, IPCChannelType } from './ipc-channels';

// Store Schema
export {
  STORE_DEFAULTS,
  VALID_STORE_KEYS,
  isValidStoreKey,
  isValidStoreValue,
  isValidWindowBounds,
  isValidThemeMode,
  isValidUserPreferences,
  isValidCategorySettings,
  getStoreDefault,
} from './store-schema';
export type {
  StoreSchema,
  StoreKey,
  WindowBounds,
  ThemeMode,
  UserPreferences,
  NotificationSettings,
  NotificationCategorySettings,
} from './store-schema';

// Type Definitions
export type {
  ElectronAPI,
  IpcRequest,
  IpcResponse,
  DialogOptions,
  DialogResult,
  NotificationOptions,
  NotificationCategory,
  NotificationSettings as NotificationSettingsType,
  PowerState,
  IdleState,
  ParsedDeepLink,
  RecentSession,
  RecentDocument,
  UpdateInfo,
  UpdateCheckResult,
  UpdateDownloadProgress,
  StoreOperationResult,
  WindowBounds as WindowBoundsType,
} from './types';
