/**
 * AI facade for the Allternit Office Suite.
 *
 * The vendored office apps no longer import `@allternit/office-ai` directly;
 * they consume these exports from the suite package so that the suite remains
 * the single boundary between the apps and the platform/standalone hosts.
 */

export {
  streamOfficeAi,
  OfficeAgentLoop,
  resolvePlatformModelId,
  resolvePlatformModelName,
  getOfficeModelOverride,
  setOfficeModelOverride,
  resolveOfficeModelId,
  resolveOfficeModelValue,
  getOfficeModelLabel,
  getOfficeModelOptions,
  refreshOfficeModelOptions,
  type OfficeAiChunk,
  type OfficeAiMessage,
  type StreamOfficeAiOptions,
  type OfficeAgentLoopEvents,
  type OfficeToolCall,
  type OfficeToolExecution,
  type PlatformModelSelection,
  type OfficeAppKey,
  type OfficeModelOverrides,
  type OfficeModelOption,
} from '@allternit/office-ai';
