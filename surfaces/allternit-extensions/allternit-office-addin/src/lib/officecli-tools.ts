/**
 * OfficeCLI Tools — static tool surface + first-party dispatcher for the
 * gateway-hosted officecli backend.
 *
 * All tools operate on a SERVER-SIDE SNAPSHOT of the open document (see
 * document-sync.ts); they never go through the sandboxed code-executor.
 * `officecli_edit`/`officecli_batch` with target "live" additionally replace
 * the open document's content via applyBackToLiveDocument (approval-gated by
 * OFFICECLI_DESTRUCTIVE in the agent loop).
 *
 * Tool output strings may embed artifact markers (`[artifact:{...}]`) and watch
 * markers (`[watch:{...}]`) — the sidepanel UI parses these to render
 * screenshots, download buttons, and live-preview iframes.
 */

import {
  execCommand,
  fetchArtifact,
  getCapabilities,
  startWatch,
  stopWatch,
  type OfficeCliArtifact,
  type OfficeCliExecRequest,
  type OfficeCliExecResponse,
} from './officecli-client'
import {
  applyBackToLiveDocument,
  ensureFreshSnapshot,
  getLocalFilePath,
  getSnapshotState,
} from './document-sync'

// ── UI markers ───────────────────────────────────────────────────────────────

/** Prefix of an artifact marker embedded in tool output: `[artifact:{json}]` */
export const ARTIFACT_MARKER = '[artifact:'

/** Prefix of a watch marker embedded in tool output: `[watch:{json}]` */
export const WATCH_MARKER = '[watch:'

/**
 * Formats an artifact reference for the UI. `url` is passed through as the
 * gateway returned it (relative to the gateway origin) — the UI resolves it
 * against the gateway base URL and fetches with auth headers.
 */
export function formatArtifact(docId: string, artifact: OfficeCliArtifact): string {
  return `${ARTIFACT_MARKER}${JSON.stringify({
    doc_id: docId,
    name: artifact.name,
    kind: artifact.kind,
    url: artifact.url,
  })}]`
}

export function formatWatchMarker(watchUrl: string): string {
  return `${WATCH_MARKER}${JSON.stringify({ url: watchUrl })}]`
}

// ── Destructive set (joins the agent loop approval gate) ─────────────────────

export const OFFICECLI_DESTRUCTIVE = new Set([
  'officecli_edit',
  'officecli_batch',
  'officecli_create',
  'officecli_merge',
  'officecli_exec',
  'officecli_raw',
])

// ── Tool schemas ─────────────────────────────────────────────────────────────

export interface OfficeCliToolDefinition {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties: Record<string, unknown>
    required: string[]
  }
}

export const OFFICECLI_TOOL_SCHEMAS: OfficeCliToolDefinition[] = [
  {
    name: 'officecli_view',
    description:
      'Read the officecli snapshot of the open document. Modes: "text" (plain text), "outline" (structure tree), "annotated" (text with element paths — use it to discover paths for officecli_edit), "stats" (counts), "issues" (validation problems). Read-only: never modifies the snapshot or the open document.',
    inputSchema: {
      type: 'object',
      properties: {
        mode: { type: 'string', enum: ['text', 'outline', 'annotated', 'stats', 'issues'] },
        path: { type: 'string', description: 'Optional element path to view a subtree' },
        max_lines: { type: 'number', description: 'Cap the number of output lines' },
      },
      required: ['mode'],
    },
  },
  {
    name: 'officecli_render',
    description:
      'Render the snapshot to a visual artifact returned as a download/preview marker. mode "screenshot" → PNG of a page/slide (optionally "page"); "html" → HTML preview. Always call this after visual edits to verify the result looks right.',
    inputSchema: {
      type: 'object',
      properties: {
        mode: { type: 'string', enum: ['screenshot', 'html'] },
        page: { type: 'number', description: '1-based page/slide number for screenshots' },
      },
      required: ['mode'],
    },
  },
  {
    name: 'officecli_get',
    description:
      'Get the JSON representation of the element at "path" in the snapshot (e.g. /Body/Paragraph[0]). "depth" limits child expansion. Read-only.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        depth: { type: 'number' },
      },
      required: ['path'],
    },
  },
  {
    name: 'officecli_query',
    description:
      'Query snapshot elements with a selector expression (e.g. all paragraphs or tables). Returns matching element paths and summaries. Read-only.',
    inputSchema: {
      type: 'object',
      properties: {
        selector: { type: 'string' },
      },
      required: ['selector'],
    },
  },
  {
    name: 'officecli_analyze',
    description:
      'Validate the snapshot and list structural issues in one call (runs officecli validate + view issues). Read-only. Call this before finishing an editing task.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'officecli_edit',
    description:
      'Apply one structural edit: op "set" (change "props" at "path"), "add" (insert a new element of "type" at "path"), "remove" (delete "path"), "move" ("path" → "to"), "swap" ("path" ↔ element at "index"). target "snapshot" (default) edits only the server-side copy; target "live" also REPLACES the open document\'s content with the edited file — destructive, requires user approval, and may drop content that does not round-trip. After any edit, verify with officecli_render and officecli_analyze.',
    inputSchema: {
      type: 'object',
      properties: {
        op: { type: 'string', enum: ['set', 'add', 'remove', 'move', 'swap'] },
        path: { type: 'string' },
        props: { type: 'object', description: 'Properties for set/add, e.g. {"text": "Hello"}' },
        type: { type: 'string', description: 'Element type for op "add"' },
        to: { type: 'string', description: 'Destination path for op "move"' },
        index: { type: 'number', description: 'Target index for op "swap"' },
        target: { type: 'string', enum: ['snapshot', 'live'] },
      },
      required: ['op', 'path'],
    },
  },
  {
    name: 'officecli_batch',
    description:
      'Apply several edits atomically. "operations" is a JSON-array string of operations (same shape as officecli_edit ops). Same snapshot/live semantics and approval rules as officecli_edit — target "live" replaces the open document.',
    inputSchema: {
      type: 'object',
      properties: {
        operations: { type: 'string', description: 'JSON array of edit operations' },
        target: { type: 'string', enum: ['snapshot', 'live'] },
      },
      required: ['operations'],
    },
  },
  {
    name: 'officecli_create',
    description:
      'Create a brand-new Office file (docx/xlsx/pptx, inferred from "filename") on the gateway, optionally seeded by "template_json" describing the content. The new file is delivered as a download artifact; it never touches the open document.',
    inputSchema: {
      type: 'object',
      properties: {
        filename: { type: 'string' },
        template_json: { type: 'string', description: 'Optional JSON description of the content' },
      },
      required: ['filename'],
    },
  },
  {
    name: 'officecli_merge',
    description:
      'Merge "data_json" into a template document (the current snapshot by default, or "template_doc_id") and produce "output_filename" as a download artifact.',
    inputSchema: {
      type: 'object',
      properties: {
        data_json: { type: 'string' },
        output_filename: { type: 'string' },
        template_doc_id: { type: 'string' },
      },
      required: ['data_json', 'output_filename'],
    },
  },
  {
    name: 'officecli_dump',
    description:
      'Dump the raw OOXML of the snapshot (or the part at "path") for low-level inspection. Read-only.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string' },
      },
      required: [],
    },
  },
  {
    name: 'officecli_raw',
    description:
      'Low-level OOXML surgery on the snapshot: action "get" reads the XML at "path" (optionally filtered by "xpath"); action "set" replaces it with "xml". Powerful but easy to break the file — run officecli_analyze afterwards.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        action: { type: 'string', enum: ['get', 'set'] },
        xpath: { type: 'string' },
        xml: { type: 'string' },
      },
      required: ['path'],
    },
  },
  {
    name: 'officecli_exec',
    description:
      'Escape hatch: run any allowlisted officecli command with raw string args against the snapshot. Prefer the dedicated officecli_* tools when one fits.',
    inputSchema: {
      type: 'object',
      properties: {
        command: { type: 'string' },
        args: { type: 'array', items: { type: 'string' } },
      },
      required: ['command'],
    },
  },
  {
    name: 'officecli_watch_start',
    description:
      'Start a live-preview web server for the current snapshot and return its URL (the UI renders it as a preview button/iframe).',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'officecli_watch_stop',
    description: 'Stop the live-preview server started by officecli_watch_start.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
]

// ── Validation (mirrors tool-dispatcher validateToolCall style) ──────────────

export interface OfficeCliValidationResult {
  valid: boolean
  errors: string[]
}

const REQUIRED_ARGS: Record<string, string[]> = {
  officecli_view: ['mode'],
  officecli_render: ['mode'],
  officecli_get: ['path'],
  officecli_query: ['selector'],
  officecli_edit: ['op', 'path'],
  officecli_batch: ['operations'],
  officecli_create: ['filename'],
  officecli_merge: ['data_json', 'output_filename'],
  officecli_raw: ['path'],
  officecli_exec: ['command'],
}

const ENUM_ARGS: Record<string, Record<string, string[]>> = {
  officecli_view: { mode: ['text', 'outline', 'annotated', 'stats', 'issues'] },
  officecli_render: { mode: ['screenshot', 'html'] },
  officecli_edit: { op: ['set', 'add', 'remove', 'move', 'swap'], target: ['snapshot', 'live'] },
  officecli_batch: { target: ['snapshot', 'live'] },
  officecli_raw: { action: ['get', 'set'] },
}

export function validateOfficeCliCall(call: {
  name: string
  arguments: Record<string, unknown>
}): OfficeCliValidationResult {
  const errors: string[] = []
  const args = call.arguments ?? {}

  for (const key of REQUIRED_ARGS[call.name] ?? []) {
    const value = args[key]
    if (value === undefined || value === null || value === '') {
      errors.push(`Missing required argument: "${key}"`)
    }
  }

  for (const [key, allowed] of Object.entries(ENUM_ARGS[call.name] ?? {})) {
    const value = args[key]
    if (value !== undefined && value !== null && !allowed.includes(String(value))) {
      errors.push(`Invalid value for "${key}": "${String(value)}" (expected one of: ${allowed.join(', ')})`)
    }
  }

  // Semantic checks — op-specific required companions
  if (call.name === 'officecli_edit' && errors.length === 0) {
    const op = String(args.op)
    if (op === 'add' && !args.type) errors.push('Missing required argument: "type" (required for op "add")')
    if (op === 'move' && !args.to) errors.push('Missing required argument: "to" (required for op "move")')
    if (op === 'swap' && (args.index === undefined || args.index === null)) {
      errors.push('Missing required argument: "index" (required for op "swap")')
    }
  }
  if (call.name === 'officecli_raw' && args.action === 'set' && !args.xml) {
    errors.push('Missing required argument: "xml" (required for action "set")')
  }
  if (call.name === 'officecli_batch' && typeof args.operations === 'string' && args.operations) {
    try {
      const parsed: unknown = JSON.parse(args.operations)
      if (!Array.isArray(parsed)) errors.push('Invalid value for "operations": must be a JSON array string')
    } catch {
      errors.push('Invalid value for "operations": not valid JSON')
    }
  }

  return { valid: errors.length === 0, errors }
}

// ── Output formatting ────────────────────────────────────────────────────────

/** Total cap for a single tool output (~8000 chars, head + tail kept) */
const MAX_OUTPUT_CHARS = 8000
const HEAD_CHARS = 5000
const TAIL_CHARS = 2500

function truncateHeadTail(text: string): string {
  if (text.length <= MAX_OUTPUT_CHARS) return text
  const omitted = text.length - HEAD_CHARS - TAIL_CHARS
  return `${text.slice(0, HEAD_CHARS)}\n… [${omitted} chars truncated] …\n${text.slice(-TAIL_CHARS)}`
}

function resultField(result: unknown, field: string): string | null {
  if (!result || typeof result !== 'object') return null
  const value = (result as Record<string, unknown>)[field]
  return typeof value === 'string' && value ? value : null
}

/**
 * Formats an exec response for the model. On failure, officecli's structured
 * error code + suggestion are passed through verbatim so the model can
 * self-correct. Artifacts are appended as UI markers.
 */
function formatExecResult(docId: string, resp: OfficeCliExecResponse): string {
  const parts: string[] = []

  if (!resp.ok) {
    parts.push(`officecli command failed (exit code ${resp.exit_code}).`)
    const message = resultField(resp.result, 'message')
    if (message) parts.push(`error: ${message}`)
    const code = resultField(resp.result, 'code')
    if (code) parts.push(`code: ${code}`)
    const suggestion = resultField(resp.result, 'suggestion')
    if (suggestion) parts.push(`suggestion: ${suggestion}`)
    if (resp.stderr?.trim()) parts.push(`stderr: ${truncateHeadTail(resp.stderr.trim())}`)
  } else {
    const body = resp.result !== null && resp.result !== undefined
      ? JSON.stringify(resp.result, null, 2)
      : (resp.stdout ?? '')
    if (body.trim()) parts.push(truncateHeadTail(body))
    if (resp.truncated) parts.push('[output was truncated by the gateway at 1 MiB]')
  }

  for (const artifact of resp.artifacts ?? []) {
    parts.push(formatArtifact(docId, artifact))
  }

  return parts.join('\n') || 'OK'
}

/** Render results lead with the artifact marker + a one-line confirmation. */
function formatRenderResult(
  docId: string,
  resp: OfficeCliExecResponse,
  mode: string,
  page?: number,
): string {
  if (!resp.ok) return formatExecResult(docId, resp)
  const artifacts = resp.artifacts ?? []
  if (artifacts.length === 0) return formatExecResult(docId, resp)

  const summary =
    mode === 'screenshot'
      ? `screenshot ready${page !== undefined ? ` (page ${page})` : ''}`
      : 'html render ready'
  return [summary, ...artifacts.map((a) => formatArtifact(docId, a))].join('\n')
}

// ── Exec request builders ────────────────────────────────────────────────────

function strArg(args: Record<string, unknown>, key: string): string | undefined {
  return typeof args[key] === 'string' && args[key] ? (args[key] as string) : undefined
}

function numArg(args: Record<string, unknown>, key: string): number | undefined {
  return typeof args[key] === 'number' ? (args[key] as number) : undefined
}

function stringArrayArg(args: Record<string, unknown>, key: string): string[] | undefined {
  const value = args[key]
  if (!Array.isArray(value)) return undefined
  return value.map((v) => String(v))
}

function buildExecRequest(docId: string, name: string, args: Record<string, unknown>): OfficeCliExecRequest {
  switch (name) {
    case 'officecli_view': {
      const cliArgs = [String(args.mode)]
      const maxLines = numArg(args, 'max_lines')
      if (maxLines !== undefined) cliArgs.push('--max-lines', String(maxLines))
      const path = strArg(args, 'path')
      return { doc_id: docId, command: 'view', args: cliArgs, ...(path ? { path } : {}) }
    }

    case 'officecli_render': {
      const mode = String(args.mode)
      const cliArgs = [mode === 'screenshot' ? 'screenshot' : 'html']
      const page = numArg(args, 'page')
      if (page !== undefined) cliArgs.push('--page', String(page))
      return { doc_id: docId, command: 'view', args: cliArgs }
    }

    case 'officecli_get': {
      const cliArgs: string[] = []
      const depth = numArg(args, 'depth')
      if (depth !== undefined) cliArgs.push('--depth', String(depth))
      return { doc_id: docId, command: 'get', path: String(args.path), args: cliArgs }
    }

    case 'officecli_query':
      return { doc_id: docId, command: 'query', args: [String(args.selector)] }

    case 'officecli_edit': {
      const op = String(args.op)
      const cliArgs: string[] = []
      const type = strArg(args, 'type')
      const to = strArg(args, 'to')
      const index = numArg(args, 'index')
      if (type) cliArgs.push('--type', type)
      // `swap <file> <path1> <path2>` takes the second path positionally;
      // `move` takes it as --to (verified against officecli 1.0.138).
      if (to) {
        if (op === 'swap') cliArgs.push(to)
        else cliArgs.push('--to', to)
      }
      if (index !== undefined) cliArgs.push('--index', String(index))
      const props = args.props && typeof args.props === 'object'
        ? (args.props as Record<string, unknown>)
        : undefined
      return { doc_id: docId, command: op, path: String(args.path), args: cliArgs, ...(props ? { props } : {}) }
    }

    case 'officecli_batch':
      // Validated as a JSON array string in validateOfficeCliCall; forwarded
      // to the gateway as the raw string (it becomes one --commands argv item).
      return { doc_id: docId, command: 'batch', commands: String(args.operations) }

    case 'officecli_merge': {
      const templateDocId = strArg(args, 'template_doc_id') ?? docId
      return {
        doc_id: templateDocId,
        new_filename: String(args.output_filename),
        command: 'merge',
        args: ['--data', String(args.data_json)],
      }
    }

    case 'officecli_dump': {
      const path = strArg(args, 'path')
      return { doc_id: docId, command: 'dump', ...(path ? { path } : {}) }
    }

    case 'officecli_raw': {
      const action = strArg(args, 'action') ?? 'get'
      const cliArgs: string[] = []
      const xpath = strArg(args, 'xpath')
      const xml = strArg(args, 'xml')
      if (xpath) cliArgs.push('--xpath', xpath)
      if (action === 'set') {
        if (xml) cliArgs.push('--xml', xml)
        return { doc_id: docId, command: 'raw-set', path: String(args.path), args: cliArgs }
      }
      return { doc_id: docId, command: 'raw', path: String(args.path), args: cliArgs }
    }

    case 'officecli_exec':
      return { doc_id: docId, command: String(args.command), args: stringArrayArg(args, 'args') }

    default:
      throw new Error(`Unknown officecli tool: ${name}`)
  }
}

// ── Live-target orchestration ────────────────────────────────────────────────

/**
 * Runs a mutating exec and, for target "live", propagates the result to the
 * user-visible document:
 * - live_fs + local file path → the gateway edits the file on disk directly
 *   (Office detects the external change and prompts to reload).
 * - otherwise → re-download the modified source file and replace the open
 *   document's content via first-party Office.js.
 */
async function runMutation(
  name: string,
  args: Record<string, unknown>,
): Promise<string> {
  const { docId } = await ensureFreshSnapshot()
  const target = strArg(args, 'target') ?? 'snapshot'
  const req = buildExecRequest(docId, name, args)

  if (target === 'live') {
    const localPath = getLocalFilePath()
    const capabilities = await getCapabilities()
    if (capabilities.live_fs && localPath) {
      req.live_path = localPath
      const resp = await execCommand(req)
      if (!resp.ok) return formatExecResult(docId, resp)
      return `${formatExecResult(docId, resp)}\nNote: file edited on disk; Office will prompt to reload.`
    }

    const resp = await execCommand(req)
    if (!resp.ok) return formatExecResult(docId, resp)

    const filename = getSnapshotState().filename
    if (!filename) {
      throw new Error('Snapshot filename is unknown — cannot download the edited source file for apply-back.')
    }
    const fetchBytes = async () => {
      const blob = await fetchArtifact(docId, filename)
      return new Uint8Array(await blob.arrayBuffer())
    }
    const confirmation = await applyBackToLiveDocument(fetchBytes)
    return `${formatExecResult(docId, resp)}\n${confirmation}`
  }

  const resp = await execCommand(req)
  return formatExecResult(docId, resp)
}

// ── Dispatcher ───────────────────────────────────────────────────────────────

/**
 * Extracts a doc_id from a gateway artifact URL
 * (`/api/v1/office/cli/document/<doc_id>/artifact/<name>`). Used for created
 * files, where the new doc id is only known via the returned artifact URLs.
 */
function docIdFromArtifactUrl(url: string): string | null {
  const match = url.match(/\/office\/cli\/document\/([^/]+)\/artifact\//)
  return match ? decodeURIComponent(match[1]) : null
}

/**
 * Executes one officecli_* tool call against the gateway and returns a string
 * for the model's tool message. Validation failures are returned (not thrown)
 * so the model can correct its call; transport/Office errors propagate.
 */
export async function executeOfficeCliTool(call: {
  name: string
  arguments: Record<string, unknown>
}): Promise<string> {
  const validation = validateOfficeCliCall(call)
  if (!validation.valid) {
    return `Invalid tool call: ${validation.errors.join(', ')}`
  }
  const args = call.arguments ?? {}

  switch (call.name) {
    // ── No snapshot needed ──
    case 'officecli_create': {
      const templateJson = strArg(args, 'template_json')
      const req: OfficeCliExecRequest = {
        new_filename: String(args.filename),
        command: 'create',
        ...(templateJson ? { args: ['--template', templateJson] } : {}),
      }
      const resp = await execCommand(req)
      const artifactDocId = resp.artifacts?.[0] ? (docIdFromArtifactUrl(resp.artifacts[0].url) ?? '') : ''
      const formatted = formatExecResult(artifactDocId, resp)
      return resp.ok
        ? `${formatted}\nThe new file "${String(args.filename)}" is available as a download artifact above.`
        : formatted
    }

    // ── Watch stop uses the cached snapshot (never forces a re-upload) ──
    case 'officecli_watch_stop': {
      const docId = getSnapshotState().docId
      if (!docId) return 'No document snapshot exists — there is no live preview to stop.'
      await stopWatch(docId)
      return 'Live preview stopped.'
    }

    case 'officecli_watch_start': {
      const { docId } = await ensureFreshSnapshot()
      const watch = await startWatch(docId)
      return [
        'Live preview started for the current document snapshot.',
        `URL: ${watch.watch_url}`,
        formatWatchMarker(watch.watch_url),
      ].join('\n')
    }

    // ── Mutations (snapshot default, live apply-back on request) ──
    case 'officecli_edit':
    case 'officecli_batch':
      return runMutation(call.name, args)

    // ── Reads ──
    case 'officecli_analyze': {
      const { docId } = await ensureFreshSnapshot()
      const validateResp = await execCommand({ doc_id: docId, command: 'validate' })
      const issuesResp = await execCommand({ doc_id: docId, command: 'view', args: ['issues'] })
      return [
        '== validate ==',
        formatExecResult(docId, validateResp),
        '',
        '== issues ==',
        formatExecResult(docId, issuesResp),
      ].join('\n')
    }

    case 'officecli_render': {
      const { docId } = await ensureFreshSnapshot()
      const resp = await execCommand(buildExecRequest(docId, call.name, args))
      return formatRenderResult(docId, resp, String(args.mode), numArg(args, 'page'))
    }

    default: {
      const { docId } = await ensureFreshSnapshot()
      const resp = await execCommand(buildExecRequest(docId, call.name, args))
      return formatExecResult(docId, resp)
    }
  }
}
