import { Router } from 'express';
import { id, num, oneOf, str } from '../lib/validate.js';
import { isManager } from '../middleware/rbac.js';
import { PLATFORMS, createPage, deletePage, getPage, listPages, updatePage } from '../services/pages.js';

const router = Router();

router.get('/', (_req, res) => {
  res.json({ rows: listPages() });
});

router.get('/:id', (req, res, next) => {
  try {
    res.json({ page: getPage(id(req.params.id)) });
  } catch (err) {
    next(err);
  }
});

router.post('/', isManager, (req, res, next) => {
  try {
    const page = createPage({
      platform: oneOf(req.body?.platform, 'platform', PLATFORMS),
      name: str(req.body?.name, 'name', { min: 2, max: 120 }),
      handle: str(req.body?.handle ?? '', 'handle', { max: 120, optional: true }),
      externalId: str(req.body?.externalId ?? '', 'externalId', { max: 120, optional: true }),
      accessToken: str(req.body?.accessToken ?? '', 'accessToken', { max: 2000, optional: true }),
      avatarUrl: str(req.body?.avatarUrl ?? '', 'avatarUrl', { max: 500, optional: true }),
      followers: num(req.body?.followers ?? 0, 'followers', { min: 0, optional: true }),
      userId: req.user!.sub,
      ip: req.ip ?? '',
    });
    res.status(201).json({ page });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', isManager, (req, res, next) => {
  try {
    const page = updatePage(
      id(req.params.id),
      {
        name: req.body?.name ? str(req.body.name, 'name', { min: 2, max: 120 }) : undefined,
        handle: req.body?.handle !== undefined ? str(req.body.handle, 'handle', { max: 120, optional: true }) : undefined,
        status: req.body?.status ? oneOf(req.body.status, 'status', ['connected', 'needs_reauth', 'disabled'] as const) : undefined,
        followers: req.body?.followers !== undefined ? num(req.body.followers, 'followers', { min: 0 }) : undefined,
        avatar_url: req.body?.avatarUrl !== undefined ? str(req.body.avatarUrl, 'avatarUrl', { max: 500, optional: true }) : undefined,
        accessToken: req.body?.accessToken ? str(req.body.accessToken, 'accessToken', { max: 2000 }) : undefined,
      },
      req.user!.sub,
      req.ip ?? '',
    );
    res.json({ page });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', isManager, (req, res, next) => {
  try {
    deletePage(id(req.params.id), req.user!.sub, req.ip ?? '');
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
