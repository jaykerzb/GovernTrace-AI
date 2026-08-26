import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useCommitteeReview, useFinalizeCommitteeReview, useReopenCommitteeReview, useSaveCommitteeReview } from "../api/committeeReview";
import { useSystem } from "../api/systems";
import { useAuth } from "../auth/AuthContext";
import { usePermissions } from "../api/permissions";
import { WorkPaperStatusBadge } from "../components/Badges";
import { SectionNav, type SectionNavItem } from "../components/SectionNav";
import { ApiError } from "../api/client";
import type { FinalDisposition } from "../api/types";
import { primaryButtonBase, inputClass } from "../lib/ui";

const DISPOSITION_LABELS: Record<FinalDisposition, string> = {
  APPROVED: "Approved",
  APPROVED_WITH_CONDITIONS: "Approved with Conditions",
  NOT_APPROVED: "Not Approved",
  DEFERRED: "Deferred",
  REMANDED: "Remanded for Additional Review",
};
const DISPOSITIONS = Object.keys(DISPOSITION_LABELS) as FinalDisposition[];

const RATING_STYLES: Record<string, string> = {
  Low: "border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300",
  Moderate: "border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-300",
  High: "border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-950 text-orange-800 dark:text-orange-300",
  Critical: "border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950 text-red-800 dark:text-red-300",
};

const RECOMMENDATION_LABELS: Record<string, string> = {
  NO_OBJECTION: "No Objection",
  APPROVE_WITH_CONDITIONS: "Approve with Conditions",
  OBJECTION: "Objection",
  DEFERRED: "Deferred",
};


function SectionHeader({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-5 border-b border-slate-100 dark:border-slate-800 pb-3">
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
      {hint && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>
      {children}
    </div>
  );
}

export function CommitteeSummaryPage() {
  const { systemId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { has } = usePermissions();
  const { data: system } = useSystem(systemId);
  const { data: review } = useCommitteeReview(systemId);

  const [conflicts, setConflicts] = useState("");
  const [discussion, setDiscussion] = useState("");
  const [disposition, setDisposition] = useState<FinalDisposition | null>(null);
  const [justification, setJustification] = useState("");
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = useSaveCommitteeReview(review?.id ?? "", systemId ?? "");
  const finalize = useFinalizeCommitteeReview(review?.id ?? "", systemId ?? "");
  const reopen = useReopenCommitteeReview(review?.id ?? "", systemId ?? "");

  useEffect(() => {
    if (review && !initialized) {
      setConflicts(review.crossFunctionalConflicts ?? "");
      setDiscussion(review.committeeDiscussion ?? "");
      setDisposition(review.finalDisposition);
      setJustification(review.decisionJustification ?? "");
      setInitialized(true);
    }
  }, [review, initialized]);

  if (!system || !review) {
    return <p className="text-slate-500 dark:text-slate-400">Loading committee summary...</p>;
  }

  const isFinalized = review.status === "FINALIZED";
  const canEdit = !!user && has("MANAGE_COMMITTEE_REVIEW");
  const locked = isFinalized || !canEdit;
  const incompleteWorkPapers = review.workPapers.filter((wp) => wp.status !== "COMPLETE");
  const canFinalize = !!disposition;

  const sectionNavItems: SectionNavItem[] = [
    { id: "section-ratings", label: "Section Ratings Summary" },
    { id: "section-conflicts", label: "Cross-Functional Conflicts" },
    { id: "section-discussion", label: "Committee Discussion" },
    { id: "section-disposition", label: "Final Disposition" },
  ];

  async function handleSave() {
    setError(null);
    try {
      await save.mutateAsync({
        crossFunctionalConflicts: conflicts,
        committeeDiscussion: discussion,
        finalDisposition: disposition,
        decisionJustification: justification,
      });
    } catch {
      setError("Could not save. Please try again.");
    }
  }

  async function handleFinalize() {
    setError(null);
    try {
      await handleSave();
      await finalize.mutateAsync();
      navigate(`/systems/${systemId}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not finalize the committee summary.");
    }
  }

  async function handleReopen() {
    setError(null);
    try {
      await reopen.mutateAsync();
    } catch {
      setError("Could not reopen the committee summary.");
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link to={`/systems/${systemId}`} className="text-xs text-slate-400 hover:underline dark:text-slate-500">
        &larr; Back to System
      </Link>

      <div className="mb-6 mt-1 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Committee Summary</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {system.name} &middot; Consolidated committee review — your changes save when you click Save.
          </p>
        </div>
        <span
          className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
            isFinalized ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
          }`}
        >
          {isFinalized ? "Finalized" : "Draft"}
        </span>
      </div>

      <div className="space-y-6">
        <SectionNav
          items={sectionNavItems}
          title={
            <>
              <span className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">Committee Summary</span>
              <span
                className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                  isFinalized ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                }`}
              >
                {isFinalized ? "Finalized" : "Draft"}
              </span>
            </>
          }
        />

        {isFinalized && (
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 text-sm text-slate-600 dark:text-slate-400">
            This committee summary is finalized and can no longer be edited.
            {canEdit && (
              <button onClick={handleReopen} disabled={reopen.isPending} className="ml-2 font-medium text-slate-800 dark:text-slate-200 hover:underline">
                {reopen.isPending ? "Reopening..." : "Reopen to Edit"}
              </button>
            )}
          </div>
        )}

        <section id="section-ratings" className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm scroll-mt-16">
          <SectionHeader title="Section Ratings Summary" hint="Pulled live from each function's work paper. Complete a work paper to update its result here." />
          {review.workPapers.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500">No functions are in scope for this system.</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {review.workPapers.map((wp) => (
                <li key={wp.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <Link to={`/systems/${systemId}/work-papers/${wp.id}`} className="font-medium text-slate-800 dark:text-slate-200 hover:underline">
                    {wp.label}
                  </Link>
                  <div className="flex items-center gap-2">
                    {wp.compositeRiskRating && (
                      <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${RATING_STYLES[wp.compositeRiskRating]}`}>
                        {wp.compositeRiskRating}
                      </span>
                    )}
                    {wp.overallRecommendation && (
                      <span className="rounded-full border border-slate-200 dark:border-slate-700 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                        {RECOMMENDATION_LABELS[wp.overallRecommendation]}
                      </span>
                    )}
                    <WorkPaperStatusBadge status={wp.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section id="section-conflicts" className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm scroll-mt-16">
          <SectionHeader title="Cross-Functional Conflicts and Notes" hint="Document any conflicting assessments between functions, unresolved dependencies, or escalations." />
          <Field label="Conflicts / Notes">
            <textarea
              value={conflicts}
              disabled={locked}
              onChange={(e) => setConflicts(e.target.value)}
              rows={3}
              placeholder="If none, note 'No cross-functional conflicts identified.'"
              className={inputClass}
            />
          </Field>
        </section>

        <section id="section-discussion" className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm scroll-mt-16">
          <SectionHeader title="Committee Discussion Summary" hint="Notes from committee discussion of the use case." />
          <Field label="Discussion Summary">
            <textarea
              value={discussion}
              disabled={locked}
              onChange={(e) => setDiscussion(e.target.value)}
              rows={3}
              placeholder="Notes from committee discussion of the use case."
              className={inputClass}
            />
          </Field>
        </section>

        <section id="section-disposition" className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm scroll-mt-16">
          <SectionHeader title="Final Disposition" hint="The committee's decision for this AI use case." />
          <div className="flex flex-wrap gap-2">
            {DISPOSITIONS.map((d) => (
              <button
                key={d}
                type="button"
                disabled={locked}
                onClick={() => setDisposition(d)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
                  disposition === d
                    ? "border-slate-900 dark:border-slate-100 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    : "border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-950"
                } ${locked ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}
              >
                {DISPOSITION_LABELS[d]}
              </button>
            ))}
          </div>

          <div className="mt-4">
            <Field label="Decision Justification">
              <textarea
                value={justification}
                disabled={locked}
                onChange={(e) => setJustification(e.target.value)}
                rows={3}
                placeholder="Explain the rationale behind the committee's disposition for this AI use case."
                className={inputClass}
              />
            </Field>
          </div>

          {review.finalizedBy && (
            <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">
              Finalized by {review.finalizedBy.name}
              {review.finalizedAt && ` on ${new Date(review.finalizedAt).toLocaleString()}`}
            </p>
          )}
        </section>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {!isFinalized && canEdit && (
          <div className="flex flex-wrap items-center justify-end gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
            {incompleteWorkPapers.length > 0 && (
              <p className="text-sm text-amber-600 dark:text-amber-400">
                {incompleteWorkPapers.length} work paper(s) still incomplete — you can still finalize.
              </p>
            )}
            <button
              onClick={handleSave}
              disabled={save.isPending}
              className="rounded-md border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-950 disabled:opacity-50"
            >
              {save.isPending ? "Saving..." : "Save"}
            </button>
            <button
              onClick={handleFinalize}
              disabled={!canFinalize || finalize.isPending}
              title={!canFinalize ? "A final disposition must be selected" : undefined}
              className={`${primaryButtonBase} px-4 py-2 text-sm`}
            >
              {finalize.isPending ? "Finalizing..." : "Finalize Committee Summary"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
