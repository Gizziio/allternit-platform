/**
 * Allternit Computers — MCP Tool Specifications
 *
 * JSON Schema declarations for every tool exposed by the standalone
 * Computers MCP server. Tool names, input shapes, and approval semantics are
 * derived 1:1 from the real REST routes:
 *
 * - `cmd/allternit-api/src/computer_routes.rs` (`router()`, `/api/v1/computers*`)
 * - `cmd/allternit-api/src/bot_desktop_templates.rs` (`router()`, `/api/v1/desktop-templates*`)
 *
 * @module tool-spec
 */

// =============================================================================
// Core spec type
// =============================================================================

export interface McpToolSpec {
  /** The tool name as registered with the MCP server (dot-namespaced). */
  name: McpToolName;
  /** Human-readable description shown in MCP clients. */
  description: string;
  /** JSON Schema for the tool's input parameters. */
  inputSchema: Record<string, unknown>;
  /**
   * True when the underlying route enforces the ACI confirmation policy
   * (`enforce_control_confirmation` / `enforce_confirmation`). Such tools
   * accept an optional `approvalId` that is threaded as the `?approval_id=`
   * query param. The server NEVER auto-obtains approvals; a missing or
   * invalid grant surfaces the API's denial message in the tool result.
   */
  requiresApproval: boolean;
}

// =============================================================================
// Tool name union — 24 tools
// =============================================================================

export type McpToolName =
  // lifecycle
  | 'computers.create'
  | 'computers.list'
  | 'computers.get'
  | 'computers.start'
  | 'computers.stop'
  | 'computers.restart'
  | 'computers.resize'
  | 'computers.clone'
  | 'computers.delete'
  // control
  | 'computers.screenshot'
  | 'computers.mouse'
  | 'computers.keyboard'
  | 'computers.shell'
  | 'computers.files.upload'
  | 'computers.files.download'
  // snapshots
  | 'computers.snapshots.list'
  | 'computers.snapshots.create'
  | 'computers.snapshots.restore'
  | 'computers.snapshots.delete'
  // desktop templates (Phase 4)
  | 'templates.list'
  | 'templates.import'
  | 'templates.build';

// =============================================================================
// Shared fragments
// =============================================================================

const COMPUTER_ID = {
  type: 'string',
  description: 'ID of the computer (computer-…).',
} as const;

const APPROVAL_ID = {
  type: 'string',
  description:
    'Optional action-hash grant (ACI approval id) for this risky action. ' +
    'Threaded as ?approval_id=. Never auto-obtained: without a valid grant ' +
    'the API denies the action and its message is returned here.',
} as const;

const approvalProps = {
  approvalId: APPROVAL_ID,
};

// =============================================================================
// Full spec array
// =============================================================================

export const COMPUTER_TOOL_SPECS: McpToolSpec[] = [
  // ── Lifecycle ──────────────────────────────────────────────────────────────
  {
    name: 'computers.create',
    requiresApproval: true,
    description:
      'Create a standalone cloud_desktop or local (Tart) computer. POST /api/v1/computers.',
    inputSchema: {
      type: 'object',
      properties: {
        kind: {
          type: 'string',
          enum: ['cloud_desktop', 'local'],
          description: 'Computer kind. managed is cut; byo_vps/byoc are not implemented.',
        },
        owner_type: {
          type: 'string',
          enum: ['user', 'org', 'bot', 'session'],
          description: 'Defaults to session when session_id is set without bot_id, else bot.',
        },
        owner_id: { type: 'string', description: 'Must match the authenticated owner.' },
        bot_id: { type: 'string', description: 'Required for bot-owned cloud_desktops.' },
        session_id: { type: 'string', description: 'Bind the computer to a session.' },
        name: { type: 'string' },
        os: { type: 'string', description: 'e.g. linux, windows, macos.' },
        cpu_cores: { type: 'integer', enum: [2, 4, 8] },
        memory_mb: { type: 'integer', enum: [4096, 8192, 16384, 32768, 65536] },
        disk_mb: { type: 'integer', enum: [20480, 40960, 81920] },
        resolution: { type: 'string', enum: ['1280x720', '1920x1080', '2560x1440'] },
        template_id: { type: 'string', description: 'Desktop template id (exactly one of template_id/template_ref).' },
        template_ref: { type: 'string', description: 'Curated system/… template ref.' },
        persistence: { type: 'string', enum: ['ephemeral', 'session', 'persistent'] },
        provider: { type: 'string', description: 'Substrate hint: incus (Linux/Windows) or tart (macOS).' },
        ...approvalProps,
      },
      required: ['kind'],
    },
  },
  {
    name: 'computers.list',
    requiresApproval: false,
    description: 'List visible computers. GET /api/v1/computers.',
    inputSchema: {
      type: 'object',
      properties: {
        bot_id: { type: 'string', description: 'Filter by owning bot.' },
        kind: { type: 'string', enum: ['local', 'byo_vps', 'managed', 'byoc', 'cloud_desktop'] },
        group_id: { type: 'string', description: 'Filter by computer group.' },
        include_roles: {
          type: 'string',
          description: 'Truthy ("1"/"true"/"yes") includes non-user roles (golden template-build holders).',
        },
      },
    },
  },
  {
    name: 'computers.get',
    requiresApproval: false,
    description: 'Get one computer by id. GET /api/v1/computers/:id.',
    inputSchema: {
      type: 'object',
      properties: { computer_id: COMPUTER_ID },
      required: ['computer_id'],
    },
  },
  {
    name: 'computers.start',
    requiresApproval: true,
    description: 'Start (resume) a stopped cloud_desktop or local computer. POST /api/v1/computers/:id/start.',
    inputSchema: {
      type: 'object',
      properties: { computer_id: COMPUTER_ID, ...approvalProps },
      required: ['computer_id'],
    },
  },
  {
    name: 'computers.stop',
    requiresApproval: true,
    description: 'Stop (pause) a cloud_desktop or local computer. POST /api/v1/computers/:id/stop.',
    inputSchema: {
      type: 'object',
      properties: { computer_id: COMPUTER_ID, ...approvalProps },
      required: ['computer_id'],
    },
  },
  {
    name: 'computers.restart',
    requiresApproval: true,
    description: 'Restart a running/stopped cloud_desktop or local computer. POST /api/v1/computers/:id/restart.',
    inputSchema: {
      type: 'object',
      properties: { computer_id: COMPUTER_ID, ...approvalProps },
      required: ['computer_id'],
    },
  },
  {
    name: 'computers.resize',
    requiresApproval: true,
    description:
      'Resize CPU/memory/disk of a cloud_desktop. PATCH /api/v1/computers/:id/resize. Disk resize requires a stopped computer.',
    inputSchema: {
      type: 'object',
      properties: {
        computer_id: COMPUTER_ID,
        cpu_cores: { type: 'integer', enum: [2, 4, 8] },
        memory_mb: { type: 'integer', enum: [4096, 8192, 16384, 32768, 65536] },
        disk_mb: { type: 'integer', enum: [20480, 40960, 81920] },
        ...approvalProps,
      },
      required: ['computer_id'],
    },
  },
  {
    name: 'computers.clone',
    requiresApproval: true,
    description: 'Clone a running/stopped cloud_desktop into a new computer. POST /api/v1/computers/:id/clone.',
    inputSchema: {
      type: 'object',
      properties: {
        computer_id: COMPUTER_ID,
        name: { type: 'string', description: 'Name for the clone (default: "<source> (copy)").' },
        ...approvalProps,
      },
      required: ['computer_id'],
    },
  },
  {
    name: 'computers.delete',
    requiresApproval: true,
    description:
      'Delete a cloud_desktop or local computer (204 on success; already-missing is also 204). POST /api/v1/computers/:id/delete.',
    inputSchema: {
      type: 'object',
      properties: { computer_id: COMPUTER_ID, ...approvalProps },
      required: ['computer_id'],
    },
  },

  // ── Control ────────────────────────────────────────────────────────────────
  {
    name: 'computers.screenshot',
    requiresApproval: false,
    description:
      'Capture a PNG screenshot of the computer desktop. GET /api/v1/computers/:id/screenshot. Returns base64-encoded PNG.',
    inputSchema: {
      type: 'object',
      properties: { computer_id: COMPUTER_ID },
      required: ['computer_id'],
    },
  },
  {
    name: 'computers.mouse',
    requiresApproval: true,
    description:
      'Move/click/drag the mouse on the computer desktop. POST /api/v1/computers/:id/mouse (ACI-gated).',
    inputSchema: {
      type: 'object',
      properties: {
        computer_id: COMPUTER_ID,
        action: {
          type: 'string',
          enum: ['move', 'click', 'rightclick', 'doubleclick', 'mousedown', 'mouseup'],
        },
        x: { type: 'integer', description: 'X coordinate on the virtual screen.' },
        y: { type: 'integer', description: 'Y coordinate on the virtual screen.' },
        button: { type: 'string', enum: ['left', 'middle', 'right'], description: 'Defaults to left.' },
        end_x: { type: 'integer', description: 'Drag end X.' },
        end_y: { type: 'integer', description: 'Drag end Y.' },
        amount: { type: 'integer', description: 'Scroll amount.' },
        ...approvalProps,
      },
      required: ['computer_id', 'action'],
    },
  },
  {
    name: 'computers.keyboard',
    requiresApproval: true,
    description:
      'Type text or press a key on the computer desktop. POST /api/v1/computers/:id/keyboard (ACI-gated).',
    inputSchema: {
      type: 'object',
      properties: {
        computer_id: COMPUTER_ID,
        action: { type: 'string', enum: ['type', 'key'] },
        text: { type: 'string', description: 'Text to type when action is type.' },
        key: { type: 'string', description: 'Key to press when action is key (e.g. Return, Control_L, F5).' },
        ...approvalProps,
      },
      required: ['computer_id', 'action'],
    },
  },
  {
    name: 'computers.shell',
    requiresApproval: true,
    description:
      'Run a shell command inside the computer guest. POST /api/v1/computers/:id/shell (ACI-gated).',
    inputSchema: {
      type: 'object',
      properties: {
        computer_id: COMPUTER_ID,
        command: { type: 'array', items: { type: 'string' }, description: 'Command and arguments.' },
        env: { type: 'object', description: 'Additional environment variables.' },
        timeout: { type: 'integer', description: 'Timeout in seconds (ignored by Incus today; 60s guest wait).' },
        ...approvalProps,
      },
      required: ['computer_id', 'command'],
    },
  },
  {
    name: 'computers.files.upload',
    requiresApproval: true,
    description:
      'Upload a file into the computer guest. POST /api/v1/computers/:id/files/upload?path=… with raw application/octet-stream bytes (ACI-gated). Content is decoded from base64 before sending.',
    inputSchema: {
      type: 'object',
      properties: {
        computer_id: COMPUTER_ID,
        path: { type: 'string', description: 'Absolute guest destination path.' },
        content: { type: 'string', description: 'Base64-encoded file content.' },
        ...approvalProps,
      },
      required: ['computer_id', 'path', 'content'],
    },
  },
  {
    name: 'computers.files.download',
    requiresApproval: false,
    description:
      'Download a file from the computer guest. GET /api/v1/computers/:id/files/download?path=…. Returns base64-encoded content.',
    inputSchema: {
      type: 'object',
      properties: {
        computer_id: COMPUTER_ID,
        path: { type: 'string', description: 'Absolute guest path to the file.' },
      },
      required: ['computer_id', 'path'],
    },
  },

  // ── Snapshots ──────────────────────────────────────────────────────────────
  {
    name: 'computers.snapshots.list',
    requiresApproval: false,
    description: 'List snapshots of a computer. GET /api/v1/computers/:id/snapshots.',
    inputSchema: {
      type: 'object',
      properties: { computer_id: COMPUTER_ID },
      required: ['computer_id'],
    },
  },
  {
    name: 'computers.snapshots.create',
    requiresApproval: false,
    description: 'Create a snapshot of a computer. POST /api/v1/computers/:id/snapshots.',
    inputSchema: {
      type: 'object',
      properties: {
        computer_id: COMPUTER_ID,
        stateful: { type: 'boolean', description: 'Include runtime state (default false).', default: false },
      },
      required: ['computer_id'],
    },
  },
  {
    name: 'computers.snapshots.restore',
    requiresApproval: false,
    description:
      'Restore a computer from a snapshot. POST /api/v1/computers/:id/snapshots/:snapshot_id/restore.',
    inputSchema: {
      type: 'object',
      properties: { computer_id: COMPUTER_ID, snapshot_id: { type: 'string' } },
      required: ['computer_id', 'snapshot_id'],
    },
  },
  {
    name: 'computers.snapshots.delete',
    requiresApproval: false,
    description: 'Delete a computer snapshot. DELETE /api/v1/computers/:id/snapshots/:snapshot_id.',
    inputSchema: {
      type: 'object',
      properties: { computer_id: COMPUTER_ID, snapshot_id: { type: 'string' } },
      required: ['computer_id', 'snapshot_id'],
    },
  },

  // ── Desktop templates (Phase 4) ────────────────────────────────────────────
  {
    name: 'templates.list',
    requiresApproval: false,
    description:
      'List visible desktop templates (public, own, or org). GET /api/v1/desktop-templates.',
    inputSchema: {
      type: 'object',
      properties: {
        os: { type: 'string', description: 'Filter by OS (case-insensitive).' },
        tag: { type: 'string', description: 'Filter by tag (case-insensitive substring).' },
      },
    },
  },
  {
    name: 'templates.import',
    requiresApproval: false,
    description:
      'Create/replace a desktop template from a canonical apiVersion: allternit.ai/v1 ComputerTemplate doc (YAML or JSON). POST /api/v1/desktop-templates/import.',
    inputSchema: {
      type: 'object',
      properties: {
        doc: {
          type: 'string',
          description: 'The ComputerTemplate document as a YAML or JSON string.',
        },
      },
      required: ['doc'],
    },
  },
  {
    name: 'templates.build',
    requiresApproval: true,
    description:
      'Build a desktop template into a golden snapshot (async; 202 on start). POST /api/v1/desktop-templates/:id/build (ACI-gated).',
    inputSchema: {
      type: 'object',
      properties: {
        template_id: { type: 'string', description: 'ID of the desktop template (dtpl-…).' },
        ...approvalProps,
      },
      required: ['template_id'],
    },
  },
];
