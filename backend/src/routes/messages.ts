import { Router, Response } from 'express';
import { Pool } from 'pg';
import { Server } from 'socket.io';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { askDungeonMaster, DmContext } from '../services/dm-agent';

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
      `SELECT m.id, m.campaign_id, m.user_id, m.content, m.is_dm, m.created_at,
              CASE WHEN m.is_dm THEN 'Dungeon Master'
                   ELSE COALESCE(u.username, u.email)
              END as display_name
       FROM messages m
       LEFT JOIN users u ON u.id = m.user_id
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

    // Insert user message and return with display_name in a single CTE query
    const result = await db.query(
      `WITH inserted AS (
         INSERT INTO messages (campaign_id, user_id, content, is_dm)
         VALUES ($1, $2, $3, FALSE)
         RETURNING id, campaign_id, user_id, content, is_dm, created_at
       )
       SELECT i.*, COALESCE(u.username, u.email) as display_name
       FROM inserted i JOIN users u ON u.id = i.user_id`,
      [id, req.userId, content.trim()],
    );

    const message = result.rows[0];

    // Broadcast user message immediately (sender sees it via socket too)
    io.to(`campaign:${id}`).emit('new-message', message);

    // Return HTTP response immediately — DM reply happens asynchronously
    res.status(201).json({ message });

    // ── Fire-and-forget: AI Dungeon Master response ────────────────────────
    triggerDmResponse(id, content.trim(), db, io).catch((err: unknown) => {
      console.error('[DM] Agent error:', err);
    });
  });

  return router;
}

// ── Helper: call DM agent and broadcast response ─────────────────────────────
async function triggerDmResponse(
  campaignId: number,
  userMessage: string,
  db: Pool,
  io: Server,
): Promise<void> {
  // Fetch campaign metadata for context
  const campaignRes = await db.query(
    `SELECT name, theme, difficulty FROM campaigns WHERE id = $1`,
    [campaignId],
  );
  if (campaignRes.rows.length === 0) return;
  const campaign = campaignRes.rows[0] as { name: string; theme: string; difficulty: string };

  // Fetch the last 10 messages for context (excluding the one just sent)
  const historyRes = await db.query(
    `SELECT m.content, m.is_dm,
            CASE WHEN m.is_dm THEN 'Dungeon Master'
                 ELSE COALESCE(u.username, u.email)
            END as display_name
     FROM messages m
     LEFT JOIN users u ON u.id = m.user_id
     WHERE m.campaign_id = $1
     ORDER BY m.created_at DESC
     LIMIT 11`,
    [campaignId],
  );

  // Reverse so oldest first; drop the very last row (the user's own message we just saved)
  const recentMessages = (historyRes.rows as Array<{ content: string; is_dm: boolean; display_name: string }>)
    .reverse()
    .slice(0, -1);

  const ctx: DmContext = {
    campaignName: campaign.name,
    theme: campaign.theme,
    difficulty: campaign.difficulty,
    recentMessages,
    userMessage,
  };

  const dmText = await askDungeonMaster(ctx);

  // Save DM message (user_id = NULL, is_dm = TRUE)
  const dmResult = await db.query(
    `INSERT INTO messages (campaign_id, user_id, content, is_dm)
     VALUES ($1, NULL, $2, TRUE)
     RETURNING id, campaign_id, user_id, content, is_dm, created_at`,
    [campaignId, dmText],
  );

  const dmMessage = {
    ...dmResult.rows[0],
    display_name: 'Dungeon Master',
  };

  // Broadcast DM message to everyone in the campaign room
  io.to(`campaign:${campaignId}`).emit('new-message', dmMessage);
}

