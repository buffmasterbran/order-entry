-- Authentication and User Management Tables
-- Run this SQL in your Supabase SQL Editor

-- Users table (shared across applications)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    netsuite_id TEXT UNIQUE NOT NULL,
    username TEXT NOT NULL,
    full_name TEXT,
    is_admin BOOLEAN DEFAULT FALSE,
    last_login TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS users_netsuite_id_idx ON users(netsuite_id);
CREATE INDEX IF NOT EXISTS users_username_idx ON users(username);



