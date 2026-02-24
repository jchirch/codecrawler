import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { Pool } from 'pg';
import { createHealthRouter } from './routes/health';
import { createAuthRouter } from './routes/auth';
import { createCampaignsRouter } from './routes/campaigns';
import { createMessagesRouter } from './routes/messages';
import { runMigrations } from './db/migrate';

const app = express();
const PORT = process.env.PORT || 3000;

// ── Database ──────────────────────────────────────────────────────────────────
const db = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'appdb',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:4200',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);
app.use(express.json());

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/health', createHealthRouter(db));
app.use('/api/auth', createAuthRouter(db));
app.use('/api/campaigns', createCampaignsRouter(db));
app.use('/api/campaigns', createMessagesRouter(db));

// ── Start ─────────────────────────────────────────────────────────────────────
runMigrations(db)
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Backend listening on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Migration failed, aborting startup', err);
    process.exit(1);
  });

