/**
 * Toast hook - Re-export from toast-provider for convenience
 * This consolidates the dual toast systems
 */

export { useToast, ToastProvider, type Toast, type ToastType } from '@/components/ui/toast-provider';

// Export ToastOptions as Omit<Toast, 'id'> for convenience
export type ToastOptions = Omit<import('@/components/ui/toast-provider').Toast, 'id'>;
