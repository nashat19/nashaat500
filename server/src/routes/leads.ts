import { Router } from 'express';
import { id, num, oneOf, str } from '../lib/validate.js';
import { isAgent } from '../middleware/rbac.js';
import { STAGES, createApplication, getLead, listLeads, pipeline, updateLead } from '../services/leads.js';

const router = Router();
const JOBS = ['government', 'private', 'self', 'retired', 'student', 'none'] as const;

router.get('/', (req, res, next) => {
  try {
    const result = listLeads({
      stage: req.query.stage ? String(req.query.stage) : undefined,
      ownerId: req.query.ownerId ? Number(req.query.ownerId) : undefined,
      q: req.query.q ? String(req.query.q) : undefined,
      minScore: req.query.minScore ? Number(req.query.minScore) : undefined,
      limit: Math.min(Number(req.query.limit ?? 50), 200),
      offset: Number(req.query.offset ?? 0),
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/pipeline', (_req, res) => {
  res.json({ stages: pipeline() });
});

router.get('/:id', (req, res, next) => {
  try {
    res.json({ lead: getLead(id(req.params.id)) });
  } catch (err) {
    next(err);
  }
});

router.post('/', isAgent, (req, res, next) => {
  try {
    const leadId = createApplication(
      {
        fullName: str(req.body?.fullName, 'fullName', { min: 2, max: 120 }),
        phone: str(req.body?.phone ?? '', 'phone', { max: 30, optional: true }),
        email: str(req.body?.email ?? '', 'email', { max: 190, optional: true }),
        city: str(req.body?.city ?? '', 'city', { max: 80, optional: true }),
        productId: req.body?.productId ? num(req.body.productId, 'productId', { min: 1 }) : null,
        productName: str(req.body?.productName ?? '', 'productName', { max: 160, optional: true }),
        price: num(req.body?.price ?? 0, 'price', { min: 0, optional: true }),
        downPayment: num(req.body?.downPayment ?? 0, 'downPayment', { min: 0, optional: true }),
        months: num(req.body?.months ?? 12, 'months', { min: 3, max: 48 }),
        job: oneOf(req.body?.job ?? 'private', 'job', JOBS),
        salary: num(req.body?.salary ?? 0, 'salary', { min: 0, optional: true }),
        sourcePlatform: str(req.body?.sourcePlatform ?? 'manual', 'sourcePlatform', { max: 30, optional: true }),
        sourcePageId: req.body?.sourcePageId ? num(req.body.sourcePageId, 'sourcePageId', { min: 1 }) : null,
        conversationId: req.body?.conversationId ? num(req.body.conversationId, 'conversationId', { min: 1 }) : null,
        ownerId: req.body?.ownerId ? num(req.body.ownerId, 'ownerId', { min: 1 }) : null,
        notes: str(req.body?.notes ?? '', 'notes', { max: 2000, optional: true }),
      },
      req.user!.sub,
      req.ip ?? '',
    );
    res.status(201).json({ lead: getLead(leadId) });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', isAgent, (req, res, next) => {
  try {
    updateLead(
      id(req.params.id),
      {
        stage: req.body?.stage ? oneOf(req.body.stage, 'stage', STAGES) : undefined,
        ownerId: req.body?.ownerId !== undefined ? (req.body.ownerId ? Number(req.body.ownerId) : null) : undefined,
        notes: req.body?.notes !== undefined ? str(req.body.notes, 'notes', { max: 2000, optional: true }) : undefined,
        phone: req.body?.phone !== undefined ? str(req.body.phone, 'phone', { max: 30, optional: true }) : undefined,
        email: req.body?.email !== undefined ? str(req.body.email, 'email', { max: 190, optional: true }) : undefined,
        city: req.body?.city !== undefined ? str(req.body.city, 'city', { max: 80, optional: true }) : undefined,
        salary: req.body?.salary !== undefined ? num(req.body.salary, 'salary', { min: 0 }) : undefined,
        job: req.body?.job ? oneOf(req.body.job, 'job', JOBS) : undefined,
        downPayment: req.body?.downPayment !== undefined ? num(req.body.downPayment, 'downPayment', { min: 0 }) : undefined,
        months: req.body?.months !== undefined ? num(req.body.months, 'months', { min: 3, max: 48 }) : undefined,
      },
      req.user!.sub,
      req.ip ?? '',
    );
    res.json({ lead: getLead(id(req.params.id)) });
  } catch (err) {
    next(err);
  }
});

export default router;
