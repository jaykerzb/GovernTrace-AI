import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useDashboard } from "../api/dashboard";
import { useCalendarEvents } from "../api/calendar";
import { MyQueuePanel } from "../components/MyQueuePanel";
import { RiskRatingDonut } from "../components/RiskRatingDonut";
import { StatusPipelineBar } from "../components/StatusPipelineBar";
import { TrendLineChart } from "../components/TrendLineChart";
import { SectionNav, type SectionNavItem } from "../components/SectionNav";

const DASHBOARD_SECTION_NAV_ITEMS: SectionNavItem[] = [
  { id: "section-overview", label: "Overview" },
  { id: "section-queue", label: "My Queue" },
  { id: "section-risk-status", label: "Risk & Status" },
  { id: "section-trends", label: "Trends" },
  { id: "section-week", label: "This Week" },
  { id: "section-needs-assessment", label: "Needs Assessment" },
];

const EVENT_COLORS: Record<string, string> = {
  MEETING: "#6366f1",
  REASSESSMENT: "#f59e0b",
  DEPLOYMENT: "#8b5cf6",
};

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
      <div className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{value}</div>
      <div className="text-sm text-slate-500 dark:text-slate-400">{label}</div>
    </div>
  );
}

export function DashboardPage() {
  const { data, isLoading } = useDashboard();
  // Memoized so these stay referentially/value-stable across re-renders —
  // otherwise a fresh `new Date()` every render produces a new millisecond
  // timestamp, which useCalendarEvents turns into a brand-new query key
  // every time, forcing a fetch on every single render. Since that fetch
  // completing triggers a re-render, which creates yet another new Date,
  // this was a tight feedback loop firing dozens of requests per second.
  const { today, weekFromNow } = useMemo(() => {
    const now = new Date();
    return { today: now, weekFromNow: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) };
  }, []);
  const { data: weekEvents } = useCalendarEvents(today, weekFromNow);

  if (isLoading || !data) {
    return <p className="text-slate-500 dark:text-slate-400">Loading dashboard...</p>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Governance Overview</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Snapshot of your AI use case registry and open compliance work. Updates automatically every 15 seconds.
        </p>
      </div>

      <SectionNav items={DASHBOARD_SECTION_NAV_ITEMS} title={<span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Governance Overview</span>} />

      <div id="section-overview" className="grid grid-cols-2 gap-4 sm:grid-cols-4 scroll-mt-16">
        <StatCard label="Total AI Use Cases" value={data.totalSystems} />
        <StatCard label="Awaiting Risk Assessment" value={data.needsAssessmentCount} />
        <StatCard label="Flagged for Review" value={data.reviewTriggeredCount} />
        <StatCard label="Events This Week" value={weekEvents?.length ?? 0} />
      </div>

      <div id="section-queue" className="scroll-mt-16">
        <MyQueuePanel />
      </div>

      <div id="section-risk-status" className="grid gap-6 lg:grid-cols-2 scroll-mt-16">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Systems by Risk Rating</h2>
          <RiskRatingDonut byRiskRating={data.byRiskRating} />
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Systems by Status</h2>
          <StatusPipelineBar byStatus={data.byStatus} />
        </div>
      </div>

      <div id="section-trends" className="grid gap-6 lg:grid-cols-2 scroll-mt-16">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">New Registrations (6 mo)</h2>
          <TrendLineChart
            data={data.trends.map((t) => ({ label: t.month, value: t.registrations }))}
            color="#0ea5e9"
            valueFormat={(v) => String(Math.round(v))}
          />
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Average Risk Score (6 mo)</h2>
          <TrendLineChart data={data.trends.map((t) => ({ label: t.month, value: t.avgRiskScore }))} color="#f59e0b" />
        </div>
      </div>

      <div id="section-week" className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm scroll-mt-16">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">This Week</h2>
          <Link to="/calendar" className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:underline">
            View full calendar &rarr;
          </Link>
        </div>
        {!weekEvents || weekEvents.length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-slate-500">Nothing scheduled or due in the next 7 days.</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {weekEvents.slice(0, 5).map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: EVENT_COLORS[e.type] }} />
                  {e.link ? (
                    <Link to={e.link} className="truncate text-sm font-medium text-slate-800 dark:text-slate-200 hover:underline">
                      {e.title}
                    </Link>
                  ) : (
                    <span className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">{e.title}</span>
                  )}
                </div>
                <span className="shrink-0 text-xs text-slate-400 dark:text-slate-500">
                  {new Date(e.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </span>
              </li>
            ))}
            {weekEvents.length > 5 && (
              <li className="pt-2 text-xs text-slate-400 dark:text-slate-500">+{weekEvents.length - 5} more</li>
            )}
          </ul>
        )}
      </div>

      <div id="section-needs-assessment" className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm scroll-mt-16">
        <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Needs a Risk Assessment</h2>
        {data.needsAssessment.length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-slate-500">Everything registered has an assessment.</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {data.needsAssessment.map((s) => (
              <li key={s.id} className="py-2">
                <Link to={`/systems/${s.id}`} className="text-sm font-medium text-slate-800 dark:text-slate-200 hover:underline">
                  {s.name}
                </Link>
                <div className="text-xs text-slate-500 dark:text-slate-400">{s.businessUnit}</div>
              </li>
            ))}
          </ul>
        )}
        {data.needsAssessmentCount > data.needsAssessment.length && (
          <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
            +{data.needsAssessmentCount - data.needsAssessment.length} more
          </p>
        )}
      </div>
    </div>
  );
}
