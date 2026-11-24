import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import { testConnection } from './config/database';
import { errorHandler } from './middleware/errorHandler';
import routes from './routes/index';
import { runScheduler } from './algorithms/scheduler';
import { getSchedulerSettings } from './config/settings';
import { initSemaphores } from './utils/semaphore';
import { runDeadlockDetection } from './utils/deadlock';

const app = express();

// ── Security middleware ──────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: env.CORS_ORIGIN,
  credentials: true,
}));
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
}));

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '1mb' }));

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// ── API routes ────────────────────────────────────────────────────────────────
app.use('/api', routes);

// ── Error handler (must be last) ─────────────────────────────────────────────
app.use(errorHandler);

// ── Start ─────────────────────────────────────────────────────────────────────
async function start() {
  await testConnection();
  await initSemaphores();
  const { algorithm, interval_seconds } = await getSchedulerSettings();
  setInterval(() => {
    runScheduler(algorithm as any, 'system')
      .catch(console.error);
  }, interval_seconds * 1000);
  // Periodic deadlock detection and recovery (every 60s)
  setInterval(() => { runDeadlockDetection(true).catch(console.error); }, 60 * 1000);
  app.listen(env.PORT, () => {
    console.log(`🚀 SmartAlloc API running on http://localhost:${env.PORT}`);
    console.log(`   Environment: ${env.NODE_ENV}`);
  });
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
