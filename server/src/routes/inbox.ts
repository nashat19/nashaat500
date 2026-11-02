import { Router } from 'express';
import { id, num, oneOf, str } from '../lib/validate.js';
import { isAgent } from '../middleware/rbac.js';
import { assign, getConversation, listConversations, reply, setStatus } from '../services/inbox.js';

const router = Router();

router.get('/', (req, res, next) => {
  try {
    const rows = listConversations({
      status: req.query.status ? String(req.query.status) : undefined,
      assigneeId: req.query.assigneeId ? Number(req.query.assigneeId) : undefined,
      pageId: req.query.pageId ? Number(req.query.pageId) : undefined,
      limit: Math.min(Number(req.query.limit ?? 50), 200),
      offset: Number(req.query.offset ?? 0),
    });
    res.json({ rows });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', (req, res, next) => {
  try {
    res.json({ conversation: getConversation(id(req.params.id)) });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/reply', isAgent, (req, res, next) => {
  try {
    reply(id(req.params.id), str(req.body?.body, 'body', { min: 1, max: 4000 }), req.user!.sub);
    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/assign', isAgent, (req, res, next) => {
  try {
    assign(id(req.params.id), req.body?.userId ? num(req.body.userId, 'userId', { min: 1 }) : null);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/status', isAgent, (req, res, next) => {
  try {
    setStatus(id(req.params.id), oneOf(req.body?.status, 'status', ['open', 'pending', 'closed'] as const));
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
