/**
 * A2rchitech Database Schema
 * Ported from ChatJS with kernel integration
 */

import type { InferSelectModel } from "drizzle-orm";
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  json,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export type User = InferSelectModel<typeof user>;

// User credits for usage tracking
export const userCredit = pgTable("UserCredit", {
  userId: text("userId")
    .primaryKey()
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  /** Balance in cents. Default = $0.50 */
  credits: integer("credits").notNull().default(50),
});

export type UserCredit = InferSelectModel<typeof userCredit>;

// Model preferences per user
export const userModelPreference = pgTable(
  "UserModelPreference",
  {
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    modelId: varchar("modelId", { length: 256 }).notNull(),
    enabled: boolean("enabled").notNull(),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.modelId] }),
    UserModelPreference_user_id_idx: index(
      "UserModelPreference_user_id_idx"
    ).on(t.userId),
  })
);

export type UserModelPreference = InferSelectModel<typeof userModelPreference>;

// Projects group chats together
export const project = pgTable(
  "Project",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    instructions: text("instructions").notNull().default(""),
    icon: varchar("icon", { length: 64 }).notNull().default("folder"),
    iconColor: varchar("iconColor", { length: 32 }).notNull().default("gray"),
  },
  (t) => ({
    Project_user_id_idx: index("Project_user_id_idx").on(t.userId),
  })
);

export type Project = InferSelectModel<typeof project>;

// Chat threads
export const chat = pgTable("Chat", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  title: text("title").notNull(),
  userId: text("userId")
    .notNull()
    .references(() => user.id),
  visibility: varchar("visibility", { enum: ["public", "private"] })
    .notNull()
    .default("private"),
  isPinned: boolean("isPinned").notNull().default(false),
  projectId: uuid("projectId").references(() => project.id, {
    onDelete: "set null",
  }),
  // Kernel integration: track which kernel session this chat uses
  kernelSessionId: text("kernelSessionId"),
});

export type Chat = InferSelectModel<typeof chat>;

// Messages with parent references for branching
export const message = pgTable("Message", {
  id: uuid("id").primaryKey().notNull().defaultRandom(),
  chatId: uuid("chatId")
    .notNull()
    .references(() => chat.id, {
      onDelete: "cascade",
    }),
  parentMessageId: uuid("parentMessageId"),
  role: varchar("role").notNull(), // 'user' | 'assistant' | 'system' | 'data'
  attachments: json("attachments").notNull().$type<Array<{
    name: string;
    contentType: string;
    url: string;
  }>>(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  annotations: json("annotations"),
  selectedModel: varchar("selectedModel", { length: 256 }).default(""),
  selectedTool: varchar("selectedTool", { length: 256 }).default(""),
  lastContext: json("lastContext"),
  activeStreamId: varchar("activeStreamId", { length: 64 }),
  /** Timestamp when this message's stream was canceled by the user. Null means not canceled. */
  canceledAt: timestamp("canceledAt"),
  // Kernel integration
  kernelRunId: text("kernelRunId"),
});

export type DBMessage = InferSelectModel<typeof message>;

/**
 * Prefix-based Part Storage
 *
 * Normalized message parts for structured content:
 * - text_*: Text content parts
 * - reasoning_*: Reasoning/thinking parts
 * - file_*: File attachments
 * - source_url_*: URL sources
 * - source_document_*: Document sources
 * - tool_*: Tool calls
 * - data_*: Custom data parts
 */
export const part = pgTable(
  "Part",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    messageId: uuid("messageId")
      .notNull()
      .references(() => message.id, { onDelete: "cascade" }),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    order: integer("order").notNull().default(0),
    type: varchar("type").notNull(),
    // Text fields
    text_text: text("text_text"),
    // Reasoning fields
    reasoning_text: text("reasoning_text"),
    // File fields
    file_mediaType: varchar("file_mediaType"),
    file_filename: varchar("file_filename"),
    file_url: varchar("file_url"),
    // Source URL fields
    source_url_sourceId: varchar("source_url_sourceId"),
    source_url_url: varchar("source_url_url"),
    source_url_title: varchar("source_url_title"),
    // Source Document fields
    source_document_sourceId: varchar("source_document_sourceId"),
    source_document_mediaType: varchar("source_document_mediaType"),
    source_document_title: varchar("source_document_title"),
    source_document_filename: varchar("source_document_filename"),
    // Tool fields
    tool_name: varchar("tool_name"),
    tool_toolCallId: varchar("tool_toolCallId"),
    tool_state: varchar("tool_state"),
    tool_input: json("tool_input"),
    tool_output: json("tool_output"),
    tool_errorText: varchar("tool_errorText"),
    // Data fields
    data_type: varchar("data_type"),
    data_blob: json("data_blob"),
    // Provider metadata
    providerMetadata: json("providerMetadata"),
  },
  (t) => ({
    Part_message_id_idx: index("Part_message_id_idx").on(t.messageId),
    Part_message_id_order_idx: index("Part_message_id_order_idx").on(
      t.messageId,
      t.order
    ),
    text_chk: check(
      "Part_text_required_if_type_text",
      sql`CASE WHEN ${t.type} = 'text' THEN ${t.text_text} IS NOT NULL ELSE TRUE END`
    ),
    reasoning_chk: check(
      "Part_reasoning_required_if_type_reasoning",
      sql`CASE WHEN ${t.type} = 'reasoning' THEN ${t.reasoning_text} IS NOT NULL ELSE TRUE END`
    ),
    file_chk: check(
      "Part_file_required_if_type_file",
      sql`CASE WHEN ${t.type} = 'file' THEN ${t.file_mediaType} IS NOT NULL AND ${t.file_url} IS NOT NULL ELSE TRUE END`
    ),
    source_url_chk: check(
      "Part_source_url_required_if_type_source_url",
      sql`CASE WHEN ${t.type} = 'source-url' THEN ${t.source_url_sourceId} IS NOT NULL AND ${t.source_url_url} IS NOT NULL ELSE TRUE END`
    ),
    source_document_chk: check(
      "Part_source_document_required_if_type_source_document",
      sql`CASE WHEN ${t.type} = 'source-document' THEN ${t.source_document_sourceId} IS NOT NULL AND ${t.source_document_mediaType} IS NOT NULL AND ${t.source_document_title} IS NOT NULL ELSE TRUE END`
    ),
    tool_chk: check(
      "Part_tool_required_if_type_tool",
      sql`CASE WHEN ${t.type} LIKE 'tool-%' THEN ${t.tool_toolCallId} IS NOT NULL AND ${t.tool_state} IS NOT NULL ELSE TRUE END`
    ),
    data_chk: check(
      "Part_data_required_if_type_data",
      sql`CASE WHEN ${t.type} LIKE 'data-%' THEN ${t.data_type} IS NOT NULL ELSE TRUE END`
    ),
  })
);

export type Part = InferSelectModel<typeof part>;

// Message votes for feedback
export const vote = pgTable(
  "Vote",
  {
    chatId: uuid("chatId")
      .notNull()
      .references(() => chat.id, {
        onDelete: "cascade",
      }),
    messageId: uuid("messageId")
      .notNull()
      .references(() => message.id, {
        onDelete: "cascade",
      }),
    isUpvoted: boolean("isUpvoted").notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.chatId, table.messageId] }),
  })
);

export type Vote = InferSelectModel<typeof vote>;

// Artifacts (documents, code, sheets)
export const document = pgTable(
  "Document",
  {
    id: uuid("id").notNull().defaultRandom(),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    title: text("title").notNull(),
    content: text("content"),
    kind: varchar("kind", { enum: ["text", "code", "sheet"] })
      .notNull()
      .default("text"),
    userId: text("userId")
      .notNull()
      .references(() => user.id),
    messageId: uuid("messageId")
      .notNull()
      .references(() => message.id, {
        onDelete: "cascade",
      }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id, table.createdAt] }),
    document_message_id_idx: index("Document_message_id_idx").on(
      table.messageId
    ),
  })
);

export type Document = InferSelectModel<typeof document>;

// Document edit suggestions
export const suggestion = pgTable(
  "Suggestion",
  {
    id: uuid("id").notNull().defaultRandom(),
    documentId: uuid("documentId").notNull(),
    documentCreatedAt: timestamp("documentCreatedAt").notNull(),
    originalText: text("originalText").notNull(),
    suggestedText: text("suggestedText").notNull(),
    description: text("description"),
    isResolved: boolean("isResolved").notNull().default(false),
    userId: text("userId")
      .notNull()
      .references(() => user.id),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.id] }),
    documentRef: foreignKey({
      columns: [table.documentId, table.documentCreatedAt],
      foreignColumns: [document.id, document.createdAt],
    }),
  })
);

export type Suggestion = InferSelectModel<typeof suggestion>;

// Better Auth tables
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
});

// MCP Connector configuration
export const mcpConnector = pgTable(
  "McpConnector",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    userId: text("userId").references(() => user.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 256 }).notNull(),
    nameId: varchar("nameId", { length: 256 }).notNull(),
    url: text("url").notNull(),
    type: varchar("type", { enum: ["http", "sse"] })
      .notNull()
      .default("http"),
    oauthClientId: text("oauthClientId"),
    oauthClientSecret: text("oauthClientSecret"),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    McpConnector_user_id_idx: index("McpConnector_user_id_idx").on(t.userId),
    McpConnector_user_name_id_idx: index("McpConnector_user_name_id_idx").on(
      t.userId,
      t.nameId
    ),
    McpConnector_user_name_id_unique: uniqueIndex(
      "McpConnector_user_name_id_unique"
    ).on(t.userId, t.nameId),
  })
);

export type McpConnector = InferSelectModel<typeof mcpConnector>;

// MCP OAuth sessions for OAuth flow state management
export const mcpOAuthSession = pgTable(
  "McpOAuthSession",
  {
    id: uuid("id").primaryKey().notNull().defaultRandom(),
    mcpConnectorId: text("mcpConnectorId").notNull(),
    state: text("state").notNull().unique(),
    codeVerifier: text("codeVerifier"),
    clientInfo: json("clientInfo"),
    tokens: json("tokens"),
    metadata: json("metadata"), // For additional data like serverUrl
    isAuthenticated: boolean("isAuthenticated").notNull().default(false),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    McpOAuthSession_state_idx: index("McpOAuthSession_state_idx").on(t.state),
    McpOAuthSession_connector_id_idx: index("McpOAuthSession_connector_id_idx").on(
      t.mcpConnectorId
    ),
  })
);

export type McpOAuthSession = InferSelectModel<typeof mcpOAuthSession>;

// Kernel sessions tracking
export const kernelSession = pgTable(
  "KernelSession",
  {
    id: text("id").primaryKey(),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    chatId: uuid("chatId")
      .references(() => chat.id, { onDelete: "cascade" }),
    config: json("config").notNull(),
    status: varchar("status", { enum: ["active", "closed", "error"] })
      .notNull()
      .default("active"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => ({
    KernelSession_user_id_idx: index("KernelSession_user_id_idx").on(t.userId),
    KernelSession_chat_id_idx: index("KernelSession_chat_id_idx").on(t.chatId),
  })
);

export type KernelSession = InferSelectModel<typeof kernelSession>;

export const schema = { 
  user, 
  session, 
  account, 
  verification,
  userCredit,
  userModelPreference,
  project,
  chat,
  message,
  part,
  vote,
  document,
  suggestion,
  mcpConnector,
  mcpOAuthSession,
  kernelSession,
};
