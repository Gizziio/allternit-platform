/**
 * Chrome Native Host
 */

export interface ChromeNativeHost {
  connect(): Promise<void>
  disconnect(): Promise<void>
}

export function createChromeNativeHost(): ChromeNativeHost {
  return {
    connect: async () => {},
    disconnect: async () => {},
  }
}
