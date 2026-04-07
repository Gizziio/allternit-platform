/**
 * Write tool - file writing capability
 */
import type { ToolDef } from '../Tool.js'
import { z } from 'zod/v4'
import { Filesystem } from '@/runtime/util/filesystem.js'

export interface WriteToolParams {
  path: string
  content: string
  append?: boolean
}

export interface WriteToolResult {
  bytesWritten: number
  path: string
}

export const WriteToolDef: ToolDef<WriteToolParams, WriteToolResult> = {
  name: 'Write',
  description: 'Write content to a file',
  parameters: z.object({
    path: z.string().describe('Path to the file to write'),
    content: z.string().describe('Content to write'),
    append: z.boolean().optional().describe('Append to file instead of overwriting'),
  }),
  async execute(params) {
    if (params.append) {
      await Filesystem.append(params.path, params.content)
    } else {
      await Filesystem.write(params.path, params.content)
    }
    const info = await Filesystem.stat(params.path)
    return { bytesWritten: info.size, path: params.path }
  },
}
