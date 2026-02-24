import { Router, Request, Response } from 'express';
import { Pool } from 'pg';

const router = Router();

export function createHealthRouter(db: Pool): Router {
  router.get('/', async (_req: Request, res: Response) => {
    let dbStatus = 'disconnected';
    try {
      await db.query('SELECT 1');
      dbStatus = 'connected';
    } catch {
      dbStatus = 'error';
    }

    res.json({
      status: 'ok',
      db: dbStatus,
      timestamp: new Date().toISOString(),
    });
  });

  return router;
}

