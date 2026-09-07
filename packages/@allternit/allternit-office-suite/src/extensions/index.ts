/**
 * Extension slot for the per-app AI chat section.
 *
 * Hosts register `OfficeExtensionDescriptor`s on `OfficeHost.extensions`;
 * `OfficeAiSlot` occupies the app's AI chat section with a tab strip of
 * extensions plus the app's built-in panel as the "Built-in" fallback tab.
 */
export { OfficeAiSlot, type OfficeAiSlotProps } from './OfficeAiSlot';
export { useOfficeExtensions } from './useOfficeExtensions';
export {
  registerActiveDocument,
  getActiveDocument,
  useActiveDocument,
} from './activeDocument';
export { createAllternitAssistantExtension } from './allternit-assistant';
