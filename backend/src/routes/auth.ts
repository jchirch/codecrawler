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
        'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, username, created_at',
        [email.toLowerCase(), password_hash],
      );
      const user = result.rows[0];
      const token = makeToken(user.id);
      res.status(201).json({ token, user: { id: user.id, email: user.email, username: user.username, created_at: user.created_at } });
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
      res.json({ token, user: { id: user.id, email: user.email, username: user.username, created_at: user.created_at } });
    } catch (err) {
      console.error('login error', err);
      res.status(500).json({ error: 'internal server error' });
    }
  });

  // GET /api/auth/me
  router.get('/me', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
    try {
      const result = await db.query(
        'SELECT id, email, username, created_at FROM users WHERE id = $1',
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

  // PATCH /api/auth/me — update username
  router.patch('/me', requireAuth, async (req: AuthRequest, res: Response): Promise<void> => {
    const { username } = req.body as { username?: string };
    if (!username || typeof username !== 'string') {
      res.status(400).json({ error: 'username is required' });
      return;
    }
    const trimmed = username.trim();
    if (trimmed.length < 3 || trimmed.length > 20) {
      res.status(400).json({ error: 'username must be 3–20 characters' });
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
      res.status(400).json({ error: 'username may only contain letters, numbers, and underscores' });
      return;
    }

    try {
      const result = await db.query(
        'UPDATE users SET username = $1 WHERE id = $2 RETURNING id, email, username, created_at',
        [trimmed, req.userId],
      );
      res.json({ user: result.rows[0] });
    } catch (err: any) {
      if (err.code === '23505') {
        res.status(409).json({ error: 'username already taken' });
      } else {
        console.error('update username error', err);
        res.status(500).json({ error: 'internal server error' });
      }
    }
  });

  return router;
}

