import { useEffect, useState } from "react";
import {
  CUSTOM_DIMENSIONS,
  CUSTOM_METRICS,
  CUSTOM_CHART_TYPES,
  DIMENSION_LABELS,
  METRIC_LABELS,
  CHART_TYPE_LABELS,
  useCustomReportData,
  loadCustomReports,
  saveCustomReports,
  type CustomReportSpec,
  type CustomDimension,
  type CustomMetric,
  type CustomChartType,
} from "../api/customReports";
import type { AnalyticsFilters } from "../api/analytics";
import { DonutChart } from "./DonutChart";
import { HorizontalBarChart, ColumnChart } from "./BarChart";
import { RISK_COLORS, RISK_LABELS } from "../constants/riskColors";
import { STATUS_LABELS } from "./Badges";
import type { SystemStatus } from "../api/types";
import { downloadCsv } from "../lib/csv";
import { inputClass, primaryButtonBase } from "../lib/ui";

const CATEGORICAL = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4"];

function colorFor(dimension: CustomDimension, label: string, index: number): string {
  if (dimension === "riskRating") return RISK_COLORS[label] ?? "#64748b";
  return CATEGORICAL[index % CATEGORICAL.length];
}

function labelFor(dimension: CustomDimension, label: string): string {
  if (dimension === "riskRating") return RISK_LABELS[label] ?? label;
  if (dimension === "status") return STATUS_LABELS[label as SystemStatus] ?? label;
  return label;
}

function ReportCard({
  report,
  filters,
  onRemove,
}: {
  report: CustomReportSpec;
  filters: AnalyticsFilters;
  onRemove: () => void;
}) {
  const { data } = useCustomReportData(report.dimension, report.metric, filters);
  const rows = (data?.data ?? []).map((r, i) => ({
    label: labelFor(report.dimension, r.label),
    value: r.value,
    color: colorFor(report.dimension, r.label, i),
  }));

  function exportCsv() {
    downloadCsv(
      `${report.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${new Date().toISOString().slice(0, 10)}.csv`,
      [DIMENSION_LABELS[report.dimension], METRIC_LABELS[report.metric]],
      rows.map((r) => [r.label, r.value])
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm print:break-inside-avoid">
      <div className="mb-3 flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{report.title}</h3>
        <div className="flex shrink-0 gap-2 print:hidden">
          <button
            onClick={exportCsv}
            className="rounded-md border border-slate-300 dark:border-slate-600 px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Export CSV
          </button>
          <button
            onClick={onRemove}
            className="rounded-md border border-slate-300 dark:border-slate-600 px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            Remove
          </button>
        </div>
      </div>

      {!data ? (
        <p className="text-sm text-slate-400 dark:text-slate-500">Loading...</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-slate-400 dark:text-slate-500">No data for this combination yet.</p>
      ) : report.chartType === "donut" ? (
        <DonutChart data={rows} />
      ) : report.chartType === "column" ? (
        <ColumnChart data={rows} color={CATEGORICAL[0]} />
      ) : report.chartType === "table" ? (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700 text-left text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">
              <th className="py-1.5 pr-2">{DIMENSION_LABELS[report.dimension]}</th>
              <th className="py-1.5 text-right">{METRIC_LABELS[report.metric]}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-2 pr-2 text-slate-700 dark:text-slate-300">{r.label}</td>
                <td className="py-2 text-right font-medium text-slate-800 dark:text-slate-100">{r.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <HorizontalBarChart data={rows} />
      )}
    </div>
  );
}

export function CustomReportsSection({ filters }: { filters: AnalyticsFilters }) {
  const [reports, setReports] = useState<CustomReportSpec[]>([]);
  const [dimension, setDimension] = useState<CustomDimension>("businessUnit");
  const [metric, setMetric] = useState<CustomMetric>("count");
  const [chartType, setChartType] = useState<CustomChartType>("bar");

  useEffect(() => {
    setReports(loadCustomReports());
  }, []);

  function addReport() {
    const title = `${METRIC_LABELS[metric]} by ${DIMENSION_LABELS[dimension]}`;
    const next = [...reports, { id: crypto.randomUUID(), title, dimension, metric, chartType }];
    setReports(next);
    saveCustomReports(next);
  }

  function removeReport(id: string) {
    const next = reports.filter((r) => r.id !== id);
    setReports(next);
    saveCustomReports(next);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Custom Reports</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Build your own metric — saved to this browser and rebuilt live from the current filters above.
          </p>
        </div>
        {reports.length > 0 && (
          <button onClick={() => window.print()} className={`${primaryButtonBase} px-4 py-2 text-sm`}>
            Print / Save as PDF
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm print:hidden">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Metric</label>
          <select value={metric} onChange={(e) => setMetric(e.target.value as CustomMetric)} className={`${inputClass} w-52`}>
            {CUSTOM_METRICS.map((m) => (
              <option key={m} value={m}>
                {METRIC_LABELS[m]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Grouped By</label>
          <select value={dimension} onChange={(e) => setDimension(e.target.value as CustomDimension)} className={`${inputClass} w-48`}>
            {CUSTOM_DIMENSIONS.map((d) => (
              <option key={d} value={d}>
                {DIMENSION_LABELS[d]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Chart Type</label>
          <select value={chartType} onChange={(e) => setChartType(e.target.value as CustomChartType)} className={`${inputClass} w-40`}>
            {CUSTOM_CHART_TYPES.map((c) => (
              <option key={c} value={c}>
                {CHART_TYPE_LABELS[c]}
              </option>
            ))}
          </select>
        </div>
        <button onClick={addReport} className={`${primaryButtonBase} px-4 py-2 text-sm`}>
          Add Report
        </button>
      </div>

      {reports.length === 0 ? (
        <p className="text-sm text-slate-400 dark:text-slate-500 print:hidden">
          No custom reports yet — pick a metric and grouping above and click "Add Report".
        </p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {reports.map((r) => (
            <ReportCard key={r.id} report={r} filters={filters} onRemove={() => removeReport(r.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
