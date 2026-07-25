/**
 * Agent Workspace Files API Client
 *
 * Reads and writes the real agent workspace files exposed by the Rust API:
 *   GET /api/v1/agents/:id/workspace/files        → { files: [{ path, size_bytes, modified_at }] }
 *   GET /api/v1/agents/:id/workspace/file?path=…  → { path, content }
 *   PUT /api/v1/agents/:id/workspace/file         { path, content }
 */

import { apiRequestWithError, runtimeApiUrl } from './api-config';

export interface AgentWorkspaceFileInfo {
  path: string;
  size_bytes: number;
  modified_at: string;
}

export const agentWorkspaceFilesApi = {
  /** GET /api/v1/agents/:id/workspace/files */
  async list(agentId: string): Promise<AgentWorkspaceFileInfo[]> {
    const data = await apiRequestWithError<{ files: AgentWorkspaceFileInfo[] }>(
      runtimeApiUrl(`/agents/${encodeURIComponent(agentId)}/workspace/files`),
    );
    return data.files ?? [];
  },

  /** GET /api/v1/agents/:id/workspace/file?path=… */
  async read(agentId: string, path: string): Promise<string> {
    const params = new URLSearchParams({ path });
    const data = await apiRequestWithError<{ path: string; content: string }>(
      runtimeApiUrl(`/agents/${encodeURIComponent(agentId)}/workspace/file?${params.toString()}`),
    );
    return data.content ?? '';
  },

  /** PUT /api/v1/agents/:id/workspace/file */
  async write(agentId: string, path: string, content: string): Promise<void> {
    await apiRequestWithError<unknown>(
      runtimeApiUrl(`/agents/${encodeURIComponent(agentId)}/workspace/file`),
      {
        method: 'PUT',
        body: JSON.stringify({ path, content }),
      },
    );
  },
};
