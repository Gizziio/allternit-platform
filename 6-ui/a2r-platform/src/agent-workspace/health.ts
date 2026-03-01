/**
 * Health Check Module
 * 
 * Provides health check functionality for the API server.
 */

export interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  version?: string;
  uptime?: number;
  timestamp?: string;
}

/**
 * Check if the API server is healthy
 * 
 * @param baseUrl - Base URL of the API server
 * @param authHeader - Optional Authorization header
 * @param timeout - Request timeout in milliseconds
 * @returns True if server is healthy
 */
export async function healthCheck(
  baseUrl: string,
  authHeader?: string,
  timeout: number = 2000
): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const headers: Record<string, string> = {
      'Accept': 'application/json',
    };

    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/health`, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    return response.ok;
  } catch (error) {
    // Connection failed or timed out
    return false;
  }
}

/**
 * Get detailed health status from the API server
 * 
 * @param baseUrl - Base URL of the API server
 * @param authHeader - Optional Authorization header
 * @param timeout - Request timeout in milliseconds
 * @returns Health status or null if unavailable
 */
export async function getHealthStatus(
  baseUrl: string,
  authHeader?: string,
  timeout: number = 2000
): Promise<HealthStatus | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const headers: Record<string, string> = {
      'Accept': 'application/json',
    };

    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/health`, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return { status: 'unhealthy' };
    }

    const data = await response.json();
    
    return {
      status: 'healthy',
      version: data.version,
      uptime: data.uptime,
      timestamp: data.timestamp,
    };
  } catch (error) {
    return null;
  }
}

/**
 * Poll health status until it becomes healthy or timeout is reached
 * 
 * @param baseUrl - Base URL of the API server
 * @param authHeader - Optional Authorization header
 * @param options - Polling options
 * @returns True if server became healthy within timeout
 */
export async function pollUntilHealthy(
  baseUrl: string,
  authHeader?: string,
  options: {
    interval?: number;
    maxAttempts?: number;
    timeout?: number;
  } = {}
): Promise<boolean> {
  const { 
    interval = 1000, 
    maxAttempts = 30,
    timeout = 30000 
  } = options;

  const startTime = Date.now();

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Check overall timeout
    if (Date.now() - startTime > timeout) {
      console.log('[Health] Polling timeout exceeded');
      return false;
    }

    const isHealthy = await healthCheck(baseUrl, authHeader, 2000);
    
    if (isHealthy) {
      console.log(`[Health] Server healthy after ${attempt + 1} attempts`);
      return true;
    }

    // Wait before next attempt
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  console.log(`[Health] Server not healthy after ${maxAttempts} attempts`);
  return false;
}

export default healthCheck;
