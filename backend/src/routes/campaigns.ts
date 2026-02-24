import { Router, Response } from 'express';
import { Pool } from 'pg';
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

    const result = await db.query(
      `INSERT INTO campaigns (name, theme, difficulty, owner_id)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, theme, difficulty, owner_id, created_at`,
      [name.trim(), theme, difficulty, req.userId],
    );

    res.status(201).json({ campaign: result.rows[0] });
  });

  // GET /api/campaigns — list campaigns owned by the authenticated user
  router.get('/', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
    const result = await db.query(
      `SELECT id, name, theme, difficulty, owner_id, created_at
       FROM campaigns
       WHERE owner_id = $1
       ORDER BY created_at DESC`,
      [req.userId],
    );

    res.json({ campaigns: result.rows });
  });

  // GET /api/campaigns/:id — get a single campaign (must be owner)
  router.get('/:id', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
    const id = Number(req.params['id']);
    if (isNaN(id)) {
      res.status(400).json({ error: 'invalid campaign id' });
      return;
    }

    const result = await db.query(
      `SELECT id, name, theme, difficulty, owner_id, created_at
       FROM campaigns
       WHERE id = $1 AND owner_id = $2`,
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

