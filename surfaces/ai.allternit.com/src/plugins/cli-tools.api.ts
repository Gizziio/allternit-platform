/**
 * CLI Tools API Client
 * 
 * Fetches real CLI tools from the system via the Gateway API.
 * Pairs with local enabled-state persistence in capability hooks.
 */

import { GATEWAY_BASE_URL } from '../integration/api-client';

import { createModuleLogger } from '@/lib/logger';

const logger = createModuleLogger('CliTools.api');

// ============================================================================
// Types
// ============================================================================

export interface CliToolApiResponse {
  id: string;
  name: string;
  description: string;
  command: string;
  category: 'shell' | 'file' | 'text' | 'network' | 'system' | 'dev';
  installed: boolean;
  version?: string;
  source?: string;
  tags: string[];
}

interface ListCliToolsResponse {
  tools: CliToolApiResponse[];
  total: number;
}

interface ExecuteCliToolRequest {
  args: string[];
  working_dir?: string;
  env?: Record<string, string>;
  timeout?: number;
}

interface ExecuteCliToolResponse {
  exit_code: number;
  stdout: string;
  stderr: string;
  duration_ms: number;
}

// ============================================================================
// API Functions
// ============================================================================

const API_BASE = `${GATEWAY_BASE_URL}/api/v1`;

/**
 * Fetch all available CLI tools from the system
 */
export async function fetchCliToolsFromApi(): Promise<CliToolApiResponse[]> {
  const response = await fetch(`${API_BASE}/cli-tools`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch CLI tools: ${response.status} ${response.statusText}`);
  }

  const data: ListCliToolsResponse = await response.json();
  return Array.isArray(data.tools) ? data.tools : [];
}

/**
 * Fetch only installed CLI tools
 */
export async function fetchInstalledCliTools(): Promise<CliToolApiResponse[]> {
  const response = await fetch(`${API_BASE}/cli-tools/installed`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch installed CLI tools: ${response.status} ${response.statusText}`);
  }

  const data: ListCliToolsResponse = await response.json();
  return Array.isArray(data.tools) ? data.tools : [];
}

/**
 * Get details about a specific CLI tool
 */
export async function fetchCliToolDetails(id: string): Promise<CliToolApiResponse | null> {
  try {
    const response = await fetch(`${API_BASE}/cli-tools/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch CLI tool details: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    logger.error({ err: error }, 'Error fetching tool ${id}:');
    return null;
  }
}

/**
 * Install a CLI tool
 */
export async function installCliTool(
  id: string,
  method?: string,
  version?: string
): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch(`${API_BASE}/cli-tools/${id}/install`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ method, version }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || `Failed to install CLI tool: ${response.status}`);
    }

    return { success: true, message: 'Installation started' };
  } catch (error) {
    logger.error({ err: error }, 'Error installing tool ${id}:');
    return { 
      success: false, 
      message: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Uninstall a CLI tool
 */
export async function uninstallCliTool(id: string): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch(`${API_BASE}/cli-tools/${id}/uninstall`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || `Failed to uninstall CLI tool: ${response.status}`);
    }

    return { success: true, message: 'Uninstallation completed' };
  } catch (error) {
    logger.error({ err: error }, 'Error uninstalling tool ${id}:');
    return { 
      success: false, 
      message: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}

/**
 * Execute a CLI tool
 */
export async function executeCliTool(
  id: string,
  request: ExecuteCliToolRequest
): Promise<ExecuteCliToolResponse> {
  try {
    const response = await fetch(`${API_BASE}/cli-tools/${id}/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(error || `Failed to execute CLI tool: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    logger.error({ err: error }, 'Error executing tool ${id}:');
    throw error;
  }
}

/**
 * Check if a CLI tool is installed on the system
 * This performs a live check via the API
 */
export async function checkCliToolInstalled(command: string): Promise<{ installed: boolean; version?: string }> {
  try {
    const response = await fetch(`${API_BASE}/cli-tools/check`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ command }),
    });

    if (!response.ok) {
      return { installed: false };
    }

    return await response.json();
  } catch (error) {
    logger.error({ err: error }, 'Error checking tool ${command}:');
    return { installed: false };
  }
}

/**
 * Discover CLI tools from the system PATH
 * This triggers a background scan and returns results
 */
export async function discoverCliTools(): Promise<CliToolApiResponse[]> {
  const response = await fetch(`${API_BASE}/cli-tools/discover`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to discover CLI tools: ${response.status} ${response.statusText}`);
  }

  const data: ListCliToolsResponse = await response.json();
  return Array.isArray(data.tools) ? data.tools : [];
}
