export {
  OfficeHostProvider,
  useOfficeHost,
  useOfficeHostRequired,
  useOfficeAi,
  localStorageProvider,
} from './OfficeHostContext';
export type {
  OfficeHost,
  OpenedFile,
  OpenOptions,
  RecentFile,
  SaveOptions,
  OfficeAiClient,
  OfficeMessage,
  OfficeModelInfo,
  OfficeAppKey,
  OfficeModelOption,
  OfficeAgentLoop,
  OfficeAgentLoopOptions,
  OfficeAgentLoopEvents,
  OfficeAgentLoopConstructor,
  OfficeToolExecution,
  OfficeStorageProvider,
  XlsxEngineHost,
  XlsxSessionHandle,
  OfficeExtensionContext,
  OfficeExtensionDescriptor,
} from './types';
export {
  OfficeAiSlot,
  useOfficeExtensions,
  registerActiveDocument,
  getActiveDocument,
  useActiveDocument,
  createAllternitAssistantExtension,
} from '../extensions';
export type { OfficeAiSlotProps } from '../extensions';
