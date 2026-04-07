/**
 * Mention Parser Types
 */

/**
 * Parsed mention structure
 */
export interface ParsedMention {
  /** Mentioned name/role */
  name: string;
  /** Position in original text */
  index: number;
  /** Full mention string (e.g., @builder) */
  full: string;
  /** Mention type */
  type: 'role' | 'agent' | 'user';
}

/**
 * Mention parser configuration
 */
export interface MentionParserConfig {
  /** Custom mention regex pattern */
  pattern?: RegExp;
  /** Known agent roles */
  knownRoles?: string[];
  /** Known agent IDs */
  knownAgents?: string[];
  /** Case sensitive matching */
  caseSensitive?: boolean;
}

/**
 * Mention parser result
 */
export interface MentionParserResult {
  /** All mentions found */
  mentions: ParsedMention[];
  /** Original text with mentions removed */
  textWithoutMentions: string;
  /** Whether any mentions were found */
  hasMentions: boolean;
  /** Count of mentions */
  count: number;
}

/**
 * Default mention regex pattern
 * Matches @name where name starts with letter and contains letters, numbers, underscores, hyphens
 */
export const DEFAULT_MENTION_REGEX = /\B@([A-Za-z][A-Za-z0-9_-]*)/g;

/**
 * Reserved role names (cannot be used as agent names)
 */
export const RESERVED_ROLES = [
  'builder',
  'validator',
  'reviewer',
  'planner',
  'security',
  'orchestrator',
  'all',
  'everyone',
  'here',
];
