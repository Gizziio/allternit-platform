import {
  createAllternitAssistantExtension,
  type OfficeExtensionDescriptor,
} from "@allternit/office-suite";

let cached: OfficeExtensionDescriptor[] | null = null;

/**
 * Shared extension list for the office views' hosts. Memoized at module
 * level so every view registers the same descriptor instances (the desktop
 * app loads these routes, so this wiring covers the desktop as well).
 */
export function getOfficeExtensions(): OfficeExtensionDescriptor[] {
  if (!cached) {
    cached = [createAllternitAssistantExtension()];
  }
  return cached;
}
