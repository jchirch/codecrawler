import { Router, Response } from 'express';
import { Pool } from 'pg';
import { Server } from 'socket.io';
import { requireAuth, AuthRequest } from '../middleware/auth';

export function createMessagesRouter(db: Pool, io: Server): Router {
  const router = Router();

  // GET /api/campaigns/:id/messages — list messages (member access)
  router.get('/:id/messages', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
    const id = Number(req.params['id']);
    if (isNaN(id)) {
      res.status(400).json({ error: 'invalid campaign id' });
      return;
    }

    // Verify membership
    const member = await db.query(
      `SELECT 1 FROM campaign_members WHERE campaign_id = $1 AND user_id = $2`,
      [id, req.userId],
    );
    if (member.rows.length === 0) {
      res.status(404).json({ error: 'campaign not found' });
      return;
    }

    const result = await db.query(
      `SELECT m.id, m.campaign_id, m.user_id, m.content, m.created_at,
              COALESCE(u.username, u.email) as display_name
       FROM messages m
       JOIN users u ON u.id = m.user_id
       WHERE m.campaign_id = $1
       ORDER BY m.created_at ASC`,
      [id],
    );

    res.json({ messages: result.rows });
  });

  // POST /api/campaigns/:id/messages — post a message (member access, broadcasts via socket)
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

    // Verify membership
    const member = await db.query(
      `SELECT 1 FROM campaign_members WHERE campaign_id = $1 AND user_id = $2`,
      [id, req.userId],
    );
    if (member.rows.length === 0) {
      res.status(404).json({ error: 'campaign not found' });
      return;
    }

    // Insert and return with display_name in a single CTE query
    const result = await db.query(
      `WITH inserted AS (
         INSERT INTO messages (campaign_id, user_id, content)
         VALUES ($1, $2, $3)
         RETURNING id, campaign_id, user_id, content, created_at
       )
       SELECT i.*, COALESCE(u.username, u.email) as display_name
       FROM inserted i JOIN users u ON u.id = i.user_id`,
      [id, req.userId, content.trim()],
    );

    const message = result.rows[0];

    // Broadcast to everyone in the campaign room (including sender)
    io.to(`campaign:${id}`).emit('new-message', message);

    res.status(201).json({ message });
  });

  return router;
}

