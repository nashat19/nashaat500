import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { config, isProd } from './config.js';
import { migrate } from './db/index.js';
import { log } from './lib/logger.js';
import { requireAuth } from './middleware/auth.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { startScheduler } from './services/scheduler.js';

import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import pageRoutes from './routes/pages.js';
import productRoutes from './routes/products.js';
import postRoutes from './routes/posts.js';
import mediaRoutes from './routes/media.js';
import inboxRoutes from './routes/inbox.js';
import leadRoutes from './routes/leads.js';
import analyticsRoutes from './routes/analytics.js';
import templateRoutes from './routes/templates.js';
import settingsRoutes from './routes/settings.js';
import webhookRoutes from './routes/webhooks.js';
import eventRoutes from './routes/events.js';

migrate();

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(
  cors({
    origin: isProd ? config.webBase : true,
    credentials: true,
  }),
);

app.use(
  express.json({
    limit: '2mb',
    verify: (req, _res, buf) => {
      (req as express.Request & { rawBody?: string }).rawBody = buf.toString('utf8');
    },
  }),
);
app.use(cookieParser());

app.use('/uploads', express.static(config.uploadDir, { maxAge: '7d', index: false }));
app.use('/api/webhooks', webhookRoutes);

app.use('/api', apiLimiter);
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, env: config.env, time: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api', requireAuth);
app.use('/api/users', userRoutes);
app.use('/api/pages', pageRoutes);
app.use('/api/products', productRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/inbox', inboxRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/events', eventRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

const server = app.listen(config.port, () => {
  log.info(`API يعمل على http://localhost:${config.port}`);
  log.info(`الوضع: ${config.env} | محاكاة النشر: ${config.simulate ? 'مفعّلة' : 'معطّلة'}`);
});

const scheduler = startScheduler();

function shutdown(signal: string): void {
  log.info(`إيقاف (${signal})`);
  clearInterval(scheduler);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 8000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
