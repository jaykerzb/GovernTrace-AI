import { useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useDeleteSystem, useSystem, useUpdateSystemStatus } from "../api/systems";
import { useDeleteAssessment, useStartAssessment } from "../api/assessments";
import { useAuditLog } from "../api/audit";
import { useWorkPapers } from "../api/workPapers";
import { useDocuments } from "../api/documents";
import { RiskScoreBadge, ReviewTriggerBadge, StatusBadge, WorkPaperStatusBadge, STATUS_LABELS } from "../components/Badges";
import { DocumentsPanel } from "../components/DocumentsPanel";
import { AuditLogPanel } from "../components/AuditLogPanel";
import { ApprovalStepsPanel } from "../components/ApprovalStepsPanel";
import { CommentsPanel } from "../components/CommentsPanel";
import { SectionNav, type SectionNavItem } from "../components/SectionNav";
import { TrashIcon } from "../components/Icons";
import { useAuth } from "../auth/AuthContext";
import { usePermissions } from "../api/permissions";
import { useRecordRecentlyViewed } from "../hooks/useRecentlyViewed";
import { useAiTypeLabel } from "../api/aiTypeOptions";
import { useCustomFieldDefs } from "../api/customFields";
import { ApiError } from "../api/client";
import type { RiskAssessment, SystemStatus } from "../api/types";
import { primaryButtonBase } from "../lib/ui";

const STATUS_OPTIONS: SystemStatus[] = [
  "DRAFT",
  "INTAKE",
  "RISK_ASSESSMENT",
  "UNDER_REVIEW",
  "APPROVED",
  "DEPLOYED",
  "MONITORING",
  "RETIRED",
];

export function SystemDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { has } = usePermissions();
  const { data: system, isLoading } = useSystem(id);
  useRecordRecentlyViewed(id, system?.name);
  const aiTypeLabel = useAiTypeLabel();
  const { data: customFieldDefs } = useCustomFieldDefs();
  const { data: auditLog } = useAuditLog(id);
  const { data: workPapers } = useWorkPapers(id);
  const { data: documents } = useDocuments(id);
  const startAssessment = useStartAssessment(id ?? "");
  const updateStatus = useUpdateSystemStatus(id ?? "");
  const deleteAssessment = useDeleteAssessment(id ?? "");
  const deleteSystem = useDeleteSystem();
  const [confirmDeleteAssessmentId, setConfirmDeleteAssessmentId] = useState<string | null>(null);
  const [confirmingDeleteSystem, setConfirmingDeleteSystem] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  if (isLoading || !system) {
    return <p className="text-slate-500 dark:text-slate-400">Loading system...</p>;
  }

  const latestAssessment = system.riskAssessments[0];
  const hasOpenDraft = latestAssessment && latestAssessment.status === "DRAFT";
  const hasFinalizedAssessment = system.riskAssessments.some((a) => a.status === "FINALIZED");
  const isIntakeIncomplete = system.status === "DRAFT";
  const reviewOverdue = system.nextReviewDue ? new Date(system.nextReviewDue).getTime() < Date.now() : false;
  const canManageDocs =
    !!user && has("MANAGE_DOCUMENTS") && (user.role !== "SYSTEM_OWNER" || user.id === system.ownerId);
  const canDeleteSystem =
    !!user && has("DELETE_SYSTEM") && (user.role !== "SYSTEM_OWNER" || user.id === system.ownerId);
  const customFieldValues = (() => {
    try {
      return JSON.parse(system.customFieldValues || "{}") as Record<string, string>;
    } catch {
      return {};
    }
  })();
  const populatedCustomFields = (customFieldDefs ?? []).filter((f) => customFieldValues[f.key]);

  const sectionNavItems: SectionNavItem[] = [
    { id: "section-details", label: "System Details" },
    { id: "section-intake", label: "Initial Intake and Risk Scoring" },
    ...(hasFinalizedAssessment ? [{ id: "section-workpapers", label: "Function Reviews/Workpapers" }] : []),
    ...(hasFinalizedAssessment ? [{ id: "section-committee", label: "Committee Summary" }] : []),
    { id: "section-approval", label: "Approval Chain" },
    { id: "section-documents", label: "Supporting Documents" },
    { id: "section-comments", label: "Comments" },
    { id: "section-audit", label: "Audit Log" },
  ];

  function canDeleteAssessment(a: RiskAssessment) {
    return (
      !!user &&
      has("DELETE_ASSESSMENT") &&
      (user.role !== "SYSTEM_OWNER" || (user.id === system!.ownerId && a.status === "DRAFT"))
    );
  }

  async function handleStartAssessment() {
    const created = await startAssessment.mutateAsync();
    navigate(`/systems/${id}/assessments/${created.id}`);
  }

  async function handleDeleteAssessment(assessmentId: string) {
    setDeleteError(null);
    try {
      await deleteAssessment.mutateAsync(assessmentId);
      setConfirmDeleteAssessmentId(null);
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : "Could not delete the assessment.");
    }
  }

  async function handleDeleteSystem() {
    setDeleteError(null);
    try {
      await deleteSystem.mutateAsync(id!);
      navigate("/systems");
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : "Could not delete this AI use case.");
      setConfirmingDeleteSystem(false);
    }
  }

  return (
    <div className="space-y-6">
      {isIntakeIncomplete && (
        <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm text-amber-800">This system's intake hasn't been completed yet.</p>
          <Link
            to={`/systems/${system.id}/intake`}
            className="rounded-md bg-amber-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-900"
          >
            Resume intake
          </Link>
        </div>
      )}

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{system.name}</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-400">{system.description}</p>
          <div className="mt-3 flex items-center gap-2">
            <StatusBadge status={system.status} />
            <RiskScoreBadge score={system.currentScore} />
            <ReviewTriggerBadge triggered={system.currentReviewTriggered} />
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            to={`/systems/${system.id}/export`}
            className="rounded-md border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-950"
          >
            Export Report
          </Link>
          {user && has("EDIT_SYSTEM") && (
            <Link
              to={`/systems/${system.id}/edit`}
              className="rounded-md border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-950"
            >
              Edit Details
            </Link>
          )}
        </div>
      </div>

      <SectionNav
        items={sectionNavItems}
        title={
          <>
            <span className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{system.name}</span>
            <StatusBadge status={system.status} />
          </>
        }
      />

      <div id="section-details" className="grid items-start gap-6 lg:grid-cols-3 scroll-mt-16">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">System Details</h2>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <Detail label="Use case ID" value={system.useCaseId || "—"} />
            <Detail
              label="Date submitted"
              value={system.dateSubmitted ? new Date(system.dateSubmitted).toLocaleDateString(undefined, { timeZone: "UTC" }) : "—"}
            />
            <Detail label="Application / platform" value={system.applicationName || "—"} />
            <Detail label="Vendor" value={system.vendorName || "—"} />
            <Detail label="AITO coordinator" value={system.aitoCoordinator || "—"} />
            <Detail label="AI type" value={aiTypeLabel(system.aiType)} />
            <Detail
              label="Projected cost"
              value={system.projectedCost != null ? `$${system.projectedCost.toLocaleString()}` : "—"}
            />
            <Detail label="Requesting business unit" value={system.businessUnit} />
            <Detail label="Sponsor / product owner" value={system.sponsorName || "—"} />
            <Detail label="Managed by" value={`${system.owner.name} (${system.owner.email})`} />
            <Detail label="Capability category" value={system.capabilityCategory || "—"} />
            <Detail
              label="Target deployment date"
              value={
                system.targetDeploymentDate
                  ? new Date(system.targetDeploymentDate).toLocaleDateString(undefined, { timeZone: "UTC" })
                  : "—"
              }
            />
            <Detail label="Data types used" value={system.dataTypesUsed || "—"} />
            <Detail label="Deployment context" value={system.deploymentContext || "—"} />
          </dl>
          <div className="mt-3">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">Business Justification</span>
            <p className="text-sm text-slate-700 dark:text-slate-300">{system.businessJustification || "—"}</p>
          </div>
          <div className="mt-3">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">Purpose</span>
            <p className="text-sm text-slate-700 dark:text-slate-300">{system.purpose || "—"}</p>
          </div>
          <div className="mt-3">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">Misc. Notes</span>
            <p className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">{system.notes || "—"}</p>
          </div>
          {populatedCustomFields.length > 0 && (
            <div className="mt-3 border-t border-slate-100 dark:border-slate-800 pt-3">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                Additional Information
              </span>
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                {populatedCustomFields.map((f) => (
                  <Detail key={f.id} label={f.label} value={customFieldValues[f.key]} />
                ))}
              </dl>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Status</h2>
          {user && has("CHANGE_SYSTEM_STATUS") ? (
            <select
              value={system.status}
              onChange={(e) => updateStatus.mutate(e.target.value as SystemStatus)}
              className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2 text-sm focus:border-slate-500 dark:focus:border-slate-400 focus:outline-none"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          ) : (
            <StatusBadge status={system.status} />
          )}
          <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
            Only Compliance Officers, Approvers, and Admins can change status.
          </p>

          <div className="mt-5 space-y-3 border-t border-slate-100 dark:border-slate-800 pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Quick Summary</h3>

            <SummaryRow label="Risk Score">
              <RiskScoreBadge score={system.currentScore} />
            </SummaryRow>
            {system.currentReviewTriggered && (
              <SummaryRow label="Dimension 1">
                <ReviewTriggerBadge triggered={system.currentReviewTriggered} />
              </SummaryRow>
            )}
            <SummaryRow label="Latest Assessment">
              {latestAssessment ? (
                <Link to={`/systems/${id}/assessments/${latestAssessment.id}`} className="text-sm font-medium text-slate-700 dark:text-slate-300 hover:underline">
                  v{latestAssessment.version} &middot; {latestAssessment.status === "FINALIZED" ? "Finalized" : "Draft"}
                </Link>
              ) : (
                <span className="text-sm text-slate-400 dark:text-slate-500">None yet</span>
              )}
            </SummaryRow>
            {system.nextReviewDue && (
              <SummaryRow label="Next Review Due">
                <span className={`text-sm ${reviewOverdue ? "font-medium text-red-600 dark:text-red-400" : "text-slate-700 dark:text-slate-300"}`}>
                  {reviewOverdue ? "Overdue since " : ""}
                  {new Date(system.nextReviewDue).toLocaleDateString()}
                </span>
              </SummaryRow>
            )}
            {workPapers && workPapers.length > 0 && (
              <SummaryRow label="Work Papers">
                <span className="text-sm text-slate-700 dark:text-slate-300">
                  {workPapers.filter((wp) => wp.status === "COMPLETE").length} / {workPapers.length} complete
                </span>
              </SummaryRow>
            )}
            <SummaryRow label="Business Unit">
              <span className="text-sm text-slate-700 dark:text-slate-300">{system.businessUnit || "—"}</span>
            </SummaryRow>
            <SummaryRow label="Sponsor / Owner">
              <span className="text-sm text-slate-700 dark:text-slate-300">{system.sponsorName || "—"}</span>
            </SummaryRow>
            <SummaryRow label="Documents">
              <span className="text-sm text-slate-700 dark:text-slate-300">{documents?.length ?? 0} uploaded</span>
            </SummaryRow>
            <SummaryRow label="Registered">
              <span className="text-sm text-slate-700 dark:text-slate-300">{new Date(system.createdAt).toLocaleDateString()}</span>
            </SummaryRow>
            <SummaryRow label="Last Updated">
              <span className="text-sm text-slate-700 dark:text-slate-300">{new Date(system.updatedAt).toLocaleDateString()}</span>
            </SummaryRow>
          </div>

          {system.nextReviewDue && user && has("RUN_ASSESSMENT") && !hasOpenDraft && (
            <div className="mt-4 border-t border-slate-100 dark:border-slate-800 pt-4">
              <button
                onClick={handleStartAssessment}
                disabled={startAssessment.isPending}
                className={`w-full ${primaryButtonBase} px-3 py-1.5 text-sm`}
              >
                {startAssessment.isPending ? "Starting..." : "Start Re-Assessment"}
              </button>
            </div>
          )}
        </div>
      </div>

      {deleteError && <p className="text-sm text-red-600">{deleteError}</p>}

      <div id="section-intake" className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm scroll-mt-16">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Initial Intake and Risk Scoring</h2>
          {user && has("RUN_ASSESSMENT") && !hasOpenDraft && (
            <button
              onClick={handleStartAssessment}
              disabled={startAssessment.isPending || isIntakeIncomplete}
              title={isIntakeIncomplete ? "Complete intake before starting a risk assessment" : undefined}
              className={`${primaryButtonBase} px-3 py-1.5 text-sm`}
            >
              {startAssessment.isPending ? "Starting..." : "Start New Assessment"}
            </button>
          )}
        </div>
        {system.riskAssessments.length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-slate-500">No risk assessment has been started yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {system.riskAssessments.map((a) => (
              <li key={a.id} className="flex items-center justify-between py-2 text-sm">
                <Link to={`/systems/${id}/assessments/${a.id}`} className="font-medium text-slate-800 dark:text-slate-200 hover:underline">
                  Intake &amp; Risk Scoring Report - Version {a.version} &middot; {a.status === "FINALIZED" ? "Finalized" : "Draft"}
                </Link>
                <div className="flex items-center gap-3">
                  {a.score !== null && <RiskScoreBadge score={a.score} />}
                  {a.reviewTriggered && <ReviewTriggerBadge triggered={a.reviewTriggered} />}
                  {a.status === "FINALIZED" && (
                    <Link
                      to={`/systems/${id}/assessments/${a.id}/report`}
                      className="rounded-md border border-slate-300 dark:border-slate-600 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      View Report
                    </Link>
                  )}
                  <span className="text-xs text-slate-400 dark:text-slate-500">
                    {a.assessedBy?.name}
                  </span>
                  {canDeleteAssessment(a) &&
                    (confirmDeleteAssessmentId === a.id ? (
                      <span className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleDeleteAssessment(a.id)}
                          disabled={deleteAssessment.isPending}
                          className="rounded-md bg-red-700 px-2 py-1 text-xs font-medium text-white hover:bg-red-800 disabled:opacity-50"
                        >
                          {deleteAssessment.isPending ? "Deleting..." : "Confirm"}
                        </button>
                        <button
                          onClick={() => setConfirmDeleteAssessmentId(null)}
                          className="text-xs text-slate-500 dark:text-slate-400 hover:underline"
                        >
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteAssessmentId(a.id)}
                        title="Delete this assessment"
                        className="rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 dark:text-slate-500 dark:hover:bg-red-950"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {hasFinalizedAssessment && (
        <div id="section-workpapers" className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm scroll-mt-16">
          <h2 className="mb-1 text-sm font-semibold text-slate-900 dark:text-slate-100">Function Reviews/Workpapers</h2>
          <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
            Work papers for the functional teams whose review is required, scoped from the latest finalized risk
            assessment's classification.
          </p>
          {!workPapers || workPapers.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500">
              No functions are currently in scope for this system's classification.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {workPapers.map((wp) => (
                <li key={wp.id} className="flex items-center justify-between py-2 text-sm">
                  <Link
                    to={`/systems/${id}/work-papers/${wp.id}`}
                    className="font-medium text-slate-800 dark:text-slate-200 hover:underline"
                  >
                    {wp.label}
                  </Link>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      {wp.answeredCount} / {wp.totalQuestions} answered
                    </span>
                    <WorkPaperStatusBadge status={wp.status} />
                    <Link
                      to={`/systems/${id}/work-papers/${wp.id}`}
                      className="rounded-md border border-slate-300 dark:border-slate-600 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      View Report
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {hasFinalizedAssessment && (
        <div id="section-committee" className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm scroll-mt-16">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Committee Summary</h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Consolidated committee decision, aggregating every in-scope function's work paper.
              </p>
            </div>
            <Link
              to={`/systems/${id}/committee-review`}
              className={`shrink-0 ${primaryButtonBase} px-3 py-1.5 text-xs`}
            >
              Open Committee Summary
            </Link>
          </div>
        </div>
      )}

      <div id="section-approval" className="scroll-mt-16">{id && <ApprovalStepsPanel systemId={id} />}</div>

      <div id="section-documents" className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm scroll-mt-16">
        <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Supporting Documents</h2>
        {id && <DocumentsPanel systemId={id} canManage={canManageDocs} />}
      </div>

      <div id="section-comments" className="scroll-mt-16">{id && <CommentsPanel systemId={id} />}</div>

      <div id="section-audit" className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm scroll-mt-16">
        <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-100">Audit Log</h2>
        <AuditLogPanel logs={auditLog} />
      </div>

      {canDeleteSystem && (
        <div className="space-y-3 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 p-5">
          <h2 className="text-sm font-semibold text-red-900 dark:text-red-300">Danger Zone</h2>
          <p className="text-sm text-red-800 dark:text-red-400">
            Permanently deletes this AI use case along with all of its risk assessments, function work papers,
            supporting documents, and audit history. This cannot be undone.
          </p>
          {!confirmingDeleteSystem ? (
            <button
              onClick={() => setConfirmingDeleteSystem(true)}
              className="rounded-md border border-red-300 dark:border-red-800 bg-white dark:bg-slate-900 px-4 py-2 text-sm font-medium text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900"
            >
              Delete This AI Use Case
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <button
                onClick={handleDeleteSystem}
                disabled={deleteSystem.isPending}
                className="rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-50"
              >
                {deleteSystem.isPending ? "Deleting..." : `Yes, permanently delete "${system.name}"`}
              </button>
              <button
                onClick={() => setConfirmingDeleteSystem(false)}
                className="text-sm font-medium text-red-700 dark:text-red-400 hover:underline"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">{label}</dt>
      <dd className="text-slate-700 dark:text-slate-300">{value}</dd>
    </div>
  );
}

function SummaryRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
      {children}
    </div>
  );
}
