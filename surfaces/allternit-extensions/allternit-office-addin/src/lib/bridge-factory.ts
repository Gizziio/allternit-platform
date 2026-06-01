/**
 * Office Bridge Factory — pattern from DocuPilotAI/DocuPilot (MIT)
 * Routes document operations to the correct Office.js API per host.
 */

import { getOfficeHost, type OfficeHostType } from './host-detector'

export interface DocumentContext {
  host: OfficeHostType
  label: string
  summary: string
}

export interface OfficeBridge {
  getContext(): Promise<DocumentContext>
  insertText(text: string): Promise<void>
}

// ── Excel ────────────────────────────────────────────────────────────────────

const ExcelBridge: OfficeBridge = {
  async getContext(): Promise<DocumentContext> {
    try {
      return await Excel.run(async (ctx) => {
        const sheet = ctx.workbook.worksheets.getActiveWorksheet()
        const range = ctx.workbook.getSelectedRange()
        sheet.load('name')
        range.load(['address', 'values'])
        ctx.workbook.load('name')
        await ctx.sync()

        const sample = (range.values as unknown[][])
          .slice(0, 5)
          .map((r) => r.slice(0, 5).join('\t'))
          .join('\n')

        return {
          host: 'excel',
          label: `${ctx.workbook.name} · ${sheet.name}`,
          summary: [
            `Workbook: ${ctx.workbook.name}`,
            `Sheet: ${sheet.name}`,
            `Selection: ${range.address}`,
            sample ? `Values (sample):\n${sample}` : '',
          ]
            .filter(Boolean)
            .join('\n'),
        }
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[ExcelBridge] getContext failed:', msg)
      return { host: 'excel', label: 'Excel Workbook', summary: `Failed to read Excel context: ${msg}` }
    }
  },

  async insertText(text: string): Promise<void> {
    try {
      await Excel.run(async (ctx) => {
        const range = ctx.workbook.getSelectedRange()
        range.load('cellCount')
        await ctx.sync()
        // Write to the first cell of the selection
        const singleCell = range.getCell(0, 0)
        singleCell.values = [[text]]
        await ctx.sync()
      })
    } catch (err) {
      console.error('[ExcelBridge] insertText failed:', err instanceof Error ? err.message : String(err))
      throw err
    }
  },
}

// ── Word ─────────────────────────────────────────────────────────────────────

const WordBridge: OfficeBridge = {
  async getContext(): Promise<DocumentContext> {
    try {
      return await Word.run(async (ctx) => {
        const selection = ctx.document.getSelection()
        const body = ctx.document.body
        const props = ctx.document.properties
        selection.load('text')
        body.load('text')
        props.load('title')
        await ctx.sync()

        return {
          host: 'word',
          label: props.title || 'Untitled Document',
          summary: [
            `Document: ${props.title || 'Untitled'}`,
            selection.text
              ? `Selected text:\n${selection.text}`
              : `Body (excerpt):\n${body.text.slice(0, 1000)}`,
          ].join('\n'),
        }
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[WordBridge] getContext failed:', msg)
      return { host: 'word', label: 'Word Document', summary: `Failed to read Word context: ${msg}` }
    }
  },

  async insertText(text: string): Promise<void> {
    try {
      await Word.run(async (ctx) => {
        const selection = ctx.document.getSelection()
        selection.insertText(text, Word.InsertLocation.replace)
        await ctx.sync()
      })
    } catch (err) {
      console.error('[WordBridge] insertText failed:', err instanceof Error ? err.message : String(err))
      throw err
    }
  },
}

// ── PowerPoint ───────────────────────────────────────────────────────────────

const PowerPointBridge: OfficeBridge = {
  async getContext(): Promise<DocumentContext> {
    try {
      return await PowerPoint.run(async (ctx) => {
        const slides = ctx.presentation.slides
        slides.load('items/id')
        ctx.presentation.load('title')
        await ctx.sync()

        return {
          host: 'powerpoint',
          label: ctx.presentation.title || 'Untitled Presentation',
          summary: [
            `Presentation: ${ctx.presentation.title || 'Untitled'}`,
            `Slides: ${slides.items.length}`,
          ].join('\n'),
        }
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[PowerPointBridge] getContext failed:', msg)
      return { host: 'powerpoint', label: 'PowerPoint Presentation', summary: `Failed to read PowerPoint context: ${msg}` }
    }
  },

  async insertText(text: string): Promise<void> {
    try {
      await PowerPoint.run(async (ctx) => {
        const slides = ctx.presentation.slides
        slides.load('items')
        await ctx.sync()
        const slide = slides.items[0]
        if (!slide) return
        // Positioning must be passed as ShapeAddOptions — cannot be set after creation
        slide.shapes.addTextBox(text, { left: 100, top: 100, width: 500, height: 80 })
        await ctx.sync()
      })
    } catch (err) {
      console.error('[PowerPointBridge] insertText failed:', err instanceof Error ? err.message : String(err))
      throw err
    }
  },
}

// ── Null (fallback) ──────────────────────────────────────────────────────────

const NullBridge: OfficeBridge = {
  async getContext(): Promise<DocumentContext> {
    return { host: 'unknown', label: 'Office Document', summary: 'No document context available.' }
  },
  async insertText(_text: string): Promise<void> {
    console.warn('[OfficeBridge] insertText called on NullBridge — no host detected')
  },
}

// ── Factory ──────────────────────────────────────────────────────────────────

export function getBridge(): OfficeBridge {
  return getBridgeByType(getOfficeHost())
}

export function getBridgeByType(hostType: OfficeHostType): OfficeBridge {
  switch (hostType) {
    case 'excel':       return ExcelBridge
    case 'word':        return WordBridge
    case 'powerpoint':  return PowerPointBridge
    default:            return NullBridge
  }
}
