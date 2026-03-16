/**
 * Renderer Hooks Module
 *
 * Central export point for all Electron IPC React hooks.
 */

export {
  useElectron,
  useWindowControls,
  useAppInfo,
  useStore,
  useWindowBounds,
  useTheme,
  useNotification,
  useDialog,
  useExternalLink,
  useUpdater,
  useUserPreferences,
  useNotificationSettings,
  useUpdateSettings,
  useLastSession,
  useLaunchCount,
} from './useElectron';

export {
  useNotifications,
  usePowerMonitor,
  useSSEWithPowerManagement,
  useProtocol,
  useRecentSessions,
  useTrayModeSwitching,
  useNotificationNavigation,
  useMenuEvents,
  useNativeFeatures,
} from './useNativeFeatures';

export { useSidecar, type SidecarStatus, type UseSidecarReturn } from './useSidecar';
