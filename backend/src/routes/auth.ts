import { Router, Request, Response } from 'express';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { requireAuth, AuthRequest } from '../middleware/auth';

function makeToken(userId: number): string {
  const secret = process.env.JWT_SECRET || 'changeme-dev-secret';
  return jwt.sign({ sub: userId }, secret, { expiresIn: '7d' });
}

export function createAuthRouter(db: Pool): Router {
  const router = Router();

  // POST /api/auth/register
  router.post('/register', async (req: Request, res: Response): Promise<void> => {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'email and password are required' });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: 'password must be at least 8 characters' });
      return;
    }

    try {
      const password_hash = await bcrypt.hash(password, 12);
      const result = await db.query(
        'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, created_at',
        [email.toLowerCase(), password_hash],
      );
      const user = result.rows[0];
      const token = makeToken(user.id);
      res.status(201).json({ token, user: { id: user.id, email: user.email, created_at: user.created_at } });
    } catch (err: any) {
      if (err.code === '23505') {
        res.status(409).json({ error: 'email already registered' });
      } else {
        console.error('register error', err);
        res.status(500).json({ error: 'internal server error' });
      }
    }
  });

  // POST /api/auth/login
  router.post('/login', async (req: Request, res: Response): Promise<void> => {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'email and password are required' });
      return;
    }

    try {
      const result = await db.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
      const user = result.rows[0];
      if (!user) {
        res.status(401).json({ error: 'invalid credentials' });
        return;
      }

      const match = await bcrypt.compare(password, user.password_hash);
      if (!match) {
        res.status(401).json({ error: 'invalid credentials' });
        return;
      }

      const token = makeToken(user.id);
      res.json({ token, user: { id: user.id, email: user.email, created_at: user.created_at } });
    } catch (err) {
      console.error('login error', err);
      res.status(500).json({ error: 'internal server error' });
    }
  });

  // GET /api/auth/me
  router.get('/me', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const result = await db.query(
        'SELECT id, email, created_at FROM users WHERE id = $1',
        [req.userId],
      );
      const user = result.rows[0];
      if (!user) {
        res.status(404).json({ error: 'user not found' });
        return;
      }
      res.json({ user });
    } catch (err) {
      console.error('me error', err);
      res.status(500).json({ error: 'internal server error' });
    }
  });

  return router;
}

