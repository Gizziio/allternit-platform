/**
 * @fileoverview Message types for gizzi-code integration
 * @module types/message
 *
 * Defines core message interfaces and types used across the application
 * for chat, notifications, and system communications.
 */
/**
 * Represents the possible roles a message can have in a conversation
 * @typedef {'user' | 'assistant' | 'system'} MessageRole
 */
export type MessageRole = 'user' | 'assistant' | 'system';
/**
 * Valid message role values for runtime validation
 * @constant {MessageRole[]}
 */
export declare const MESSAGE_ROLES: readonly MessageRole[];
/**
 * Supported MIME types for message attachments
 * @typedef {string} AttachmentMimeType
 */
export type AttachmentMimeType = 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp' | 'image/svg+xml' | 'text/plain' | 'text/markdown' | 'text/html' | 'application/json' | 'application/pdf' | 'application/zip' | 'audio/mpeg' | 'audio/wav' | 'video/mp4' | 'video/webm' | string;
/**
 * Attachment metadata and content structure
 * @interface Attachment
 */
export interface Attachment {
    /** Unique identifier for the attachment */
    readonly id: string;
    /** Original filename */
    readonly name: string;
    /** MIME type of the attachment */
    readonly mimeType: AttachmentMimeType;
    /** File size in bytes */
    readonly size: number;
    /** Data URL or storage reference for the attachment content */
    readonly url: string;
    /** Optional preview/thumbnail URL for image/video attachments */
    readonly previewUrl?: string;
    /** Optional caption or description */
    readonly caption?: string;
    /** Timestamp when the attachment was created */
    readonly createdAt: Date;
    /** Optional metadata for specific attachment types */
    readonly metadata?: Readonly<Record<string, unknown>>;
}
/**
 * Message status indicators
 * @typedef {'pending' | 'sent' | 'delivered' | 'read' | 'error'} MessageStatus
 */
export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'error';
/**
 * Core message structure for all communications
 * @interface Message
 */
export interface Message {
    /** Unique message identifier */
    readonly id: string;
    /** Message role identifying the sender type */
    readonly role: MessageRole;
    /** Message content - can be text or structured data */
    readonly content: string;
    /** Optional timestamp when the message was created */
    readonly timestamp?: Date;
    /** Optional array of file attachments */
    readonly attachments?: readonly Attachment[];
    /** Current status of the message delivery */
    readonly status?: MessageStatus;
    /** Optional metadata for extended message properties */
    readonly metadata?: Readonly<Record<string, unknown>>;
    /** Optional ID of the message this is replying to */
    readonly replyTo?: string;
    /** Optional edit history for tracking modifications */
    readonly edits?: ReadonlyArray<{
        readonly content: string;
        readonly timestamp: Date;
    }>;
}
/**
 * System-specific message with additional metadata
 * @interface SystemMessage
 * @extends Message
 */
export interface SystemMessage extends Message {
    readonly role: 'system';
    /** System message type categorization */
    readonly systemType: 'notification' | 'error' | 'warning' | 'info' | 'command';
    /** Optional action button or link */
    readonly action?: {
        readonly label: string;
        readonly handler: string;
        readonly payload?: unknown;
    };
}
/**
 * User message with optional context
 * @interface UserMessage
 * @extends Message
 */
export interface UserMessage extends Message {
    readonly role: 'user';
    /** Optional session or conversation context */
    readonly context?: Readonly<Record<string, unknown>>;
}
/**
 * Assistant/AI response message with optional thinking/reasoning
 * @interface AssistantMessage
 * @extends Message
 */
export interface AssistantMessage extends Message {
    readonly role: 'assistant';
    /** Optional thinking/reasoning process for the response */
    readonly reasoning?: string;
    /** Token usage statistics for the response */
    readonly tokenUsage?: {
        readonly prompt: number;
        readonly completion: number;
        readonly total: number;
    };
    /** Model identifier that generated the response */
    readonly model?: string;
}
/**
 * Union type for all message variants
 * @typedef {UserMessage | AssistantMessage | SystemMessage} TypedMessage
 */
export type TypedMessage = UserMessage | AssistantMessage | SystemMessage;
/**
 * Message thread/conversation structure
 * @interface MessageThread
 */
export interface MessageThread {
    /** Unique thread identifier */
    readonly id: string;
    /** Thread title or subject */
    readonly title?: string;
    /** Array of messages in the thread */
    readonly messages: readonly TypedMessage[];
    /** Thread creation timestamp */
    readonly createdAt: Date;
    /** Last activity timestamp */
    readonly updatedAt: Date;
    /** Optional metadata for the thread */
    readonly metadata?: Readonly<Record<string, unknown>>;
}
/**
 * Type guard to check if a message is from a user
 * @param {Message} message - The message to check
 * @returns {boolean} True if the message is from a user
 */
export declare function isUserMessage(message: Message): message is UserMessage;
/**
 * Type guard to check if a message is from the assistant
 * @param {Message} message - The message to check
 * @returns {boolean} True if the message is from the assistant
 */
export declare function isAssistantMessage(message: Message): message is AssistantMessage;
/**
 * Type guard to check if a message is a system message
 * @param {Message} message - The message to check
 * @returns {boolean} True if the message is a system message
 */
export declare function isSystemMessage(message: Message): message is SystemMessage;
/**
 * Type guard to check if a value is a valid MessageRole
 * @param {unknown} value - The value to check
 * @returns {boolean} True if the value is a valid MessageRole
 */
export declare function isMessageRole(value: unknown): value is MessageRole;
/**
 * Creates a new message with proper defaults
 * @param {Object} params - Message creation parameters
 * @returns {Message} A new message object
 */
export declare function createMessage(params: {
    role: MessageRole;
    content: string;
    attachments?: Attachment[];
    metadata?: Record<string, unknown>;
    replyTo?: string;
}): Message;
declare const _default: {
    MESSAGE_ROLES: readonly MessageRole[];
    isUserMessage: typeof isUserMessage;
    isAssistantMessage: typeof isAssistantMessage;
    isSystemMessage: typeof isSystemMessage;
    isMessageRole: typeof isMessageRole;
    createMessage: typeof createMessage;
};
export default _default;
