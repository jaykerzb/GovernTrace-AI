import { STATUS_LABELS } from "./Badges";
import type { SystemStatus } from "../api/types";

const STATUS_ORDER: SystemStatus[] = [
  "DRAFT",
  "INTAKE",
  "RISK_ASSESSMENT",
  "UNDER_REVIEW",
  "APPROVED",
  "DEPLOYED",
  "MONITORING",
  "RETIRED",
];

export function StatusPipelineBar({ byStatus }: { byStatus: Record<string, number> }) {
  const max = Math.max(1, ...STATUS_ORDER.map((s) => byStatus[s] ?? 0));

  return (
    <div className="space-y-2">
      {STATUS_ORDER.map((status) => {
        const count = byStatus[status] ?? 0;
        const widthPct = (count / max) * 100;
        return (
          <div key={status} className="flex items-center gap-3">
            <span className="w-28 shrink-0 truncate text-xs text-slate-500 dark:text-slate-400">{STATUS_LABELS[status]}</span>
            <div className="h-4 flex-1 overflow-hidden rounded bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full rounded bg-slate-700 dark:bg-slate-400"
                style={{ width: count > 0 ? `${Math.max(widthPct, 3)}%` : "0%" }}
              />
            </div>
            <span className="w-6 shrink-0 text-right text-xs font-medium text-slate-700 dark:text-slate-300">{count}</span>
          </div>
        );
      })}
    </div>
  );
}
