/**
 * Type declarations for the Chrome Embed API
 * Exposed via Electron's contextBridge in the shell desktop preload script
 */

export interface ChromeEmbedAPI {
  /**
   * Launches Chrome browser with the specified URL
   */
  launch(url: string): Promise<void>;

  /**
   * Opens Chrome browser (optionally with a URL)
   */
  open(url?: string): Promise<void>;

  /**
   * Closes the Chrome browser window
   */
  close(): Promise<void>;

  /**
   * Checks if Chrome embed is available on this platform
   */
  isAvailable(): Promise<boolean>;

  /**
   * Embeds Chrome into a container handle (not yet fully supported)
   */
  embed(handle: unknown): Promise<{ success: boolean }>;
}

declare global {
  interface Window {
    /**
     * Chrome Embed API for launching/managing an embedded Chrome browser
     * Only available when running in the Electron shell environment
     */
    chromeEmbed?: ChromeEmbedAPI;
  }
}

export {};
