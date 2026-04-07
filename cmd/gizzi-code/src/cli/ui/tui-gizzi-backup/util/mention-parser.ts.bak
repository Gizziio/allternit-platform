/**
 * @mention Parser - Parse and route @mentions to agents
 * 
 * When Agent Mode is ON:
 * - @agent-name in prompts routes to that agent
 * - Shows which agent will respond
 * - Agent processes the message
 * 
 * When Agent Mode is OFF:
 * - @agent-name is treated as plain text
 * - No agent routing occurs
 */

import { Log } from "@/runtime/util/log"

export interface MentionParseResult {
  hasMention: boolean
  agentName?: string
  message: string
  remainingText: string
}

/**
 * Parse @mentions from user input
 * 
 * Examples:
 * - "@research analyze this" → { agentName: "research", message: "analyze this" }
 * - "Hello @code can you help?" → { agentName: "code", message: "can you help?" }
 * - "No mention here" → { hasMention: false }
 */
export function parseMentions(text: string): MentionParseResult {
  const mentionRegex = /@([a-zA-Z][a-zA-Z0-9_-]*)/g
  const match = mentionRegex.exec(text)
  
  if (!match) {
    return {
      hasMention: false,
      message: text,
      remainingText: text,
    }
  }
  
  const agentName = match[1]
  const mentionStart = match.index
  const mentionEnd = mentionStart + match[0].length
  
  // Extract message after the mention
  const remainingText = text.slice(mentionEnd).trim()
  const message = remainingText || text
  
  Log.Default.info("mention:parse", {
    original: text,
    agentName,
    message,
    hasMention: true,
  })
  
  return {
    hasMention: true,
    agentName,
    message,
    remainingText,
  }
}

/**
 * Check if text contains @mentions
 */
export function hasMention(text: string): boolean {
  return /@[a-zA-Z][a-zA-Z0-9_-]*/.test(text)
}

/**
 * Extract all @mentions from text
 */
export function extractAllMentions(text: string): string[] {
  const matches = text.match(/@[a-zA-Z][a-zA-Z0-9_-]*/g)
  return matches ? matches.map(m => m.slice(1)) : []
}
