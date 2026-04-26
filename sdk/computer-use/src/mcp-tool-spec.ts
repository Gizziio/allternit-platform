/**
 * Allternit Computer Use — MCP Tool Specifications
 *
 * TypeScript types and JSON Schema definitions for all 12 MCP tools exposed
 * by the Allternit Computer Use Engine MCP server.
 *
 * @module mcp-tool-spec
 */

// =============================================================================
// Core spec type
// =============================================================================

export interface McpToolSpec {
  /** The tool name as registered with the MCP server. */
  name: McpToolName;
  /** Human-readable description shown in Claude Desktop / MCP clients. */
  description: string;
  /** JSON Schema for the tool's input parameters. */
  inputSchema: Record<string, unknown>;
}

// =============================================================================
// Tool name union
// =============================================================================

export type McpToolName =
  | 'screenshot'
  | 'click'
  | 'type'
  | 'scroll'
  | 'key'
  | 'navigate'
  | 'find_element'
  | 'read_screen'
  | 'run_code'
  | 'record_start'
  | 'record_stop'
  | 'execute_task';

// =============================================================================
// Per-tool input / result interfaces
// =============================================================================

// --- screenshot ---

export interface McpScreenshotInput {
  session_id: string;
  full_page?: boolean;
}

export interface McpScreenshotResult {
  /** Base64-encoded PNG. */
  screenshot: string;
  url: string;
  width: number;
  height: number;
}

// --- click ---

export interface McpClickInput {
  session_id: string;
  /** Pixel x-coordinate. Required if selector is not provided. */
  x?: number;
  /** Pixel y-coordinate. Required if selector is not provided. */
  y?: number;
  /** CSS selector or text selector. Required if (x, y) not provided. */
  selector?: string;
}

export interface McpClickResult {
  success: boolean;
  /** Resolved element description, if available. */
  element: string | null;
}

// --- type ---

export interface McpTypeInput {
  session_id: string;
  text: string;
  /** Optional CSS selector to focus before typing. */
  selector?: string;
}

export interface McpTypeResult {
  success: boolean;
  chars_typed: number;
}

// --- scroll ---

export type McpScrollDirection = 'up' | 'down' | 'left' | 'right';

export interface McpScrollInput {
  session_id: string;
  direction?: McpScrollDirection;
  /** Number of scroll steps (default: 3). */
  amount?: number;
}

export interface McpScrollResult {
  success: boolean;
  position: { x: number; y: number };
}

// --- key ---

export interface McpKeyInput {
  session_id: string;
  /**
   * Key(s) to press. Examples: "Enter", "Tab", "Control+a", "Escape".
   * Modifier+key combos use "+" as separator.
   */
  keys: string;
}

export interface McpKeyResult {
  success: boolean;
  keys: string;
}

// --- navigate ---

export type McpWaitUntil = 'load' | 'domcontentloaded' | 'networkidle' | 'commit';

export interface McpNavigateInput {
  session_id: string;
  url: string;
  wait_until?: McpWaitUntil;
}

export interface McpNavigateResult {
  success: boolean;
  url: string;
  title: string;
}

// --- find_element ---

export type McpFindStrategy = 'selector' | 'text' | 'accessibility' | 'vision';

export interface McpFindElementInput {
  session_id: string;
  /** Natural language or selector description of the element to find. */
  description: string;
  strategy?: McpFindStrategy;
}

export interface McpFindElementResult {
  found: boolean;
  /** CSS selector for the located element, if available. */
  selector: string | null;
  /** Visible text of the element, if available. */
  text: string | null;
  /** Bounding box {x, y, width, height}, if available. */
  bounds: Record<string, number> | null;
}

// --- read_screen ---

export type McpReadScreenMode = 'text' | 'accessibility' | 'structured';

export interface McpReadScreenInput {
  session_id: string;
  mode?: McpReadScreenMode;
}

export interface McpReadScreenResult {
  /** Extracted content string. */
  content: string;
  /** Structured element list (populated in structured/accessibility modes). */
  elements: unknown[];
}

// --- run_code ---

export type McpCodeLanguage = 'python' | 'javascript';

export interface McpRunCodeInput {
  session_id: string;
  code: string;
  language?: McpCodeLanguage;
  /** Execution timeout in seconds (default: 30, max: 120). */
  timeout?: number;
}

export interface McpRunCodeResult {
  success: boolean;
  output: string;
  error: string | null;
}

// --- record_start ---

export interface McpRecordStartInput {
  session_id: string;
  /** Optional human-readable name for this recording. */
  name?: string;
}

export interface McpRecordStartResult {
  /** Opaque ID used with record_stop to finalize the recording. */
  recording_id: string;
  /** Absolute path to the JSONL file being written. */
  path: string;
}

// --- record_stop ---

export interface McpRecordStopInput {
  session_id: string;
  recording_id: string;
}

export interface McpRecordStopResult {
  success: boolean;
  /** Number of recorded action frames. */
  frames: number;
  /** Absolute path to the finalized JSONL file. */
  path: string;
}

// --- execute_task ---

export type McpTaskMode = 'intent' | 'direct' | 'assist';

export interface McpExecuteTaskInput {
  session_id: string;
  task: string;
  mode?: McpTaskMode;
  /** Maximum PlanningLoop iterations (default: 20). */
  max_steps?: number;
}

export interface McpExecuteTaskResult {
  success: boolean;
  /** Human-readable summary of what was accomplished. */
  summary: string;
  /** Number of planning steps executed. */
  steps: number;
  run_id: string;
}

// =============================================================================
// Full spec array — all 12 tools
// =============================================================================

export const MCP_TOOL_SPECS: McpToolSpec[] = [
  {
    name: 'screenshot',
    description:
      'Capture a screenshot of the current browser page for the given session. Returns base64 PNG, URL, and viewport dimensions.',
    inputSchema: {
      type: 'object',
      properties: {
        session_id: { type: 'string', description: 'Active session identifier.' },
        full_page: {
          type: 'boolean',
          default: false,
          description: 'Capture full scrollable page instead of visible viewport.',
        },
      },
      required: ['session_id'],
    },
  },
  {
    name: 'click',
    description:
      'Click at pixel coordinates (x, y) or on an element matched by selector. Provide either coordinates or selector.',
    inputSchema: {
      type: 'object',
      properties: {
        session_id: { type: 'string' },
        x: { type: 'integer', description: 'Pixel x-coordinate.' },
        y: { type: 'integer', description: 'Pixel y-coordinate.' },
        selector: { type: 'string', description: 'CSS or text selector.' },
      },
      required: ['session_id'],
    },
  },
  {
    name: 'type',
    description: 'Type text into the focused element, or into selector if provided.',
    inputSchema: {
      type: 'object',
      properties: {
        session_id: { type: 'string' },
        text: { type: 'string', description: 'Text to type.' },
        selector: { type: 'string', description: 'Optional element to focus before typing.' },
      },
      required: ['session_id', 'text'],
    },
  },
  {
    name: 'scroll',
    description: 'Scroll the page in a direction by a number of steps.',
    inputSchema: {
      type: 'object',
      properties: {
        session_id: { type: 'string' },
        direction: {
          type: 'string',
          enum: ['up', 'down', 'left', 'right'],
          default: 'down',
        },
        amount: { type: 'integer', default: 3, description: 'Number of scroll steps.' },
      },
      required: ['session_id'],
    },
  },
  {
    name: 'key',
    description:
      'Press keyboard key(s). Examples: "Enter", "Tab", "Control+a", "Escape". Use "+" to combine modifiers.',
    inputSchema: {
      type: 'object',
      properties: {
        session_id: { type: 'string' },
        keys: { type: 'string', description: 'Key(s) to press, e.g. "Control+a".' },
      },
      required: ['session_id', 'keys'],
    },
  },
  {
    name: 'navigate',
    description: 'Navigate the browser session to a URL.',
    inputSchema: {
      type: 'object',
      properties: {
        session_id: { type: 'string' },
        url: { type: 'string', description: 'Target URL.' },
        wait_until: {
          type: 'string',
          enum: ['load', 'domcontentloaded', 'networkidle', 'commit'],
          default: 'domcontentloaded',
        },
      },
      required: ['session_id', 'url'],
    },
  },
  {
    name: 'find_element',
    description:
      'Find an element on the page using a description and search strategy (selector, text, accessibility, or vision).',
    inputSchema: {
      type: 'object',
      properties: {
        session_id: { type: 'string' },
        description: {
          type: 'string',
          description: 'Natural language or selector description of the element.',
        },
        strategy: {
          type: 'string',
          enum: ['selector', 'text', 'accessibility', 'vision'],
          default: 'accessibility',
        },
      },
      required: ['session_id', 'description'],
    },
  },
  {
    name: 'read_screen',
    description:
      'Read text or structural content from the current page view. Returns content string and structured element list.',
    inputSchema: {
      type: 'object',
      properties: {
        session_id: { type: 'string' },
        mode: {
          type: 'string',
          enum: ['text', 'accessibility', 'structured'],
          default: 'accessibility',
        },
      },
      required: ['session_id'],
    },
  },
  {
    name: 'run_code',
    description:
      'Execute Python or JavaScript code in a subprocess sandbox. Returns stdout, stderr, and success flag.',
    inputSchema: {
      type: 'object',
      properties: {
        session_id: { type: 'string' },
        code: { type: 'string', description: 'Source code to execute.' },
        language: { type: 'string', enum: ['python', 'javascript'], default: 'python' },
        timeout: {
          type: 'integer',
          default: 30,
          maximum: 120,
          description: 'Execution timeout in seconds.',
        },
      },
      required: ['session_id', 'code'],
    },
  },
  {
    name: 'record_start',
    description:
      'Start recording all actions for this session to a JSONL file. Returns recording_id for use with record_stop.',
    inputSchema: {
      type: 'object',
      properties: {
        session_id: { type: 'string' },
        name: { type: 'string', description: 'Optional human-readable recording name.' },
      },
      required: ['session_id'],
    },
  },
  {
    name: 'record_stop',
    description:
      'Stop an active recording and finalize the JSONL file. Returns frame count and output path.',
    inputSchema: {
      type: 'object',
      properties: {
        session_id: { type: 'string' },
        recording_id: { type: 'string', description: 'ID returned by record_start.' },
      },
      required: ['session_id', 'recording_id'],
    },
  },
  {
    name: 'execute_task',
    description:
      'Run a full intent task through the PlanningLoop. Handles planning, acting, and reflecting autonomously. Returns summary, step count, and run_id.',
    inputSchema: {
      type: 'object',
      properties: {
        session_id: { type: 'string' },
        task: { type: 'string', description: 'Natural language task description.' },
        mode: {
          type: 'string',
          enum: ['intent', 'direct', 'assist'],
          default: 'intent',
          description:
            'intent: fully autonomous, direct: no planning step, assist: pauses for approval.',
        },
        max_steps: {
          type: 'integer',
          default: 20,
          description: 'Maximum PlanningLoop iterations.',
        },
      },
      required: ['session_id', 'task'],
    },
  },
];
