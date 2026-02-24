import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import { createHealthRouter } from './routes/health';
import { createAuthRouter } from './routes/auth';
import { createCampaignsRouter } from './routes/campaigns';
import { createMessagesRouter } from './routes/messages';
import { runMigrations } from './db/migrate';

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'change_me_in_production';
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost';

// ── Database ──────────────────────────────────────────────────────────────────
const db = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'appdb',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

// ── Socket.io ─────────────────────────────────────────────────────────────────
const io = new Server(httpServer, {
  cors: {
    origin: CORS_ORIGIN,
    methods: ['GET', 'POST'],
  },
});

// JWT authentication middleware for socket connections
io.use((socket, next) => {
  const token = socket.handshake.auth['token'] as string | undefined;
  if (!token) {
    return next(new Error('Authentication required'));
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { sub: string };
    socket.data['userId'] = Number(payload.sub);
    next();
  } catch {
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  const userId = socket.data['userId'] as number;

  socket.on('join-campaign', async (campaignId: number) => {
    // Verify the user is a member before admitting them to the room
    const result = await db.query(
      `SELECT 1 FROM campaign_members WHERE campaign_id = $1 AND user_id = $2`,
      [campaignId, userId],
    );
    if (result.rows.length === 0) {
      socket.emit('error', 'Not a member of this campaign');
      return;
    }
    await socket.join(`campaign:${campaignId}`);
  });

  socket.on('leave-campaign', (campaignId: number) => {
    socket.leave(`campaign:${campaignId}`);
  });
});

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: CORS_ORIGIN,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);
app.use(express.json());

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/health', createHealthRouter(db));
app.use('/api/auth', createAuthRouter(db));
app.use('/api/campaigns', createCampaignsRouter(db));
app.use('/api/campaigns', createMessagesRouter(db, io));

// ── Start ─────────────────────────────────────────────────────────────────────
runMigrations(db)
  .then(() => {
    httpServer.listen(PORT, () => {
      console.log(`Backend listening on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Migration failed, aborting startup', err);
    process.exit(1);
  });

