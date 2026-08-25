interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

export function DonutChart({ data, size = 160 }: { data: DonutSlice[]; size?: number }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const radius = size / 2;
  const strokeWidth = radius * 0.36;
  const innerRadius = radius - strokeWidth / 2;
  const circumference = 2 * Math.PI * innerRadius;

  let offset = 0;
  const segments = data
    .filter((d) => d.value > 0)
    .map((d) => {
      const fraction = total > 0 ? d.value / total : 0;
      const dash = fraction * circumference;
      // 2px gap between segments (converted to circumference units).
      const gap = total > 0 && data.filter((x) => x.value > 0).length > 1 ? 2 : 0;
      const seg = {
        ...d,
        dashArray: `${Math.max(dash - gap, 0)} ${circumference - Math.max(dash - gap, 0)}`,
        dashOffset: -offset,
        fraction,
      };
      offset += dash;
      return seg;
    });

  return (
    <div className="flex items-center gap-5">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
          <circle
            cx={radius}
            cy={radius}
            r={innerRadius}
            fill="none"
            stroke="currentColor"
            className="text-slate-100 dark:text-slate-800"
            strokeWidth={strokeWidth}
          />
          {segments.map((seg) => (
            <circle
              key={seg.label}
              cx={radius}
              cy={radius}
              r={innerRadius}
              fill="none"
              stroke={seg.color}
              strokeWidth={strokeWidth}
              strokeDasharray={seg.dashArray}
              strokeDashoffset={seg.dashOffset}
              transform={`rotate(-90 ${radius} ${radius})`}
              strokeLinecap="round"
            >
              <title>
                {seg.label}: {seg.value} ({Math.round(seg.fraction * 100)}%)
              </title>
            </circle>
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-xl font-semibold text-slate-900 dark:text-slate-100">{total}</span>
          <span className="text-[10px] text-slate-400 dark:text-slate-500">total</span>
        </div>
      </div>

      <ul className="min-w-0 flex-1 space-y-1.5">
        {data.map((d) => (
          <li key={d.label} className="flex items-center justify-between gap-3 text-xs">
            <span className="flex min-w-0 items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: d.color }} />
              <span className="truncate text-slate-600 dark:text-slate-300">{d.label}</span>
            </span>
            <span className="shrink-0 font-medium text-slate-800 dark:text-slate-100">
              {d.value}
              <span className="ml-1 text-slate-400 dark:text-slate-500">
                ({total > 0 ? Math.round((d.value / total) * 100) : 0}%)
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
