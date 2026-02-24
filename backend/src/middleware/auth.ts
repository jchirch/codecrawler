import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  userId?: number;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }

  const token = header.slice(7);
  const secret = process.env.JWT_SECRET || 'changeme-dev-secret';

  try {
    const payload = jwt.verify(token, secret) as jwt.JwtPayload;
    req.userId = Number(payload['sub']);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

