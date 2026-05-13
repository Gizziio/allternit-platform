import { useCallback } from 'react';

export function useErrorToast(): void {
  return useCallback((message: string) => {
    console.error('[ErrorToast]', message);
  }, []);
}
