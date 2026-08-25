import { useMemo, useState } from "react";
import type { AuditLogEntry } from "../api/types";

const CATEGORY_LABELS: Record<string, string> = {
  AiSystem: "System",
  RiskAssessment: "Risk Scoring",
  FunctionWorkPaper: "Work Paper",
  Document: "Document",
  User: "User",
};

const CATEGORY_STYLES: Record<string, string> = {
  AiSystem: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  RiskAssessment: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300",
  FunctionWorkPaper: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  Document: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  User: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
};

function categoryLabel(entityType: string): string {
  return CATEGORY_LABELS[entityType] ?? entityType;
}

function categoryStyle(entityType: string): string {
  return CATEGORY_STYLES[entityType] ?? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";
}

function dayHeading(date: Date): string {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (sameDay(date, today)) return "Today";
  if (sameDay(date, yesterday)) return "Yesterday";
  return date.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric", year: "numeric" });
}

export function AuditLogPanel({ logs, emptyMessage = "No activity recorded yet." }: { logs: AuditLogEntry[] | undefined; emptyMessage?: string }) {
  const [filter, setFilter] = useState<string | null>(null);

  const categories = useMemo(() => {
    if (!logs) return [];
    const seen = new Set<string>();
    logs.forEach((l) => seen.add(l.entityType));
    return Array.from(seen).sort((a, b) => categoryLabel(a).localeCompare(categoryLabel(b)));
  }, [logs]);

  const filtered = useMemo(() => {
    if (!logs) return [];
    return filter ? logs.filter((l) => l.entityType === filter) : logs;
  }, [logs, filter]);

  const groups = useMemo(() => {
    const map = new Map<string, AuditLogEntry[]>();
    for (const log of filtered) {
      const key = new Date(log.timestamp).toDateString();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(log);
    }
    return Array.from(map.entries());
  }, [filtered]);

  if (!logs || logs.length === 0) {
    return <p className="text-sm text-slate-400 dark:text-slate-500">{emptyMessage}</p>;
  }

  return (
    <div>
      {categories.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          <button
            onClick={() => setFilter(null)}
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
              filter === null ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
            }`}
          >
            All
          </button>
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setFilter(c)}
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                filter === c ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900" : `${categoryStyle(c)} hover:opacity-80`
              }`}
            >
              {categoryLabel(c)}
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="text-sm text-slate-400 dark:text-slate-500">No activity in this category.</p>
      ) : (
        <div className="space-y-4">
          {groups.map(([dateKey, entries]) => (
            <div key={dateKey}>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                {dayHeading(new Date(entries[0].timestamp))}
              </p>
              <ul className="space-y-1.5">
                {entries.map((log) => (
                  <li key={log.id} className="flex items-start gap-2 text-sm">
                    <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${categoryStyle(log.entityType)}`}>
                      {categoryLabel(log.entityType)}
                    </span>
                    <span className="flex-1">
                      <span className="text-slate-800 dark:text-slate-200">{log.summary}</span>
                      <span className="ml-2 text-xs text-slate-400 dark:text-slate-500">
                        {log.actor.name} &middot;{" "}
                        {new Date(log.timestamp).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
