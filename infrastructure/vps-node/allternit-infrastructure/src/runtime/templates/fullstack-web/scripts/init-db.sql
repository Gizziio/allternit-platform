-- Full Stack Web Template - Database Initialization
-- This script runs when PostgreSQL container starts for the first time

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create application database (if running standalone without docker-compose)
-- CREATE DATABASE IF NOT EXISTS myapp;

-- Set up reasonable defaults
SET TIME ZONE 'UTC';

-- Note: Tables will be created by Prisma migrations
-- This file is for any initial database setup that Prisma doesn't handle

-- Create a function to update the updated_at column automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';
