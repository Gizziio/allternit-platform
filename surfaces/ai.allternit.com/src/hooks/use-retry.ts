/**
 * useRetry - Retry utility with exponential backoff
 * 
 * Provides automatic retry functionality for async operations
 * with configurable attempts, delays, and toast notifications.
 */

import { useCallback, useRef, useState } from 'react';
import { useToast } from './use-toast';

export interface RetryConfig {
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  showToast?: boolean;
  toastTitle?: string;
  toastRetryMessage?: string;
  toastFailureMessage?: string;
}

export interface RetryState {
  attempt: number;
  isRetrying: boolean;
  lastError?: Error;
}

const DEFAULT_CONFIG: Required<RetryConfig> = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  showToast: true,
  toastTitle: 'Operation Failed',
  toastRetryMessage: 'Retrying in {delay}s... (Attempt {attempt}/{max})',
  toastFailureMessage: 'Operation failed after {max} attempts.',
};

export function useRetry<T>(
  operation: () => Promise<T>,
  config: RetryConfig = {}
) {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const { addToast } = useToast();
  const [state, setState] = useState<RetryState>({
    attempt: 0,
    isRetrying: false,
  });
  const abortRef = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const clearRetryTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const execute = useCallback(async (): Promise<T> => {
    abortRef.current = false;
    setState({ attempt: 0, isRetrying: false });

    for (let attempt = 1; attempt <= finalConfig.maxAttempts; attempt++) {
      if (abortRef.current) {
        throw new Error('Operation aborted');
      }

      setState({ attempt, isRetrying: attempt > 1, lastError: undefined });

      try {
        const result = await operation();
        setState({ attempt: 0, isRetrying: false });
        return result;
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        setState({ attempt, isRetrying: false, lastError: err });

        // Don't retry if this was the last attempt
        if (attempt >= finalConfig.maxAttempts) {
          if (finalConfig.showToast) {
            addToast({
              title: finalConfig.toastTitle,
              description: finalConfig.toastFailureMessage
                .replace('{max}', String(finalConfig.maxAttempts))
                .replace('{error}', err.message),
              type: 'error',
            });
          }
          throw err;
        }

        // Calculate delay with exponential backoff
        const delay = Math.min(
          finalConfig.initialDelay * Math.pow(finalConfig.backoffMultiplier, attempt - 1),
          finalConfig.maxDelay
        );

        if (finalConfig.showToast) {
          addToast({
            title: finalConfig.toastTitle,
            description: finalConfig.toastRetryMessage
              .replace('{delay}', String(Math.round(delay / 1000)))
              .replace('{attempt}', String(attempt))
              .replace('{max}', String(finalConfig.maxAttempts))
              .replace('{error}', err.message),
            type: 'warning',
          });
        }

        // Wait before retrying
        await new Promise<void>((resolve) => {
          timeoutRef.current = setTimeout(resolve, delay);
        });

        clearRetryTimeout();
      }
    }

    // This should never be reached, but TypeScript needs it
    throw new Error('Retry loop exited unexpectedly');
  }, [operation, finalConfig, clearRetryTimeout]);

  const abort = useCallback(() => {
    abortRef.current = true;
    clearRetryTimeout();
    setState({ attempt: 0, isRetrying: false });
  }, [clearRetryTimeout]);

  const retryNow = useCallback(async (): Promise<T> => {
    clearRetryTimeout();
    return execute();
  }, [execute, clearRetryTimeout]);

  return {
    execute,
    abort,
    retryNow,
    attempt: state.attempt,
    isRetrying: state.isRetrying,
    lastError: state.lastError,
  };
}

/**
 * Retry a function immediately without hook overhead
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  config: RetryConfig = {}
): Promise<T> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  for (let attempt = 1; attempt <= finalConfig.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));

      if (attempt >= finalConfig.maxAttempts) {
        throw err;
      }

      const delay = Math.min(
        finalConfig.initialDelay * Math.pow(finalConfig.backoffMultiplier, attempt - 1),
        finalConfig.maxDelay
      );

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw new Error('Retry loop exited unexpectedly');
}
