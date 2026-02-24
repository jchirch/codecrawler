import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { Pool } from 'pg';
import { createHealthRouter } from './routes/health';

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

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`);
});

