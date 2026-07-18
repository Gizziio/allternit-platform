/**
 * Allternit in Chrome Common
 */

export interface ChromeConnectionConfig {
  host: string
  port: number
}

export function getChromeConnectionConfig(): ChromeConnectionConfig {
  return { host: 'localhost', port: 9222 }
}

// Merge-by-re-export: complete counterpart (local exports win on conflict)
export { ALLTERNIT_IN_CHROME_MCP_SERVER_NAME, BROWSER_DETECTION_ORDER, CHROMIUM_BROWSERS, detectAvailableBrowser, getAllBrowserDataPaths, getAllNativeMessagingHostsDirs, getAllSocketPaths, getAllWindowsRegistryKeys, getSecureSocketPath, getSocketDir, isAllternitInChromeMCPServer, isTrackedAllternitInChromeTabId, openInChrome, trackAllternitInChromeTabId } from "../../shared/utils/allternitInChrome/common.js";
export type { ChromiumBrowser } from "../../shared/utils/allternitInChrome/common.js";
