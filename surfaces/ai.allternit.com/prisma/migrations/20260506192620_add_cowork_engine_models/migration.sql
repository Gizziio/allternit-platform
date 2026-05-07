-- CreateTable
CREATE TABLE "cowork_projects" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "instructions" TEXT,
    "metadata" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "cowork_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "project_id" TEXT,
    "title" TEXT,
    "status" TEXT NOT NULL DEFAULT 'idle',
    "mode" TEXT NOT NULL DEFAULT 'agent',
    "checkpoint" TEXT,
    "metadata" TEXT,
    "started_at" DATETIME,
    "completed_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "cowork_sessions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "cowork_projects" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "cowork_scheduled_tasks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "project_id" TEXT,
    "title" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "run_at" BIGINT NOT NULL,
    "next_run_at" BIGINT,
    "schedule_config" TEXT,
    "repeat_every" INTEGER,
    "repeat_unit" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "last_run_at" BIGINT,
    "last_run_session_id" TEXT,
    "last_error" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "cowork_scheduled_tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "cowork_projects" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "cowork_memory_entries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "project_id" TEXT,
    "session_id" TEXT,
    "content" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'fact',
    "tags" TEXT,
    "source" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cowork_memory_entries_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "cowork_projects" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "cowork_personas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "system_prompt" TEXT NOT NULL,
    "tools" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "cowork_connectors" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "config" TEXT,
    "last_used" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "cowork_projects_user_id_idx" ON "cowork_projects"("user_id");

-- CreateIndex
CREATE INDEX "cowork_sessions_user_id_idx" ON "cowork_sessions"("user_id");

-- CreateIndex
CREATE INDEX "cowork_sessions_status_idx" ON "cowork_sessions"("status");

-- CreateIndex
CREATE INDEX "cowork_sessions_project_id_idx" ON "cowork_sessions"("project_id");

-- CreateIndex
CREATE INDEX "cowork_scheduled_tasks_user_id_idx" ON "cowork_scheduled_tasks"("user_id");

-- CreateIndex
CREATE INDEX "cowork_scheduled_tasks_enabled_next_run_at_idx" ON "cowork_scheduled_tasks"("enabled", "next_run_at");

-- CreateIndex
CREATE INDEX "cowork_scheduled_tasks_project_id_idx" ON "cowork_scheduled_tasks"("project_id");

-- CreateIndex
CREATE INDEX "cowork_memory_entries_user_id_idx" ON "cowork_memory_entries"("user_id");

-- CreateIndex
CREATE INDEX "cowork_memory_entries_project_id_idx" ON "cowork_memory_entries"("project_id");

-- CreateIndex
CREATE INDEX "cowork_memory_entries_type_idx" ON "cowork_memory_entries"("type");

-- CreateIndex
CREATE INDEX "cowork_personas_user_id_idx" ON "cowork_personas"("user_id");

-- CreateIndex
CREATE INDEX "cowork_connectors_user_id_idx" ON "cowork_connectors"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "cowork_connectors_user_id_name_key" ON "cowork_connectors"("user_id", "name");
