/**
 * Read tool - file reading capability
 */
import type { ToolDef } from '../Tool.js'
import { z } from 'zod/v4'
import { Filesystem } from '@/runtime/util/filesystem.js'

export interface ReadToolParams {
  path: string
  maxLines?: number
  offset?: number
}

export interface ReadToolResult {
  content: string
  totalLines: number
  isBinary: boolean
}

export const ReadToolDef: ToolDef<ReadToolParams, ReadToolResult> = {
  name: 'Read',
  description: 'Read the contents of a file',
  parameters: z.object({
    path: z.string().describe('Path to the file to read'),
    maxLines: z.number().optional().describe('Maximum number of lines to read'),
    offset: z.number().optional().describe('Line offset to start reading from'),
  }),
  async execute(params) {
    const content = await Filesystem.readText(params.path)
    const lines = content.split('\n')
    const totalLines = lines.length
    const start = params.offset ?? 0
    const end = params.maxLines ? start + params.maxLines : lines.length
    const sliced = lines.slice(start, end).join('\n')
    const isBinary = await Filesystem.isBinaryFile(params.path).catch(() => false)
    return { content: sliced, totalLines, isBinary }
  },
}
