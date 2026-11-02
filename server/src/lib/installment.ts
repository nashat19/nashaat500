import { badRequest } from './errors.js';

export const MIN_MONTHS = 3;
export const MAX_MONTHS = 48;
export const DEFAULT_PROFIT_RATE = 0.025;

export interface Plan {
  price: number;
  downPayment: number;
  months: number;
  profitRate: number;
  financed: number;
  profit: number;
  total: number;
  monthly: number;
}

export function computePlan(price: number, downPayment: number, months: number, profitRate = DEFAULT_PROFIT_RATE): Plan {
  if (!Number.isFinite(price) || price <= 0) throw badRequest('سعر الجهاز غير صالح');
  if (!Number.isFinite(downPayment) || downPayment < 0) throw badRequest('المقدم غير صالح');
  if (downPayment >= price) throw badRequest('المقدم يجب أن يكون أقل من سعر الجهاز');
  if (!Number.isInteger(months) || months < MIN_MONTHS || months > MAX_MONTHS) {
    throw badRequest(`عدد الأشهر يجب أن يكون بين ${MIN_MONTHS} و ${MAX_MONTHS}`);
  }
  if (!Number.isFinite(profitRate) || profitRate < 0 || profitRate > 0.2) throw badRequest('هامش الربح غير صالح');

  const financed = round(price - downPayment);
  const profit = round(financed * profitRate * months);
  const total = round(financed + profit);
  const monthly = round(total / months);

  return { price: round(price), downPayment: round(downPayment), months, profitRate, financed, profit, total, monthly };
}

export const round = (n: number) => Math.round(n * 100) / 100;

export function debtRatio(monthly: number, salary: number): number {
  if (salary <= 0) return 1;
  return monthly / salary;
}

export interface ScoreInput {
  price: number;
  downPayment: number;
  months: number;
  monthly: number;
  salary: number;
  job: string;
  phone: string;
  city: string;
  sourcePlatform: string;
}

export function scoreApplication(input: ScoreInput): number {
  let score = 15;

  const downRatio = input.price > 0 ? input.downPayment / input.price : 0;
  if (downRatio >= 0.4) score += 30;
  else if (downRatio >= 0.25) score += 23;
  else if (downRatio >= 0.15) score += 15;
  else if (downRatio >= 0.05) score += 8;

  const dti = debtRatio(input.monthly, input.salary);
  if (input.salary > 0) {
    if (dti <= 0.15) score += 30;
    else if (dti <= 0.25) score += 22;
    else if (dti <= 0.35) score += 14;
    else if (dti <= 0.5) score += 6;
    else score -= 6;
  }

  if (input.salary >= 1_500_000) score += 10;
  else if (input.salary >= 1_000_000) score += 7;
  else if (input.salary >= 600_000) score += 4;

  const jobBonus: Record<string, number> = { government: 12, private: 8, retired: 6, self: 4, student: 2, none: 0 };
  score += jobBonus[input.job] ?? 0;

  if (input.phone) score += 8;
  if (input.city) score += 4;
  if (['whatsapp', 'telegram'].includes(input.sourcePlatform)) score += 5;

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function riskBand(score: number): 'low' | 'medium' | 'high' {
  if (score >= 70) return 'low';
  if (score >= 45) return 'medium';
  return 'high';
}
