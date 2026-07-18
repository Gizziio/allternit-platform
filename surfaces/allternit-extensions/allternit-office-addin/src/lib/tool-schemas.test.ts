import { describe, it, expect, afterEach } from 'vitest'
import { toOpenAITool, mergeToolCallDelta, finalizeToolCalls, getToolsForHost } from './tool-schemas'

describe('toOpenAITool', () => {
  it('converts internal definition to OpenAI format', () => {
    const def = {
      name: 'excel_read_range',
      description: 'Read values from the active worksheet.',
      inputSchema: {
        type: 'object' as const,
        properties: { address: { type: 'string' } },
        required: [],
      },
    }

    const result = toOpenAITool(def)

    expect(result).toEqual({
      type: 'function',
      function: {
        name: 'excel_read_range',
        description: 'Read values from the active worksheet.',
        parameters: {
          type: 'object',
          properties: { address: { type: 'string' } },
          required: [],
        },
      },
    })
  })
})

describe('mergeToolCallDelta', () => {
  it('creates a new accumulator entry', () => {
    const map = new Map()
    mergeToolCallDelta(map, {
      index: 0,
      id: 'call_1',
      function: { name: 'excel_read_range', arguments: '{"a":' },
    })

    const entry = map.get(0)
    expect(entry.id).toBe('call_1')
    expect(entry.name).toBe('excel_read_range')
    expect(entry.argumentsJson).toBe('{"a":')
  })

  it('appends to existing accumulator entry', () => {
    const map = new Map()
    mergeToolCallDelta(map, { index: 0, function: { arguments: '{"a":' } })
    mergeToolCallDelta(map, { index: 0, function: { arguments: '1}' } })

    expect(map.get(0).argumentsJson).toBe('{"a":1}')
  })

  it('handles multiple parallel tool calls', () => {
    const map = new Map()
    mergeToolCallDelta(map, { index: 0, function: { name: 'tool_a' } })
    mergeToolCallDelta(map, { index: 1, function: { name: 'tool_b' } })

    expect(map.get(0).name).toBe('tool_a')
    expect(map.get(1).name).toBe('tool_b')
  })

  it('uses default index 0 when omitted', () => {
    const map = new Map()
    mergeToolCallDelta(map, { function: { name: 'single' } })

    expect(map.get(0).name).toBe('single')
  })
})

describe('finalizeToolCalls', () => {
  it('parses accumulated JSON arguments', () => {
    const map = new Map([
      [0, { id: 'call_1', name: 'excel_write_range', argumentsJson: '{"address":"A1","values":[[1]]}' }],
    ])

    const result = finalizeToolCalls(map)

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      id: 'call_1',
      name: 'excel_write_range',
      arguments: { address: 'A1', values: [[1]] },
    })
  })

  it('filters out entries with empty names', () => {
    const map = new Map([
      [0, { id: '', name: '', argumentsJson: '' }],
      [1, { id: 'call_2', name: 'ppt_add_slide', argumentsJson: '{}' }],
    ])

    const result = finalizeToolCalls(map)

    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('ppt_add_slide')
  })

  it('falls back to empty args on malformed JSON', () => {
    const map = new Map([
      [0, { id: 'call_1', name: 'excel_read_range', argumentsJson: '{not valid json' }],
    ])

    const result = finalizeToolCalls(map)

    expect(result[0].arguments).toEqual({})
  })

  it('handles empty argumentsJson', () => {
    const map = new Map([
      [0, { id: 'call_1', name: 'excel_get_sheet_names', argumentsJson: '' }],
    ])

    const result = finalizeToolCalls(map)

    expect(result[0].arguments).toEqual({})
  })
})

describe('getToolsForHost with officecli tools', () => {
  const HOST_CASES = [
    { host: 'excel', officeHost: 'Excel', hostTool: 'excel_read_range' },
    { host: 'word', officeHost: 'Word', hostTool: 'word_read_body' },
    { host: 'powerpoint', officeHost: 'PowerPoint', hostTool: 'ppt_get_slide_count' },
  ]

  afterEach(() => {
    delete (globalThis as Record<string, unknown>).Office
  })

  function installOfficeHost(officeHost: string) {
    ;(globalThis as Record<string, unknown>).Office = {
      context: { host: officeHost },
      HostType: { Excel: 'Excel', Word: 'Word', PowerPoint: 'PowerPoint' },
    }
  }

  for (const { host, officeHost, hostTool } of HOST_CASES) {
    it(`includes officecli_* tools alongside host tools for ${host}`, () => {
      installOfficeHost(officeHost)

      const names = getToolsForHost().map((t) => t.function.name)

      expect(names).toContain(hostTool)
      expect(names).toContain('officecli_view')
      expect(names).toContain('officecli_edit')
      expect(names).toContain('officecli_render')
      expect(names).toContain('officecli_watch_start')
    })
  }

  it('returns no tools for unrecognized hosts', () => {
    delete (globalThis as Record<string, unknown>).Office
    expect(getToolsForHost()).toEqual([])
  })
})
