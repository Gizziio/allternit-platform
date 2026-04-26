// @ts-nocheck
/**
 * MCPB Types (Locally defined to remove @anthropic-ai/mcpb dependency)
 */
export interface McpbAuthor {
  name: string
  email?: string
  url?: string
}

export interface McpbServerConfig {
  command: string
  args?: string[]
  env?: Record<string, string>
}

export interface McpbUserConfigurationOption {
  key?: string
  label?: string
  title?: string
  description?: string
  type: 'string' | 'number' | 'boolean' | 'enum' | 'file' | 'directory'
  options?: string[]
  required?: boolean
  sensitive?: boolean
  multiple?: boolean
  default?: string | number | boolean | string[]
  min?: number
  max?: number
}

export interface McpbManifest {
  name: string
  version: string
  author: McpbAuthor
  server?: McpbServerConfig
  tools: unknown[]
  user_config?: Record<string, McpbUserConfigurationOption>
}

import { errorMessage } from '../errors.js'
import { jsonParse } from '../slowOperations.js'

/**
 * Parses and validates a DXT manifest from a JSON object.
 */
export async function validateManifest(
  manifestJson: unknown,
): Promise<McpbManifest> {
  // Simple structural validation instead of Zod
  if (!manifestJson || typeof manifestJson !== 'object') {
    throw new Error('Invalid manifest: not an object')
  }

  const manifest = manifestJson as Record<string, any>
  if (typeof manifest.name !== 'string') throw new Error('Invalid manifest: name must be a string')
  if (typeof manifest.version !== 'string') throw new Error('Invalid manifest: version must be a string')
  if (!manifest.author || typeof manifest.author.name !== 'string') {
    throw new Error('Invalid manifest: author.name must be a string')
  }

  return manifestJson as McpbManifest
}

/**
 * Parses and validates a DXT manifest from raw text data.
 */
export async function parseAndValidateManifestFromText(
  manifestText: string,
): Promise<McpbManifest> {
  let manifestJson: unknown

  try {
    manifestJson = jsonParse(manifestText)
  } catch (error) {
    throw new Error(`Invalid JSON in manifest.json: ${errorMessage(error)}`)
  }

  return validateManifest(manifestJson)
}

/**
 * Parses and validates a DXT manifest from raw binary data.
 */
export async function parseAndValidateManifestFromBytes(
  manifestData: Uint8Array,
): Promise<McpbManifest> {
  const manifestText = new TextDecoder().decode(manifestData)
  return parseAndValidateManifestFromText(manifestText)
}

/**
 * Generates an extension ID from author name and extension name.
 * Uses the same algorithm as the directory backend for consistency.
 */
export function generateExtensionId(
  manifest: McpbManifest,
  prefix?: 'local.unpacked' | 'local.dxt',
): string {
  const sanitize = (str: string) =>
    str
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-_.]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')

  const authorName = manifest.author.name
  const extensionName = manifest.name

  const sanitizedAuthor = sanitize(authorName)
  const sanitizedName = sanitize(extensionName)

  return prefix
    ? `${prefix}.${sanitizedAuthor}.${sanitizedName}`
    : `${sanitizedAuthor}.${sanitizedName}`
}
