import { Router, Request, Response } from 'express';
import {
  getClasses, getClassDetail, getRaces, getRaceDetail, getSpellsForClass
} from '../services/dnd5e-api';

export function createDnd5eRouter(): Router {
  const router = Router();

  // GET /api/dnd5e/classes
  router.get('/classes', async (_req: Request, res: Response): Promise<void> => {
    try {
      const data = await getClasses();
      res.json(data);
    } catch (err) {
      console.error('[dnd5e] classes error', err);
      res.status(502).json({ error: 'Failed to fetch classes from DnD 5e API' });
    }
  });

  // GET /api/dnd5e/classes/:index
  router.get('/classes/:index', async (req: Request, res: Response): Promise<void> => {
    try {
      const data = await getClassDetail(req.params['index']!);
      res.json(data);
    } catch (err) {
      console.error('[dnd5e] class detail error', err);
      res.status(502).json({ error: 'Failed to fetch class detail from DnD 5e API' });
    }
  });

  // GET /api/dnd5e/races
  router.get('/races', async (_req: Request, res: Response): Promise<void> => {
    try {
      const data = await getRaces();
      res.json(data);
    } catch (err) {
      console.error('[dnd5e] races error', err);
      res.status(502).json({ error: 'Failed to fetch races from DnD 5e API' });
    }
  });

  // GET /api/dnd5e/races/:index
  router.get('/races/:index', async (req: Request, res: Response): Promise<void> => {
    try {
      const data = await getRaceDetail(req.params['index']!);
      res.json(data);
    } catch (err) {
      console.error('[dnd5e] race detail error', err);
      res.status(502).json({ error: 'Failed to fetch race detail from DnD 5e API' });
    }
  });

  // GET /api/dnd5e/spells?class=wizard&level=1
  router.get('/spells', async (req: Request, res: Response): Promise<void> => {
    const classIndex = req.query['class'] as string | undefined;
    const levelParam = req.query['level'] as string | undefined;

    if (!classIndex) {
      res.status(400).json({ error: 'class query param is required' });
      return;
    }

    try {
      let spells = await getSpellsForClass(classIndex);
      if (levelParam !== undefined) {
        const level = parseInt(levelParam, 10);
        if (!isNaN(level)) {
          spells = spells.filter(s => s.level === level);
        }
      }
      res.json({ results: spells, count: spells.length });
    } catch (err) {
      console.error('[dnd5e] spells error', err);
      res.status(502).json({ error: 'Failed to fetch spells from DnD 5e API' });
    }
  });

  return router;
}
