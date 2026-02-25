import { Pool } from 'pg';

/**
 * Loads the persisted world state for a campaign from the database.
 * Returns an empty object if no state has been saved yet.
 */
export async function loadCampaignState(
  db: Pool,
  campaignId: number,
): Promise<Record<string, unknown>> {
  const result = await db.query(
    `SELECT world_state FROM campaign_state WHERE campaign_id = $1`,
    [campaignId],
  );
  if (result.rows.length === 0) return {};
  return (result.rows[0] as { world_state: Record<string, unknown> }).world_state;
}

/**
 * Upserts the world state for a campaign.
 */
export async function saveCampaignState(
  db: Pool,
  campaignId: number,
  state: Record<string, unknown>,
): Promise<void> {
  await db.query(
    `INSERT INTO campaign_state (campaign_id, world_state)
     VALUES ($1, $2::jsonb)
     ON CONFLICT (campaign_id) DO UPDATE
       SET world_state = $2::jsonb, updated_at = NOW()`,
    [campaignId, JSON.stringify(state)],
  );
}

