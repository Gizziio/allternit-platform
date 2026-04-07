-- =============================================================================
-- A2R Platform - PostgreSQL Initialization
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
CREATE SCHEMA IF NOT EXISTS a2r;
CREATE SCHEMA IF NOT EXISTS a2r_audit;

-- Set search path
ALTER DATABASE a2r_platform SET search_path TO a2r, public;

-- Create roles
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'a2r_app') THEN
        CREATE ROLE a2r_app WITH LOGIN PASSWORD 'a2r-app-password';
    END IF;
    
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'a2r_readonly') THEN
        CREATE ROLE a2r_readonly WITH LOGIN PASSWORD 'a2r-readonly-password';
    END IF;
END
$$;

-- Grant permissions
GRANT USAGE ON SCHEMA a2r TO a2r_app;
GRANT CREATE ON SCHEMA a2r TO a2r_app;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA a2r TO a2r_app;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA a2r TO a2r_app;

GRANT USAGE ON SCHEMA a2r TO a2r_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA a2r TO a2r_readonly;

-- Create update timestamp function
CREATE OR REPLACE FUNCTION a2r.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Grant execute permission
GRANT EXECUTE ON FUNCTION a2r.update_updated_at_column() TO a2r_app;

-- Log completion
DO $$
BEGIN
    RAISE NOTICE 'A2R Platform database initialized successfully';
END
$$;
