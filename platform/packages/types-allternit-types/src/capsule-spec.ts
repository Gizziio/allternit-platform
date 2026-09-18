import type { A2UIPayload } from './a2ui-types';

export type IntentTokenKind = 'intent' | 'entity' | 'constraint' | 'risk' | 'confidence';
export type EvidenceKind = 'url' | 'doc' | 'pdf' | 'note' | 'repo' | 'diff' | 'testRun' | 'log' | 'artifact' | 'dataset';
export type SafetyTier = 'read' | 'write' | 'exec' | 'danger';
export type UIAffordance = 'button' | 'menu' | 'formSubmit' | 'dragDrop';
export type EventType = 'evidenceAdded' | 'evidenceRemoved' | 'goalChanged' | 'journalEvent' | 'userAction';
export type UpdateStrategy = 'recompileFull' | 'recompilePartial' | 'patchUi' | 'patchDataModel';
export type DiffMode = 'stableIds' | 'positionAware' | 'contentHash';
export type PhysicsProfile = 'structuredLight' | 'structuredStrong' | 'freeformLight';

export interface IntentToken {
    kind: IntentTokenKind;
    value: string;
    weight?: number;
}

export interface Goal {
    text: string;
    tokens?: IntentToken[];
}

export interface EvidenceObject {
    evidenceId: string;
    kind: EvidenceKind;
    title: string;
    uri?: string;
    favicon?: string;
    snapshotRef?: string;
    extractedSchema: Record<string, unknown>;
    metadata: Record<string, unknown>;
    extractionStatus: 'loading' | 'ready' | 'error';
    pinState: 'none' | 'pinned' | 'excluded';
    freshness: 'recent' | 'stale';
    confidence: number;
}

export interface SurfacePolicy {
    componentWhitelist?: string[];
    noCodeExecution?: boolean;
}

export interface UISpec {
    a2uiPayload: A2UIPayload;
    surfacePolicy?: SurfacePolicy;
}

export interface ActionSpec {
    actionId: string;
    label: string;
    safetyTier: SafetyTier;
    toolRef: string;
    inputSchema: Record<string, unknown>;
    uiAffordance?: UIAffordance;
}

export interface BindingSpec {
    from: string;
    to: string;
    transform?: string;
}

export interface WhenCondition {
    event: EventType;
    filter: Record<string, unknown>;
}

export interface ThenAction {
    strategy: UpdateStrategy;
    diffMode?: DiffMode;
}

export interface UpdateRule {
    when: WhenCondition;
    then: ThenAction;
}

export interface TokenSemantics {
    dragToRefine?: boolean;
    snapZones?: string[];
}

export interface MotionSemantics {
    riskHeat?: boolean;
    confidenceFog?: boolean;
    constraintGravity?: boolean;
}

export interface InteractionSpec {
    physicsProfile?: PhysicsProfile;
    tokenSemantics?: TokenSemantics;
    motionSemantics?: MotionSemantics;
}

export interface SourceLink {
    evidenceId: string;
    uri: string;
    anchor?: string;
}

// UI State extensions for polish features
export interface UIState {
    activeCapsuleId: string | null;
    activeSurfaceId: string | null;
    evidenceFilter: EvidenceFilter;
    showWhyPanel: boolean;
    toasts: Toast[];
    motionEvents: MotionEvent[];
}

export interface EvidenceFilter {
    kinds: EvidenceKind[];
    tags: string[];
}

export interface Toast {
    id: string;
    message: string;
    type: 'success' | 'info' | 'warn' | 'error';
    duration: number;
    timestamp: number;
}

export interface MotionEvent {
    type: string;
    targetElement: string;
    timing: number;
}

export interface Provenance {
    runId: string;
    createdAtMs: number;
    sourceLinks: SourceLink[];
}

export interface CapsuleSpec {
    id: string;
    capsuleType?: string;
    goal: Goal;
    evidence: EvidenceObject[];
    ui: UISpec;
    actions: ActionSpec[];
    bindings: BindingSpec[];
    updateRules: UpdateRule[];
    interaction?: InteractionSpec;
    provenance: Provenance;
}
