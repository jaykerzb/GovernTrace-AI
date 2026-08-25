import { Link } from "react-router-dom";
import { useDashboard } from "../api/dashboard";
import { useMyQueue } from "../api/myQueue";

function queueCount(data: ReturnType<typeof useMyQueue>["data"]): number {
  if (!data) return 0;
  return data.draftIntakes.length + data.draftAssessments.length + data.openWorkPapers.length + data.readyCommitteeReviews.length;
}

export function SidebarQuickStats() {
  const { data: dashboard } = useDashboard();
  const { data: myQueue } = useMyQueue();

  if (!dashboard) return null;

  const myQueueCount = queueCount(myQueue);

  const stats = [
    { label: "My Queue", value: myQueueCount, to: "/" },
    { label: "Flagged for Review", value: dashboard.reviewTriggeredCount, to: "/" },
    { label: "Awaiting Assessment", value: dashboard.needsAssessmentCount, to: "/" },
  ];

  return (
    <div className="grid grid-cols-3 gap-1.5 px-3 py-3">
      {stats.map((s) => (
        <Link
          key={s.label}
          to={s.to}
          title={s.label}
          className="flex flex-col items-center gap-0.5 rounded-md border border-slate-200 bg-slate-50 py-2 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-800/60 dark:hover:bg-slate-800"
        >
          <span
            className={`text-base font-semibold ${
              s.value > 0 ? "text-slate-900 dark:text-slate-100" : "text-slate-400 dark:text-slate-600"
            }`}
          >
            {s.value}
          </span>
          <span className="px-1 text-center text-[10px] leading-tight text-slate-500 dark:text-slate-400">{s.label}</span>
        </Link>
      ))}
    </div>
  );
}
