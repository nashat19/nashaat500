import { db, audit } from '../db/index.js';
import { notFound } from '../lib/errors.js';
import { computePlan, scoreApplication, riskBand, DEFAULT_PROFIT_RATE } from '../lib/installment.js';
import { getProduct } from './products.js';

export const STAGES = ['new', 'contacted', 'docs', 'credit_check', 'approved', 'contract', 'delivered', 'rejected', 'lost'] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_LABELS: Record<Stage, string> = {
  new: 'جديد',
  contacted: 'تم التواصل',
  docs: 'بانتظار المستندات',
  credit_check: 'تدقيق ائتماني',
  approved: 'موافقة مبدئية',
  contract: 'توقيع العقد',
  delivered: 'تم التسليم',
  rejected: 'مرفوض',
  lost: 'مفقود',
};

export function profitRate(): number {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'profit_rate'").get() as { value: string } | undefined;
  const n = row ? Number(row.value) : NaN;
  return Number.isFinite(n) && n >= 0 && n <= 0.2 ? n : DEFAULT_PROFIT_RATE;
}

export interface ApplicationInput {
  fullName: string;
  phone: string;
  email: string;
  city: string;
  productId: number | null;
  productName: string;
  price: number;
  downPayment: number;
  months: number;
  job: string;
  salary: number;
  sourcePlatform: string;
  sourcePageId: number | null;
  conversationId: number | null;
  ownerId: number | null;
  notes: string;
}

export function createApplication(input: ApplicationInput, userId: number, ip: string): number {
  let price = input.price;
  let productName = input.productName;

  if (input.productId) {
    const product = getProduct(input.productId);
    price = product.price;
    productName = `${product.brand} ${product.name}`.trim();
  }

  const plan = computePlan(price, input.downPayment, input.months, profitRate());
  const score = scoreApplication({
    price: plan.price,
    downPayment: plan.downPayment,
    months: plan.months,
    monthly: plan.monthly,
    salary: input.salary,
    job: input.job,
    phone: input.phone,
    city: input.city,
    sourcePlatform: input.sourcePlatform,
  });

  const info = db
    .prepare(
      `INSERT INTO leads (full_name, phone, email, city, product_id, product_name, price, down_payment, months,
        monthly_amount, job, salary, source_platform, source_page_id, conversation_id, owner_id, notes, score)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    )
    .run(
      input.fullName, input.phone, input.email, input.city, input.productId, productName, plan.price,
      plan.downPayment, plan.months, plan.monthly, input.job, input.salary, input.sourcePlatform,
      input.sourcePageId, input.conversationId, input.ownerId, input.notes, score,
    );

  const id = Number(info.lastInsertRowid);
  db.prepare('INSERT INTO lead_events (lead_id, type, payload, user_id) VALUES (?,?,?,?)').run(
    id, 'created', JSON.stringify({ plan, score, risk: riskBand(score) }), userId,
  );
  audit(userId, 'lead.create', 'lead', id, { score, productId: input.productId }, ip);
  return id;
}

export function getLead(id: number) {
  const lead = db
    .prepare(
      `SELECT l.*, u.name AS owner_name, p.name AS page_name, pr.image_url AS product_image, pr.specs AS product_specs
       FROM leads l LEFT JOIN users u ON u.id = l.owner_id LEFT JOIN pages p ON p.id = l.source_page_id
       LEFT JOIN products pr ON pr.id = l.product_id WHERE l.id = ?`,
    )
    .get(id) as Record<string, unknown> | undefined;
  if (!lead) throw notFound('الطلب غير موجود');

  const events = db
    .prepare('SELECT e.*, u.name AS user_name FROM lead_events e LEFT JOIN users u ON u.id = e.user_id WHERE e.lead_id = ? ORDER BY e.created_at DESC')
    .all(id);

  return { ...lead, risk: riskBand(Number(lead.score)), events };
}

export function updateLead(
  id: number,
  patch: Partial<Pick<ApplicationInput, 'phone' | 'email' | 'city' | 'notes' | 'salary' | 'job'>> & {
    stage?: Stage;
    ownerId?: number | null;
    downPayment?: number;
    months?: number;
  },
  userId: number,
  ip: string,
): void {
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!lead) throw notFound('الطلب غير موجود');

  const price = Number(lead.price);
  const downPayment = patch.downPayment ?? Number(lead.down_payment);
  const months = patch.months ?? Number(lead.months);
  const salary = patch.salary ?? Number(lead.salary);
  const job = patch.job ?? String(lead.job);
  const phone = patch.phone ?? String(lead.phone);
  const city = patch.city ?? String(lead.city);

  const plan = computePlan(price, downPayment, months, profitRate());
  const score = scoreApplication({
    price, downPayment, months, monthly: plan.monthly, salary, job, phone, city,
    sourcePlatform: String(lead.source_platform),
  });

  db.prepare(
    `UPDATE leads SET stage = ?, owner_id = ?, notes = ?, phone = ?, email = ?, city = ?, salary = ?, job = ?,
      down_payment = ?, months = ?, monthly_amount = ?, score = ?, updated_at = datetime('now') WHERE id = ?`,
  ).run(
    patch.stage ?? String(lead.stage),
    patch.ownerId === undefined ? (lead.owner_id as number | null) : patch.ownerId,
    patch.notes ?? String(lead.notes),
    phone,
    patch.email ?? String(lead.email),
    city,
    salary,
    job,
    plan.downPayment,
    plan.months,
    plan.monthly,
    score,
    id,
  );

  if (patch.stage && patch.stage !== lead.stage) {
    db.prepare('INSERT INTO lead_events (lead_id, type, payload, user_id) VALUES (?,?,?,?)').run(
      id, 'stage_change', JSON.stringify({ from: lead.stage, to: patch.stage }), userId,
    );
  }
  audit(userId, 'lead.update', 'lead', id, { stage: patch.stage }, ip);
}

export function listLeads(filters: { stage?: string; ownerId?: number; q?: string; minScore?: number; limit: number; offset: number }) {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filters.stage) { where.push('l.stage = ?'); params.push(filters.stage); }
  if (filters.ownerId) { where.push('l.owner_id = ?'); params.push(filters.ownerId); }
  if (filters.minScore) { where.push('l.score >= ?'); params.push(filters.minScore); }
  if (filters.q) {
    where.push('(l.full_name LIKE ? OR l.phone LIKE ? OR l.city LIKE ? OR l.product_name LIKE ?)');
    const like = `%${filters.q}%`;
    params.push(like, like, like, like);
  }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const rows = db
    .prepare(
      `SELECT l.*, u.name AS owner_name, p.name AS page_name, pr.image_url AS product_image
       FROM leads l LEFT JOIN users u ON u.id = l.owner_id LEFT JOIN pages p ON p.id = l.source_page_id
       LEFT JOIN products pr ON pr.id = l.product_id
       ${clause} ORDER BY l.score DESC, l.updated_at DESC LIMIT ? OFFSET ?`,
    )
    .all(...params, filters.limit, filters.offset) as Record<string, unknown>[];

  const total = (db.prepare(`SELECT COUNT(*) AS c FROM leads l ${clause}`).get(...params) as { c: number }).c;
  return { rows: rows.map((r) => ({ ...r, risk: riskBand(Number(r.score)) })), total };
}

export function pipeline() {
  const rows = db
    .prepare('SELECT stage, COUNT(*) AS count, COALESCE(SUM(price),0) AS volume, COALESCE(AVG(score),0) AS avg_score FROM leads GROUP BY stage')
    .all() as { stage: string; count: number; volume: number; avg_score: number }[];

  return STAGES.map((stage) => {
    const found = rows.find((r) => r.stage === stage);
    return {
      stage,
      label: STAGE_LABELS[stage],
      count: found?.count ?? 0,
      volume: found?.volume ?? 0,
      avgScore: Math.round(found?.avg_score ?? 0),
    };
  });
}

export function quote(productId: number, downPayment: number, months: number) {
  const product = getProduct(productId);
  const plan = computePlan(product.price, downPayment, months, profitRate());
  return { product: { id: product.id, name: product.name, brand: product.brand, price: product.price }, plan };
}
