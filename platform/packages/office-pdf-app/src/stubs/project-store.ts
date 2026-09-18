/**
 * Stub for @genoffice/project-store. Chat/project persistence is in-memory
 * only in this build; every method resolves to an empty value.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export interface ProjectApi {
  [key: string]: (...args: any[]) => Promise<any>
}

export class ProjectStore {
  constructor(..._args: any[]) {}
  [key: string]: any
  async appendChatMessage(..._args: any[]): Promise<any> { return null }
  async resolveChatForFile(..._args: any[]): Promise<any> { return { projectId: 'browser', chatId: 'local' } }
  async ensureDefaultProject(..._args: any[]): Promise<any> { return { id: 'browser' } }
  async loadChat(..._args: any[]): Promise<any[]> { return [] }
}
