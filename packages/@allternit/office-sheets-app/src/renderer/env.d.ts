import type { DesktopApi } from '@allternit/office-xlsx-engine/shared/desktop-api'

/** Chat-history record as returned by the project store. */
export interface ProjectChatMessage {
  role: string
  text: string
  tools?: { summary: string; isError?: boolean; name?: string; output?: string }[]
}

/** Minimal chat-history surface of @genoffice/project-store used by App.tsx. */
interface ProjectApi {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  appendChat(args: any): Promise<any>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  resolveChat(args: any): Promise<{ projectId: string; chatId: string }>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  loadChat(args: any): Promise<any[]>
}

declare global {
  interface Window {
    readonly desktopApi: DesktopApi
    readonly projectApi?: ProjectApi
  }
}

export {}
