import { db, audit } from '../db/index.js';
import { notFound } from '../lib/errors.js';

export const CATEGORIES = ['phone', 'laptop', 'tablet', 'tv', 'appliance', 'console', 'accessory', 'other'] as const;

export interface ProductRow {
  id: number;
  name: string;
  brand: string;
  category: string;
  price: number;
  specs: string;
  image_url: string;
  stock: number;
  active: number;
  created_at: string;
}

export function getProduct(id: number): ProductRow {
  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(id) as ProductRow | undefined;
  if (!row) throw notFound('الجهاز غير موجود');
  return row;
}

export function listProducts(filters: { category?: string; q?: string; activeOnly: boolean; limit: number; offset: number }) {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filters.activeOnly) where.push('active = 1');
  if (filters.category) { where.push('category = ?'); params.push(filters.category); }
  if (filters.q) {
    where.push('(name LIKE ? OR brand LIKE ? OR specs LIKE ?)');
    const like = `%${filters.q}%`;
    params.push(like, like, like);
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const rows = db.prepare(`SELECT * FROM products ${clause} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, filters.limit, filters.offset);
  const total = (db.prepare(`SELECT COUNT(*) AS c FROM products ${clause}`).get(...params) as { c: number }).c;
  return { rows, total };
}

export function createProduct(input: Omit<ProductRow, 'id' | 'created_at' | 'active'> & { userId: number; ip: string }): ProductRow {
  const info = db
    .prepare('INSERT INTO products (name, brand, category, price, specs, image_url, stock) VALUES (?,?,?,?,?,?,?)')
    .run(input.name, input.brand, input.category, input.price, input.specs, input.image_url, input.stock);
  const id = Number(info.lastInsertRowid);
  audit(input.userId, 'product.create', 'product', id, { name: input.name }, input.ip);
  return getProduct(id);
}

export function updateProduct(
  id: number,
  patch: Partial<Pick<ProductRow, 'name' | 'brand' | 'category' | 'price' | 'specs' | 'image_url' | 'stock' | 'active'>>,
  userId: number,
  ip: string,
): ProductRow {
  const p = getProduct(id);
  db.prepare('UPDATE products SET name = ?, brand = ?, category = ?, price = ?, specs = ?, image_url = ?, stock = ?, active = ? WHERE id = ?').run(
    patch.name ?? p.name,
    patch.brand ?? p.brand,
    patch.category ?? p.category,
    patch.price ?? p.price,
    patch.specs ?? p.specs,
    patch.image_url ?? p.image_url,
    patch.stock ?? p.stock,
    patch.active ?? p.active,
    id,
  );
  audit(userId, 'product.update', 'product', id, {}, ip);
  return getProduct(id);
}

export function deleteProduct(id: number, userId: number, ip: string): void {
  getProduct(id);
  db.prepare('DELETE FROM products WHERE id = ?').run(id);
  audit(userId, 'product.delete', 'product', id, {}, ip);
}
