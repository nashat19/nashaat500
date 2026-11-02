import { Router } from 'express';
import { id, idList, num, oneOf, str } from '../lib/validate.js';
import { isManager } from '../middleware/rbac.js';
import { CATEGORIES, createProduct, deleteProduct, getProduct, listProducts, updateProduct } from '../services/products.js';
import { computePlan, profitRate } from '../lib/installment.js';
import { quote } from '../services/leads.js';

const router = Router();

router.get('/', (req, res, next) => {
  try {
    const result = listProducts({
      category: req.query.category ? String(req.query.category) : undefined,
      q: req.query.q ? String(req.query.q) : undefined,
      activeOnly: req.query.all !== '1',
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
    const product = getProduct(id(req.params.id));
    const rate = profitRate();
    const plans = [6, 12, 18, 24].map((months) => {
      const down = Math.round(product.price * 0.2);
      return { months, ...computePlan(product.price, down, months, rate) };
    });
    res.json({ product, plans });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/quote', (req, res, next) => {
  try {
    res.json(quote(id(req.params.id), num(req.query.down ?? 0, 'down', { min: 0 }), num(req.query.months ?? 12, 'months', { min: 3, max: 48 })));
  } catch (err) {
    next(err);
  }
});

router.post('/', isManager, (req, res, next) => {
  try {
    const product = createProduct({
      name: str(req.body?.name, 'name', { min: 2, max: 160 }),
      brand: str(req.body?.brand ?? '', 'brand', { max: 80, optional: true }),
      category: oneOf(req.body?.category ?? 'phone', 'category', CATEGORIES),
      price: num(req.body?.price, 'price', { min: 1 }),
      specs: str(req.body?.specs ?? '', 'specs', { max: 2000, optional: true }),
      image_url: str(req.body?.imageUrl ?? '', 'imageUrl', { max: 500, optional: true }),
      stock: num(req.body?.stock ?? 0, 'stock', { min: 0, optional: true }),
      userId: req.user!.sub,
      ip: req.ip ?? '',
    });
    res.status(201).json({ product });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', isManager, (req, res, next) => {
  try {
    const product = updateProduct(
      id(req.params.id),
      {
        name: req.body?.name ? str(req.body.name, 'name', { min: 2, max: 160 }) : undefined,
        brand: req.body?.brand !== undefined ? str(req.body.brand, 'brand', { max: 80, optional: true }) : undefined,
        category: req.body?.category ? oneOf(req.body.category, 'category', CATEGORIES) : undefined,
        price: req.body?.price !== undefined ? num(req.body.price, 'price', { min: 1 }) : undefined,
        specs: req.body?.specs !== undefined ? str(req.body.specs, 'specs', { max: 2000, optional: true }) : undefined,
        image_url: req.body?.imageUrl !== undefined ? str(req.body.imageUrl, 'imageUrl', { max: 500, optional: true }) : undefined,
        stock: req.body?.stock !== undefined ? num(req.body.stock, 'stock', { min: 0 }) : undefined,
        active: req.body?.active !== undefined ? (req.body.active ? 1 : 0) : undefined,
      },
      req.user!.sub,
      req.ip ?? '',
    );
    res.json({ product });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', isManager, (req, res, next) => {
  try {
    deleteProduct(id(req.params.id), req.user!.sub, req.ip ?? '');
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
