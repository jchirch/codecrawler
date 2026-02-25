import { Pool } from 'pg';
import { randomBytes } from 'crypto';

export async function runMigrations(db: Pool): Promise<void> {
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id            SERIAL PRIMARY KEY,
      email         TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS campaigns (
      id          SERIAL PRIMARY KEY,
      name        TEXT NOT NULL,
      theme       TEXT NOT NULL,
      difficulty  TEXT NOT NULL,
      owner_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id          SERIAL PRIMARY KEY,
      campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content     TEXT NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // ── Phase 5: invite codes + membership ──────────────────────────────────────
  await db.query(`
    ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS invite_code TEXT;
  `);

  // Backfill existing campaigns that have no invite_code
  const orphans = await db.query(
    `SELECT id FROM campaigns WHERE invite_code IS NULL`,
  );
  for (const row of orphans.rows as { id: number }[]) {
    const code = randomBytes(4).toString('hex').toUpperCase();
    await db.query(`UPDATE campaigns SET invite_code = $1 WHERE id = $2`, [code, row.id]);
  }

  await db.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS campaigns_invite_code_idx ON campaigns(invite_code);
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS campaign_members (
      campaign_id INTEGER NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (campaign_id, user_id)
    );
  `);

  // Backfill: ensure every campaign owner is a member
  await db.query(`
    INSERT INTO campaign_members (campaign_id, user_id)
    SELECT id, owner_id FROM campaigns
    ON CONFLICT DO NOTHING;
  `);

  // ── Phase 6: username for display in chat ───────────────────────────────────
  await db.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;
  `);

  // ── Phase 7: AI Dungeon Master messages ─────────────────────────────────────
  await db.query(`
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS is_dm BOOLEAN NOT NULL DEFAULT FALSE;
  `);

  // Allow user_id to be NULL for DM messages (which have no associated user)
  await db.query(`
    ALTER TABLE messages ALTER COLUMN user_id DROP NOT NULL;
  `);

  // ── Phase 8: persistent campaign world state ─────────────────────────────────
  await db.query(`
    CREATE TABLE IF NOT EXISTS campaign_state (
      id           SERIAL PRIMARY KEY,
      campaign_id  INTEGER NOT NULL UNIQUE REFERENCES campaigns(id) ON DELETE CASCADE,
      world_state  JSONB NOT NULL DEFAULT '{}',
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  console.log('Migrations applied');
}

