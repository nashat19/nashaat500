import { db } from '../db/index.js';

export function overview(days: number) {
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

  const totals = db
    .prepare(
      `SELECT COALESCE(SUM(reach),0) AS reach, COALESCE(SUM(impressions),0) AS impressions,
              COALESCE(SUM(engagements),0) AS engagements, COALESCE(SUM(clicks),0) AS clicks
       FROM analytics_daily WHERE day >= ?`,
    )
    .get(since) as { reach: number; impressions: number; engagements: number; clicks: number };

  const series = db
    .prepare(
      `SELECT day, SUM(reach) AS reach, SUM(engagements) AS engagements, SUM(clicks) AS clicks
       FROM analytics_daily WHERE day >= ? GROUP BY day ORDER BY day ASC`,
    )
    .all(since) as { day: string; reach: number; engagements: number; clicks: number }[];

  const byPlatform = db
    .prepare(
      `SELECT p.platform, SUM(a.reach) AS reach, SUM(a.engagements) AS engagements
       FROM analytics_daily a JOIN pages p ON p.id = a.page_id WHERE a.day >= ?
       GROUP BY p.platform ORDER BY reach DESC`,
    )
    .all(since) as { platform: string; reach: number; engagements: number }[];

  const leadsBySource = db
    .prepare('SELECT source_platform AS platform, COUNT(*) AS count FROM leads GROUP BY source_platform ORDER BY count DESC')
    .all() as { platform: string; count: number }[];

  const topProducts = db
    .prepare(
      `SELECT product_name AS name, COUNT(*) AS count, COALESCE(SUM(price),0) AS volume
       FROM leads WHERE product_name <> '' GROUP BY product_name ORDER BY count DESC LIMIT 8`,
    )
    .all() as { name: string; count: number; volume: number }[];

  const funnel = db.prepare('SELECT stage, COUNT(*) AS count FROM leads GROUP BY stage').all() as { stage: string; count: number }[];

  const published = (db.prepare("SELECT COUNT(*) AS c FROM posts WHERE status = 'published'").get() as { c: number }).c;
  const scheduled = (db.prepare("SELECT COUNT(*) AS c FROM posts WHERE status = 'scheduled'").get() as { c: number }).c;
  const openConversations = (db.prepare("SELECT COUNT(*) AS c FROM conversations WHERE status <> 'closed'").get() as { c: number }).c;
  const deliveredVolume = (db.prepare("SELECT COALESCE(SUM(price),0) AS v FROM leads WHERE stage = 'delivered'").get() as { v: number }).v;
  const totalLeads = (db.prepare('SELECT COUNT(*) AS c FROM leads').get() as { c: number }).c;
  const delivered = (db.prepare("SELECT COUNT(*) AS c FROM leads WHERE stage = 'delivered'").get() as { c: number }).c;
  const avgTicket = (db.prepare('SELECT COALESCE(AVG(price),0) AS v FROM leads').get() as { v: number }).v;
  const avgScore = (db.prepare('SELECT COALESCE(AVG(score),0) AS v FROM leads').get() as { v: number }).v;

  const engagementRate = totals.impressions > 0 ? (totals.engagements / totals.impressions) * 100 : 0;
  const conversion = totalLeads > 0 ? (delivered / totalLeads) * 100 : 0;

  return {
    totals: { ...totals, engagementRate: Number(engagementRate.toFixed(2)) },
    series,
    byPlatform,
    leadsBySource,
    topProducts,
    funnel,
    counters: {
      published,
      scheduled,
      openConversations,
      deliveredVolume,
      totalLeads,
      delivered,
      conversion: Number(conversion.toFixed(1)),
      avgTicket: Math.round(avgTicket),
      avgScore: Math.round(avgScore),
    },
  };
}

export function bestHours() {
  return db
    .prepare(
      `SELECT CAST(strftime('%H', created_at) AS INTEGER) AS hour, COUNT(*) AS count
       FROM messages WHERE direction = 'in' GROUP BY hour ORDER BY count DESC LIMIT 8`,
    )
    .all() as { hour: number; count: number }[];
}
