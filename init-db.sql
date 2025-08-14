-- Initialize database for NestJS Boilerplate
-- This script runs when the PostgreSQL container starts

-- Create database if it doesn't exist
SELECT 'CREATE DATABASE nestjs_boilerplate'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'nestjs_boilerplate')\gexec

-- Connect to the database
\c nestjs_boilerplate;

-- Create extensions if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Add any additional initialization SQL here
-- For example, you can add initial data or additional schemas

-- Log successful initialization
DO $$
BEGIN
    RAISE NOTICE 'Database nestjs_boilerplate initialized successfully!';
END $$; 