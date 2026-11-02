import { riskOf } from '../lib/installment';

export function ScoreGauge({ score, size = 132 }: { score: number; size?: number }) {
  const risk = riskOf(score);
  const radius = size / 2 - 10;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score / 100);

  return (
    <div className="gauge" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={radius} className="gauge-track" strokeWidth={10} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={risk.color}
          strokeWidth={10}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset .45s ease, stroke .3s ease' }}
        />
      </svg>
      <div className="gauge-center">
        <strong style={{ color: risk.color }}>{score}</strong>
        <span>{risk.label}</span>
      </div>
    </div>
  );
}
