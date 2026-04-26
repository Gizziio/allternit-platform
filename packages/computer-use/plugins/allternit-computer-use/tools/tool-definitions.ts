/**
 * Allternit Computer Use — Tool Definitions
 *
 * All 14 tools exposed by the computer-use plugin.
 * These map 1-to-1 to the MCP server tools and gateway API actions.
 * Injected into the AI context when the plugin is active.
 */

export interface ComputerUseTool {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required: string[];
  };
}

export const COMPUTER_USE_TOOLS: ComputerUseTool[] = [
  // ──────────────────────────────────────────────────────────────
  // OBSERVE
  // ──────────────────────────────────────────────────────────────
  {
    name: "screenshot",
    description:
      "Capture the current state of the browser session as a base64-encoded PNG. " +
      "Always call this before acting on a page you haven't seen yet. " +
      "Returns: screenshot (base64 PNG), url, title, width, height.",
    input_schema: {
      type: "object",
      properties: {
        session_id: { type: "string", description: "Active session identifier" },
        full_page: {
          type: "boolean",
          description: "Capture the full scrollable page height (browser only). Default false.",
          default: false,
        },
        annotate: {
          type: "boolean",
          description: "Overlay step number and timestamp on the captured image. Default false.",
          default: false,
        },
      },
      required: ["session_id"],
    },
  },

  {
    name: "read_screen",
    description:
      "Read the current page as text or accessibility tree — no screenshot needed. " +
      "mode='text' returns raw visible text. " +
      "mode='accessibility' returns the full accessibility tree (roles, labels, values). " +
      "mode='structured' returns a JSON outline (headings, forms, links, inputs). " +
      "Use this to check page state, find elements, or read content without consuming vision tokens.",
    input_schema: {
      type: "object",
      properties: {
        session_id: { type: "string", description: "Active session identifier" },
        mode: {
          type: "string",
          enum: ["text", "accessibility", "structured"],
          description: "Extraction mode. Default: accessibility.",
          default: "accessibility",
        },
      },
      required: ["session_id"],
    },
  },

  {
    name: "find_element",
    description:
      "Find a specific element on the page by description. " +
      "strategy='selector': CSS selector (most reliable when known). " +
      "strategy='text': visible text match. " +
      "strategy='accessibility': ARIA role/label search (default). " +
      "strategy='vision': vision-model element detection (use when others fail). " +
      "Returns: found (bool), selector, text, bounds (x/y/width/height).",
    input_schema: {
      type: "object",
      properties: {
        session_id: { type: "string", description: "Active session identifier" },
        description: {
          type: "string",
          description: "What to find: element label, role, visible text, or CSS selector.",
        },
        strategy: {
          type: "string",
          enum: ["selector", "text", "accessibility", "vision"],
          description: "Search strategy. Default: accessibility.",
          default: "accessibility",
        },
      },
      required: ["session_id", "description"],
    },
  },

  // ──────────────────────────────────────────────────────────────
  // NAVIGATE
  // ──────────────────────────────────────────────────────────────
  {
    name: "navigate",
    description:
      "Navigate the browser to a URL. Waits for the page to load before returning. " +
      "Returns: success, url (final after redirects), title.",
    input_schema: {
      type: "object",
      properties: {
        session_id: { type: "string", description: "Active session identifier" },
        url: { type: "string", description: "Full URL to navigate to (include https://)." },
        wait_until: {
          type: "string",
          enum: ["load", "domcontentloaded", "networkidle", "commit"],
          description: "When to consider navigation complete. Default: domcontentloaded.",
          default: "domcontentloaded",
        },
      },
      required: ["session_id", "url"],
    },
  },

  // ──────────────────────────────────────────────────────────────
  // INTERACT
  // ──────────────────────────────────────────────────────────────
  {
    name: "click",
    description:
      "Click at pixel coordinates (x, y) or on a CSS selector. " +
      "Provide x+y for coordinate-based clicking (use after screenshot to determine position). " +
      "Provide selector for selector-based clicking (more reliable when element is in DOM). " +
      "REQUIRES user approval before execution if the click triggers a server-side action. " +
      "Returns: success.",
    input_schema: {
      type: "object",
      properties: {
        session_id: { type: "string", description: "Active session identifier" },
        x: { type: "number", description: "X coordinate in pixels from left edge of viewport." },
        y: { type: "number", description: "Y coordinate in pixels from top edge of viewport." },
        selector: {
          type: "string",
          description: "CSS selector for the element to click. Use instead of x/y when possible.",
        },
        description: {
          type: "string",
          description: "Human-readable description of what this click does (shown for approval).",
        },
        is_destructive: {
          type: "boolean",
          description: "True if this click submits data, sends a message, or mutates server state.",
          default: false,
        },
      },
      required: ["session_id"],
    },
  },

  {
    name: "type",
    description:
      "Type text into the currently focused element (no selector), or into a specific element (with selector). " +
      "For forms: prefer selector to avoid focus errors. " +
      "For password fields: never log or echo the typed value. " +
      "Returns: success, chars_typed.",
    input_schema: {
      type: "object",
      properties: {
        session_id: { type: "string", description: "Active session identifier" },
        text: { type: "string", description: "Text to type." },
        selector: {
          type: "string",
          description: "CSS selector of the target field. Omit to type into currently focused element.",
        },
      },
      required: ["session_id", "text"],
    },
  },

  {
    name: "scroll",
    description:
      "Scroll the page or a specific element in a direction. " +
      "amount is number of scroll steps (default 3). " +
      "Returns: success, scroll position.",
    input_schema: {
      type: "object",
      properties: {
        session_id: { type: "string", description: "Active session identifier" },
        direction: {
          type: "string",
          enum: ["up", "down", "left", "right"],
          description: "Scroll direction. Default: down.",
          default: "down",
        },
        amount: {
          type: "number",
          description: "Number of scroll steps. Default: 3.",
          default: 3,
        },
      },
      required: ["session_id"],
    },
  },

  {
    name: "key",
    description:
      "Press keyboard key(s) or a key combination. " +
      "Single keys: 'Enter', 'Tab', 'Escape', 'Backspace', 'ArrowDown'. " +
      "Combos: 'Control+a', 'Control+c', 'Shift+Tab', 'Meta+l'. " +
      "Returns: success, keys.",
    input_schema: {
      type: "object",
      properties: {
        session_id: { type: "string", description: "Active session identifier" },
        keys: {
          type: "string",
          description: "Key or combo to press. Examples: 'Enter', 'Tab', 'Control+a', 'Meta+Shift+t'.",
        },
      },
      required: ["session_id", "keys"],
    },
  },

  // ──────────────────────────────────────────────────────────────
  // EXTRACT
  // ──────────────────────────────────────────────────────────────
  {
    name: "extract",
    description:
      "Extract structured content from the current page. " +
      "mode='text': raw visible text. " +
      "mode='accessibility': accessibility tree. " +
      "mode='structured': JSON outline with headings, links, inputs, forms. " +
      "Returns: content (string or object), elements (array).",
    input_schema: {
      type: "object",
      properties: {
        session_id: { type: "string", description: "Active session identifier" },
        mode: {
          type: "string",
          enum: ["text", "accessibility", "structured"],
          description: "Extraction mode. Default: accessibility.",
          default: "accessibility",
        },
      },
      required: ["session_id"],
    },
  },

  // ──────────────────────────────────────────────────────────────
  // CODE EXECUTION
  // ──────────────────────────────────────────────────────────────
  {
    name: "run_code",
    description:
      "Execute Python or JavaScript in a sandboxed subprocess with a minimal environment. " +
      "Use for data processing, calculations, or generating output from extracted data. " +
      "The sandbox has no network access and no access to secrets. " +
      "Returns: success, output, error.",
    input_schema: {
      type: "object",
      properties: {
        session_id: { type: "string", description: "Active session identifier (for context only)" },
        code: { type: "string", description: "Code to execute." },
        language: {
          type: "string",
          enum: ["python", "javascript"],
          description: "Language. Default: python.",
          default: "python",
        },
        timeout: {
          type: "number",
          description: "Max execution time in seconds (max 120). Default: 30.",
          default: 30,
        },
      },
      required: ["session_id", "code"],
    },
  },

  // ──────────────────────────────────────────────────────────────
  // RECORDING
  // ──────────────────────────────────────────────────────────────
  {
    name: "record_start",
    description:
      "Start recording all actions and screenshots for this session. " +
      "Produces a JSONL trajectory file and buffers frames for GIF export. " +
      "Returns: recording_id (pass to record_stop), path.",
    input_schema: {
      type: "object",
      properties: {
        session_id: { type: "string", description: "Active session identifier" },
        name: {
          type: "string",
          description: "Human-readable label for this recording (used in filename and metadata).",
        },
        gif_fps: {
          type: "number",
          description: "GIF frame capture rate (1–10 FPS). Default: 2.",
          default: 2,
        },
        annotate: {
          type: "boolean",
          description: "Overlay step/time annotations on GIF frames. Default: false.",
          default: false,
        },
      },
      required: ["session_id"],
    },
  },

  {
    name: "record_stop",
    description:
      "Stop an active recording, finalize the JSONL file, and render the GIF. " +
      "Returns: success, frames, jsonl_path, gif_path, gif_size_kb, duration_ms.",
    input_schema: {
      type: "object",
      properties: {
        session_id: { type: "string", description: "Active session identifier" },
        recording_id: {
          type: "string",
          description: "Recording ID returned by record_start.",
        },
        export_gif: {
          type: "boolean",
          description: "Render the GIF from buffered frames. Default: true.",
          default: true,
        },
        gif_scale: {
          type: "number",
          description: "Scale factor for GIF output (0.1–1.0). Default: 0.5.",
          default: 0.5,
        },
      },
      required: ["session_id", "recording_id"],
    },
  },

  // ──────────────────────────────────────────────────────────────
  // PLANNING LOOP
  // ──────────────────────────────────────────────────────────────
  {
    name: "execute_task",
    description:
      "Run a complete natural-language task through the Plan→Act→Observe→Reflect planning loop. " +
      "Use this when a task requires multiple steps with vision-guided decision making. " +
      "Returns: success, summary, steps (count), run_id, gif_path (if recording enabled).",
    input_schema: {
      type: "object",
      properties: {
        session_id: { type: "string", description: "Active session identifier" },
        task: { type: "string", description: "Natural language task description." },
        mode: {
          type: "string",
          enum: ["intent", "direct", "assist"],
          description: "Execution mode. intent=full planning loop, direct=single action, assist=propose only. Default: intent.",
          default: "intent",
        },
        max_steps: {
          type: "number",
          description: "Maximum planning loop iterations. Default: 20.",
          default: 20,
        },
        approval_policy: {
          type: "string",
          enum: ["never", "on-risk", "always"],
          description: "When to pause for human approval. Default: on-risk.",
          default: "on-risk",
        },
        record_gif: {
          type: "boolean",
          description: "Produce a GIF replay of the session. Default: true.",
          default: true,
        },
      },
      required: ["session_id", "task"],
    },
  },
];

export default COMPUTER_USE_TOOLS;
