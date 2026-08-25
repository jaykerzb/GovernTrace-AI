const WIDTH = 320;
const HEIGHT = 120;
const PAD_X = 8;
const PAD_TOP = 16;
const PAD_BOTTOM = 24;

export interface TrendPoint {
  label: string;
  value: number | null;
}

export function TrendLineChart({
  data,
  color,
  valueFormat = (v) => String(Math.round(v * 10) / 10),
}: {
  data: TrendPoint[];
  color: string;
  valueFormat?: (v: number) => string;
}) {
  const values = data.map((d) => d.value).filter((v): v is number => v !== null);
  const max = values.length > 0 ? Math.max(...values) : 1;
  const min = values.length > 0 ? Math.min(0, ...values) : 0;
  const range = max - min || 1;

  const plotWidth = WIDTH - PAD_X * 2;
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const stepX = data.length > 1 ? plotWidth / (data.length - 1) : 0;

  function xAt(i: number) {
    return PAD_X + i * stepX;
  }
  function yAt(v: number) {
    return PAD_TOP + plotHeight - ((v - min) / range) * plotHeight;
  }

  // Break the line into contiguous segments so a null (no data that month)
  // shows as a gap rather than a false dip to zero.
  const segments: { x: number; y: number; value: number }[][] = [];
  let current: { x: number; y: number; value: number }[] = [];
  data.forEach((d, i) => {
    if (d.value === null) {
      if (current.length > 0) segments.push(current);
      current = [];
    } else {
      current.push({ x: xAt(i), y: yAt(d.value), value: d.value });
    }
  });
  if (current.length > 0) segments.push(current);

  const lastPoint = [...data].reverse().find((d) => d.value !== null);
  const hasData = values.length > 0;

  return (
    <svg width="100%" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="overflow-visible">
      {/* Recessive baseline */}
      <line x1={PAD_X} y1={yAt(min)} x2={WIDTH - PAD_X} y2={yAt(min)} className="stroke-slate-100 dark:stroke-slate-800" strokeWidth={1} />

      {!hasData ? (
        <text x={WIDTH / 2} y={HEIGHT / 2} textAnchor="middle" className="fill-slate-400 dark:fill-slate-500 text-[10px]">
          No data yet
        </text>
      ) : (
        <>
          {segments.map((seg, si) => (
            <g key={si}>
              {seg.length > 1 && (
                <polyline
                  points={seg.map((p) => `${p.x},${p.y}`).join(" ")}
                  fill="none"
                  stroke={color}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
              {seg.map((p, pi) => (
                <circle key={pi} cx={p.x} cy={p.y} r={seg.length === 1 ? 3 : 2.5} fill={color} />
              ))}
            </g>
          ))}
          {lastPoint && lastPoint.value !== null && (
            <text
              x={xAt(data.indexOf(lastPoint)) + 4}
              y={yAt(lastPoint.value) - 6}
              className="fill-slate-700 dark:fill-slate-300 text-[11px] font-semibold"
            >
              {valueFormat(lastPoint.value)}
            </text>
          )}
        </>
      )}

      {data.map((d, i) => (
        <text
          key={i}
          x={xAt(i)}
          y={HEIGHT - 6}
          textAnchor={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"}
          className="fill-slate-400 dark:fill-slate-500 text-[9px]"
        >
          {d.label}
        </text>
      ))}
    </svg>
  );
}
