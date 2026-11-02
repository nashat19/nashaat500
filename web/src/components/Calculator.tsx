import { useMemo, useState } from 'react';
import { computePlan, scoreApplication, MAX_MONTHS, MIN_MONTHS, DEFAULT_PROFIT_RATE } from '../lib/installment';
import { money } from '../lib/format';
import { ScoreGauge } from './ScoreGauge';
import { Field, Input, Select } from './ui';

export interface CalcState {
  price: number;
  down: number;
  months: number;
  salary: number;
  job: string;
  phone: string;
  city: string;
  platform: string;
}

export const emptyCalc: CalcState = {
  price: 0,
  down: 0,
  months: 12,
  salary: 0,
  job: 'private',
  phone: '',
  city: '',
  platform: 'manual',
};

export function Calculator({
  value,
  onChange,
  rate = DEFAULT_PROFIT_RATE,
  compact = false,
}: {
  value: CalcState;
  onChange: (next: CalcState) => void;
  rate?: number;
  compact?: boolean;
}) {
  const [showProfile, setShowProfile] = useState(!compact);

  const plan = useMemo(() => computePlan(value.price, value.down, value.months, rate), [value.price, value.down, value.months, rate]);
  const score = useMemo(
    () =>
      scoreApplication({
        price: value.price,
        down: value.down,
        monthly: plan.monthly,
        salary: value.salary,
        job: value.job,
        phone: value.phone,
        city: value.city,
        platform: value.platform,
      }),
    [value, plan.monthly],
  );

  const set = <K extends keyof CalcState>(key: K, v: CalcState[K]) => onChange({ ...value, [key]: v });
  const downPct = Math.round(plan.downRatio * 100);

  return (
    <div className="calc">
      <div className="calc-grid">
        <Field label="سعر الجهاز">
          <Input
            type="number"
            min={0}
            step={10000}
            value={value.price || ''}
            onChange={(e) => set('price', Number(e.target.value))}
            placeholder="0"
          />
        </Field>

        <Field label={`المقدم (${downPct}%)`}>
          <Input
            type="number"
            min={0}
            step={10000}
            value={value.down || ''}
            onChange={(e) => set('down', Number(e.target.value))}
            placeholder="0"
          />
          <input
            className="range"
            type="range"
            min={0}
            max={Math.max(value.price, 1)}
            step={10000}
            value={value.down}
            onChange={(e) => set('down', Number(e.target.value))}
          />
        </Field>
      </div>

      <Field label={`عدد الأشهر — ${value.months}`}>
        <input
          className="range"
          type="range"
          min={MIN_MONTHS}
          max={MAX_MONTHS}
          step={1}
          value={value.months}
          onChange={(e) => set('months', Number(e.target.value))}
        />
        <div className="chips">
          {[6, 12, 18, 24, 36].map((m) => (
            <button key={m} type="button" className={`chip ${value.months === m ? 'chip-on' : ''}`} onClick={() => set('months', m)}>
              {m} شهر
            </button>
          ))}
        </div>
      </Field>

      <button type="button" className="link-btn" onClick={() => setShowProfile((s) => !s)}>
        {showProfile ? '− إخفاء بيانات العميل' : '+ بيانات العميل للتقييم'}
      </button>

      {showProfile ? (
        <div className="calc-grid">
          <Field label="الراتب الشهري">
            <Input type="number" min={0} step={50000} value={value.salary || ''} onChange={(e) => set('salary', Number(e.target.value))} placeholder="0" />
          </Field>
          <Field label="نوع العمل">
            <Select value={value.job} onChange={(e) => set('job', e.target.value)}>
              <option value="government">حكومي</option>
              <option value="private">قطاع خاص</option>
              <option value="self">عمل حر</option>
              <option value="retired">متقاعد</option>
              <option value="student">طالب</option>
              <option value="none">بدون</option>
            </Select>
          </Field>
          <Field label="الهاتف">
            <Input value={value.phone} onChange={(e) => set('phone', e.target.value)} placeholder="07XXXXXXXXX" />
          </Field>
          <Field label="المدينة">
            <Input value={value.city} onChange={(e) => set('city', e.target.value)} placeholder="بغداد" />
          </Field>
        </div>
      ) : null}

      <div className="calc-result">
        <div className="calc-figures">
          <div>
            <span>القسط الشهري</span>
            <strong className="accent">{money(plan.monthly)}</strong>
          </div>
          <div>
            <span>المبلغ الممول</span>
            <strong>{money(plan.financed)}</strong>
          </div>
          <div>
            <span>هامش الربح</span>
            <strong>{money(plan.profit)}</strong>
          </div>
          <div>
            <span>الإجمالي</span>
            <strong>{money(plan.total)}</strong>
          </div>
        </div>
        <ScoreGauge score={score} size={112} />
      </div>
    </div>
  );
}
