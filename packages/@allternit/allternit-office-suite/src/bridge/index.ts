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
  reportActiveDocument,
  getActiveDocument,
  useActiveDocument,
  createAllternitAssistantExtension,
} from '../extensions';
export type { OfficeAiSlotProps, ActiveDocumentInfo } from '../extensions';
