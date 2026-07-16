/** Provider-neutral Allternit computer-use contract. Keep aligned with
 * domains/computer-use/core/contracts/schemas/canonical.schema.json.
 */

export const COMPUTER_USE_CONTRACT_VERSION = '1.0.0-alpha.1' as const;

export type ComputerOperatingSystem = 'macos' | 'windows' | 'linux' | 'android';
export type ComputerIsolation = 'host' | 'container' | 'vm';
export type ComputerExecutionMode = 'background_strict' | 'foreground_allowed' | 'sandboxed';
export type ComputerOutcomeStatus = 'worked' | 'didnt' | 'unknown' | 'blocked' | 'cancelled';

export interface ComputerCapabilityManifest {
  provider_id: string;
  provider_version: string;
  contract_version: typeof COMPUTER_USE_CONTRACT_VERSION;
  invariant_version: string;
  invariants: string[];
  operating_systems: ComputerOperatingSystem[];
  actions: string[];
  observation_channels: string[];
  execution_modes: ComputerExecutionMode[];
  strict_background: boolean;
  semantic_input: boolean;
  raw_input: boolean;
  streaming: boolean;
  clipboard: boolean;
  shell: boolean;
  files: boolean;
  audio: boolean;
  mobile: boolean;
  max_concurrency: number;
  limitations: string[];
}

export interface ComputerEnvironment {
  environment_id: string;
  provider_id: string;
  os: ComputerOperatingSystem;
  isolation: ComputerIsolation;
  state: 'creating' | 'ready' | 'paused' | 'stopped' | 'failed';
  capabilities: ComputerCapabilityManifest;
  image_digest?: string | null;
  metadata: Record<string, unknown>;
}

export interface ComputerEnvironmentRecord {
  environment_id: string;
  owner_id: string;
  provider_id: string;
  os: ComputerOperatingSystem;
  isolation: ComputerIsolation;
  state: 'requested' | 'provisioning' | 'running' | 'stopping' | 'stopped' | 'failed' | 'destroyed';
  image_digest?: string | null;
  created_at: string;
  updated_at: string;
  expires_at?: string | null;
  metadata: Record<string, unknown>;
}

export interface ComputerEnvironmentProviderManifest {
  provider_id: string;
  operating_systems: ComputerOperatingSystem[];
  isolations: ComputerIsolation[];
  available: boolean;
  reason?: string | null;
  capabilities: string[];
}

export interface ComputerImageRecord {
  digest: string;
  source: string;
  os: ComputerOperatingSystem;
  architecture: string;
  provenance: Record<string, unknown>;
  scan_status: 'clean' | 'failed' | 'pending' | 'unavailable';
  created_at: string;
}

export interface ComputerEnvironmentLease {
  lease_id: string;
  environment_id: string;
  holder_id: string;
  kind: 'agent' | 'human_takeover';
  issued_at: string;
  expires_at: string;
}

export interface ComputerRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ComputerElementNode {
  ref: string;
  role: string;
  name: string;
  value: string;
  description: string;
  bounds?: ComputerRect | null;
  states: string[];
  actions: string[];
  children: ComputerElementNode[];
  provider_metadata: Record<string, unknown>;
}

export interface ComputerRoot {
  root_id: string;
  resource_id: string;
  kind: string;
  title: string;
  application: string;
  process_id?: number | null;
  bounds?: ComputerRect | null;
  focused: boolean;
}

export interface ComputerRootDiscovery {
  session_id: string;
  environment_id: string;
  providers: Record<string, ComputerRoot[]>;
}

export interface ComputerImageEvidence {
  artifact_id: string;
  media_type: 'image/png' | 'image/jpeg';
  width: number;
  height: number;
  sha256: string;
  coordinate_space: string;
}

export interface ComputerObservation {
  state_id: string;
  session_id: string;
  environment_id: string;
  resource_id: string;
  epoch: number;
  captured_at: string;
  provider_id: string;
  provider_version: string;
  roots: ComputerRoot[];
  elements: ComputerElementNode[];
  image?: ComputerImageEvidence | null;
  truncated: boolean;
  metadata: Record<string, unknown>;
}

export interface ComputerActionTarget {
  ref?: string | null;
  x?: number | null;
  y?: number | null;
  root_id?: string | null;
}

export interface ComputerActionStep {
  action: string;
  target?: ComputerActionTarget | null;
  arguments: Record<string, unknown>;
}

export interface ComputerPostcondition {
  kind: 'text' | 'role' | 'value' | 'visible' | 'focused';
  value: string;
  gone: boolean;
  timeout_ms: number;
}

export interface ComputerActionTransaction {
  transaction_id: string;
  session_id: string;
  environment_id: string;
  resource_id: string;
  base_state_id: string;
  mode: ComputerExecutionMode;
  steps: ComputerActionStep[];
  postcondition?: ComputerPostcondition | null;
  approval_id?: string | null;
}

export interface ComputerActionEvidence {
  grounding: string;
  delivery: string;
  details: Record<string, unknown>;
  artifact_ids: string[];
}

export interface ComputerStepOutcome {
  index: number;
  status: ComputerOutcomeStatus;
  evidence: ComputerActionEvidence;
  error_code?: string | null;
  message?: string | null;
}

export interface ComputerTransactionOutcome {
  transaction_id: string;
  status: ComputerOutcomeStatus;
  step_outcomes: ComputerStepOutcome[];
  stopped_at: number | null;
  successor_state_id: string | null;
  receipt_id?: string | null;
  policy_decision_id?: string | null;
  duration_ms?: number | null;
  metadata: Record<string, unknown>;
}

export interface ComputerApprovalGrant {
  approval_id: string;
  action_hash: string;
  approved_by: string;
  issued_at: number;
  expires_at: number;
}

export interface ComputerEvent<TPayload extends Record<string, unknown> = Record<string, unknown>> {
  event_id: string;
  event_type: string;
  occurred_at: string;
  session_id: string;
  payload: TPayload;
  run_id?: string | null;
  state_id?: string | null;
  transaction_id?: string | null;
  trace_id?: string | null;
  contract_version: typeof COMPUTER_USE_CONTRACT_VERSION;
}
