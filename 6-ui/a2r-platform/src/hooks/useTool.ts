/**
 * Tool Execution Hook for GUI
 * 
 * Provides deterministic tool execution with retry, timeout, and error handling.
 * 
 * @module hooks/useTool
 */

import { useState, useCallback, useRef } from 'react';

export interface ToolExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
  screenshot?: string;
  snapshot?: any;
  execution_time_ms?: number;
}

export interface ToolExecutionOptions {
  /** Maximum retry attempts (default: 0 = no retry) */
  retry?: number;
  /** Retry delay in milliseconds (default: 1000) */
  retryDelay?: number;
  /** Timeout in milliseconds (default: 30000 = 30s) */
  timeout?: number;
  /** Enable exponential backoff (default: true) */
  backoff?: boolean;
  /** Idempotency key for deduplication */
  idempotencyKey?: string;
  /** Callback on success */
  onSuccess?: (result: ToolExecutionResult) => void;
  /** Callback on error */
  onError?: (error: Error) => void;
}

/**
 * Execute a tool with deterministic retry and timeout handling
 */
export function useTool(toolId: string) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<ToolExecutionResult | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Execute the tool with options
   */
  const execute = useCallback(async (
    parameters: Record<string, any>,
    options: ToolExecutionOptions = {}
  ): Promise<ToolExecutionResult> => {
    const {
      retry = 0,
      retryDelay = 1000,
      timeout = 30000,
      backoff = true,
      idempotencyKey,
      onSuccess,
      onError,
    } = options;

    // Cancel any in-progress execution
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setIsLoading(true);
    setError(null);

    const startTime = Date.now();

    // Add idempotency key if provided
    const paramsWithIdempotency = idempotencyKey
      ? { ...parameters, __idempotency_key: idempotencyKey }
      : parameters;

    // Execute with retry logic
    let lastError: Error | null = null;
    let result: ToolExecutionResult | null = null;

    for (let attempt = 1; attempt <= retry + 1; attempt++) {
      try {
        // Create timeout promise
        const timeoutPromise = new Promise<never>((_, reject) => {
          const timeoutId = setTimeout(() => {
            reject(new Error(`Tool execution timeout after ${timeout}ms`));
          }, timeout);

          abortController.signal.addEventListener('abort', () => {
            clearTimeout(timeoutId);
            reject(new Error('Tool execution aborted'));
          });
        });

        // Create execution promise
        const executePromise = (async () => {
          const response = await fetch('/api/v1/tools/execute', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              tool_name: toolId,
              parameters: paramsWithIdempotency,
            }),
            signal: abortController.signal,
          });

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error || `HTTP ${response.status}: ${response.statusText}`);
          }

          return data as ToolExecutionResult;
        })();

        // Race between execution and timeout
        result = await Promise.race([executePromise, timeoutPromise]);

        // Check if tool execution reported an error
        if (!result.success && result.error) {
          throw new Error(result.error);
        }

        // Success - break retry loop
        break;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        // Don't retry if aborted
        if (abortController.signal.aborted) {
          break;
        }

        // Retry if attempts remaining
        if (attempt < retry + 1) {
          // Calculate delay with exponential backoff
          const delay = backoff
            ? retryDelay * Math.pow(2, attempt - 1)
            : retryDelay;

          // Cap delay at 10 seconds
          const cappedDelay = Math.min(delay, 10000);

          await new Promise(resolve => setTimeout(resolve, cappedDelay));
        }
      }
    }

    // Handle final result
    if (result && result.success) {
      setLastResult(result);
      setError(null);
      onSuccess?.(result);
      setIsLoading(false);
      return result;
    }

    // Handle error
    const errorMessage = lastError?.message || result?.error || 'Tool execution failed';
    setError(errorMessage);
    onError?.(lastError || new Error(errorMessage));
    setIsLoading(false);

    return {
      success: false,
      error: errorMessage,
      execution_time_ms: Date.now() - startTime,
    };
  }, [toolId, onSuccess, onError]);

  /**
   * Cancel in-progress execution
   */
  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
    setError('Execution cancelled');
  }, []);

  /**
   * Reset state
   */
  const reset = useCallback(() => {
    setError(null);
    setLastResult(null);
    setIsLoading(false);
  }, []);

  return {
    execute,
    cancel,
    reset,
    isLoading,
    error,
    lastResult,
  };
}

/**
 * Execute a tool with automatic retry (convenience wrapper)
 */
export function useToolWithRetry(toolId: string, maxRetries = 3) {
  const tool = useTool(toolId);

  const executeWithRetry = useCallback(async (
    parameters: Record<string, any>,
    options?: Omit<ToolExecutionOptions, 'retry'>
  ) => {
    return tool.execute(parameters, {
      ...options,
      retry: maxRetries,
    });
  }, [tool, maxRetries]);

  return {
    ...tool,
    execute: executeWithRetry,
  };
}

/**
 * Execute a tool with timeout (convenience wrapper)
 */
export function useToolWithTimeout(toolId: string, defaultTimeout = 30000) {
  const tool = useTool(toolId);

  const executeWithTimeout = useCallback(async (
    parameters: Record<string, any>,
    options?: Omit<ToolExecutionOptions, 'timeout'>
  ) => {
    return tool.execute(parameters, {
      ...options,
      timeout: defaultTimeout,
    });
  }, [tool, defaultTimeout]);

  return {
    ...tool,
    execute: executeWithTimeout,
  };
}

/**
 * Execute a tool with both retry and timeout (convenience wrapper)
 */
export function useToolWithRetryAndTimeout(
  toolId: string,
  maxRetries = 3,
  defaultTimeout = 30000
) {
  const tool = useTool(toolId);

  const executeWithRetryAndTimeout = useCallback(async (
    parameters: Record<string, any>,
    options?: Omit<ToolExecutionOptions, 'retry' | 'timeout'>
  ) => {
    return tool.execute(parameters, {
      ...options,
      retry: maxRetries,
      timeout: defaultTimeout,
    });
  }, [tool, maxRetries, defaultTimeout]);

  return {
    ...tool,
    execute: executeWithRetryAndTimeout,
  };
}

export default useTool;
