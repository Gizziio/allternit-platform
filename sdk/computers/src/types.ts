/**
 * Type shapes for the Allternit Computers API.
 *
 * Mirrored from the server-side serde structs
 * (`cmd/allternit-api/src/computer_routes.rs`,
 * `cmd/allternit-api/src/bot_desktop_input.rs`,
 * `cmd/allternit-api/src/bot_desktop_snapshots.rs`,
 * `cmd/allternit-api/src/bot_desktop_templates.rs`). Field names are the
 * snake_case JSON wire format — the API does not camelCase.
 */

export type ComputerKind =
  | 'local'
  | 'byo_vps'
  | 'managed'
  | 'byoc'
  | 'cloud_desktop';

export type ComputerStatus =
  | 'creating'
  | 'running'
  | 'stopped'
  | 'error'
  | 'deleted';

export interface Computer {
  id: string;
  kind: ComputerKind;
  provider: string;
  status: ComputerStatus;
  owner_type: 'user' | 'org' | 'bot' | 'session';
  owner_id: string;
  bot_id?: string | null;
  session_id?: string | null;
  name: string;
  os?: string | null;
  cpu_cores?: number | null;
  memory_mb?: number | null;
  disk_mb?: number | null;
  /** Only returned at create; resolution is persisted through guest environment. */
  resolution?: string | null;
  region?: string | null;
  host?: string | null;
  native_id?: string | null;
  template_id?: string | null;
  billing_source: string;
  created_at: string;
  updated_at: string;
  idle_timeout_secs?: number | null;
  last_activity_at?: string | null;
  group_id?: string | null;
  /** 'user' or 'golden' (template build holder; hidden unless include_roles=1). */
  role?: string;
}

export interface CreateComputerInput {
  kind: ComputerKind;
  owner_type?: 'user' | 'org' | 'bot' | 'session';
  owner_id?: string;
  cpu_cores?: 2 | 4 | 8;
  memory_mb?: 4096 | 8192 | 16384 | 32768 | 65536;
  disk_mb?: 20480 | 40960 | 81920;
  resolution?: '1280x720' | '1920x1080' | '2560x1440';
  bot_id?: string;
  name?: string;
  os?: string;
  template_id?: string;
  /** Curated `system/...` template ref; exactly one of template_id/template_ref. */
  template_ref?: string;
  session_id?: string;
  persistence?: 'ephemeral' | 'session' | 'persistent';
  /** Substrate hint: incus (Linux/Windows) or tart (macOS). */
  provider?: string;
}

export interface CreateComputerResponse {
  id: string;
  status: string;
  sandbox_id?: string;
  owner_type?: 'user' | 'org' | 'bot';
  owner_id?: string;
  cpu_cores?: number;
  memory_mb?: number;
  disk_mb?: number;
  /** Guest environment setting; echoed at create, not persisted in the row. */
  resolution?: string | null;
  provider?: string;
  host?: string | null;
  persistence?: 'ephemeral' | 'session' | 'persistent';
}

export interface ComputerLifecycleResponse {
  id: string;
  status: string;
  sandbox_id?: string;
}

export interface ListComputersResponse {
  computers: Computer[];
}

export interface ListComputersFilters {
  bot_id?: string;
  kind?: ComputerKind;
  group_id?: string;
  /** Include non-user roles (e.g. golden template-build holders). */
  include_roles?: boolean;
}

export interface ResizeComputerInput {
  cpu_cores?: 2 | 4 | 8;
  memory_mb?: 4096 | 8192 | 16384 | 32768 | 65536;
  disk_mb?: 20480 | 40960 | 81920;
}

export interface ResizeComputerResponse {
  id: string;
  status: ComputerStatus;
  cpu_cores: number | null;
  memory_mb: number | null;
  disk_mb: number | null;
}

/** PATCH /api/v1/computers/:id body; today only the idle auto-stop timer is mutable. */
export interface UpdateComputerInput {
  /** Idle seconds before auto-stop, or null to clear the timer. */
  idle_timeout_secs: number | null;
}

export type ComputerMouseInput =
  | { action: 'move' | 'click' | 'rightclick' | 'doubleclick' | 'mousedown' | 'mouseup'; x?: number; y?: number; button?: 'left' | 'middle' | 'right' }
  | { action: 'drag'; x: number; y: number; end_x: number; end_y: number }
  | { action: 'scroll'; button?: 'up' | 'down'; amount?: number };

export type ComputerKeyboardInput =
  | { action: 'type'; text: string }
  | { action: 'key'; key: string };

export interface ComputerShellInput {
  command: string[];
  env?: Record<string, string>;
  /** Seconds; ignored by the Incus substrate today (60s guest wait). */
  timeout?: number;
}

export interface ComputerShellResponse {
  exit_code: number;
  stdout: string;
  stderr: string;
  duration_ms: number;
}

export interface ComputerSnapshot {
  id: string;
  created_at: string;
  stateful: boolean;
}

export interface ComputerSnapshotActionResponse {
  success: boolean;
  snapshot_id?: string | null;
}

// ---------------------------------------------------------------------------
// Desktop templates (Phase 4 registry).
// ---------------------------------------------------------------------------

export interface DesktopTemplate {
  id: string;
  org_id?: string | null;
  user_id: string;
  name: string;
  description?: string | null;
  os: string;
  image: string;
  cpu_millis: number;
  memory_mib: number;
  disk_mib: number;
  network_enabled: boolean;
  env: Record<string, string>;
  packages: string[];
  tags: string[];
  public: boolean;
  /** Canonical `apiVersion: allternit.ai/v1` `ComputerTemplate` doc (YAML). */
  spec_yaml?: string;
  /** Curated `system/...` ref; seeded-only, never user-writable. */
  ref?: string;
  golden_snapshot_id?: string | null;
  /** NULL = never built, otherwise pending|building|ready|failed. */
  build_status?: string;
  build_error?: string | null;
  built_at?: string;
}

export interface ListDesktopTemplatesFilters {
  os?: string;
  tag?: string;
}

/**
 * Declarative `apiVersion: allternit.ai/v1` `ComputerTemplate` doc accepted by
 * POST /api/v1/desktop-templates/import. The server parses the raw body with a
 * YAML deserializer (JSON is a subset), so this SDK serializes the object as
 * JSON.
 */
export interface ComputerTemplateSpec {
  apiVersion: 'allternit.ai/v1';
  kind: 'ComputerTemplate';
  metadata: {
    name: string;
    description?: string;
    tags?: string[];
  };
  os?: {
    /** Default "linux". */
    name?: string;
    /** "" means the default image for this os (resolved at provision time). */
    image?: string;
  };
  hardware?: {
    cpu_cores?: number;
    memory_mb?: number;
    disk_mb?: number;
    /** [width, height]; validated against the server-side resolution list. */
    resolution?: [number, number];
  };
  packages?: string[];
  services?: Array<{
    name: string;
    command: string;
    env?: Record<string, string>;
    autostart?: boolean;
  }>;
  /** Build-time env injections; `ref` is `vault://org/{org_id}/{cred_name}`. */
  secrets?: Array<{ name: string; ref: string }>;
  hooks?: { postCreate?: string[] };
}

export interface BuildTemplateResponse {
  id: string;
  build_status: string;
}

// ---------------------------------------------------------------------------
// Phase 5 additions: status + embed token.
// These routes (GET /api/v1/computers/:id/status,
// POST /api/v1/computers/:id/embed-token) are being added to the server
// concurrently with this SDK; response payloads are not yet frozen, so these
// types are intentionally permissive.
// ---------------------------------------------------------------------------

export interface ComputerStatusReport {
  id?: string;
  status?: ComputerStatus;
  [extra: string]: unknown;
}

export interface ComputerEmbedTokenResponse {
  token?: string;
  [extra: string]: unknown;
}
