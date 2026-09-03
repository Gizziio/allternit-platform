/**
 * Group Chat Types
 *
 * Shared types for bot group chats: rooms where 2-6 bots coordinate over
 * bounded serial rounds, following the Hermes Bot Mode group-chat model.
 *
 * @module group-chat.types
 */

export type GroupChatMemberRole = 'native' | 'stacked';

export interface GroupChatMember {
  /** Roster-unique bot id. */
  botId: string;
  /** Display name at the time the group was created. */
  displayName: string;
  /** Handle used for @mentions. */
  handle: string;
  /** Source of the bot. */
  source: GroupChatMemberRole;
  /** For stacked bots, the provider id. */
  providerId?: string;
}

export interface GroupChatMessage {
  /** Unique message id. */
  id: string;
  /** Who sent the message. */
  from: 'user' | 'bot';
  /** Bot id when from === 'bot'. */
  botId?: string;
  /** Display name of the sender. */
  displayName?: string;
  /** Message text. */
  text: string;
  /** ISO timestamp. */
  timestamp: string;
}

export interface GroupChatMetadata {
  /** Optional channel bulletin / topic shown in the header. */
  bulletin?: string;
  /** Optional working folder path shared by the group. */
  workingFolder?: string;
  /** Optional bot id that acts as the default responder for the channel. */
  defaultResponderId?: string;
}

export interface GroupChat {
  /** Unique group id (slug from name). */
  id: string;
  /** Human-readable group name. */
  name: string;
  /** Members of the group. */
  members: GroupChatMember[];
  /** Chronological message log. */
  log: GroupChatMessage[];
  /** Optional image/avatar for the group. */
  image?: string;
  /** Channel metadata: bulletin, working folder, default responder. */
  metadata?: GroupChatMetadata;
  /** Created timestamp. */
  createdAt: string;
  /** Updated timestamp. */
  updatedAt: string;
}

export interface GroupChatRunOptions {
  /** Group to run. */
  group: GroupChat;
  /** User message that triggered the run. */
  userText: string;
  /** Maximum rounds of member turns (default 3). */
  maxRounds?: number;
  /** Maximum total member messages per user send (default 10). */
  maxMessages?: number;
  /** Timeout per member turn in ms (default 180000). */
  turnTimeoutMs?: number;
}

export interface GroupChatRoundResult {
  /** Round number (1-based). */
  round: number;
  /** Replies collected this round. */
  replies: GroupChatMessage[];
  /** Whether every member passed. */
  allPassed: boolean;
}

export interface GroupChatRunResult {
  /** Total rounds executed. */
  rounds: GroupChatRoundResult[];
  /** Whether the run completed (vs. hitting a cap). */
  settled: boolean;
  /** Reason if the run did not settle. */
  stopReason?: 'max_rounds' | 'max_messages' | 'timeout' | 'error';
  /** Member ids whose turns failed during the run. */
  failedMemberIds?: string[];
}
