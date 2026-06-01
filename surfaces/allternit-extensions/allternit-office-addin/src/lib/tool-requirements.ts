/**
 * Office API Requirement Checker
 *
 * Maps tool names to their minimum Office.js API set requirements.
 * Uses Office.context.requirements.isSetSupported() at runtime to
 * determine whether a tool can safely execute.
 */

import { getOfficeHost } from './host-detector'

export interface ApiRequirement {
  /** Office API set name, e.g. 'ExcelApi', 'WordApi', 'PowerPointApi' */
  apiSet: string
  /** Minimum version string, e.g. '1.1', '1.8' */
  minVersion: string
  /** Human-readable description of why this is needed */
  reason: string
}

const TOOL_REQUIREMENTS: Record<string, ApiRequirement> = {
  // PowerPoint 1.8+ features
  ppt_set_notes: {
    apiSet: 'PowerPointApi',
    minVersion: '1.8',
    reason: 'Speaker notes require PowerPointApi 1.8+ (NotesSlide shapes)',
  },
  ppt_read_notes: {
    apiSet: 'PowerPointApi',
    minVersion: '1.8',
    reason: 'Reading speaker notes requires PowerPointApi 1.8+',
  },
}

/**
 * Check whether the current Office host supports the given API set version.
 * Returns true if the requirement is met or if the tool has no declared requirement.
 * Returns false if the host does not support the required API set version.
 */
export function checkToolRequirement(toolName: string): { supported: true } | { supported: false; message: string } {
  const req = TOOL_REQUIREMENTS[toolName]
  if (!req) {
    return { supported: true }
  }

  // If Office.js is not available (e.g. running in a browser test), treat as unsupported
  if (typeof Office === 'undefined' || !Office.context?.requirements?.isSetSupported) {
    return {
      supported: false,
      message: `${toolName} requires ${req.apiSet} ${req.minVersion} or later, but Office.js is not available in this context. ${req.reason}`,
    }
  }

  const supported = Office.context.requirements.isSetSupported(req.apiSet, req.minVersion)
  if (supported) {
    return { supported: true }
  }

  return {
    supported: false,
    message: `${toolName} requires ${req.apiSet} ${req.minVersion} or later. ${req.reason}. Please update your Office application or use an alternative approach.`,
  }
}

/**
 * Returns a list of all tools that have declared API requirements for the current host.
 * Useful for debugging or displaying capability information in the UI.
 */
export function getRequiredToolsForHost(): Array<{ tool: string; requirement: ApiRequirement }> {
  const host = getOfficeHost()
  return Object.entries(TOOL_REQUIREMENTS)
    .filter(([tool]) => tool.startsWith(host))
    .map(([tool, requirement]) => ({ tool, requirement }))
}
