-- Initial database schema
-- This file runs once on fresh volume initialisation.
-- Ongoing migrations are handled by backend/src/db/migrate.ts on startup.

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS campaigns (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  theme       TEXT NOT NULL,
  difficulty  TEXT NOT NULL,
  owner_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

