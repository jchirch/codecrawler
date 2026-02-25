import { Router, Response } from 'express';
import { Pool } from 'pg';
import { Server } from 'socket.io';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { getLevelForXp, getXpForNextLevel, getAbilityModifier } from '../services/character.service';

export function createCharactersRouter(db: Pool, io: Server): Router {
  const router = Router();

  // ── GET /campaigns/:campaignId/my-character ─────────────────────────────────
  router.get('/campaigns/:campaignId/my-character', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
    const campaignId = Number(req.params['campaignId']);
    if (isNaN(campaignId)) { res.status(400).json({ error: 'invalid campaign id' }); return; }

    // Verify membership
    const member = await db.query(
      `SELECT 1 FROM campaign_members WHERE campaign_id = $1 AND user_id = $2`,
      [campaignId, req.userId]
    );
    if (member.rows.length === 0) { res.status(404).json({ error: 'campaign not found' }); return; }

    const charRes = await db.query(
      `SELECT c.*, 
              COALESCE(json_agg(ii ORDER BY ii.created_at ASC) FILTER (WHERE ii.id IS NOT NULL), '[]') as inventory
       FROM characters c
       LEFT JOIN inventory_items ii ON ii.character_id = c.id
       WHERE c.campaign_id = $1 AND c.user_id = $2
       GROUP BY c.id`,
      [campaignId, req.userId]
    );

    if (charRes.rows.length === 0) {
      res.status(404).json({ error: 'no character found' });
      return;
    }

    res.json({ character: charRes.rows[0] });
  });

  // ── POST /campaigns/:campaignId/characters ──────────────────────────────────
  router.post('/campaigns/:campaignId/characters', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
    const campaignId = Number(req.params['campaignId']);
    if (isNaN(campaignId)) { res.status(400).json({ error: 'invalid campaign id' }); return; }

    // Verify membership
    const member = await db.query(
      `SELECT 1 FROM campaign_members WHERE campaign_id = $1 AND user_id = $2`,
      [campaignId, req.userId]
    );
    if (member.rows.length === 0) { res.status(403).json({ error: 'not a campaign member' }); return; }

    const {
      name, race, class: charClass,
      strength = 10, dexterity = 10, constitution = 10,
      intelligence = 10, wisdom = 10, charisma = 10,
      max_hp, armor_class = 10, hit_die, spells = []
    } = req.body as Record<string, unknown>;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ error: 'name is required' }); return;
    }
    if (!race || typeof race !== 'string') {
      res.status(400).json({ error: 'race is required' }); return;
    }
    if (!charClass || typeof charClass !== 'string') {
      res.status(400).json({ error: 'class is required' }); return;
    }

    // Default max_hp: hit_die max + CON modifier
    const conMod = getAbilityModifier(Number(constitution));
    const hitDie = Number(hit_die) || 8;
    const startingHp = Number(max_hp) || (hitDie + conMod);

    try {
      const result = await db.query(
        `INSERT INTO characters 
           (user_id, campaign_id, name, race, class, strength, dexterity, constitution, intelligence, wisdom, charisma, max_hp, current_hp, armor_class, hit_die, spells)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $12, $13, $14, $15)
         RETURNING *`,
        [
          req.userId, campaignId, name.trim(), race, charClass,
          strength, dexterity, constitution, intelligence, wisdom, charisma,
          startingHp, armor_class, hit_die ?? null, JSON.stringify(spells)
        ]
      );
      res.status(201).json({ character: result.rows[0] });
    } catch (err: unknown) {
      if ((err as { code?: string }).code === '23505') {
        res.status(409).json({ error: 'You already have a character in this campaign' });
      } else {
        console.error('[characters] create error', err);
        res.status(500).json({ error: 'internal server error' });
      }
    }
  });

  // ── GET /characters/:id ─────────────────────────────────────────────────────
  router.get('/characters/:id', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
    const id = Number(req.params['id']);
    if (isNaN(id)) { res.status(400).json({ error: 'invalid character id' }); return; }

    const result = await db.query(
      `SELECT c.*,
              COALESCE(json_agg(ii ORDER BY ii.created_at ASC) FILTER (WHERE ii.id IS NOT NULL), '[]') as inventory
       FROM characters c
       LEFT JOIN inventory_items ii ON ii.character_id = c.id
       WHERE c.id = $1 AND c.user_id = $2
       GROUP BY c.id`,
      [id, req.userId]
    );

    if (result.rows.length === 0) { res.status(404).json({ error: 'character not found' }); return; }
    res.json({ character: result.rows[0] });
  });

  // ── PATCH /characters/:id ───────────────────────────────────────────────────
  router.patch('/characters/:id', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
    const id = Number(req.params['id']);
    if (isNaN(id)) { res.status(400).json({ error: 'invalid character id' }); return; }

    // Verify ownership
    const charRes = await db.query(`SELECT id FROM characters WHERE id = $1 AND user_id = $2`, [id, req.userId]);
    if (charRes.rows.length === 0) { res.status(404).json({ error: 'character not found' }); return; }

    const allowed = ['name', 'strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma', 'max_hp', 'current_hp', 'armor_class', 'spells'];
    const updates: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    for (const field of allowed) {
      if (req.body[field] !== undefined) {
        if (field === 'spells') {
          updates.push(`${field} = $${idx}`);
          values.push(JSON.stringify(req.body[field]));
        } else {
          updates.push(`${field} = $${idx}`);
          values.push(req.body[field]);
        }
        idx++;
      }
    }

    if (updates.length === 0) { res.status(400).json({ error: 'no fields to update' }); return; }

    values.push(id);
    const result = await db.query(
      `UPDATE characters SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    res.json({ character: result.rows[0] });
  });

  // ── POST /characters/:id/xp ─────────────────────────────────────────────────
  router.post('/characters/:id/xp', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
    const id = Number(req.params['id']);
    if (isNaN(id)) { res.status(400).json({ error: 'invalid character id' }); return; }

    const { amount } = req.body as { amount?: number };
    if (typeof amount !== 'number' || amount <= 0) {
      res.status(400).json({ error: 'amount must be a positive number' }); return;
    }

    const charRes = await db.query(
      `SELECT id, name, level, experience_points, campaign_id, user_id FROM characters WHERE id = $1 AND user_id = $2`,
      [id, req.userId]
    );
    if (charRes.rows.length === 0) { res.status(404).json({ error: 'character not found' }); return; }

    const char = charRes.rows[0] as {
      id: number; name: string; level: number; experience_points: number; campaign_id: number; user_id: number;
    };

    const newXp = char.experience_points + amount;
    const newLevel = getLevelForXp(newXp);
    const leveledUp = newLevel > char.level;

    const updated = await db.query(
      `UPDATE characters SET experience_points = $1, level = $2 WHERE id = $3 RETURNING *`,
      [newXp, newLevel, id]
    );

    if (leveledUp) {
      // Broadcast level-up event
      io.to(`campaign:${char.campaign_id}`).emit('level-up', {
        characterId: id,
        userId: char.user_id,
        characterName: char.name,
        newLevel,
      });

      // Save system message in campaign chat
      const sysMsg = await db.query(
        `INSERT INTO messages (campaign_id, user_id, content, is_dm)
         VALUES ($1, NULL, $2, TRUE)
         RETURNING id, campaign_id, user_id, content, is_dm, created_at`,
        [char.campaign_id, `⬆️ ${char.name} has leveled up to level ${newLevel}! Update your character sheet.`]
      );
      io.to(`campaign:${char.campaign_id}`).emit('new-message', {
        ...sysMsg.rows[0],
        display_name: 'System',
      });
    }

    const xpForNext = getXpForNextLevel(newLevel);
    res.json({ character: updated.rows[0], leveledUp, xpForNext });
  });

  // ── GET /characters/:id/inventory ───────────────────────────────────────────
  router.get('/characters/:id/inventory', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
    const id = Number(req.params['id']);
    if (isNaN(id)) { res.status(400).json({ error: 'invalid character id' }); return; }

    const charRes = await db.query(`SELECT id FROM characters WHERE id = $1 AND user_id = $2`, [id, req.userId]);
    if (charRes.rows.length === 0) { res.status(404).json({ error: 'character not found' }); return; }

    const result = await db.query(
      `SELECT * FROM inventory_items WHERE character_id = $1 ORDER BY created_at ASC`,
      [id]
    );
    res.json({ items: result.rows });
  });

  // ── POST /characters/:id/inventory ──────────────────────────────────────────
  router.post('/characters/:id/inventory', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
    const id = Number(req.params['id']);
    if (isNaN(id)) { res.status(400).json({ error: 'invalid character id' }); return; }

    const charRes = await db.query(`SELECT id FROM characters WHERE id = $1 AND user_id = $2`, [id, req.userId]);
    if (charRes.rows.length === 0) { res.status(404).json({ error: 'character not found' }); return; }

    const { name, description = '', quantity = 1 } = req.body as { name?: string; description?: string; quantity?: number };
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ error: 'name is required' }); return;
    }

    const result = await db.query(
      `INSERT INTO inventory_items (character_id, name, description, quantity) VALUES ($1, $2, $3, $4) RETURNING *`,
      [id, name.trim(), description, quantity]
    );
    res.status(201).json({ item: result.rows[0] });
  });

  // ── PATCH /characters/:id/inventory/:itemId ──────────────────────────────────
  router.patch('/characters/:id/inventory/:itemId', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
    const id = Number(req.params['id']);
    const itemId = Number(req.params['itemId']);
    if (isNaN(id) || isNaN(itemId)) { res.status(400).json({ error: 'invalid id' }); return; }

    const charRes = await db.query(`SELECT id FROM characters WHERE id = $1 AND user_id = $2`, [id, req.userId]);
    if (charRes.rows.length === 0) { res.status(404).json({ error: 'character not found' }); return; }

    const { name, description, quantity } = req.body as { name?: string; description?: string; quantity?: number };
    const updates: string[] = [];
    const values: unknown[] = [];
    let idx = 1;
    if (name !== undefined) { updates.push(`name = $${idx++}`); values.push(name); }
    if (description !== undefined) { updates.push(`description = $${idx++}`); values.push(description); }
    if (quantity !== undefined) { updates.push(`quantity = $${idx++}`); values.push(quantity); }
    if (updates.length === 0) { res.status(400).json({ error: 'no fields to update' }); return; }

    values.push(itemId, id);
    const result = await db.query(
      `UPDATE inventory_items SET ${updates.join(', ')} WHERE id = $${idx} AND character_id = $${idx + 1} RETURNING *`,
      values
    );
    if (result.rows.length === 0) { res.status(404).json({ error: 'item not found' }); return; }
    res.json({ item: result.rows[0] });
  });

  // ── DELETE /characters/:id/inventory/:itemId ─────────────────────────────────
  router.delete('/characters/:id/inventory/:itemId', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
    const id = Number(req.params['id']);
    const itemId = Number(req.params['itemId']);
    if (isNaN(id) || isNaN(itemId)) { res.status(400).json({ error: 'invalid id' }); return; }

    const charRes = await db.query(`SELECT id FROM characters WHERE id = $1 AND user_id = $2`, [id, req.userId]);
    if (charRes.rows.length === 0) { res.status(404).json({ error: 'character not found' }); return; }

    await db.query(`DELETE FROM inventory_items WHERE id = $1 AND character_id = $2`, [itemId, id]);
    res.status(204).send();
  });

  return router;
}
