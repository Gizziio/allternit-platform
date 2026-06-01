/**
 * Tool Schemas — host-aware tool catalog for the Office add-in runtime.
 *
 * The shell-side built-in Office plugins currently do not expose importable tool
 * definition modules, so the add-in keeps its executable Office.js tool surface
 * local and explicit here.
 */

import { getOfficeHost } from './host-detector'

type InternalToolDefinition = {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties: Record<string, unknown>
    required: string[]
  }
}

const excelTools: InternalToolDefinition[] = [
  { name: 'excel_read_range', description: 'Read values from the active worksheet.', inputSchema: { type: 'object', properties: { address: { type: 'string' }, includeFormulas: { type: 'boolean' }, includeNumberFormat: { type: 'boolean' } }, required: [] } },
  { name: 'excel_write_range', description: 'Write a 2D array of values into a range.', inputSchema: { type: 'object', properties: { address: { type: 'string' }, values: { type: 'array' }, numberFormat: { type: 'string' } }, required: ['address', 'values'] } },
  { name: 'excel_get_sheet_names', description: 'List worksheet names in the workbook.', inputSchema: { type: 'object', properties: { includeHidden: { type: 'boolean' } }, required: [] } },
  { name: 'excel_create_chart', description: 'Create a chart from a source data range.', inputSchema: { type: 'object', properties: { dataAddress: { type: 'string' }, chartType: { type: 'string' }, title: { type: 'string' }, seriesBy: { type: 'string' } }, required: ['dataAddress'] } },
  { name: 'excel_create_table', description: 'Convert a range into a formatted Excel table.', inputSchema: { type: 'object', properties: { address: { type: 'string' }, tableName: { type: 'string' }, style: { type: 'string' }, hasHeaders: { type: 'boolean' } }, required: [] } },
  { name: 'excel_apply_format', description: 'Apply common formatting to a range.', inputSchema: { type: 'object', properties: { address: { type: 'string' }, numberFormat: { type: 'string' }, fontColor: { type: 'string' }, fillColor: { type: 'string' }, bold: { type: 'boolean' }, autofitColumns: { type: 'boolean' } }, required: ['address'] } },
  { name: 'excel_add_data_validation', description: 'Apply data validation rules to cells.', inputSchema: { type: 'object', properties: { address: { type: 'string' }, type: { type: 'string' }, listSource: { type: 'string' }, formula1: { type: 'string' }, formula2: { type: 'string' }, operator: { type: 'string' }, errorTitle: { type: 'string' }, errorMessage: { type: 'string' }, alertStyle: { type: 'string' } }, required: ['address'] } },
  { name: 'excel_run_formula', description: 'Evaluate a formula in a temporary cell.', inputSchema: { type: 'object', properties: { formula: { type: 'string' }, tempAddress: { type: 'string' } }, required: ['formula'] } },
  { name: 'excel_add_worksheet', description: 'Add a new worksheet.', inputSchema: { type: 'object', properties: { name: { type: 'string' }, position: { type: 'number' }, tabColor: { type: 'string' }, activate: { type: 'boolean' } }, required: ['name'] } },
  { name: 'excel_delete_rows', description: 'Delete rows by condition in the active sheet.', inputSchema: { type: 'object', properties: { condition: { type: 'string' }, columnIndex: { type: 'number' }, matchValue: { type: 'string' }, startRow: { type: 'number' } }, required: [] } },
]

const powerpointTools: InternalToolDefinition[] = [
  { name: 'ppt_get_slide_count', description: 'Get the number of slides in the current deck.', inputSchema: { type: 'object', properties: {}, required: [] } },
  { name: 'ppt_read_slide_text', description: 'Read text from a single slide.', inputSchema: { type: 'object', properties: { slideIndex: { type: 'number' } }, required: ['slideIndex'] } },
  { name: 'ppt_write_slide_text', description: 'Replace title and/or body text on a slide.', inputSchema: { type: 'object', properties: { slideIndex: { type: 'number' }, title: { type: 'string' }, body: { type: 'string' } }, required: ['slideIndex'] } },
  { name: 'ppt_add_slide', description: 'Add a new slide to the presentation.', inputSchema: { type: 'object', properties: { layout: { type: 'string' }, title: { type: 'string' } }, required: [] } },
  { name: 'ppt_delete_slide', description: 'Delete a slide by index.', inputSchema: { type: 'object', properties: { slideIndex: { type: 'number' } }, required: ['slideIndex'] } },
  { name: 'ppt_read_all_titles', description: 'Read titles from all slides.', inputSchema: { type: 'object', properties: {}, required: [] } },
  { name: 'ppt_set_notes', description: 'Write speaker notes for a slide.', inputSchema: { type: 'object', properties: { slideIndex: { type: 'number' }, notes: { type: 'string' } }, required: ['slideIndex', 'notes'] } },
  { name: 'ppt_read_notes', description: 'Read speaker notes for a slide.', inputSchema: { type: 'object', properties: { slideIndex: { type: 'number' } }, required: ['slideIndex'] } },
  { name: 'ppt_add_textbox', description: 'Add a textbox shape to a slide.', inputSchema: { type: 'object', properties: { slideIndex: { type: 'number' }, text: { type: 'string' }, left: { type: 'number' }, top: { type: 'number' }, width: { type: 'number' }, height: { type: 'number' } }, required: ['slideIndex', 'text'] } },
]

const wordTools: InternalToolDefinition[] = [
  { name: 'word_read_body', description: 'Read the current document body.', inputSchema: { type: 'object', properties: { maxChars: { type: 'number' } }, required: [] } },
  { name: 'word_read_selection', description: 'Read the current selection.', inputSchema: { type: 'object', properties: {}, required: [] } },
  { name: 'word_insert_text', description: 'Insert or replace text at the current selection.', inputSchema: { type: 'object', properties: { text: { type: 'string' }, location: { type: 'string' } }, required: ['text'] } },
  { name: 'word_replace_text', description: 'Find and replace text in the document.', inputSchema: { type: 'object', properties: { searchText: { type: 'string' }, replacementText: { type: 'string' }, matchCase: { type: 'boolean' }, replaceAll: { type: 'boolean' }, useTrackedChanges: { type: 'boolean' } }, required: ['searchText', 'replacementText'] } },
  { name: 'word_get_document_outline', description: 'Return headings and structure for the document.', inputSchema: { type: 'object', properties: {}, required: [] } },
  { name: 'word_get_document_properties', description: 'Read title and document properties.', inputSchema: { type: 'object', properties: {}, required: [] } },
  { name: 'word_insert_table', description: 'Insert a table at the current selection.', inputSchema: { type: 'object', properties: { data: { type: 'array', description: '2D array of cell values' }, style: { type: 'string' }, location: { type: 'string', enum: ['end', 'start', 'after_selection'] } }, required: ['data'] } },
  { name: 'word_set_track_changes', description: 'Enable or disable tracked changes.', inputSchema: { type: 'object', properties: { enabled: { type: 'boolean' } }, required: ['enabled'] } },
  { name: 'word_get_content_controls', description: 'List content controls in the document.', inputSchema: { type: 'object', properties: {}, required: [] } },
  { name: 'word_fill_content_control', description: 'Fill a content control by tag or title.', inputSchema: { type: 'object', properties: { tag: { type: 'string' }, title: { type: 'string' }, value: { type: 'string' } }, required: ['value'] } },
]

// ── Types ────────────────────────────────────────────────────────────────────

/** OpenAI function-calling tool format (also accepted by Anthropic-compatible endpoints) */
export interface OpenAITool {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: {
      type: 'object'
      properties: Record<string, unknown>
      required: string[]
    }
  }
}

/** A fully-parsed tool call returned from the streaming SSE response */
export interface ParsedToolCall {
  id: string
  name: string
  arguments: Record<string, unknown>
}

/** Partial accumulator used while streaming tool_call deltas */
export interface ToolCallAccumulator {
  id: string
  name: string
  argumentsJson: string
}

// ── Conversion ───────────────────────────────────────────────────────────────

/**
 * Converts an internal tool definition (with `inputSchema`) to the OpenAI
 * function-calling format (with `parameters`).
 */
export function toOpenAITool(def: {
  name: string
  description: string
  inputSchema: {
    type: 'object'
    properties: Record<string, unknown>
    required: string[]
  }
}): OpenAITool {
  return {
    type: 'function',
    function: {
      name: def.name,
      description: def.description,
      parameters: {
        type: def.inputSchema.type,
        properties: def.inputSchema.properties,
        required: def.inputSchema.required,
      },
    },
  }
}

/**
 * Returns the tool set for the current Office host in OpenAI format.
 * Returns an empty array if the host is unrecognized.
 */
export function getToolsForHost(): OpenAITool[] {
  const host = getOfficeHost()
  switch (host) {
    case 'excel':
      return excelTools.map(toOpenAITool)
    case 'powerpoint':
      return powerpointTools.map(toOpenAITool)
    case 'word':
      return wordTools.map(toOpenAITool)
    default:
      return []
  }
}

// ── Streaming accumulation helpers ───────────────────────────────────────────

/** Merge an incoming SSE tool_call delta into an accumulator map */
export function mergeToolCallDelta(
  accumMap: Map<number, ToolCallAccumulator>,
  delta: {
    index?: number
    id?: string
    function?: { name?: string; arguments?: string }
  },
): void {
  const idx = delta.index ?? 0
  const existing = accumMap.get(idx) ?? { id: '', name: '', argumentsJson: '' }
  accumMap.set(idx, {
    id: existing.id || delta.id || '',
    name: existing.name || delta.function?.name || '',
    argumentsJson: existing.argumentsJson + (delta.function?.arguments ?? ''),
  })
}

/** Finalize accumulated tool calls into ParsedToolCall objects */
export function finalizeToolCalls(
  accumMap: Map<number, ToolCallAccumulator>,
): ParsedToolCall[] {
  return Array.from(accumMap.values())
    .filter((tc) => tc.name)
    .map((tc) => {
      let args: Record<string, unknown> = {}
      try {
        args = JSON.parse(tc.argumentsJson || '{}') as Record<string, unknown>
      } catch {
        // malformed JSON — use empty args
      }
      return { id: tc.id, name: tc.name, arguments: args }
    })
}
