import { useOfficeHost } from '../bridge/OfficeHostContext';
import type { OfficeExtensionDescriptor } from '../bridge/types';

const EMPTY_EXTENSIONS: readonly OfficeExtensionDescriptor[] = [];

/**
 * Read the extensions the embedding host registered on the office host.
 * Returns an empty list when no provider is mounted or the host registered
 * none — in that case every app renders its built-in AI panel unchanged.
 */
export function useOfficeExtensions(): readonly OfficeExtensionDescriptor[] {
  return useOfficeHost()?.extensions ?? EMPTY_EXTENSIONS;
}
