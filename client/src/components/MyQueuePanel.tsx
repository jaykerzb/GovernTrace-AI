import { Link } from "react-router-dom";
import { useMyQueue } from "../api/myQueue";
import { useReviewFunctionLabel } from "../api/reviewFunctions";

function QueueSection({ title, empty, children }: { title: string; empty: boolean; children: React.ReactNode }) {
  if (empty) return null;
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">{title}</h3>
      <ul className="divide-y divide-slate-100 dark:divide-slate-800">{children}</ul>
    </div>
  );
}

function isOverdue(iso: string): boolean {
  return new Date(iso).getTime() < Date.now();
}

export function MyQueuePanel() {
  const { data, isLoading } = useMyQueue();
  const functionLabel = useReviewFunctionLabel();

  if (isLoading || !data) return null;

  const isEmpty =
    data.draftIntakes.length === 0 &&
    data.draftAssessments.length === 0 &&
    data.openWorkPapers.length === 0 &&
    data.readyCommitteeReviews.length === 0 &&
    data.dueForReassessment.length === 0;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
      <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">My Queue</h2>

      {isEmpty ? (
        <p className="text-sm text-slate-400 dark:text-slate-500">Nothing needs your attention right now.</p>
      ) : (
        <div className="space-y-4">
          <QueueSection title="Draft Intakes" empty={data.draftIntakes.length === 0}>
            {data.draftIntakes.map((s) => (
              <li key={s.id} className="py-2">
                <Link to={`/systems/${s.id}`} className="text-sm font-medium text-slate-800 dark:text-slate-200 hover:underline">
                  {s.name}
                </Link>
              </li>
            ))}
          </QueueSection>

          <QueueSection title="Draft Risk Assessments" empty={data.draftAssessments.length === 0}>
            {data.draftAssessments.map((a) => (
              <li key={a.id} className="py-2">
                <Link to={`/systems/${a.aiSystemId}`} className="text-sm font-medium text-slate-800 dark:text-slate-200 hover:underline">
                  {a.aiSystemName}
                </Link>
                <span className="ml-2 text-xs text-slate-400 dark:text-slate-500">v{a.version}</span>
              </li>
            ))}
          </QueueSection>

          <QueueSection title="Open Work Papers" empty={data.openWorkPapers.length === 0}>
            {Object.values(
              data.openWorkPapers.reduce<Record<string, { aiSystemId: string; aiSystemName: string; papers: typeof data.openWorkPapers }>>(
                (groups, wp) => {
                  const group = groups[wp.aiSystemId] ?? { aiSystemId: wp.aiSystemId, aiSystemName: wp.aiSystemName, papers: [] };
                  group.papers.push(wp);
                  groups[wp.aiSystemId] = group;
                  return groups;
                },
                {}
              )
            ).map((group) => (
              <li key={group.aiSystemId} className="py-2">
                <div className="flex items-center justify-between">
                  <Link to={`/systems/${group.aiSystemId}`} className="text-sm font-medium text-slate-800 dark:text-slate-200 hover:underline">
                    {group.aiSystemName}
                  </Link>
                  <span className="text-xs text-slate-400 dark:text-slate-500">
                    {group.papers.length} {group.papers.length === 1 ? "work paper" : "work papers"}
                  </span>
                </div>
                <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                  {group.papers.map((wp) => (
                    <li key={wp.id}>
                      <Link
                        to={`/systems/${wp.aiSystemId}/work-papers/${wp.id}`}
                        className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 hover:underline dark:hover:text-slate-200"
                      >
                        {functionLabel(wp.functionKey)}
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </QueueSection>

          <QueueSection title="Ready for Committee Finalization" empty={data.readyCommitteeReviews.length === 0}>
            {data.readyCommitteeReviews.map((cr) => (
              <li key={cr.id} className="py-2">
                <Link to={`/systems/${cr.aiSystemId}`} className="text-sm font-medium text-slate-800 dark:text-slate-200 hover:underline">
                  {cr.aiSystemName}
                </Link>
                <span className="ml-2 text-xs text-slate-400 dark:text-slate-500">{cr.finalDisposition}</span>
              </li>
            ))}
          </QueueSection>

          <QueueSection title="Due for Re-Assessment" empty={data.dueForReassessment.length === 0}>
            {data.dueForReassessment.map((s) => (
              <li key={s.id} className="flex items-center justify-between py-2">
                <Link to={`/systems/${s.id}`} className="text-sm font-medium text-slate-800 dark:text-slate-200 hover:underline">
                  {s.name}
                </Link>
                <span
                  className={`text-xs ${
                    isOverdue(s.nextReviewDue) ? "font-medium text-red-600 dark:text-red-400" : "text-slate-400 dark:text-slate-500"
                  }`}
                >
                  {isOverdue(s.nextReviewDue) ? "Overdue" : "Due"} {new Date(s.nextReviewDue).toLocaleDateString()}
                </span>
              </li>
            ))}
          </QueueSection>
        </div>
      )}
    </div>
  );
}
