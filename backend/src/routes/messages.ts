import { Router, Response } from 'express';
import { Pool } from 'pg';
import { requireAuth, AuthRequest } from '../middleware/auth';

export function createMessagesRouter(db: Pool): Router {
  const router = Router();

  // GET /api/campaigns/:id/messages — list messages for a campaign (owner only)
  router.get('/:id/messages', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
    const id = Number(req.params['id']);
    if (isNaN(id)) {
      res.status(400).json({ error: 'invalid campaign id' });
      return;
    }

    // Verify ownership
    const campaign = await db.query(
      `SELECT id FROM campaigns WHERE id = $1 AND owner_id = $2`,
      [id, req.userId],
    );
    if (campaign.rows.length === 0) {
      res.status(404).json({ error: 'campaign not found' });
      return;
    }

    const result = await db.query(
      `SELECT m.id, m.campaign_id, m.user_id, m.content, m.created_at, u.email
       FROM messages m
       JOIN users u ON u.id = m.user_id
       WHERE m.campaign_id = $1
       ORDER BY m.created_at ASC`,
      [id],
    );

    res.json({ messages: result.rows });
  });

  // POST /api/campaigns/:id/messages — post a message to a campaign (owner only)
  router.post('/:id/messages', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
    const id = Number(req.params['id']);
    if (isNaN(id)) {
      res.status(400).json({ error: 'invalid campaign id' });
      return;
    }

    const { content } = req.body as Record<string, string>;
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      res.status(400).json({ error: 'content is required' });
      return;
    }

    // Verify ownership
    const campaign = await db.query(
      `SELECT id FROM campaigns WHERE id = $1 AND owner_id = $2`,
      [id, req.userId],
    );
    if (campaign.rows.length === 0) {
      res.status(404).json({ error: 'campaign not found' });
      return;
    }

    // Insert and return with user email in a single CTE query
    const result = await db.query(
      `WITH inserted AS (
         INSERT INTO messages (campaign_id, user_id, content)
         VALUES ($1, $2, $3)
         RETURNING id, campaign_id, user_id, content, created_at
       )
       SELECT i.*, u.email FROM inserted i JOIN users u ON u.id = i.user_id`,
      [id, req.userId, content.trim()],
    );

    res.status(201).json({ message: result.rows[0] });
  });

  return router;
}

