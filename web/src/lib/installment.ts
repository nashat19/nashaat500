export const MIN_MONTHS = 3;
export const MAX_MONTHS = 48;
export const DEFAULT_PROFIT_RATE = 0.025;

export interface Plan {
  financed: number;
  profit: number;
  total: number;
  monthly: number;
  downRatio: number;
}

const round = (n: number) => Math.round(n * 100) / 100;

export function computePlan(price: number, down: number, months: number, rate: number): Plan {
  const safePrice = Math.max(0, price);
  const safeDown = Math.min(Math.max(0, down), Math.max(0, safePrice - 1));
  const financed = round(safePrice - safeDown);
  const profit = round(financed * rate * months);
  const total = round(financed + profit);
  const monthly = months > 0 ? round(total / months) : 0;
  return {
    financed,
    profit,
    total,
    monthly,
    downRatio: safePrice > 0 ? safeDown / safePrice : 0,
  };
}

export interface ScoreInput {
  price: number;
  down: number;
  monthly: number;
  salary: number;
  job: string;
  phone: string;
  city: string;
  platform: string;
}

export function scoreApplication(i: ScoreInput): number {
  let score = 15;
  const ratio = i.price > 0 ? i.down / i.price : 0;

  if (ratio >= 0.4) score += 30;
  else if (ratio >= 0.25) score += 23;
  else if (ratio >= 0.15) score += 15;
  else if (ratio >= 0.05) score += 8;

  if (i.salary > 0) {
    const dti = i.monthly / i.salary;
    if (dti <= 0.15) score += 30;
    else if (dti <= 0.25) score += 22;
    else if (dti <= 0.35) score += 14;
    else if (dti <= 0.5) score += 6;
    else score -= 6;
  }

  if (i.salary >= 1_500_000) score += 10;
  else if (i.salary >= 1_000_000) score += 7;
  else if (i.salary >= 600_000) score += 4;

  const jobBonus: Record<string, number> = { government: 12, private: 8, retired: 6, self: 4, student: 2, none: 0 };
  score += jobBonus[i.job] ?? 0;

  if (i.phone) score += 8;
  if (i.city) score += 4;
  if (['whatsapp', 'telegram'].includes(i.platform)) score += 5;

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function riskOf(score: number): { key: 'low' | 'medium' | 'high'; label: string; color: string } {
  if (score >= 70) return { key: 'low', label: 'مخاطرة منخفضة', color: 'var(--ok)' };
  if (score >= 45) return { key: 'medium', label: 'مخاطرة متوسطة', color: 'var(--warn)' };
  return { key: 'high', label: 'مخاطرة مرتفعة', color: 'var(--danger)' };
}
