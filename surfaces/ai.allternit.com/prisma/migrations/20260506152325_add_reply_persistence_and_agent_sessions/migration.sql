-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clerkId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ssh_connections" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 22,
    "username" TEXT NOT NULL,
    "auth_type" TEXT NOT NULL,
    "encrypted_private_key" TEXT,
    "encrypted_password" TEXT,
    "status" TEXT NOT NULL DEFAULT 'disconnected',
    "os" TEXT,
    "architecture" TEXT,
    "docker_installed" BOOLEAN,
    "a2r_installed" BOOLEAN,
    "a2r_version" TEXT,
    "last_connected_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "ssh_connections_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "remote_backend_targets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "ssh_connection_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'disconnected',
    "install_state" TEXT NOT NULL DEFAULT 'unknown',
    "backend_url" TEXT,
    "gateway_url" TEXT,
    "gateway_ws_url" TEXT,
    "encrypted_gateway_token" TEXT,
    "installed_version" TEXT,
    "supported_client_range" TEXT,
    "last_verified_at" DATETIME,
    "last_heartbeat_at" DATETIME,
    "last_error" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "remote_backend_targets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "remote_backend_targets_ssh_connection_id_fkey" FOREIGN KEY ("ssh_connection_id") REFERENCES "ssh_connections" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "user_backend_preferences" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "org_id" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'local',
    "fallback_mode" TEXT NOT NULL DEFAULT 'local',
    "execution_mode" TEXT NOT NULL DEFAULT 'auto',
    "execution_mode_updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "active_remote_backend_target_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "user_backend_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "user_backend_preferences_active_remote_backend_target_id_fkey" FOREIGN KEY ("active_remote_backend_target_id") REFERENCES "remote_backend_targets" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ssh_keys" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "public_key" TEXT NOT NULL,
    "private_key" TEXT,
    "passphrase" TEXT,
    "fingerprint" TEXT NOT NULL,
    "key_type" TEXT NOT NULL DEFAULT 'ed25519',
    "bits" INTEGER NOT NULL DEFAULT 256,
    "last_used_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "ssh_keys_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "artifacts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "summary" TEXT,
    "tags" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "artifact_sections" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "artifact_id" TEXT NOT NULL,
    "heading" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "artifact_sections_artifact_id_fkey" FOREIGN KEY ("artifact_id") REFERENCES "artifacts" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "artifact_revisions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "artifact_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "snapshot" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "artifact_revisions_artifact_id_fkey" FOREIGN KEY ("artifact_id") REFERENCES "artifacts" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "workflows" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "userId" TEXT,
    "nodes" TEXT NOT NULL,
    "edges" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "workflow_executions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "workflowId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "result" TEXT,
    "error" TEXT,
    CONSTRAINT "workflow_executions_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "workflows" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "agent_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "agentId" TEXT NOT NULL,
    "agentName" TEXT NOT NULL,
    "runtimeModel" TEXT NOT NULL,
    "originSurface" TEXT NOT NULL DEFAULT 'remote-agents-api',
    "sessionMode" TEXT NOT NULL DEFAULT 'chat',
    "metadata" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "replies" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "conversations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "title" TEXT,
    "userId" TEXT,
    "parentConversationId" TEXT,
    "gizzi_session_id" TEXT,
    CONSTRAINT "conversations_parentConversationId_fkey" FOREIGN KEY ("parentConversationId") REFERENCES "conversations" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "conversation_messages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "parentMessageId" TEXT,
    "metadata" TEXT,
    CONSTRAINT "conversation_messages_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "workspaces" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "description" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "workspace_members" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspace_id" TEXT NOT NULL,
    "user_id" TEXT,
    "agent_id" TEXT,
    "role" TEXT NOT NULL,
    "joined_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "workspace_members_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "workspace_invitations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspace_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires_at" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "workspace_invitations_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "board_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspace_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL,
    "assignee_type" TEXT,
    "assignee_id" TEXT,
    "reporter_id" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "labels" TEXT,
    "estimated_minutes" INTEGER,
    "deadline" DATETIME,
    "dependencies" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "board_items_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "board_comments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "item_id" TEXT NOT NULL,
    "author_type" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "board_comments_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "board_items" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "team_skills" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspace_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "manifest" TEXT,
    "source_repo" TEXT,
    "version" TEXT NOT NULL,
    "installed_by" TEXT NOT NULL,
    "installed_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "team_skills_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "task_audit_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "task_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actor_type" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "payload" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "agent_runtimes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "agent_clis" TEXT,
    "status" TEXT NOT NULL,
    "last_heartbeat" DATETIME,
    "workspace_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "agent_runtimes_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "agents" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'worker',
    "parent_agent_id" TEXT,
    "model" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "capabilities" TEXT,
    "system_prompt" TEXT,
    "tools" TEXT,
    "max_iterations" INTEGER NOT NULL DEFAULT 10,
    "temperature" REAL NOT NULL DEFAULT 0.7,
    "config" TEXT,
    "status" TEXT NOT NULL DEFAULT 'idle',
    "workspace_id" TEXT,
    "avatar" TEXT,
    "identity_key" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "last_run_at" DATETIME
);

-- CreateTable
CREATE TABLE "memory_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "agent_id" TEXT,
    "type" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'user',
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "memory_events_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "memory_entities" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "agent_id" TEXT,
    "entity_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'General',
    "content" TEXT,
    "properties" TEXT,
    "property_count" INTEGER NOT NULL DEFAULT 0,
    "vector_id" TEXT,
    "last_updated" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "memory_entities_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "memory_edges" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "confidence" REAL NOT NULL DEFAULT 1.0,
    "metadata" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "memory_documents" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "agent_id" TEXT,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "source_type" TEXT NOT NULL,
    "source_url" TEXT,
    "chunk_count" INTEGER NOT NULL DEFAULT 0,
    "vector_ids" TEXT,
    "is_indexed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "test_suites" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "cases" TEXT NOT NULL,
    "runs" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "test_suites_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "agent_metrics" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "run_id" TEXT,
    "metric_type" TEXT NOT NULL,
    "value" REAL NOT NULL,
    "unit" TEXT NOT NULL,
    "metadata" TEXT,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "agent_metrics_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "agents" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "inbox_items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "agent_id" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "status" TEXT NOT NULL DEFAULT 'unread',
    "action_url" TEXT,
    "metadata" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "users_clerkId_key" ON "users"("clerkId");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "ssh_connections_userId_idx" ON "ssh_connections"("userId");

-- CreateIndex
CREATE INDEX "ssh_connections_status_idx" ON "ssh_connections"("status");

-- CreateIndex
CREATE UNIQUE INDEX "remote_backend_targets_ssh_connection_id_key" ON "remote_backend_targets"("ssh_connection_id");

-- CreateIndex
CREATE INDEX "remote_backend_targets_userId_idx" ON "remote_backend_targets"("userId");

-- CreateIndex
CREATE INDEX "remote_backend_targets_status_idx" ON "remote_backend_targets"("status");

-- CreateIndex
CREATE UNIQUE INDEX "user_backend_preferences_userId_key" ON "user_backend_preferences"("userId");

-- CreateIndex
CREATE INDEX "user_backend_preferences_active_remote_backend_target_id_idx" ON "user_backend_preferences"("active_remote_backend_target_id");

-- CreateIndex
CREATE INDEX "ssh_keys_user_id_idx" ON "ssh_keys"("user_id");

-- CreateIndex
CREATE INDEX "ssh_keys_fingerprint_idx" ON "ssh_keys"("fingerprint");

-- CreateIndex
CREATE INDEX "artifacts_user_id_idx" ON "artifacts"("user_id");

-- CreateIndex
CREATE INDEX "artifacts_workspace_id_idx" ON "artifacts"("workspace_id");

-- CreateIndex
CREATE INDEX "artifacts_status_idx" ON "artifacts"("status");

-- CreateIndex
CREATE INDEX "artifacts_type_idx" ON "artifacts"("type");

-- CreateIndex
CREATE INDEX "artifact_sections_artifact_id_idx" ON "artifact_sections"("artifact_id");

-- CreateIndex
CREATE INDEX "artifact_sections_artifact_id_position_idx" ON "artifact_sections"("artifact_id", "position");

-- CreateIndex
CREATE INDEX "artifact_revisions_artifact_id_idx" ON "artifact_revisions"("artifact_id");

-- CreateIndex
CREATE INDEX "artifact_revisions_artifact_id_created_at_idx" ON "artifact_revisions"("artifact_id", "created_at");

-- CreateIndex
CREATE INDEX "workflow_executions_workflowId_idx" ON "workflow_executions"("workflowId");

-- CreateIndex
CREATE INDEX "agent_sessions_agentId_idx" ON "agent_sessions"("agentId");

-- CreateIndex
CREATE INDEX "replies_conversationId_idx" ON "replies"("conversationId");

-- CreateIndex
CREATE INDEX "conversations_userId_idx" ON "conversations"("userId");

-- CreateIndex
CREATE INDEX "conversations_parentConversationId_idx" ON "conversations"("parentConversationId");

-- CreateIndex
CREATE INDEX "conversations_gizzi_session_id_idx" ON "conversations"("gizzi_session_id");

-- CreateIndex
CREATE INDEX "conversation_messages_conversationId_idx" ON "conversation_messages"("conversationId");

-- CreateIndex
CREATE INDEX "conversation_messages_parentMessageId_idx" ON "conversation_messages"("parentMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "workspaces_slug_key" ON "workspaces"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_members_workspace_id_user_id_key" ON "workspace_members"("workspace_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_members_workspace_id_agent_id_key" ON "workspace_members"("workspace_id", "agent_id");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_invitations_token_key" ON "workspace_invitations"("token");

-- CreateIndex
CREATE INDEX "board_items_workspace_id_idx" ON "board_items"("workspace_id");

-- CreateIndex
CREATE INDEX "board_items_status_idx" ON "board_items"("status");

-- CreateIndex
CREATE INDEX "board_comments_item_id_idx" ON "board_comments"("item_id");

-- CreateIndex
CREATE INDEX "team_skills_workspace_id_idx" ON "team_skills"("workspace_id");

-- CreateIndex
CREATE INDEX "task_audit_logs_task_id_idx" ON "task_audit_logs"("task_id");

-- CreateIndex
CREATE INDEX "task_audit_logs_created_at_idx" ON "task_audit_logs"("created_at");

-- CreateIndex
CREATE INDEX "agent_runtimes_workspace_id_idx" ON "agent_runtimes"("workspace_id");

-- CreateIndex
CREATE INDEX "agent_runtimes_status_idx" ON "agent_runtimes"("status");

-- CreateIndex
CREATE INDEX "agents_user_id_idx" ON "agents"("user_id");

-- CreateIndex
CREATE INDEX "agents_status_idx" ON "agents"("status");

-- CreateIndex
CREATE INDEX "memory_events_user_id_idx" ON "memory_events"("user_id");

-- CreateIndex
CREATE INDEX "memory_events_agent_id_idx" ON "memory_events"("agent_id");

-- CreateIndex
CREATE INDEX "memory_events_type_idx" ON "memory_events"("type");

-- CreateIndex
CREATE INDEX "memory_events_timestamp_idx" ON "memory_events"("timestamp");

-- CreateIndex
CREATE INDEX "memory_entities_user_id_idx" ON "memory_entities"("user_id");

-- CreateIndex
CREATE INDEX "memory_entities_agent_id_idx" ON "memory_entities"("agent_id");

-- CreateIndex
CREATE INDEX "memory_entities_entity_id_idx" ON "memory_entities"("entity_id");

-- CreateIndex
CREATE INDEX "memory_entities_type_idx" ON "memory_entities"("type");

-- CreateIndex
CREATE INDEX "memory_edges_user_id_idx" ON "memory_edges"("user_id");

-- CreateIndex
CREATE INDEX "memory_edges_source_idx" ON "memory_edges"("source");

-- CreateIndex
CREATE INDEX "memory_edges_target_idx" ON "memory_edges"("target");

-- CreateIndex
CREATE INDEX "memory_documents_user_id_idx" ON "memory_documents"("user_id");

-- CreateIndex
CREATE INDEX "memory_documents_agent_id_idx" ON "memory_documents"("agent_id");

-- CreateIndex
CREATE INDEX "memory_documents_is_indexed_idx" ON "memory_documents"("is_indexed");

-- CreateIndex
CREATE INDEX "test_suites_user_id_idx" ON "test_suites"("user_id");

-- CreateIndex
CREATE INDEX "test_suites_agent_id_idx" ON "test_suites"("agent_id");

-- CreateIndex
CREATE INDEX "agent_metrics_user_id_idx" ON "agent_metrics"("user_id");

-- CreateIndex
CREATE INDEX "agent_metrics_agent_id_idx" ON "agent_metrics"("agent_id");

-- CreateIndex
CREATE INDEX "agent_metrics_metric_type_idx" ON "agent_metrics"("metric_type");

-- CreateIndex
CREATE INDEX "agent_metrics_timestamp_idx" ON "agent_metrics"("timestamp");

-- CreateIndex
CREATE INDEX "inbox_items_user_id_idx" ON "inbox_items"("user_id");

-- CreateIndex
CREATE INDEX "inbox_items_agent_id_idx" ON "inbox_items"("agent_id");

-- CreateIndex
CREATE INDEX "inbox_items_status_idx" ON "inbox_items"("status");

-- CreateIndex
CREATE INDEX "inbox_items_created_at_idx" ON "inbox_items"("created_at");
