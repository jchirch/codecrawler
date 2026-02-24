import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth';

const VALID_SIDES = [4, 6, 8, 10, 12, 20, 100];

export function createDiceRouter(): Router {
  const router = Router();

  // POST /api/dice/roll
  router.post('/roll', requireAuth, (req: AuthRequest, res: Response): void => {
    const { count = 1, sides, modifier = 0 } = req.body as {
      count?: number;
      sides: number;
      modifier?: number;
    };

    if (!VALID_SIDES.includes(Number(sides))) {
      res.status(400).json({ error: `sides must be one of: ${VALID_SIDES.join(', ')}` });
      return;
    }

    const c = Math.max(1, Math.min(20, Math.floor(Number(count))));
    const s = Number(sides);
    const m = Math.max(-100, Math.min(100, Math.floor(Number(modifier))));

    const rolls: number[] = Array.from({ length: c }, () =>
      Math.floor(Math.random() * s) + 1,
    );
    const subtotal = rolls.reduce((a, b) => a + b, 0);
    const total = subtotal + m;

    const modStr = m > 0 ? `+${m}` : m < 0 ? `${m}` : '';
    const notation = `${c}d${s}${modStr}`;
    const rollsStr = rolls.length === 1 ? `${rolls[0]}` : `[${rolls.join(', ')}]`;
    const formatted = `🎲 ${notation}: ${rollsStr}${m !== 0 ? ` (${m > 0 ? '+' : ''}${m})` : ''} → **${total}**`;

    res.json({ rolls, total, notation, formatted });
  });

  return router;
}

