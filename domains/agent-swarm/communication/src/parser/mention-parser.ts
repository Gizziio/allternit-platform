/**
 * Mention Parser
 * 
 * Parses @mentions from text messages.
 * Reverse engineered from agentchattr pattern, implemented for allternit.
 */

import type {
  ParsedMention,
  MentionParserConfig,
  MentionParserResult,
} from './mention-types.js';
import {
  DEFAULT_MENTION_REGEX,
  RESERVED_ROLES,
} from './mention-types.js';

/**
 * Mention Parser Class
 */
export class MentionParser {
  private config: MentionParserConfig;
  private pattern: RegExp;

  constructor(config: MentionParserConfig = {}) {
    this.config = {
      caseSensitive: config.caseSensitive ?? false,
      knownRoles: config.knownRoles ?? RESERVED_ROLES,
      knownAgents: config.knownAgents ?? [],
      pattern: config.pattern ?? DEFAULT_MENTION_REGEX,
    };

    // Create pattern with appropriate flags
    const flags = this.config.caseSensitive ? 'g' : 'gi';
    this.pattern = new RegExp(this.config.pattern.source, flags);
  }

  /**
   * Parse mentions from text
   */
  parse(text: string): MentionParserResult {
    if (!text || typeof text !== 'string') {
      return {
        mentions: [],
        textWithoutMentions: text || '',
        hasMentions: false,
        count: 0,
      };
    }

    const mentions: ParsedMention[] = [];
    const knownRoles = new Set(this.config.knownRoles?.map(r => r.toLowerCase()));
    const knownAgents = new Set(this.config.knownAgents?.map(a => a.toLowerCase()));

    // Reset regex lastIndex
    this.pattern.lastIndex = 0;

    let match: RegExpExecArray | null;
    while ((match = this.pattern.exec(text)) !== null) {
      const full = match[0];
      const name = match[1];
      const index = match.index;

      // Determine mention type
      const type = this.determineMentionType(name, knownRoles, knownAgents);

      mentions.push({
        name,
        index,
        full,
        type,
      });
    }

    // Remove mentions from text
    const textWithoutMentions = text.replace(this.pattern, '').trim();

    return {
      mentions,
      textWithoutMentions,
      hasMentions: mentions.length > 0,
      count: mentions.length,
    };
  }

  /**
   * Determine mention type (role, agent, or user)
   */
  private determineMentionType(
    name: string,
    knownRoles: Set<string>,
    knownAgents: Set<string>
  ): 'role' | 'agent' | 'user' {
    const lowerName = name.toLowerCase();

    // Check if it's a known role
    if (knownRoles.has(lowerName)) {
      return 'role';
    }

    // Check if it's a known agent
    if (knownAgents.has(lowerName)) {
      return 'agent';
    }

    // Default to user
    return 'user';
  }

  /**
   * Extract only role mentions
   */
  extractRoleMentions(text: string): ParsedMention[] {
    const result = this.parse(text);
    return result.mentions.filter(m => m.type === 'role');
  }

  /**
   * Extract only agent mentions
   */
  extractAgentMentions(text: string): ParsedMention[] {
    const result = this.parse(text);
    return result.mentions.filter(m => m.type === 'agent');
  }

  /**
   * Check if text mentions a specific role
   */
  mentionsRole(text: string, role: string): boolean {
    const result = this.parse(text);
    return result.mentions.some(
      m => m.type === 'role' && m.name.toLowerCase() === role.toLowerCase()
    );
  }

  /**
   * Check if text mentions a specific agent
   */
  mentionsAgent(text: string, agentName: string): boolean {
    const result = this.parse(text);
    return result.mentions.some(
      m => m.name.toLowerCase() === agentName.toLowerCase()
    );
  }

  /**
   * Get unique mention names
   */
  getUniqueMentions(text: string): string[] {
    const result = this.parse(text);
    const unique = new Set(result.mentions.map(m => m.name.toLowerCase()));
    return Array.from(unique);
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<MentionParserConfig>): void {
    this.config = { ...this.config, ...config };

    // Rebuild pattern if changed
    if (config.pattern) {
      const flags = this.config.caseSensitive ? 'g' : 'gi';
      this.pattern = new RegExp(this.config.pattern.source, flags);
    }
  }

  /**
   * Add known role
   */
  addKnownRole(role: string): void {
    if (!this.config.knownRoles) {
      this.config.knownRoles = [];
    }
    if (!this.config.knownRoles.includes(role)) {
      this.config.knownRoles.push(role);
    }
  }

  /**
   * Add known agent
   */
  addKnownAgent(agent: string): void {
    if (!this.config.knownAgents) {
      this.config.knownAgents = [];
    }
    if (!this.config.knownAgents.includes(agent)) {
      this.config.knownAgents.push(agent);
    }
  }
}

/**
 * Quick parse function (without parser instance)
 */
export function parseMentions(text: string): ParsedMention[] {
  const parser = new MentionParser();
  const result = parser.parse(text);
  return result.mentions;
}

/**
 * Check if text has mentions
 */
export function hasMentions(text: string): boolean {
  const parser = new MentionParser();
  const result = parser.parse(text);
  return result.hasMentions;
}

/**
 * Extract mention names from text
 */
export function extractMentionNames(text: string): string[] {
  const parser = new MentionParser();
  return parser.getUniqueMentions(text);
}
