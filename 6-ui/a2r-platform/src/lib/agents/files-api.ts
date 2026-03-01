/**
 * Files API Client
 * 
 * Production-ready file operations API client.
 * All operations go through the Gateway API.
 * NO localStorage fallbacks - proper error handling only.
 */

import { GATEWAY_BASE_URL } from "@/integration/api-client";

const FILES_API_BASE = `${GATEWAY_BASE_URL}/api/v1/files`;

// ============================================================================
// Types
// ============================================================================

export interface ReadFileRequest {
  path: string;
  offset?: number;
  limit?: number;
}

export interface ReadFileResponse {
  path: string;
  content: string;
  totalLines: number;
  offset: number;
  limit: number;
}

export interface WriteFileRequest {
  path: string;
  content: string;
  append?: boolean;
}

export interface WriteFileResponse {
  path: string;
  bytesWritten: number;
  operation: "write" | "append";
}

export interface FileEntry {
  name: string;
  path: string;
  type: "file" | "directory";
  size?: number;
  modifiedAt?: string;
}

export interface ListDirectoryRequest {
  path: string;
  includeDetails?: boolean;
  recursive?: boolean;
}

export interface ListDirectoryResponse {
  path: string;
  entries: FileEntry[];
}

export interface SearchCodeRequest {
  query: string;
  type?: "text" | "regex" | "symbol" | "file";
  glob?: string;
  caseSensitive?: boolean;
  maxResults?: number;
}

export interface SearchResult {
  file: string;
  line: number;
  column: number;
  content: string;
  context: string[];
}

export interface SearchCodeResponse {
  query: string;
  type: string;
  glob: string;
  results: SearchResult[];
  totalResults: number;
}

export interface FilesApiError {
  code: string;
  message: string;
  path?: string;
}

// ============================================================================
// Error Handling
// ============================================================================

class FilesApiClientError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
    public path?: string
  ) {
    super(message);
    this.name = "FilesApiClientError";
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new FilesApiClientError(
      errorData.message || `HTTP ${response.status}: ${response.statusText}`,
      errorData.code || "UNKNOWN_ERROR",
      response.status,
      errorData.path
    );
  }
  return response.json();
}

// ============================================================================
// API Client
// ============================================================================

export const filesApi = {
  /**
   * Read file contents
   * GET /api/v1/files/read?path={path}&offset={offset}&limit={limit}
   */
  async readFile(request: ReadFileRequest): Promise<ReadFileResponse> {
    const params = new URLSearchParams();
    params.set("path", request.path);
    if (request.offset !== undefined) params.set("offset", String(request.offset));
    if (request.limit !== undefined) params.set("limit", String(request.limit));

    const response = await fetch(`${FILES_API_BASE}/read?${params}`, {
      method: "GET",
      headers: {
        "Accept": "application/json",
      },
    });

    return handleResponse<ReadFileResponse>(response);
  },

  /**
   * Write file contents
   * POST /api/v1/files/write
   */
  async writeFile(request: WriteFileRequest): Promise<WriteFileResponse> {
    const response = await fetch(`${FILES_API_BASE}/write`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(request),
    });

    return handleResponse<WriteFileResponse>(response);
  },

  /**
   * List directory contents
   * GET /api/v1/files/list?path={path}&details={details}&recursive={recursive}
   */
  async listDirectory(request: ListDirectoryRequest): Promise<ListDirectoryResponse> {
    const params = new URLSearchParams();
    params.set("path", request.path);
    if (request.includeDetails) params.set("details", "true");
    if (request.recursive) params.set("recursive", "true");

    const response = await fetch(`${FILES_API_BASE}/list?${params}`, {
      method: "GET",
      headers: {
        "Accept": "application/json",
      },
    });

    return handleResponse<ListDirectoryResponse>(response);
  },

  /**
   * Search code
   * POST /api/v1/files/search
   */
  async searchCode(request: SearchCodeRequest): Promise<SearchCodeResponse> {
    const response = await fetch(`${FILES_API_BASE}/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(request),
    });

    return handleResponse<SearchCodeResponse>(response);
  },

  /**
   * Delete file
   * DELETE /api/v1/files/delete?path={path}
   */
  async deleteFile(path: string): Promise<void> {
    const params = new URLSearchParams();
    params.set("path", path);

    const response = await fetch(`${FILES_API_BASE}/delete?${params}`, {
      method: "DELETE",
      headers: {
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new FilesApiClientError(
        errorData.message || `Failed to delete file: ${response.statusText}`,
        errorData.code || "DELETE_FAILED",
        response.status,
        path
      );
    }
  },

  /**
   * Check if file exists
   * HEAD /api/v1/files/exists?path={path}
   */
  async fileExists(path: string): Promise<boolean> {
    const params = new URLSearchParams();
    params.set("path", path);

    try {
      const response = await fetch(`${FILES_API_BASE}/exists?${params}`, {
        method: "HEAD",
      });
      return response.ok;
    } catch {
      return false;
    }
  },
};

export { FilesApiClientError };
