import { Router } from 'express';
import { bestHours, overview } from '../services/analytics.js';

const router = Router();

router.get('/overview', (req, res, next) => {
  try {
    const days = Math.min(Math.max(Number(req.query.days ?? 30), 1), 365);
    res.json(overview(days));
  } catch (err) {
    next(err);
  }
});

router.get('/best-hours', (_req, res) => {
  res.json({ hours: bestHours() });
});

export default router;
