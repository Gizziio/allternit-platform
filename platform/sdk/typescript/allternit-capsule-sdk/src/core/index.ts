/**
 * Core Module Exports
 *
 * All core SDK types and utilities are exported here.
 */

// Identifiers
export type {
  SpaceId,
  CapsuleId,
  TabId,
  ActionId,
  EventId,
} from './ids.js';

export {
  generateCapsuleId,
  generateTabId,
  generateEventId,
  generateSpaceId,
} from './ids.js';

// Presentation
export type { StagePreset, Presentation } from './presentation.js';
export { STAGE_PRESETS } from './presentation.js';

// Lifecycle
export type {
  CapsulePhase,
  CapsuleError,
  CapsuleLifecycleState,
  CapsuleLifecycleController,
  LifecycleChangeEvent,
  LifecycleEventPayload,
} from './lifecycle.js';

export {
  createLifecycleController,
  isValidTransition,
  getValidNextPhases,
  PHASE_DESCRIPTIONS,
} from './lifecycle.js';

// Capabilities
export type {
  CapsuleCapabilities,
  CapsuleCapabilitiesController,
} from './capabilities.js';

export {
  createCapabilitiesController,
  DEFAULT_CAPABILITIES,
  supportsStaging,
  supportsStreaming,
  supportsGpu,
  supportsMultiTab,
  isAgentControllable,
  mergeCapabilities,
} from './capabilities.js';

// Events
export type {
  A2Event,
  EventBus,
  LifecycleChangedPayload,
  CapabilitiesPayload,
  PresentationChangedPayload,
  ActionMissingPayload,
  StageChangedPayload,
  RendererChangedPayload,
} from './events.js';

export {
  createEvent,
  createEventBus,
  EVENT_LIFECYCLE_CHANGED,
  EVENT_STATUS_CHANGED,
  EVENT_CAPABILITIES_CHANGED,
  EVENT_PRESENTATION_CHANGED,
  EVENT_ACTION_MISSING,
  EVENT_STAGE_CHANGED,
  EVENT_STAGE_REQUESTED,
  EVENT_RENDERER_CHANGED,
  EVENT_ERROR,
} from './events.js';

// Actions
export type {
  CapsuleAction,
  ActionRegistry,
  ActionBuilder,
} from './actions.js';

export {
  createActionRegistry,
  createActionBuilder,
  BROWSER_ACTIONS,
} from './actions.js';
