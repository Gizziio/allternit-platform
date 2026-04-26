-- =============================================================================
-- Allternit Platform - PostgreSQL Initialization
-- =============================================================================
-- This script runs when the PostgreSQL container starts for the first time.
-- It sets up required extensions and initial database configuration.
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";

-- Enable pgvector for AI embeddings (if available)
DO $$
BEGIN
    CREATE EXTENSION IF NOT EXISTS "vector";
EXCEPTION
    WHEN undefined_file THEN
        RAISE NOTICE 'pgvector extension not available. Install with: apt-get install postgresql-16-pgvector';
END
$$;

-- Create application schemas
CREATE SCHEMA IF NOT EXISTS allternit;
CREATE SCHEMA IF NOT EXISTS allternit_audit;

-- Set search path
ALTER DATABASE allternit_platform SET search_path TO allternit, public;

-- Create roles
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'allternit_app') THEN
        CREATE ROLE allternit_app WITH LOGIN PASSWORD 'allternit-app-password';
    END IF;
    
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'allternit_readonly') THEN
        CREATE ROLE allternit_readonly WITH LOGIN PASSWORD 'allternit-readonly-password';
    END IF;
END
$$;

-- Grant permissions
GRANT USAGE ON SCHEMA allternit TO allternit_app;
GRANT CREATE ON SCHEMA allternit TO allternit_app;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA allternit TO allternit_app;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA allternit TO allternit_app;

GRANT USAGE ON SCHEMA allternit TO allternit_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA allternit TO allternit_readonly;

-- Create update timestamp function
CREATE OR REPLACE FUNCTION allternit.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Grant execute permission
GRANT EXECUTE ON FUNCTION allternit.update_updated_at_column() TO allternit_app;

-- Log completion
DO $$
BEGIN
    RAISE NOTICE 'Allternit Platform database initialized successfully';
END
$$;
