import { Link } from "react-router-dom";
import { useDashboard } from "../api/dashboard";
import { useMyQueue } from "../api/myQueue";

// Matches every section MyQueuePanel actually renders — this used to omit
// dueForReassessment, so the sidebar number and the panel's visible
// sections disagreed on what "My Queue" added up to.
function queueCount(data: ReturnType<typeof useMyQueue>["data"]): number {
  if (!data) return 0;
  return (
    data.draftIntakes.length +
    data.draftAssessments.length +
    data.openWorkPapers.length +
    data.readyCommitteeReviews.length +
    data.dueForReassessment.length
  );
}

export function SidebarQuickStats() {
  const { data: dashboard } = useDashboard();
  const { data: myQueue } = useMyQueue();

  if (!dashboard) return null;

  const myQueueCount = queueCount(myQueue);

  const awaitingCount = dashboard.notStartedCount + dashboard.inProgressCount;

  const stats = [
    {
      label: "My Queue",
      value: myQueueCount,
      to: "/#section-queue",
      title: "Draft intakes, draft assessments, open work papers, committee reviews, and re-assessments due — everything needing action from you or your role",
    },
    {
      label: "Flagged for Review",
      value: dashboard.reviewTriggeredCount,
      to: "/#section-flagged",
      title: "Systems where the intake questionnaire triggered a mandatory additional review",
    },
    {
      label: "Awaiting Assessment",
      value: awaitingCount,
      to: "/#section-needs-assessment",
      title: `${dashboard.notStartedCount} not started yet, ${dashboard.inProgressCount} in progress but not finalized`,
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-1.5 px-3 py-3">
      {stats.map((s) => (
        <Link
          key={s.label}
          to={s.to}
          title={s.title}
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
