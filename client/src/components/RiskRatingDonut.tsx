import { RISK_COLORS, RISK_LABELS, RISK_RATING_ORDER } from "../constants/riskColors";

const SIZE = 140;
const STROKE = 20;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function RiskRatingDonut({ byRiskRating }: { byRiskRating: Record<string, number> }) {
  const total = RISK_RATING_ORDER.reduce((sum, rating) => sum + (byRiskRating[rating] ?? 0), 0);

  let offset = 0;
  const segments = RISK_RATING_ORDER.map((rating) => {
    const count = byRiskRating[rating] ?? 0;
    const fraction = total > 0 ? count / total : 0;
    const dash = fraction * CIRCUMFERENCE;
    const segment = { rating, count, dash, offset };
    offset += dash;
    return segment;
  });

  return (
    <div className="flex items-center gap-6">
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="shrink-0 -rotate-90">
        <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke="currentColor" strokeWidth={STROKE} className="text-slate-100 dark:text-slate-800" />
        {total > 0 &&
          segments
            .filter((s) => s.count > 0)
            .map((s) => (
              <circle
                key={s.rating}
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                fill="none"
                stroke={RISK_COLORS[s.rating]}
                strokeWidth={STROKE}
                strokeDasharray={`${s.dash} ${CIRCUMFERENCE - s.dash}`}
                strokeDashoffset={-s.offset}
                strokeLinecap={segments.filter((seg) => seg.count > 0).length === 1 ? "butt" : "round"}
              />
            ))}
        <text
          x={SIZE / 2}
          y={SIZE / 2}
          textAnchor="middle"
          dominantBaseline="central"
          className="rotate-90 fill-slate-900 text-2xl font-semibold dark:fill-slate-100"
          style={{ transformOrigin: "center", transformBox: "fill-box" }}
        >
          {total}
        </text>
      </svg>

      <ul className="min-w-0 flex-1 space-y-1.5">
        {RISK_RATING_ORDER.map((rating) => (
          <li key={rating} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: RISK_COLORS[rating] }} />
              <span className="truncate text-slate-600 dark:text-slate-300">{RISK_LABELS[rating]}</span>
            </span>
            <span className="shrink-0 font-medium text-slate-700 dark:text-slate-300">{byRiskRating[rating] ?? 0}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
