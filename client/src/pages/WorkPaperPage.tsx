import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useCompleteWorkPaper, useReopenWorkPaper, useSaveWorkPaper, useWorkPaper } from "../api/workPapers";
import { useAuth } from "../auth/AuthContext";
import { usePermissions } from "../api/permissions";
import { WorkPaperStatusBadge } from "../components/Badges";
import { SectionNav, type SectionNavItem } from "../components/SectionNav";
import { ApiError } from "../api/client";
import type { CompositeRiskRating, OverallRecommendation, SectionData, SectionRiskRating } from "../api/types";
import { primaryButtonBase } from "../lib/ui";

const ANSWER_OPTIONS = ["Yes", "No", "N/A"] as const;
const SECTION_RISK_RATINGS: SectionRiskRating[] = ["Low", "Moderate", "High", "Critical", "N/A"];
const COMPOSITE_RISK_RATINGS: CompositeRiskRating[] = ["Low", "Moderate", "High", "Critical"];

const RECOMMENDATION_LABELS: Record<OverallRecommendation, string> = {
  NO_OBJECTION: "No Objection",
  APPROVE_WITH_CONDITIONS: "Approve with Conditions",
  OBJECTION: "Objection",
  DEFERRED: "Deferred",
};
const RECOMMENDATIONS = Object.keys(RECOMMENDATION_LABELS) as OverallRecommendation[];

const RATING_PILL_STYLES: Record<string, string> = {
  Low: "border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300",
  Moderate: "border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-300",
  High: "border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-950 text-orange-800 dark:text-orange-300",
  Critical: "border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950 text-red-800 dark:text-red-300",
  "N/A": "border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300",
};

export function WorkPaperPage() {
  const { systemId, workPaperId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { has } = usePermissions();
  const { data: workPaper } = useWorkPaper(workPaperId);

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [questionNotes, setQuestionNotes] = useState<Record<string, string>>({});
  const [sectionData, setSectionData] = useState<Record<string, SectionData>>({});
  const [compositeRiskRating, setCompositeRiskRating] = useState<CompositeRiskRating | null>(null);
  const [overallRecommendation, setOverallRecommendation] = useState<OverallRecommendation | null>(null);
  const [keyFindings, setKeyFindings] = useState("");
  const [rationale, setRationale] = useState("");
  const [reviewerName, setReviewerName] = useState("");
  const [reviewerTitle, setReviewerTitle] = useState("");
  const [reviewerDate, setReviewerDate] = useState("");
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = useSaveWorkPaper(workPaperId ?? "", systemId ?? "");
  const complete = useCompleteWorkPaper(workPaperId ?? "", systemId ?? "");
  const reopen = useReopenWorkPaper(workPaperId ?? "", systemId ?? "");

  useEffect(() => {
    if (workPaper && !initialized) {
      try {
        setAnswers(JSON.parse(workPaper.answers || "{}"));
      } catch {
        setAnswers({});
      }
      try {
        setQuestionNotes(JSON.parse(workPaper.questionNotes || "{}"));
      } catch {
        setQuestionNotes({});
      }
      try {
        setSectionData(JSON.parse(workPaper.sectionData || "{}"));
      } catch {
        setSectionData({});
      }
      setCompositeRiskRating(workPaper.compositeRiskRating);
      setOverallRecommendation(workPaper.overallRecommendation);
      setKeyFindings(workPaper.keyFindings ?? "");
      setRationale(workPaper.rationale ?? "");
      setReviewerName(workPaper.reviewerName ?? "");
      setReviewerTitle(workPaper.reviewerTitle ?? "");
      setReviewerDate(workPaper.reviewerDate ? workPaper.reviewerDate.slice(0, 10) : "");
      setInitialized(true);
    }
  }, [workPaper, initialized]);

  if (!workPaper) {
    return <p className="text-slate-500 dark:text-slate-400">Loading work paper...</p>;
  }

  const isComplete = workPaper.status === "COMPLETE";
  const canEdit = !!user && has("MANAGE_WORK_PAPERS");
  const locked = isComplete || !canEdit;
  const questionIds = workPaper.sections.flatMap((s) => s.questions.map((q) => q.id));
  const answeredCount = questionIds.filter((qid) => answers[qid]).length;
  const allAnswered = questionIds.length > 0 && answeredCount === questionIds.length;
  const allSectionsRated = workPaper.sections.every((s) => sectionData[s.id]?.riskRating);
  const canComplete = allAnswered && allSectionsRated && !!compositeRiskRating;

  const sectionNavItems: SectionNavItem[] = [
    ...workPaper.sections.map((s) => ({ id: `section-wp-${s.id}`, label: s.title })),
    { id: "section-summary", label: "Assessment Summary" },
  ];

  function updateSection(sectionId: string, patch: Partial<SectionData>) {
    setSectionData((d) => ({ ...d, [sectionId]: { ...d[sectionId], ...patch } }));
  }

  async function handleSave() {
    setError(null);
    try {
      await save.mutateAsync({
        answers,
        questionNotes,
        sectionData,
        compositeRiskRating,
        overallRecommendation,
        keyFindings,
        rationale,
        reviewerName,
        reviewerTitle,
        reviewerDate: reviewerDate || null,
      });
    } catch {
      setError("Could not save this work paper. Please try again.");
    }
  }

  async function handleComplete() {
    setError(null);
    try {
      await handleSave();
      await complete.mutateAsync();
      navigate(`/systems/${systemId}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not mark this work paper complete.");
    }
  }

  async function handleReopen() {
    setError(null);
    try {
      await reopen.mutateAsync();
    } catch {
      setError("Could not reopen this work paper.");
    }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link to={`/systems/${systemId}`} className="text-xs text-slate-400 hover:underline dark:text-slate-500">
          &larr; Back to System
        </Link>
        <div className="mt-1 flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{workPaper.label} Work Paper</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Sections and questions in scope for this system's Delivery Model / Capability Tier / Risk Factor classification.
            </p>
          </div>
          <WorkPaperStatusBadge status={workPaper.status} />
        </div>
      </div>

      <SectionNav
        items={sectionNavItems}
        title={
          <>
            <span className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{workPaper.label} Work Paper</span>
            <WorkPaperStatusBadge status={workPaper.status} />
          </>
        }
      />

      {isComplete && (
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 text-sm text-slate-600 dark:text-slate-400">
          This work paper is marked complete and can no longer be edited.
          {canEdit && (
            <button onClick={handleReopen} disabled={reopen.isPending} className="ml-2 font-medium text-slate-800 dark:text-slate-200 hover:underline">
              {reopen.isPending ? "Reopening..." : "Reopen to Edit"}
            </button>
          )}
        </div>
      )}

      {workPaper.sections.length === 0 ? (
        <p className="text-sm text-slate-400 dark:text-slate-500">No sections are currently in scope.</p>
      ) : (
        workPaper.sections.map((section) => {
          const sd = sectionData[section.id] ?? {};
          return (
            <div
              key={section.id}
              id={`section-wp-${section.id}`}
              className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm scroll-mt-16"
            >
              <h2 className="mb-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{section.title}</h2>
              <p className="mb-4 text-xs italic text-slate-400 dark:text-slate-500">{section.triggerLabel}</p>
              <div className="space-y-5">
                {section.questions.map((q, i) => (
                  <div key={q.id}>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                      {i + 1}. {q.text}
                    </p>
                    {q.citation && <p className="mb-2 text-xs text-slate-400 dark:text-slate-500">{q.citation}</p>}
                    <div className="mb-2 flex gap-2">
                      {ANSWER_OPTIONS.map((opt) => (
                        <label
                          key={opt}
                          className={`flex cursor-pointer items-center gap-2 rounded-md border px-4 py-1.5 text-sm ${
                            answers[q.id] === opt
                              ? "border-slate-900 dark:border-slate-100 bg-slate-50 dark:bg-slate-800"
                              : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-950"
                          } ${locked ? "cursor-not-allowed opacity-70" : ""}`}
                        >
                          <input
                            type="radio"
                            name={q.id}
                            disabled={locked}
                            checked={answers[q.id] === opt}
                            onChange={() => setAnswers((a) => ({ ...a, [q.id]: opt }))}
                          />
                          <span>{opt}</span>
                        </label>
                      ))}
                    </div>
                    <textarea
                      value={questionNotes[q.id] ?? ""}
                      disabled={locked}
                      onChange={(e) => setQuestionNotes((n) => ({ ...n, [q.id]: e.target.value }))}
                      rows={2}
                      placeholder="Evidence / Notes..."
                      className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-sm text-slate-800 dark:text-slate-200 disabled:opacity-70"
                    />
                  </div>
                ))}
              </div>

              <div className="mt-5 space-y-3 border-t border-slate-100 dark:border-slate-800 pt-4">
                <SectionTextField label="Findings / Observations" value={sd.findings} disabled={locked} onChange={(v) => updateSection(section.id, { findings: v })} />
                <SectionTextField label="Identified Risks" value={sd.identifiedRisks} disabled={locked} onChange={(v) => updateSection(section.id, { identifiedRisks: v })} />
                <SectionTextField label="Mitigating Controls" value={sd.mitigatingControls} disabled={locked} onChange={(v) => updateSection(section.id, { mitigatingControls: v })} />
                <SectionTextField label="Required Actions / Conditions" value={sd.requiredActions} disabled={locked} onChange={(v) => updateSection(section.id, { requiredActions: v })} />

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">Section Risk Rating</label>
                  <div className="flex flex-wrap gap-2">
                    {SECTION_RISK_RATINGS.map((r) => (
                      <button
                        key={r}
                        type="button"
                        disabled={locked}
                        onClick={() => updateSection(section.id, { riskRating: r })}
                        className={`rounded-full border px-3 py-1 text-xs font-medium ${
                          sd.riskRating === r ? RATING_PILL_STYLES[r] : "border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-950"
                        } ${locked ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })
      )}

      <div id="section-summary" className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm scroll-mt-16">
        <h2 className="mb-1 text-sm font-semibold text-slate-900 dark:text-slate-100">Assessment Summary</h2>
        <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
          Function-level synthesis across all in-scope sections.
        </p>

        <div className="mb-5">
          <label className="mb-2 block text-xs font-medium text-slate-500 dark:text-slate-400">Section Ratings Summary</label>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800 rounded-md border border-slate-200 dark:border-slate-800">
            {workPaper.sections.map((s) => {
              const rating = sectionData[s.id]?.riskRating;
              return (
                <li key={s.id} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span className="text-slate-700 dark:text-slate-300">{s.title}</span>
                  <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${rating ? RATING_PILL_STYLES[rating] : "border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500"}`}>
                    {rating ?? "Not Rated"}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="mb-5">
          <label className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">Composite Risk Rating</label>
          <div className="flex flex-wrap gap-2">
            {COMPOSITE_RISK_RATINGS.map((r) => (
              <button
                key={r}
                type="button"
                disabled={locked}
                onClick={() => setCompositeRiskRating(r)}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${
                  compositeRiskRating === r ? RATING_PILL_STYLES[r] : "border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-950"
                } ${locked ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-5">
          <label className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">Overall Recommendation</label>
          <div className="flex flex-wrap gap-2">
            {RECOMMENDATIONS.map((r) => (
              <button
                key={r}
                type="button"
                disabled={locked}
                onClick={() => setOverallRecommendation(r)}
                className={`rounded-full border px-3 py-1 text-xs font-medium ${
                  overallRecommendation === r
                    ? "border-slate-900 dark:border-slate-100 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                    : "border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-950"
                } ${locked ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}
              >
                {RECOMMENDATION_LABELS[r]}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-5">
          <label className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">Key Findings Synthesis</label>
          <textarea
            value={keyFindings}
            disabled={locked}
            onChange={(e) => setKeyFindings(e.target.value)}
            rows={4}
            placeholder="Summarize cross-section findings, themes, and material observations..."
            className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 disabled:opacity-70"
          />
        </div>

        <div className="mb-5">
          <label className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">Rationale for Recommendation</label>
          <textarea
            value={rationale}
            disabled={locked}
            onChange={(e) => setRationale(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 disabled:opacity-70"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-500 dark:text-slate-400">Reviewer Sign-Off</label>
          <p className="mb-2 text-xs text-slate-400 dark:text-slate-500">
            By signing below, the reviewer attests that the assessment was conducted in accordance with applicable standards and that the findings and recommendation reflect their professional judgment.
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <input
              value={reviewerName}
              disabled={locked}
              onChange={(e) => setReviewerName(e.target.value)}
              placeholder="Reviewer Name"
              className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 disabled:opacity-70"
            />
            <input
              value={reviewerTitle}
              disabled={locked}
              onChange={(e) => setReviewerTitle(e.target.value)}
              placeholder="Title"
              className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 disabled:opacity-70"
            />
            <input
              type="date"
              value={reviewerDate}
              disabled={locked}
              onChange={(e) => setReviewerDate(e.target.value)}
              className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 disabled:opacity-70"
            />
          </div>
        </div>

        {workPaper.reviewedBy && (
          <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">
            Marked complete by {workPaper.reviewedBy.name}
            {workPaper.completedAt && ` on ${new Date(workPaper.completedAt).toLocaleString()}`}
          </p>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {!isComplete && canEdit && (
        <div className="flex flex-wrap items-center justify-end gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {answeredCount} / {questionIds.length} questions answered
          </p>
          <button
            onClick={handleSave}
            disabled={save.isPending}
            className="rounded-md border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-950 disabled:opacity-50"
          >
            {save.isPending ? "Saving..." : "Save"}
          </button>
          <button
            onClick={handleComplete}
            disabled={!canComplete || complete.isPending}
            title={!canComplete ? "Answer all questions, rate every section, and set a composite rating before marking complete" : undefined}
            className={`${primaryButtonBase} px-4 py-2 text-sm`}
          >
            {complete.isPending ? "Completing..." : "Mark Complete"}
          </button>
        </div>
      )}
    </div>
  );
}

function SectionTextField({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: string | undefined;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">{label}</label>
      <textarea
        value={value ?? ""}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-sm text-slate-800 dark:text-slate-200 disabled:opacity-70"
      />
    </div>
  );
}
