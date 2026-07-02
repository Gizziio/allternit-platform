export type ProjectTab = 'overview' | 'files' | 'threads' | 'analytics' | 'settings';

export interface ProjectStats {
  filesCount: number;
  threadsCount: number;
  activeAgents: number;
  totalTokens: number;
  completion: number;
}
