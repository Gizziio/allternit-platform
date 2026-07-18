import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  executeOfficeCliTool,
  validateOfficeCliCall,
  formatArtifact,
  OFFICECLI_DESTRUCTIVE,
  ARTIFACT_MARKER,
} from './officecli-tools'
import * as client from './officecli-client'
import * as sync from './document-sync'
import type { OfficeCliExecResponse } from './officecli-client'

// ── Module mocks ─────────────────────────────────────────────────────────────

vi.mock('./officecli-client', () => ({
  execCommand: vi.fn(),
  fetchArtifact: vi.fn(),
  getCapabilities: vi.fn(),
  startWatch: vi.fn(),
  stopWatch: vi.fn(),
}))

vi.mock('./document-sync', () => ({
  ensureFreshSnapshot: vi.fn(),
  applyBackToLiveDocument: vi.fn(),
  getLocalFilePath: vi.fn(),
  getSnapshotState: vi.fn(),
}))

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeCall(name: string, args: Record<string, unknown>) {
  return { id: 'test-1', name, arguments: args }
}

function okExecResponse(overrides: Partial<OfficeCliExecResponse> = {}): OfficeCliExecResponse {
  return {
    ok: true,
    exit_code: 0,
    result: { text: 'hello' },
    stdout: '',
    stderr: '',
    artifacts: [],
    duration_ms: 5,
    truncated: false,
    ...overrides,
  }
}

const execCommandMock = vi.mocked(client.execCommand)
const getCapabilitiesMock = vi.mocked(client.getCapabilities)
const fetchArtifactMock = vi.mocked(client.fetchArtifact)
const startWatchMock = vi.mocked(client.startWatch)
const stopWatchMock = vi.mocked(client.stopWatch)
const ensureFreshSnapshotMock = vi.mocked(sync.ensureFreshSnapshot)
const applyBackMock = vi.mocked(sync.applyBackToLiveDocument)
const getLocalFilePathMock = vi.mocked(sync.getLocalFilePath)
const getSnapshotStateMock = vi.mocked(sync.getSnapshotState)

beforeEach(() => {
  vi.clearAllMocks()
  execCommandMock.mockResolvedValue(okExecResponse())
  getCapabilitiesMock.mockResolvedValue({ ok: true, available: true, version: '0.1.0', commands: [], live_fs: false })
  ensureFreshSnapshotMock.mockResolvedValue({ docId: 'doc-1' })
  getSnapshotStateMock.mockReturnValue({ officeDocUrl: 'file:///Users/test/doc.docx', docId: 'doc-1', filename: 'doc.docx', dirty: false })
  getLocalFilePathMock.mockReturnValue(null)
  applyBackMock.mockImplementation(async (fetchBytes: () => Promise<Uint8Array>) => {
    await fetchBytes() // the real apply-back pulls the edited bytes through this callback
    return 'Replaced the open word document with the edited file (100 bytes).'
  })
})

// ── Validation ───────────────────────────────────────────────────────────────

describe('validateOfficeCliCall', () => {
  it('flags missing required args', () => {
    const result = validateOfficeCliCall(makeCall('officecli_get', {}))
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Missing required argument: "path"')
  })

  it('flags invalid enum values', () => {
    const result = validateOfficeCliCall(makeCall('officecli_view', { mode: 'banana' }))
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain('Invalid value for "mode"')
  })

  it('flags missing op companions', () => {
    expect(validateOfficeCliCall(makeCall('officecli_edit', { op: 'add', path: '/x' })).errors[0]).toContain('"type"')
    expect(validateOfficeCliCall(makeCall('officecli_edit', { op: 'move', path: '/x' })).errors[0]).toContain('"to"')
    expect(validateOfficeCliCall(makeCall('officecli_edit', { op: 'swap', path: '/x' })).errors[0]).toContain('"index"')
  })

  it('flags raw set without xml', () => {
    const result = validateOfficeCliCall(makeCall('officecli_raw', { path: '/x', action: 'set' }))
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain('"xml"')
  })

  it('flags batch operations that are not a JSON array', () => {
    expect(validateOfficeCliCall(makeCall('officecli_batch', { operations: '{not json' })).valid).toBe(false)
    expect(validateOfficeCliCall(makeCall('officecli_batch', { operations: '{"a":1}' })).valid).toBe(false)
    expect(validateOfficeCliCall(makeCall('officecli_batch', { operations: '[{"op":"set"}]' })).valid).toBe(true)
  })

  it('returns validation errors as tool output instead of throwing', async () => {
    const output = await executeOfficeCliTool(makeCall('officecli_query', {}))
    expect(output).toContain('Invalid tool call')
    expect(output).toContain('Missing required argument: "selector"')
    expect(execCommandMock).not.toHaveBeenCalled()
  })
})

// ── Dispatch mapping ─────────────────────────────────────────────────────────

describe('executeOfficeCliTool dispatch', () => {
  it('maps officecli_view to a view exec', async () => {
    await executeOfficeCliTool(makeCall('officecli_view', { mode: 'outline', path: '/Body', max_lines: 50 }))
    expect(execCommandMock).toHaveBeenCalledWith({
      doc_id: 'doc-1',
      command: 'view',
      args: ['outline', '--max-lines', '50'],
      path: '/Body',
    })
  })

  it('maps officecli_render screenshot to a view exec with page', async () => {
    execCommandMock.mockResolvedValue(okExecResponse({
      artifacts: [{ name: 'page2.png', kind: 'image', url: '/api/v1/office/cli/document/doc-1/artifact/page2.png' }],
    }))
    await executeOfficeCliTool(makeCall('officecli_render', { mode: 'screenshot', page: 2 }))
    expect(execCommandMock).toHaveBeenCalledWith({
      doc_id: 'doc-1',
      command: 'view',
      args: ['screenshot', '--page', '2'],
    })
  })

  it('maps officecli_get with depth', async () => {
    await executeOfficeCliTool(makeCall('officecli_get', { path: '/Body/Paragraph[0]', depth: 2 }))
    expect(execCommandMock).toHaveBeenCalledWith({
      doc_id: 'doc-1',
      command: 'get',
      path: '/Body/Paragraph[0]',
      args: ['--depth', '2'],
    })
  })

  it('maps officecli_query to a query exec', async () => {
    await executeOfficeCliTool(makeCall('officecli_query', { selector: 'Paragraph' }))
    expect(execCommandMock).toHaveBeenCalledWith({
      doc_id: 'doc-1',
      command: 'query',
      args: ['Paragraph'],
    })
  })

  it('maps officecli_analyze to validate + view issues', async () => {
    await executeOfficeCliTool(makeCall('officecli_analyze', {}))
    expect(execCommandMock).toHaveBeenCalledTimes(2)
    expect(execCommandMock).toHaveBeenNthCalledWith(1, { doc_id: 'doc-1', command: 'validate' })
    expect(execCommandMock).toHaveBeenNthCalledWith(2, { doc_id: 'doc-1', command: 'view', args: ['issues'] })
  })

  it('maps officecli_edit set to an exec with props', async () => {
    await executeOfficeCliTool(makeCall('officecli_edit', { op: 'set', path: '/x', props: { text: 'hi' } }))
    expect(execCommandMock).toHaveBeenCalledWith({
      doc_id: 'doc-1',
      command: 'set',
      path: '/x',
      args: [],
      props: { text: 'hi' },
    })
  })

  it('maps officecli_edit add with type flag', async () => {
    await executeOfficeCliTool(makeCall('officecli_edit', { op: 'add', path: '/x', type: 'Paragraph' }))
    expect(execCommandMock).toHaveBeenCalledWith({
      doc_id: 'doc-1',
      command: 'add',
      path: '/x',
      args: ['--type', 'Paragraph'],
    })
  })

  it('maps officecli_batch to a batch exec with the raw commands string', async () => {
    const operations = JSON.stringify([{ op: 'set', path: '/a' }, { op: 'remove', path: '/b' }])
    await executeOfficeCliTool(makeCall('officecli_batch', { operations }))
    expect(execCommandMock).toHaveBeenCalledWith({
      doc_id: 'doc-1',
      command: 'batch',
      commands: operations,
    })
  })

  it('maps officecli_create without syncing a snapshot', async () => {
    await executeOfficeCliTool(makeCall('officecli_create', { filename: 'new.docx', template_json: '{}' }))
    expect(ensureFreshSnapshotMock).not.toHaveBeenCalled()
    expect(execCommandMock).toHaveBeenCalledWith({
      new_filename: 'new.docx',
      command: 'create',
      args: ['--template', '{}'],
    })
  })

  it('maps officecli_merge to the template doc with an output filename', async () => {
    await executeOfficeCliTool(makeCall('officecli_merge', { data_json: '{"a":1}', output_filename: 'out.docx' }))
    expect(execCommandMock).toHaveBeenCalledWith({
      doc_id: 'doc-1',
      new_filename: 'out.docx',
      command: 'merge',
      args: ['--data', '{"a":1}'],
    })
  })

  it('maps officecli_dump with an optional path', async () => {
    await executeOfficeCliTool(makeCall('officecli_dump', { path: '/word/document.xml' }))
    expect(execCommandMock).toHaveBeenCalledWith({ doc_id: 'doc-1', command: 'dump', path: '/word/document.xml' })
  })

  it('maps officecli_raw get/set to raw and raw-set', async () => {
    await executeOfficeCliTool(makeCall('officecli_raw', { path: '/word/document.xml', xpath: '//w:p' }))
    expect(execCommandMock).toHaveBeenLastCalledWith({
      doc_id: 'doc-1',
      command: 'raw',
      path: '/word/document.xml',
      args: ['--xpath', '//w:p'],
    })

    await executeOfficeCliTool(makeCall('officecli_raw', { path: '/word/document.xml', action: 'set', xml: '<w:p/>' }))
    expect(execCommandMock).toHaveBeenLastCalledWith({
      doc_id: 'doc-1',
      command: 'raw-set',
      path: '/word/document.xml',
      args: ['--xml', '<w:p/>'],
    })
  })

  it('maps officecli_exec as an escape hatch', async () => {
    await executeOfficeCliTool(makeCall('officecli_exec', { command: 'plugins', args: ['--all'] }))
    expect(execCommandMock).toHaveBeenCalledWith({ doc_id: 'doc-1', command: 'plugins', args: ['--all'] })
  })
})

// ── Error passthrough / formatting ───────────────────────────────────────────

describe('executeOfficeCliTool output formatting', () => {
  it('passes officecli structured error code + suggestion through verbatim', async () => {
    execCommandMock.mockResolvedValue(okExecResponse({
      ok: false,
      exit_code: 2,
      result: { code: 'E_PATH_NOT_FOUND', suggestion: 'Try /Body/Paragraph[0] instead', message: 'path not found' },
      stderr: 'boom',
    }))

    const output = await executeOfficeCliTool(makeCall('officecli_get', { path: '/nope' }))
    expect(output).toContain('exit code 2')
    expect(output).toContain('code: E_PATH_NOT_FOUND')
    expect(output).toContain('suggestion: Try /Body/Paragraph[0] instead')
    expect(output).toContain('boom')
  })

  it('truncates huge output head+tail with a marker', async () => {
    execCommandMock.mockResolvedValue(okExecResponse({
      result: null,
      stdout: 'x'.repeat(20000),
    }))

    const output = await executeOfficeCliTool(makeCall('officecli_query', { selector: 'p' }))
    expect(output.length).toBeLessThan(9000)
    expect(output).toContain('chars truncated')
  })

  it('appends artifact markers for artifacts', async () => {
    execCommandMock.mockResolvedValue(okExecResponse({
      artifacts: [{ name: 'shot.png', kind: 'image', url: '/api/v1/office/cli/document/doc-1/artifact/shot.png' }],
    }))

    const output = await executeOfficeCliTool(makeCall('officecli_view', { mode: 'text' }))
    expect(output).toContain(ARTIFACT_MARKER)
    expect(output).toContain('"doc_id":"doc-1"')
    expect(output).toContain('"name":"shot.png"')
  })

  it('returns a one-line confirmation + marker for render', async () => {
    execCommandMock.mockResolvedValue(okExecResponse({
      artifacts: [{ name: 'page2.png', kind: 'image', url: '/api/v1/office/cli/document/doc-1/artifact/page2.png' }],
    }))

    const output = await executeOfficeCliTool(makeCall('officecli_render', { mode: 'screenshot', page: 2 }))
    expect(output).toContain('screenshot ready (page 2)')
    expect(output).toContain(ARTIFACT_MARKER)
  })

  it('formats artifact markers as [artifact:{json}]', () => {
    expect(formatArtifact('d', { name: 'n', kind: 'k', url: 'u' })).toBe(
      '[artifact:{"doc_id":"d","name":"n","kind":"k","url":"u"}]',
    )
  })
})

// ── Destructive set ──────────────────────────────────────────────────────────

describe('OFFICECLI_DESTRUCTIVE', () => {
  it('contains the mutating tools', () => {
    for (const name of ['officecli_edit', 'officecli_batch', 'officecli_create', 'officecli_merge', 'officecli_exec', 'officecli_raw']) {
      expect(OFFICECLI_DESTRUCTIVE.has(name)).toBe(true)
    }
  })

  it('does not contain read-only tools', () => {
    for (const name of ['officecli_view', 'officecli_render', 'officecli_get', 'officecli_query', 'officecli_analyze', 'officecli_dump', 'officecli_watch_start', 'officecli_watch_stop']) {
      expect(OFFICECLI_DESTRUCTIVE.has(name)).toBe(false)
    }
  })
})

// ── Live target ──────────────────────────────────────────────────────────────

describe('target: live', () => {
  it('downloads the edited source and applies it back to the live document', async () => {
    fetchArtifactMock.mockResolvedValue(new Blob([new Uint8Array([1, 2, 3])]))

    const output = await executeOfficeCliTool(makeCall('officecli_edit', { op: 'set', path: '/x', props: { a: 1 }, target: 'live' }))

    expect(execCommandMock).toHaveBeenCalledWith({
      doc_id: 'doc-1',
      command: 'set',
      path: '/x',
      args: [],
      props: { a: 1 },
    })
    expect(fetchArtifactMock).toHaveBeenCalledWith('doc-1', 'doc.docx')
    expect(applyBackMock).toHaveBeenCalledTimes(1)
    expect(output).toContain('Replaced the open word document')
  })

  it('does not apply back when the edit exec fails', async () => {
    execCommandMock.mockResolvedValue(okExecResponse({ ok: false, exit_code: 1, result: null, stderr: 'nope' }))

    const output = await executeOfficeCliTool(makeCall('officecli_edit', { op: 'remove', path: '/x', target: 'live' }))
    expect(applyBackMock).not.toHaveBeenCalled()
    expect(output).toContain('failed')
  })

  it('edits on disk via live_path when live_fs and a local file exist', async () => {
    getCapabilitiesMock.mockResolvedValue({ ok: true, available: true, live_fs: true })
    getLocalFilePathMock.mockReturnValue('/Users/test/doc.docx')

    const output = await executeOfficeCliTool(makeCall('officecli_edit', { op: 'set', path: '/x', target: 'live' }))

    expect(execCommandMock).toHaveBeenCalledWith({
      doc_id: 'doc-1',
      command: 'set',
      path: '/x',
      args: [],
      live_path: '/Users/test/doc.docx',
    })
    expect(applyBackMock).not.toHaveBeenCalled()
    expect(output).toContain('file edited on disk; Office will prompt to reload')
  })

  it('supports target live on batch', async () => {
    fetchArtifactMock.mockResolvedValue(new Blob([new Uint8Array([1])]))

    await executeOfficeCliTool(makeCall('officecli_batch', { operations: '[{"op":"set","path":"/a"}]', target: 'live' }))
    expect(applyBackMock).toHaveBeenCalledTimes(1)
  })
})

// ── Watch ────────────────────────────────────────────────────────────────────

describe('watch tools', () => {
  it('watch_start returns the URL and a watch marker', async () => {
    startWatchMock.mockResolvedValue({ ok: true, watch_url: 'http://127.0.0.1:26400', port: 26400 })

    const output = await executeOfficeCliTool(makeCall('officecli_watch_start', {}))
    expect(startWatchMock).toHaveBeenCalledWith('doc-1')
    expect(output).toContain('http://127.0.0.1:26400')
    expect(output).toContain('[watch:{"url":"http://127.0.0.1:26400"}]')
  })

  it('watch_stop stops the watch for the cached snapshot', async () => {
    stopWatchMock.mockResolvedValue({ ok: true })

    const output = await executeOfficeCliTool(makeCall('officecli_watch_stop', {}))
    expect(stopWatchMock).toHaveBeenCalledWith('doc-1')
    expect(ensureFreshSnapshotMock).not.toHaveBeenCalled()
    expect(output).toContain('stopped')
  })

  it('watch_stop reports when no snapshot exists', async () => {
    getSnapshotStateMock.mockReturnValue({ officeDocUrl: null, docId: null, filename: null, dirty: true })

    const output = await executeOfficeCliTool(makeCall('officecli_watch_stop', {}))
    expect(stopWatchMock).not.toHaveBeenCalled()
    expect(output).toContain('no live preview')
  })
})
