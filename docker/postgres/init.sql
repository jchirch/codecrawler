-- Initial database schema
-- This file runs once on fresh volume initialisation.
-- Ongoing migrations are handled by backend/src/db/migrate.ts on startup.

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

