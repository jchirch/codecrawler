import { Router, Response } from 'express';
import { Pool } from 'pg';
import { randomBytes } from 'crypto';
import { requireAuth, AuthRequest } from '../middleware/auth';

const VALID_THEMES = ['Fantasy', 'Dark Fantasy', 'Sci-Fi', 'Horror', 'Steampunk', 'Cyberpunk'];
const VALID_DIFFICULTIES = ['Novice', 'Standard', 'Veteran', 'Legendary'];

export function createCampaignsRouter(db: Pool): Router {
  const router = Router();

  // POST /api/campaigns — create a new campaign
  router.post('/', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
    const { name, theme, difficulty } = req.body as Record<string, string>;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ error: 'name is required' });
      return;
    }
    if (!VALID_THEMES.includes(theme)) {
      res.status(400).json({ error: `theme must be one of: ${VALID_THEMES.join(', ')}` });
      return;
    }
    if (!VALID_DIFFICULTIES.includes(difficulty)) {
      res.status(400).json({ error: `difficulty must be one of: ${VALID_DIFFICULTIES.join(', ')}` });
      return;
    }

    const invite_code = randomBytes(4).toString('hex').toUpperCase();
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      const campResult = await client.query(
        `INSERT INTO campaigns (name, theme, difficulty, owner_id, invite_code)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, name, theme, difficulty, owner_id, invite_code, created_at`,
        [name.trim(), theme, difficulty, req.userId, invite_code],
      );
      const campaign = campResult.rows[0];
      await client.query(
        `INSERT INTO campaign_members (campaign_id, user_id) VALUES ($1, $2)`,
        [campaign.id, req.userId],
      );
      await client.query('COMMIT');
      res.status(201).json({ campaign });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });

  // POST /api/campaigns/join — join via invite code (MUST be before /:id)
  router.post('/join', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
    const { invite_code } = req.body as Record<string, string>;

    if (!invite_code || typeof invite_code !== 'string' || invite_code.trim().length === 0) {
      res.status(400).json({ error: 'invite_code is required' });
      return;
    }

    const campResult = await db.query(
      `SELECT id, name, theme, difficulty, owner_id, invite_code, created_at
       FROM campaigns WHERE invite_code = $1`,
      [invite_code.trim().toUpperCase()],
    );
    if (campResult.rows.length === 0) {
      res.status(404).json({ error: 'Invalid invite code' });
      return;
    }

    const campaign = campResult.rows[0];
    await db.query(
      `INSERT INTO campaign_members (campaign_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [campaign.id, req.userId],
    );

    res.json({ campaign });
  });

  // GET /api/campaigns — list campaigns the authenticated user is a member of
  router.get('/', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
    const result = await db.query(
      `SELECT c.id, c.name, c.theme, c.difficulty, c.owner_id, c.invite_code, c.created_at
       FROM campaigns c
       JOIN campaign_members cm ON cm.campaign_id = c.id
       WHERE cm.user_id = $1
       ORDER BY c.created_at DESC`,
      [req.userId],
    );

    res.json({ campaigns: result.rows });
  });

  // GET /api/campaigns/:id — get a single campaign (must be a member)
  router.get('/:id', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
    const id = Number(req.params['id']);
    if (isNaN(id)) {
      res.status(400).json({ error: 'invalid campaign id' });
      return;
    }

    const result = await db.query(
      `SELECT c.id, c.name, c.theme, c.difficulty, c.owner_id, c.invite_code, c.created_at
       FROM campaigns c
       JOIN campaign_members cm ON cm.campaign_id = c.id
       WHERE c.id = $1 AND cm.user_id = $2`,
      [id, req.userId],
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'campaign not found' });
      return;
    }

    res.json({ campaign: result.rows[0] });
  });

  return router;
}

