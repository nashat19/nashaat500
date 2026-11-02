import { db, migrate } from './index.js';
import { hashPassword } from '../lib/crypto.js';
import { computePlan, scoreApplication, DEFAULT_PROFIT_RATE } from '../lib/installment.js';
import { log } from '../lib/logger.js';

migrate();

const existing = db.prepare('SELECT COUNT(*) AS c FROM users').get() as { c: number };
if (existing.c > 0) {
  log.info('قاعدة البيانات مهيأة مسبقاً — تخطي التهيئة');
  process.exit(0);
}

const users = [
  ['admin@loans.local', 'مدير النظام', 'Admin@12345', 'admin', '#2563eb'],
  ['manager@loans.local', 'سارة المشرفة', 'Manager@12345', 'manager', '#7c3aed'],
  ['agent@loans.local', 'علي المستشار', 'Agent@12345', 'agent', '#059669'],
  ['viewer@loans.local', 'حساب مشاهدة', 'Viewer@12345', 'viewer', '#64748b'],
] as const;

const insertUser = db.prepare('INSERT INTO users (email, name, password_hash, role, color) VALUES (?,?,?,?,?)');
const userIds: number[] = [];
for (const [email, name, pw, role, color] of users) {
  userIds.push(Number(insertUser.run(email, name, hashPassword(pw), role, color).lastInsertRowid));
}

const insertPage = db.prepare(
  'INSERT INTO pages (platform, name, handle, external_id, avatar_url, status, followers, created_by) VALUES (?,?,?,?,?,?,?,?)',
);
const pages = [
  ['facebook', 'النور للإلكترونيات', 'alnoor.tech', 'fb_1001', '', 'connected', 18420],
  ['instagram', 'النور تِك', 'alnoor.tech', 'ig_2002', '', 'connected', 9310],
  ['telegram', 'عروض النور', 'alnoor_offers', 'tg_3003', '', 'connected', 4120],
  ['whatsapp', 'واتساب النور', '+9647700000000', 'wa_4004', '', 'connected', 2760],
  ['tiktok', 'النور تيك توك', 'alnoor.tech', 'tt_5005', '', 'needs_reauth', 15230],
] as const;
const pageIds: number[] = [];
for (const p of pages) pageIds.push(Number(insertPage.run(...p, userIds[0]).lastInsertRowid));

const insertProduct = db.prepare(
  'INSERT INTO products (name, brand, category, price, specs, stock) VALUES (?,?,?,?,?,?)',
);
const products = [
  ['iPhone 15 Pro 256GB', 'Apple', 'phone', 2_150_000, 'شريحة A17 Pro، كاميرا 48MP، تيتانيوم', 6],
  ['Galaxy S24 Ultra', 'Samsung', 'phone', 1_850_000, 'شاشة 6.8" AMOLED، قلم S-Pen، 200MP', 9],
  ['Redmi Note 13 Pro', 'Xiaomi', 'phone', 480_000, 'شاشة 120Hz، شحن 67W، 8/256GB', 24],
  ['MacBook Air M3 13"', 'Apple', 'laptop', 2_400_000, 'شريحة M3، 8GB RAM، 256GB SSD', 4],
  ['Lenovo IdeaPad 3', 'Lenovo', 'laptop', 720_000, 'Core i5، 8GB RAM، 512GB SSD', 12],
  ['iPad 10th Gen 64GB', 'Apple', 'tablet', 690_000, 'شاشة 10.9"، Wi-Fi، شريحة A14', 8],
  ['Samsung 55" QLED', 'Samsung', 'tv', 1_150_000, '4K، 120Hz، HDR10+', 5],
  ['LG 43" Smart TV', 'LG', 'tv', 520_000, '4K، WebOS، بلوتوث', 11],
  ['PlayStation 5 Slim', 'Sony', 'console', 850_000, 'نسخة ديجيتال، يد DualSense', 7],
  ['غسالة LG 8 كغم', 'LG', 'appliance', 610_000, 'تعبئة أمامية، موفر طاقة A+++', 6],
  ['مكيف سبليت 1.5 طن', 'Gree', 'appliance', 780_000, 'تبريد سريع، انفرتر', 10],
  ['AirPods Pro 2', 'Apple', 'accessory', 320_000, 'إلغاء ضوضاء نشط، USB-C', 30],
] as const;
const productIds: number[] = [];
for (const p of products) productIds.push(Number(insertProduct.run(...p).lastInsertRowid));

const insertTemplate = db.prepare('INSERT INTO templates (name, category, body, created_by) VALUES (?,?,?,?)');
insertTemplate.run('عرض تقسيط جهاز', 'عروض', '📱 {{device}}\nالسعر: {{price}} د.ع\nالمقدم: {{down}} د.ع\nالقسط الشهري: {{monthly}} د.ع لمدة {{months}} شهر\nبدون كفيل — موافقة سريعة.\nراسلنا الآن 👇', userIds[1]);
insertTemplate.run('تذكير بالمستندات', 'متابعة', 'أهلاً {{name}}، لاستكمال طلب تقسيط {{device}} نحتاج: البطاقة الوطنية، آخر 3 كشوف راتب، وإثبات سكن.', userIds[2]);
insertTemplate.run('ترحيب أول رسالة', 'خدمة', 'أهلاً بك في النور للإلكترونيات 🌟\nأخبرنا بالجهاز الذي تريده والمقدم المتاح لديك لنحسب لك القسط.', userIds[2]);
insertTemplate.run('رفض مهذب', 'متابعة', 'شكراً {{name}}، حالياً لا يمكن الموافقة على الطلب بسبب نسبة القسط للراتب. يمكنك زيادة المقدم أو تقليل المدة.', userIds[1]);

const insertPost = db.prepare(
  'INSERT INTO posts (title, body, product_id, status, scheduled_at, published_at, created_by, approved_by) VALUES (?,?,?,?,?,?,?,?)',
);
const now = Date.now();
const day = 86_400_000;
const iso = (t: number) => new Date(t).toISOString();

const postIds: number[] = [];
postIds.push(Number(insertPost.run('عرض iPhone 15 Pro', 'iPhone 15 Pro بالتقسيط — مقدم 400 ألف والقسط 95 ألف شهرياً.', productIds[0], 'published', iso(now - 3 * day), iso(now - 3 * day), userIds[1], userIds[0]).lastInsertRowid));
postIds.push(Number(insertPost.run('لابتوبات للطلاب', 'لابتوب Lenovo IdeaPad بأقساط تبدأ من 40 ألف شهرياً — بدون كفيل.', productIds[4], 'published', iso(now - day), iso(now - day), userIds[2], userIds[0]).lastInsertRowid));
postIds.push(Number(insertPost.run('عرض نهاية الأسبوع', 'خصم 10% على المقدم لكل الأجهزة حتى نهاية الأسبوع.', null, 'scheduled', iso(now + day), null, userIds[1], userIds[0]).lastInsertRowid));
postIds.push(Number(insertPost.run('PlayStation 5 بالتقسيط', 'PS5 Slim بالتقسيط على 12 شهر — الكمية محدودة.', productIds[8], 'pending', null, null, userIds[2], null).lastInsertRowid));
postIds.push(Number(insertPost.run('مسودة: مكيفات', 'عروض خاصة على المكيفات مع تركيب مجاني.', productIds[10], 'draft', null, null, userIds[2], null).lastInsertRowid));

const insertTarget = db.prepare('INSERT INTO post_targets (post_id, page_id, status, external_post_id) VALUES (?,?,?,?)');
for (const pid of postIds.slice(0, 3)) {
  for (const pageId of pageIds.slice(0, 3)) insertTarget.run(pid, pageId, 'published', `ext_${pid}_${pageId}`);
}

const insertConv = db.prepare(
  'INSERT INTO conversations (page_id, external_user_id, external_user_name, status, assignee_id, unread_count, last_message_at) VALUES (?,?,?,?,?,?,?)',
);
const insertMsg = db.prepare('INSERT INTO messages (conversation_id, direction, body, author_id, created_at) VALUES (?,?,?,?,?)');

const conv1 = Number(insertConv.run(pageIds[0], 'psid_9001', 'حسين كريم', 'open', userIds[2], 2, iso(now - 3600_000)).lastInsertRowid);
insertMsg.run(conv1, 'in', 'مساء الخير، أريد iPhone 15 Pro بالتقسيط', null, iso(now - 4000_000));
insertMsg.run(conv1, 'in', 'المقدم 400 ألف، على 12 شهر', null, iso(now - 3600_000));

const conv2 = Number(insertConv.run(pageIds[3], 'wa_7701234567', 'زينب أحمد', 'pending', userIds[2], 1, iso(now - 7200_000)).lastInsertRowid);
insertMsg.run(conv2, 'in', 'هل يوجد لابتوب للطلاب بالتقسيط؟', null, iso(now - 7200_000));

const insertLead = db.prepare(
  `INSERT INTO leads (full_name, phone, email, city, product_id, product_name, price, down_payment, months, monthly_amount,
    job, salary, source_platform, source_page_id, conversation_id, stage, score, owner_id)
   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
);

function seedLead(
  name: string, phone: string, city: string, productIdx: number, downRatio: number, months: number,
  job: string, salary: number, platform: string, pageIdx: number, convId: number | null, stage: string, owner: number | null,
) {
  const product = products[productIdx];
  const price = product[3] as number;
  const down = Math.round(price * downRatio);
  const plan = computePlan(price, down, months, DEFAULT_PROFIT_RATE);
  const score = scoreApplication({
    price, downPayment: down, months, monthly: plan.monthly, salary, job, phone, city, sourcePlatform: platform,
  });
  insertLead.run(
    name, phone, '', city, productIds[productIdx], `${product[1]} ${product[0]}`, price, down, months, plan.monthly,
    job, salary, platform, pageIds[pageIdx], convId, stage, score, owner,
  );
}

seedLead('حسين كريم', '07701234567', 'بغداد', 0, 0.19, 12, 'government', 1_800_000, 'facebook', 0, conv1, 'contacted', userIds[2]);
seedLead('زينب أحمد', '07711234567', 'البصرة', 4, 0.25, 18, 'private', 1_100_000, 'whatsapp', 3, conv2, 'new', null);
seedLead('مصطفى جبار', '07721234567', 'أربيل', 2, 0.3, 9, 'self', 900_000, 'instagram', 1, null, 'docs', userIds[2]);
seedLead('نور الهدى', '07731234567', 'النجف', 6, 0.35, 24, 'government', 2_200_000, 'tiktok', 4, null, 'credit_check', userIds[1]);
seedLead('عمر سعد', '07741234567', 'بغداد', 8, 0.4, 12, 'private', 1_500_000, 'telegram', 2, null, 'delivered', userIds[1]);
seedLead('سيف الدين', '07751234567', 'كربلاء', 11, 0.2, 6, 'student', 400_000, 'facebook', 0, null, 'rejected', userIds[2]);
seedLead('رقية علي', '07761234567', 'بغداد', 9, 0.45, 18, 'retired', 1_300_000, 'instagram', 1, null, 'approved', userIds[1]);

const insertAnalytics = db.prepare(
  'INSERT INTO analytics_daily (page_id, day, reach, impressions, engagements, clicks, followers) VALUES (?,?,?,?,?,?,?)',
);
for (let d = 29; d >= 0; d--) {
  const dayStr = new Date(now - d * day).toISOString().slice(0, 10);
  for (const pageId of pageIds) {
    const base = 800 + Math.floor(Math.random() * 2400);
    insertAnalytics.run(pageId, dayStr, base, Math.floor(base * 1.6), Math.floor(base * 0.12), Math.floor(base * 0.05), 9000 + Math.floor(Math.random() * 9000));
  }
}

db.prepare('INSERT INTO settings (key, value) VALUES (?,?) ON CONFLICT(key) DO NOTHING').run('office_name', 'النور للإلكترونيات');
db.prepare('INSERT INTO settings (key, value) VALUES (?,?) ON CONFLICT(key) DO NOTHING').run('auto_lead_capture', '1');
db.prepare('INSERT INTO settings (key, value) VALUES (?,?) ON CONFLICT(key) DO NOTHING').run('profit_rate', String(DEFAULT_PROFIT_RATE));
db.prepare('INSERT INTO settings (key, value) VALUES (?,?) ON CONFLICT(key) DO NOTHING').run('currency', 'IQD');

log.info('تمت تهيئة قاعدة البيانات بنجاح');
log.info('الدخول: admin@loans.local / Admin@12345');
