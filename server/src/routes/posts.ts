import { Router } from 'express';
import { id, idList, num, oneOf, str } from '../lib/validate.js';
import { isAgent, isManager } from '../middleware/rbac.js';
import { POST_STATUSES, createPost, deletePost, getPost, listPosts, targetsOf, transition } from '../services/posts.js';

const router = Router();

router.get('/', (req, res, next) => {
  try {
    const result = listPosts({
      status: req.query.status ? String(req.query.status) : undefined,
      pageId: req.query.pageId ? Number(req.query.pageId) : undefined,
      from: req.query.from ? String(req.query.from) : undefined,
      to: req.query.to ? String(req.query.to) : undefined,
      limit: Math.min(Number(req.query.limit ?? 50), 200),
      offset: Number(req.query.offset ?? 0),
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', (req, res, next) => {
  try {
    const post = getPost(id(req.params.id));
    res.json({ post: { ...post, targets: targetsOf(post.id) } });
  } catch (err) {
    next(err);
  }
});

router.post('/', isAgent, (req, res, next) => {
  try {
    const post = createPost({
      title: str(req.body?.title ?? '', 'title', { max: 200, optional: true }),
      body: str(req.body?.body, 'body', { min: 1, max: 8000 }),
      media: Array.isArray(req.body?.media) ? req.body.media.map((m: unknown) => String(m)) : [],
      productId: req.body?.productId ? num(req.body.productId, 'productId', { min: 1 }) : null,
      pageIds: idList(req.body?.pageIds, 'pageIds'),
      scheduledAt: req.body?.scheduledAt ? str(req.body.scheduledAt, 'scheduledAt', { max: 40 }) : null,
      status: oneOf(req.body?.status ?? 'draft', 'status', POST_STATUSES),
      userId: req.user!.sub,
      ip: req.ip ?? '',
    });
    res.status(201).json({ post });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', isAgent, (req, res, next) => {
  try {
    const post = updatePost(
      id(req.params.id),
      {
        title: req.body?.title !== undefined ? str(req.body.title, 'title', { max: 200, optional: true }) : undefined,
        body: req.body?.body !== undefined ? str(req.body.body, 'body', { min: 1, max: 8000 }) : undefined,
        media: Array.isArray(req.body?.media) ? req.body.media.map((m: unknown) => String(m)) : undefined,
        productId: req.body?.productId !== undefined ? (req.body.productId ? Number(req.body.productId) : null) : undefined,
        scheduledAt: req.body?.scheduledAt !== undefined ? (req.body.scheduledAt ? String(req.body.scheduledAt) : null) : undefined,
        pageIds: req.body?.pageIds ? idList(req.body.pageIds, 'pageIds') : undefined,
      },
      req.user!.sub,
      req.ip ?? '',
    );
    res.json({ post });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/:action', isAgent, (req, res, next) => {
  try {
    const action = oneOf(req.params.action, 'action', ['submit', 'approve', 'reject', 'schedule', 'cancel'] as const);
    if (['approve', 'reject'].includes(action) && !['admin', 'manager'].includes(req.user!.role)) {
      res.status(403).json({ error: 'الموافقة تتطلب دور مشرف', code: 'forbidden' });
      return;
    }
    const post = transition(
      id(req.params.id),
      action,
      req.user!.sub,
      req.ip ?? '',
      req.body?.scheduledAt ? String(req.body.scheduledAt) : null,
    );
    res.json({ post });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', isManager, (req, res, next) => {
  try {
    deletePost(id(req.params.id), req.user!.sub, req.ip ?? '');
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
