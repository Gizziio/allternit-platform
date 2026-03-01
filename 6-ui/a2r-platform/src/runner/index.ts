/**
 * DAK Runner - Deterministic Agent Kernel
 * 
 * Complete runner module with:
 * - DAG planning and execution
 * - Work item (WIH) management
 * - Lease management
 * - Context pack browser
 * - Receipt query
 * - Template library
 * - Snapshot management
 */

// Store
export { useDakStore } from "./dak.store";

// Types
export type {
  // DAG
  DagDefinition,
  DagExecution,
  DagPlanRequest,
  DagRefineRequest,
  DagNode,
  DagEdge,
  DagNodeStatus,
  DagEdgeType,
  DagMutation,
  // WIH
  WihInfo,
  WihPickupRequest,
  WihCloseRequest,
  // Lease
  ManagedLease,
  LeaseRequest,
  LeaseStatus,
  // Context Pack
  ContextPack,
  ContextPackInputs,
  ContextPackQuery,
  // Receipt
  Receipt,
  ReceiptQuery,
  ReceiptKind,
  // Gate
  GateCheck,
  ToolCall,
  GateDecision,
  // Policy
  PolicyMarker,
  InjectionPoint,
  // Snapshot
  ToolSnapshot,
  SnapshotStats,
  // Template
  PromptTemplate,
  TemplateCategory,
  TemplateVariable,
  TemplateExecutionRequest,
  // Events
  DakEvent,
  DakEventType,
  DakHealthStatus,
} from "./dak.types";

// Components
export {
  DagPlanningPanel,
  WIHManagerPanel,
  LeaseMonitorPanel,
  ContextPackBrowser,
  ReceiptQueryPanel,
  TemplateLibraryPanel,
  SnapshotManagerPanel,
} from "./components";
