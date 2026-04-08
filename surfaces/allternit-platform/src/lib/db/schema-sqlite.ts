/**
 * A2rchitech Database Schema - SQLite Version (Dev Mode)
 * Simplified schema for local development without PostgreSQL
 */

import { sql } from "drizzle-orm";
import {
  integer,
  sqliteTable,
  text,
  primaryKey,
} from "drizzle-orm/sqlite-core";

// Better Auth tables
export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).default(false).notNull(),
  image: text("image"),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
});

export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp" }),
  refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp" }),
  scope: text("scope"),
  password: text("password"),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

// App tables
export const userCredit = sqliteTable("UserCredit", {
  userId: text("userId")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  credits: integer("credits").notNull().default(50),
});

export const project = sqliteTable("Project", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  createdAt: integer("createdAt", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  instructions: text("instructions").notNull().default(""),
  icon: text("icon").notNull().default("folder"),
  iconColor: text("iconColor").notNull().default("gray"),
});

export const chat = sqliteTable("Chat", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  createdAt: integer("createdAt", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
  title: text("title").notNull(),
  userId: text("userId")
    .notNull()
    .references(() => user.id),
  visibility: text("visibility").notNull().default("private"),
  isPinned: integer("isPinned", { mode: "boolean" }).notNull().default(false),
  projectId: text("projectId").references(() => project.id, { onDelete: "set null" }),
  kernelSessionId: text("kernelSessionId"),
});

export const message = sqliteTable("Message", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  chatId: text("chatId")
    .notNull()
    .references(() => chat.id, { onDelete: "cascade" }),
  parentMessageId: text("parentMessageId"),
  role: text("role").notNull(),
  content: text("content").notNull().default(""),
  attachments: text("attachments").notNull().default("[]"), // JSON
  createdAt: integer("createdAt", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
  annotations: text("annotations"), // JSON
  selectedModel: text("selectedModel").default(""),
  selectedTool: text("selectedTool").default(""),
  lastContext: text("lastContext"), // JSON
  activeStreamId: text("activeStreamId"),
  canceledAt: integer("canceledAt", { mode: "timestamp" }),
  kernelRunId: text("kernelRunId"),
});

export const part = sqliteTable("Part", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  messageId: text("messageId")
    .notNull()
    .references(() => message.id, { onDelete: "cascade" }),
  createdAt: integer("createdAt", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
  order: integer("order").notNull().default(0),
  type: text("type").notNull(),
  // Text fields
  text_text: text("text_text"),
  // Reasoning fields
  reasoning_text: text("reasoning_text"),
  // File fields
  file_mediaType: text("file_mediaType"),
  file_filename: text("file_filename"),
  file_url: text("file_url"),
  // Tool fields
  tool_name: text("tool_name"),
  tool_toolCallId: text("tool_toolCallId"),
  tool_state: text("tool_state"),
  tool_input: text("tool_input"), // JSON
  tool_output: text("tool_output"), // JSON
  tool_errorText: text("tool_errorText"),
  // Data fields
  data_type: text("data_type"),
  data_blob: text("data_blob"), // JSON
  providerMetadata: text("providerMetadata"), // JSON
});

export const vote = sqliteTable("Vote", {
  chatId: text("chatId")
    .notNull()
    .references(() => chat.id, { onDelete: "cascade" }),
  messageId: text("messageId")
    .notNull()
    .references(() => message.id, { onDelete: "cascade" }),
  isUpvoted: integer("isUpvoted", { mode: "boolean" }).notNull(),
}, (table) => ({
  pk: primaryKey({ columns: [table.chatId, table.messageId] }),
}));

export const document = sqliteTable("Document", {
  id: text("id").notNull().$defaultFn(() => crypto.randomUUID()),
  createdAt: integer("createdAt", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
  title: text("title").notNull(),
  content: text("content"),
  kind: text("kind").notNull().default("text"),
  userId: text("userId")
    .notNull()
    .references(() => user.id),
  messageId: text("messageId")
    .notNull()
    .references(() => message.id, { onDelete: "cascade" }),
});

export const mcpConnector = sqliteTable("McpConnector", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text("userId").references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  nameId: text("nameId").notNull(),
  url: text("url").notNull(),
  type: text("type").notNull().default("http"),
  oauthClientId: text("oauthClientId"),
  oauthClientSecret: text("oauthClientSecret"),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("createdAt", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
});

export const kernelSession = sqliteTable("KernelSession", {
  id: text("id").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  chatId: text("chatId").references(() => chat.id, { onDelete: "cascade" }),
  config: text("config").notNull(), // JSON
  status: text("status").notNull().default("active"),
  createdAt: integer("createdAt", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
});

export const schema = { 
  user, 
  session, 
  account, 
  verification,
  userCredit,
  project,
  chat,
  message,
  part,
  vote,
  document,
  mcpConnector,
  kernelSession,
};

// ============================================================================
// A2UI Sessions - Stores A2UI capsule state
// ============================================================================
export const a2uiSession = sqliteTable("A2UISession", {
  id: text("id").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  chatId: text("chatId")
    .notNull()
    .references(() => chat.id, { onDelete: "cascade" }),
  messageId: text("messageId").references(() => message.id, { onDelete: "set null" }),
  agentId: text("agentId"),
  // The A2UI payload (JSON)
  payload: text("payload").notNull(),
  // Current data model state (JSON)
  dataModel: text("dataModel").notNull().default("{}"),
  // Session status
  status: text("status").notNull().default("active"),
  // Source information
  source: text("source"),
  createdAt: integer("createdAt", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
});

// ============================================================================
// A2UI Capsules - Registry of available miniapps
// ============================================================================
export const a2uiCapsule = sqliteTable("A2UICapsule", {
  id: text("id").primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  // Capsule metadata
  name: text("name").notNull(),
  description: text("description"),
  version: text("version").notNull().default("1.0.0"),
  author: text("author"),
  // Manifest (JSON containing entry points, surfaces, actions, etc.)
  manifest: text("manifest").notNull(),
  // Content address (if stored externally)
  contentAddress: text("contentAddress"),
  // Binary content (if stored locally)
  content: text("content"),
  // Status
  status: text("status").notNull().default("draft"),
  // Installation metadata
  installedAt: integer("installedAt", { mode: "timestamp" }).default(sql`(unixepoch())`).notNull(),
  lastUsedAt: integer("lastUsedAt", { mode: "timestamp" }),
  favorite: integer("favorite", { mode: "boolean" }).notNull().default(false),
});
