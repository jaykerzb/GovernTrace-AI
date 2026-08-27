interface Bar {
  label: string;
  value: number;
  color: string;
}

export function HorizontalBarChart({ data }: { data: Bar[] }) {
  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <div className="space-y-2.5">
      {data.map((d) => (
        <div key={d.label} className="flex items-center gap-3 text-xs">
          <span className="w-32 shrink-0 truncate text-slate-600 dark:text-slate-300" title={d.label}>
            {d.label}
          </span>
          <div className="relative h-2 flex-1 rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-2 rounded-full transition-all"
              style={{ width: `${(d.value / max) * 100}%`, backgroundColor: d.color }}
              title={`${d.label}: ${d.value}`}
            />
          </div>
          <span className="w-6 shrink-0 text-right font-medium text-slate-800 dark:text-slate-100">{d.value}</span>
        </div>
      ))}
      {data.length === 0 && <p className="text-sm text-slate-400 dark:text-slate-500">No data yet.</p>}
    </div>
  );
}

export function ColumnChart({ data, color }: { data: { label: string; value: number }[]; color: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const height = 120;
  // Fixed-height slots (not natural text flow) for the value number and the
  // category label, so every column's total height is exactly
  // NUMBER_SLOT + gap + bar + gap + LABEL_SLOT regardless of digit count —
  // a previous version reserved only 24px total for both, which was too
  // little; the tallest bar's own column then exceeded the row's fixed
  // height and, combined with items-end bottom alignment, had its number
  // pushed above the box and clipped instead of scrolled into view.
  const NUMBER_SLOT = 16;
  const LABEL_SLOT = 14;
  const GAP = 4;

  return (
    // min-w on each column plus its own horizontal scroll — with a handful
    // of bars they still stretch to fill the card (flex-1), but a report
    // grouped by something with a dozen+ categories scrolls instead of
    // squeezing every column and label past the point of reading.
    <div className="overflow-x-auto">
      <div
        className="flex items-end gap-2"
        style={{ height: NUMBER_SLOT + GAP + height + GAP + LABEL_SLOT, minWidth: data.length * 52 }}
      >
        {data.map((d) => {
          const barHeight = Math.max((d.value / max) * height, d.value > 0 ? 4 : 0);
          return (
            <div key={d.label} className="flex min-w-[44px] flex-1 flex-col items-center" style={{ gap: GAP }}>
              <span
                className="flex w-full items-end justify-center text-[11px] font-medium text-slate-700 dark:text-slate-200"
                style={{ height: NUMBER_SLOT }}
              >
                {d.value > 0 ? d.value : ""}
              </span>
              <div
                className="w-full shrink-0 rounded-t-sm"
                style={{ height: barHeight, backgroundColor: color, minHeight: d.value > 0 ? 4 : 1 }}
                title={`${d.label}: ${d.value}`}
              />
              <span
                className="w-full truncate text-center text-[10px] leading-none text-slate-400 dark:text-slate-500"
                style={{ height: LABEL_SLOT }}
                title={d.label}
              >
                {d.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
