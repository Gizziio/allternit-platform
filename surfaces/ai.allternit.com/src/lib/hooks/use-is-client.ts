import { useSyncExternalStore } from 'react';

const subscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

/**
 * Hook to detect if the component is rendering on the client.
 * Useful for avoiding hydration mismatches with window-dependent logic or timestamps.
 * 
 * @example
 * const isClient = useIsClient();
 * return isClient ? <ClientOnlyComponent /> : <Placeholder />;
 */
export function useIsClient(): void {
  return useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
}
