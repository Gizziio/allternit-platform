-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "clerkId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ssh_connections" (
    "id" TEXT NOT NULL,
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
    "last_connected_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ssh_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "remote_backend_targets" (
    "id" TEXT NOT NULL,
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
    "last_verified_at" TIMESTAMP(3),
    "last_heartbeat_at" TIMESTAMP(3),
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "remote_backend_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_backend_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "org_id" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'local',
    "fallback_mode" TEXT NOT NULL DEFAULT 'local',
    "execution_mode" TEXT NOT NULL DEFAULT 'auto',
    "execution_mode_updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "active_remote_backend_target_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_backend_preferences_pkey" PRIMARY KEY ("id")
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

-- AddForeignKey
ALTER TABLE "ssh_connections" ADD CONSTRAINT "ssh_connections_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "remote_backend_targets" ADD CONSTRAINT "remote_backend_targets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "remote_backend_targets" ADD CONSTRAINT "remote_backend_targets_ssh_connection_id_fkey" FOREIGN KEY ("ssh_connection_id") REFERENCES "ssh_connections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_backend_preferences" ADD CONSTRAINT "user_backend_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_backend_preferences" ADD CONSTRAINT "user_backend_preferences_active_remote_backend_target_id_fkey" FOREIGN KEY ("active_remote_backend_target_id") REFERENCES "remote_backend_targets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
