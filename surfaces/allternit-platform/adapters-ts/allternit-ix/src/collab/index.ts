// OWNER: T2-A4

/**
 * Real-time Collaboration
 *
 * Yjs/CRDT integration for collaborative UI editing.
 *
 * @example
 * ```typescript
 * import { YjsClient, AwarenessManager, CapsuleRegistry } from '@allternit/ix/collab';
 *
 * const client = new YjsClient('room-123', config);
 * const text = client.getText('document');
 * text.insert(0, 'Hello collaborative world!');
 * ```
 */

export {
  // YJS Types
  type YjsConfig,
  type CollaborationSession,
  type Participant,
  type CursorPosition,
  type Range,
  type UserState,
  type AwarenessChanges,
  type DocType,
  type OperationType,
  type DocChangeEvent,
  type SyncState,
  type CursorStyle,
  type CollabConfig,
  defaultCollabConfig,
} from './yjs-types';

export {
  // YJS Client
  YjsClient,
  createYjsClient,
  defaultConfig,
} from './yjs-client';

export {
  // YJS Protocols
  BroadcastProtocol,
  SyncProtocol,
  AwarenessManager,
  createAwarenessManager,
} from './yjs-protocols';

export {
  // Capsule Registry
  CapsuleRegistry,
  createCapsuleRegistry,
  type CapsuleEvent,
  type CapsuleSubscriber,
} from './capsule-registry';

export {
  // YJS Adapter
  createYjsAdapter,
  createCollaborativeStore,
  type YjsAdapter,
  type YjsAdapterConfig,
  type AwarenessState,
} from './yjs-adapter';

export {
  // Visual Editor
  createVisualEditor,
  ui,
  type VisualEditor,
  type UIRootBuilder,
  type UIComponentBuilder,
} from './visual-editor';
