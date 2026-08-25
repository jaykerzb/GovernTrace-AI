import { useAnalytics } from "../api/analytics";
import { DonutChart } from "../components/DonutChart";
import { HorizontalBarChart, ColumnChart } from "../components/BarChart";
import { RISK_COLORS } from "../constants/riskColors";

// Categorical slots 1-5 from the validated default palette, adjacent-pair safe.
const CATEGORICAL = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4"];

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
      {subtitle && <p className="mb-3 text-xs text-slate-400 dark:text-slate-500">{subtitle}</p>}
      {!subtitle && <div className="mb-3" />}
      {children}
    </div>
  );
}

export function AnalyticsPage() {
  const { data, isLoading } = useAnalytics();

  if (isLoading || !data) {
    return <p className="text-slate-500 dark:text-slate-400">Loading analytics...</p>;
  }

  const riskData = Object.entries(data.riskDistribution).map(([label, value]) => ({
    label,
    value,
    color: RISK_COLORS[label] ?? "#64748b",
  }));

  const businessUnitData = data.byBusinessUnit.map((d, i) => ({
    label: d.businessUnit,
    value: d.count,
    color: CATEGORICAL[i % CATEGORICAL.length],
  }));

  const workloadData = data.workloadByFunction.map((d, i) => ({
    label: d.label,
    value: d.count,
    color: CATEGORICAL[i % CATEGORICAL.length],
  }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Analytics</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Program-level trends across the AI use case registry. Updates automatically every 15 seconds.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="Risk Distribution" subtitle="Composite risk rating across all completed function work papers.">
          {Object.values(data.riskDistribution).every((v) => v === 0) ? (
            <p className="text-sm text-slate-400 dark:text-slate-500">No work papers have a composite risk rating yet.</p>
          ) : (
            <DonutChart data={riskData} />
          )}
        </ChartCard>

        <ChartCard title="Review Function Workload" subtitle="Open (not-started or in-progress) work papers by team.">
          <HorizontalBarChart data={workloadData} />
        </ChartCard>

        <ChartCard title="Registrations Over Time" subtitle="New AI use cases registered per month, last 6 months.">
          <ColumnChart
            data={data.registrationsByMonth.map((m) => ({ label: m.month, value: m.count }))}
            color={CATEGORICAL[0]}
          />
        </ChartCard>

        <ChartCard title="Use Cases by Business Unit" subtitle="Top business units by registered use case count.">
          <HorizontalBarChart data={businessUnitData} />
        </ChartCard>
      </div>

      <ChartCard title="Average Time to Committee Decision" subtitle="From intake to a finalized committee disposition.">
        {data.avgDaysToDecision === null ? (
          <p className="text-sm text-slate-400 dark:text-slate-500">No committee reviews have been finalized yet.</p>
        ) : (
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-semibold text-slate-900 dark:text-slate-100">{Math.round(data.avgDaysToDecision)}</span>
            <span className="text-sm text-slate-500 dark:text-slate-400">days</span>
            <span className="text-xs text-slate-400 dark:text-slate-500">
              (across {data.decisionSampleSize} finalized review{data.decisionSampleSize === 1 ? "" : "s"})
            </span>
          </div>
        )}
      </ChartCard>
    </div>
  );
}
