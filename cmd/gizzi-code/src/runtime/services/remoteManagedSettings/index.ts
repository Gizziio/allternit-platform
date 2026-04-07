/**
 * Remote Managed Settings
 */

export interface RemoteSettings {
  [key: string]: unknown
}

export async function fetchRemoteSettings(): Promise<RemoteSettings> {
  return {}
}
