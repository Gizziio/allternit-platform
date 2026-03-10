/**
 * IPC Channel Definitions
 *
 * Central registry of all IPC channels between main and renderer processes.
 * Using 'as const' for strict type checking and compile-time validation.
 */

export const IPC_CHANNELS = {
  // Window
  WINDOW: {
    MINIMIZE: 'window:minimize',
    MAXIMIZE: 'window:maximize',
    CLOSE: 'window:close',
    IS_MAXIMIZED: 'window:is-maximized',
    GET_BOUNDS: 'window:get-bounds',
    SET_BOUNDS: 'window:set-bounds',
    BLUR: 'window:blur',
    FOCUS: 'window:focus',
    SHOW: 'window:show',
    HIDE: 'window:hide',
    RESIZE: 'window:resize',
    MOVE: 'window:move',
    FULLSCREEN: 'window:fullscreen',
    SET_UNSAVED_CHANGES: 'window:set-unsaved-changes',
    CONFIRM_CLOSE: 'window:confirm-close',
    SAVE_REQUEST: 'window:save-request',
  },

  // Theme
  THEME: {
    GET: 'theme:get',
    SET: 'theme:set',
    UPDATED: 'theme:updated',
  },

  // Multi-window
  MULTI_WINDOW: {
    SEND_MESSAGE: 'multi-window:send-message',
    BROADCAST: 'multi-window:broadcast',
    MESSAGE_RECEIVED: 'multi-window:message-received',
    GET_WINDOWS: 'multi-window:get-windows',
    FOCUS_WINDOW: 'multi-window:focus-window',
    CLOSE_WINDOW: 'multi-window:close-window',
    WINDOW_READY: 'multi-window:window-ready',
  },

  // Store
  STORE: {
    GET: 'store:get',
    SET: 'store:set',
    DELETE: 'store:delete',
    CLEAR: 'store:clear',
    HAS: 'store:has',
  },

  // App
  APP: {
    GET_VERSION: 'app:get-version',
    GET_PLATFORM: 'app:get-platform',
    QUIT: 'app:quit',
    RELAUNCH: 'app:relaunch',
  },

  // Native Features - Notifications
  NOTIFICATION: {
    SHOW: 'notification:show',
    GET_SETTINGS: 'notification:getSettings',
    UPDATE_SETTINGS: 'notification:updateSettings',
    TOGGLE_DO_NOT_DISTURB: 'notification:toggleDoNotDisturb',
    SET_CATEGORY_ENABLED: 'notification:setCategoryEnabled',
    CLEAR_BADGE: 'notification:clearBadge',
    GET_BADGE_COUNT: 'notification:getBadgeCount',
  },

  // Native Features - Tray
  TRAY: {
    UPDATE_TOOLTIP: 'tray:updateTooltip',
    SHOW_NOTIFICATION: 'tray:showNotification',
    UPDATE_MENU: 'tray:updateMenu',
  },

  // Native Features - Menu
  MENU: {
    ADD_RECENT_SESSION: 'menu:addRecentSession',
    CLEAR_RECENT_SESSIONS: 'menu:clearRecentSessions',
    GET_RECENT_SESSIONS: 'menu:getRecentSessions',
    UPDATE: 'menu:update',
  },

  // Native Features - Dock (macOS)
  DOCK: {
    BOUNCE: 'dock:bounce',
    CANCEL_BOUNCE: 'dock:cancelBounce',
    SET_BADGE: 'dock:setBadge',
    GET_BADGE: 'dock:getBadge',
    ADD_RECENT_DOCUMENT: 'dock:addRecentDocument',
    CLEAR_RECENT_DOCUMENTS: 'dock:clearRecentDocuments',
    GET_RECENT_DOCUMENTS: 'dock:getRecentDocuments',
    SET_PROGRESS: 'dock:setProgress',
  },

  // Native Features - Power Monitor
  POWER: {
    GET_STATE: 'power:getState',
    IS_ON_BATTERY: 'power:isOnBattery',
    GET_IDLE_TIME: 'power:getIdleTime',
    IS_SCREEN_LOCKED: 'power:isScreenLocked',
    GET_IDLE_STATE: 'power:getIdleState',
    PAUSE_CONNECTIONS: 'power:pauseConnections',
    RESUME_CONNECTIONS: 'power:resumeConnections',
  },

  // Native Features - Protocol
  PROTOCOL: {
    BUILD_URL: 'protocol:buildUrl',
    OPEN: 'protocol:open',
    IS_REGISTERED: 'protocol:isRegistered',
    PARSE: 'protocol:parse',
  },

  // Auto Updater
  UPDATE: {
    CHECK: 'updater:check',
    DOWNLOAD: 'updater:download',
    INSTALL: 'updater:install',
    CHECKING: 'updater:checking',
    AVAILABLE: 'updater:available',
    NOT_AVAILABLE: 'updater:not-available',
    PROGRESS: 'updater:progress',
    DOWNLOADED: 'updater:downloaded',
    ERROR: 'updater:error',
    GET_INFO: 'updater:get-info',
    SET_CHANNEL: 'updater:set-channel',
    GET_CHANNEL: 'updater:get-channel',
  },

  // Sidecar / API Server
  SIDECAR: {
    START: 'sidecar:start',
    STOP: 'sidecar:stop',
    RESTART: 'sidecar:restart',
    GET_STATUS: 'sidecar:get-status',
    GET_API_URL: 'sidecar:get-api-url',
    GET_AUTH_PASSWORD: 'sidecar:get-auth-password',
    STATUS_CHANGED: 'sidecar:status-changed',
  },

  // VM Management
  VM: {
    GET_STATUS: 'vm:get-status',
    START: 'vm:start',
    STOP: 'vm:stop',
    RESTART: 'vm:restart',
    EXECUTE: 'vm:execute',
    SETUP: 'vm:setup',
    CHECK_IMAGES: 'vm:check-images',
    DOWNLOAD_IMAGES: 'vm:download-images',
    STATUS_CHANGED: 'vm:status-changed',
    EXECUTION_RESULT: 'vm:execution-result',
    SETUP_PROGRESS: 'vm:setup-progress',
  },
} as const;

/**
 * Type helper for IPC channel names
 * Extracts all leaf values from the nested channel structure
 */
export type IPCChannelValue =
  | typeof IPC_CHANNELS.WINDOW[keyof typeof IPC_CHANNELS.WINDOW]
  | typeof IPC_CHANNELS.THEME[keyof typeof IPC_CHANNELS.THEME]
  | typeof IPC_CHANNELS.MULTI_WINDOW[keyof typeof IPC_CHANNELS.MULTI_WINDOW]
  | typeof IPC_CHANNELS.STORE[keyof typeof IPC_CHANNELS.STORE]
  | typeof IPC_CHANNELS.APP[keyof typeof IPC_CHANNELS.APP]
  | typeof IPC_CHANNELS.NOTIFICATION[keyof typeof IPC_CHANNELS.NOTIFICATION]
  | typeof IPC_CHANNELS.TRAY[keyof typeof IPC_CHANNELS.TRAY]
  | typeof IPC_CHANNELS.MENU[keyof typeof IPC_CHANNELS.MENU]
  | typeof IPC_CHANNELS.DOCK[keyof typeof IPC_CHANNELS.DOCK]
  | typeof IPC_CHANNELS.POWER[keyof typeof IPC_CHANNELS.POWER]
  | typeof IPC_CHANNELS.PROTOCOL[keyof typeof IPC_CHANNELS.PROTOCOL]
  | typeof IPC_CHANNELS.UPDATE[keyof typeof IPC_CHANNELS.UPDATE]
  | typeof IPC_CHANNELS.SIDECAR[keyof typeof IPC_CHANNELS.SIDECAR]
  | typeof IPC_CHANNELS.VM[keyof typeof IPC_CHANNELS.VM];

/**
 * IPC channel categories for validation and organization
 */
export const IPC_CATEGORIES = {
  WINDOW: Object.values(IPC_CHANNELS.WINDOW),
  THEME: Object.values(IPC_CHANNELS.THEME),
  MULTI_WINDOW: Object.values(IPC_CHANNELS.MULTI_WINDOW),
  STORE: Object.values(IPC_CHANNELS.STORE),
  APP: Object.values(IPC_CHANNELS.APP),
  NOTIFICATION: Object.values(IPC_CHANNELS.NOTIFICATION),
  TRAY: Object.values(IPC_CHANNELS.TRAY),
  MENU: Object.values(IPC_CHANNELS.MENU),
  DOCK: Object.values(IPC_CHANNELS.DOCK),
  POWER: Object.values(IPC_CHANNELS.POWER),
  PROTOCOL: Object.values(IPC_CHANNELS.PROTOCOL),
  UPDATE: Object.values(IPC_CHANNELS.UPDATE),
  SIDECAR: Object.values(IPC_CHANNELS.SIDECAR),
  VM: Object.values(IPC_CHANNELS.VM),
} as const;

export type IPCChannelType = typeof IPC_CHANNELS;
