-- A2R Infrastructure Database Schema
-- Initial migration for VPS connections, cloud deployments, environments, and SSH keys

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- VPS Connections table
CREATE TABLE IF NOT EXISTS vps_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    host VARCHAR(255) NOT NULL,
    port INTEGER NOT NULL DEFAULT 22,
    auth_type VARCHAR(50) NOT NULL CHECK (auth_type IN ('password', 'private_key', 'ssh_agent')),
    username VARCHAR(255) NOT NULL,
    credentials_encrypted TEXT,
    ssh_key_id UUID,
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'connected', 'disconnected', 'error')),
    last_connected TIMESTAMP WITH TIME ZONE,
    last_error TEXT,
    tags TEXT[],
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- SSH Keys table
CREATE TABLE IF NOT EXISTS ssh_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    public_key TEXT NOT NULL,
    private_key_encrypted TEXT NOT NULL,
    fingerprint VARCHAR(255) UNIQUE NOT NULL,
    key_type VARCHAR(50) NOT NULL DEFAULT 'rsa' CHECK (key_type IN ('rsa', 'ed25519', 'ecdsa')),
    key_size INTEGER,
    passphrase_encrypted TEXT,
    tags TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add foreign key constraint to vps_connections
ALTER TABLE vps_connections 
    ADD CONSTRAINT fk_ssh_key 
    FOREIGN KEY (ssh_key_id) 
    REFERENCES ssh_keys(id) 
    ON DELETE SET NULL;

-- Cloud Deployments table
CREATE TABLE IF NOT EXISTS cloud_deployments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    provider VARCHAR(50) NOT NULL CHECK (provider IN ('hetzner', 'digitalocean', 'aws', 'azure', 'gcp')),
    region VARCHAR(100) NOT NULL,
    instance_type VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'provisioning', 'running', 'stopping', 'stopped', 'terminating', 'terminated', 'error')),
    instance_id VARCHAR(255),
    instance_ip INET,
    instance_ipv6 INET,
    root_password_encrypted TEXT,
    progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    config JSONB NOT NULL DEFAULT '{}',
    ssh_key_id UUID,
    vps_connection_id UUID,
    estimated_cost_per_hour DECIMAL(10, 4),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    terminated_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    tags TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_deployment_ssh_key 
        FOREIGN KEY (ssh_key_id) 
        REFERENCES ssh_keys(id) 
        ON DELETE SET NULL,
    CONSTRAINT fk_deployment_vps 
        FOREIGN KEY (vps_connection_id) 
        REFERENCES vps_connections(id) 
        ON DELETE SET NULL
);

-- Deployment Events table
CREATE TABLE IF NOT EXISTS deployment_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    deployment_id UUID NOT NULL,
    event_type VARCHAR(100) NOT NULL CHECK (event_type IN ('info', 'progress', 'success', 'warning', 'error')),
    message TEXT NOT NULL,
    data JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_event_deployment 
        FOREIGN KEY (deployment_id) 
        REFERENCES cloud_deployments(id) 
        ON DELETE CASCADE
);

-- Environment Templates table
CREATE TABLE IF NOT EXISTS environment_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    docker_compose TEXT NOT NULL,
    environment_variables JSONB DEFAULT '{}',
    required_ports INTEGER[],
    volume_mappings JSONB DEFAULT '[]',
    resource_limits JSONB DEFAULT '{"cpu": "1", "memory": "1g"}',
    tags TEXT[],
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Environments table
CREATE TABLE IF NOT EXISTS environments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    template_id UUID NOT NULL,
    target_vps_id UUID NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'provisioning', 'running', 'stopped', 'error', 'destroying', 'destroyed')),
    container_id VARCHAR(255),
    container_name VARCHAR(255),
    ports JSONB DEFAULT '[]',
    volumes JSONB DEFAULT '[]',
    environment_variables JSONB DEFAULT '{}',
    logs TEXT,
    health_status VARCHAR(50) DEFAULT 'unknown' CHECK (health_status IN ('healthy', 'unhealthy', 'starting', 'unknown')),
    last_health_check TIMESTAMP WITH TIME ZONE,
    started_at TIMESTAMP WITH TIME ZONE,
    stopped_at TIMESTAMP WITH TIME ZONE,
    destroyed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    tags TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_env_template 
        FOREIGN KEY (template_id) 
        REFERENCES environment_templates(id) 
        ON DELETE RESTRICT,
    CONSTRAINT fk_env_vps 
        FOREIGN KEY (target_vps_id) 
        REFERENCES vps_connections(id) 
        ON DELETE CASCADE
);

-- Environment Events table
CREATE TABLE IF NOT EXISTS environment_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    environment_id UUID NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    data JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_env_event 
        FOREIGN KEY (environment_id) 
        REFERENCES environments(id) 
        ON DELETE CASCADE
);

-- SSH Key Distributions table (tracks which keys are on which VPS)
CREATE TABLE IF NOT EXISTS ssh_key_distributions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ssh_key_id UUID NOT NULL,
    vps_id UUID NOT NULL,
    is_distributed BOOLEAN DEFAULT false,
    distributed_at TIMESTAMP WITH TIME ZONE,
    last_verified_at TIMESTAMP WITH TIME ZONE,
    authorized_key_entry TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_key_vps UNIQUE (ssh_key_id, vps_id),
    CONSTRAINT fk_dist_ssh_key 
        FOREIGN KEY (ssh_key_id) 
        REFERENCES ssh_keys(id) 
        ON DELETE CASCADE,
    CONSTRAINT fk_dist_vps 
        FOREIGN KEY (vps_id) 
        REFERENCES vps_connections(id) 
        ON DELETE CASCADE
);

-- VPS Connection Attempts table (for audit/security)
CREATE TABLE IF NOT EXISTS vps_connection_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vps_id UUID NOT NULL,
    attempt_type VARCHAR(50) NOT NULL,
    success BOOLEAN NOT NULL,
    error_message TEXT,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_attempt_vps 
        FOREIGN KEY (vps_id) 
        REFERENCES vps_connections(id) 
        ON DELETE CASCADE
);

-- API Keys table (for service-to-service authentication)
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    key_hash VARCHAR(255) UNIQUE NOT NULL,
    key_prefix VARCHAR(20) NOT NULL,
    permissions TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    last_used_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by UUID
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_vps_status ON vps_connections(status);
CREATE INDEX IF NOT EXISTS idx_vps_host ON vps_connections(host);
CREATE INDEX IF NOT EXISTS idx_vps_created_at ON vps_connections(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ssh_keys_fingerprint ON ssh_keys(fingerprint);
CREATE INDEX IF NOT EXISTS idx_ssh_keys_name ON ssh_keys(name);

CREATE INDEX IF NOT EXISTS idx_deployments_status ON cloud_deployments(status);
CREATE INDEX IF NOT EXISTS idx_deployments_provider ON cloud_deployments(provider);
CREATE INDEX IF NOT EXISTS idx_deployments_instance_id ON cloud_deployments(instance_id);
CREATE INDEX IF NOT EXISTS idx_deployments_created_at ON cloud_deployments(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_deployment_events_deployment_id ON deployment_events(deployment_id);
CREATE INDEX IF NOT EXISTS idx_deployment_events_created_at ON deployment_events(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_environments_status ON environments(status);
CREATE INDEX IF NOT EXISTS idx_environments_vps_id ON environments(target_vps_id);
CREATE INDEX IF NOT EXISTS idx_environments_template_id ON environments(template_id);
CREATE INDEX IF NOT EXISTS idx_environments_created_at ON environments(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_env_events_env_id ON environment_events(environment_id);
CREATE INDEX IF NOT EXISTS idx_env_events_created_at ON environment_events(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_key_dist_ssh_key ON ssh_key_distributions(ssh_key_id);
CREATE INDEX IF NOT EXISTS idx_key_dist_vps ON ssh_key_distributions(vps_id);

CREATE INDEX IF NOT EXISTS idx_vps_attempts_vps_id ON vps_connection_attempts(vps_id);
CREATE INDEX IF NOT EXISTS idx_vps_attempts_created_at ON vps_connection_attempts(created_at DESC);

-- Create trigger function for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_vps_connections_updated_at 
    BEFORE UPDATE ON vps_connections 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ssh_keys_updated_at 
    BEFORE UPDATE ON ssh_keys 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cloud_deployments_updated_at 
    BEFORE UPDATE ON cloud_deployments 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_environments_updated_at 
    BEFORE UPDATE ON environments 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_environment_templates_updated_at 
    BEFORE UPDATE ON environment_templates 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ssh_key_distributions_updated_at 
    BEFORE UPDATE ON ssh_key_distributions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Insert default environment templates
INSERT INTO environment_templates (name, description, docker_compose, required_ports, tags) VALUES
('a2r-node', 'Standard A2R node deployment', 
'version: "3.8"
services:
  a2r-node:
    image: a2r/node:latest
    container_name: a2r-node
    ports:
      - "${NODE_PORT:-8080}:8080"
      - "${WS_PORT:-8081}:8081"
    environment:
      - NODE_ENV=production
      - LOG_LEVEL=info
    volumes:
      - a2r-data:/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
      interval: 30s
      timeout: 10s
      retries: 3
volumes:
  a2r-data:', 
ARRAY[8080, 8081], 
ARRAY['a2r', 'node', 'default']),

('a2r-node-ssl', 'A2R node with SSL/TLS termination',
'version: "3.8"
services:
  a2r-node:
    image: a2r/node:latest
    container_name: a2r-node
    ports:
      - "${NODE_PORT:-8080}:8080"
      - "${WS_PORT:-8081}:8081"
    environment:
      - NODE_ENV=production
      - LOG_LEVEL=info
      - SSL_ENABLED=true
    volumes:
      - a2r-data:/data
      - ./ssl:/ssl:ro
    restart: unless-stopped
  nginx:
    image: nginx:alpine
    container_name: a2r-nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/ssl:ro
    depends_on:
      - a2r-node
    restart: unless-stopped
volumes:
  a2r-data:',
ARRAY[80, 443, 8080, 8081],
ARRAY['a2r', 'node', 'ssl', 'nginx']),

('postgres-stack', 'PostgreSQL with pgAdmin',
'version: "3.8"
services:
  postgres:
    image: postgres:15-alpine
    container_name: a2r-postgres
    environment:
      POSTGRES_USER: ${DB_USER:-a2r}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ${DB_NAME:-a2r}
    ports:
      - "${DB_PORT:-5432}:5432"
    volumes:
      - postgres-data:/var/lib/postgresql/data
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER:-a2r}"]
      interval: 10s
      timeout: 5s
      retries: 5
  pgadmin:
    image: dpage/pgadmin4:latest
    container_name: a2r-pgadmin
    environment:
      PGADMIN_DEFAULT_EMAIL: ${PGADMIN_EMAIL:-admin@a2r.local}
      PGADMIN_DEFAULT_PASSWORD: ${PGADMIN_PASSWORD}
    ports:
      - "${PGADMIN_PORT:-5050}:80"
    depends_on:
      - postgres
    restart: unless-stopped
volumes:
  postgres-data:',
ARRAY[5432, 5050],
ARRAY['database', 'postgres', 'pgadmin']);
