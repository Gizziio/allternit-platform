/**
 * Edit tool - file editing capability (search and replace)
 */
import type { ToolDef } from '../Tool.js'
import { z } from 'zod/v4'
import { Filesystem } from '@/runtime/util/filesystem.js'

export interface EditToolParams {
  path: string
  search: string
  replace: string
  regex?: boolean
  maxReplacements?: number
}

export interface EditToolResult {
  replacements: number
  content: string
  path: string
}

export const EditToolDef: ToolDef<EditToolParams, EditToolResult> = {
  name: 'Edit',
  description: 'Search and replace content in a file',
  parameters: z.object({
    path: z.string().describe('Path to the file to edit'),
    search: z.string().describe('Text or regex pattern to search for'),
    replace: z.string().describe('Replacement text'),
    regex: z.boolean().optional().describe('Treat search as regex'),
    maxReplacements: z.number().optional().describe('Maximum number of replacements'),
  }),
  async execute(params) {
    const content = await Filesystem.readText(params.path)
    const regex = params.regex ? new RegExp(params.search, 'g') : new RegExp(params.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')
    const max = params.maxReplacements ?? Infinity
    let count = 0
    const newContent = content.replace(regex, (match) => {
      if (count >= max) return match
      count++
      return params.replace
    })
    await Filesystem.write(params.path, newContent)
    return { replacements: count, content: newContent, path: params.path }
  },
}
