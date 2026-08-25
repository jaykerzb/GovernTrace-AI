import { useOrgSettings } from "../api/orgSettings";
import { RISK_COLORS, RISK_LABELS } from "../constants/riskColors";
import { riskBand } from "../lib/riskBand";
import type { SystemStatus, WorkPaperStatus } from "../api/types";

// Replaces the Approval Authority display in list/summary views with the
// same Low/Moderate/High/Critical scale used across the rest of the
// platform (dashboard risk rating, work paper composite ratings), derived
// from the assessment's numeric Dimension 2 score.
export function RiskScoreBadge({ score }: { score: number | null }) {
  const { data: orgSettings } = useOrgSettings();

  if (score === null) {
    return (
      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
        Not Assessed
      </span>
    );
  }

  const band = riskBand(score, {
    riskBandLowMax: orgSettings?.riskBandLowMax ?? 15,
    riskBandModerateMax: orgSettings?.riskBandModerateMax ?? 30,
    riskBandHighMax: orgSettings?.riskBandHighMax ?? 38,
  });
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
      style={{ backgroundColor: RISK_COLORS[band] }}
    >
      {RISK_LABELS[band]}
      <span className="opacity-80">({score})</span>
    </span>
  );
}

export function ReviewTriggerBadge({ triggered }: { triggered: boolean | null }) {
  if (!triggered) return null;
  return (
    <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
      Flagged for Additional Review
    </span>
  );
}

export const STATUS_LABELS: Record<SystemStatus, string> = {
  DRAFT: "Draft",
  INTAKE: "Intake",
  RISK_ASSESSMENT: "Risk Assessment",
  UNDER_REVIEW: "Under Review",
  APPROVED: "Approved",
  DEPLOYED: "Deployed",
  MONITORING: "Monitoring",
  RETIRED: "Retired",
};

export function StatusBadge({ status }: { status: SystemStatus }) {
  return (
    <span className="inline-flex items-center rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-200">
      {STATUS_LABELS[status]}
    </span>
  );
}

const WORK_PAPER_STYLES: Record<WorkPaperStatus, string> = {
  NOT_STARTED: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
  IN_PROGRESS: "bg-amber-100 text-amber-800",
  COMPLETE: "bg-emerald-100 text-emerald-800",
};

const WORK_PAPER_LABELS: Record<WorkPaperStatus, string> = {
  NOT_STARTED: "Not Started",
  IN_PROGRESS: "In Progress",
  COMPLETE: "Complete",
};

export function WorkPaperStatusBadge({ status }: { status: WorkPaperStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${WORK_PAPER_STYLES[status]}`}>
      {WORK_PAPER_LABELS[status]}
    </span>
  );
}
