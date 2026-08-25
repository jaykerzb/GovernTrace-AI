import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  useAssessments,
  useClassificationOptions,
  useDeleteAssessment,
  useFinalizeAssessment,
  useQuestionnaire,
  useSaveAssessmentAnswers,
} from "../api/assessments";
import { useSystem } from "../api/systems";
import { useOrgSettings } from "../api/orgSettings";
import { useAuth } from "../auth/AuthContext";
import { usePermissions } from "../api/permissions";
import { RiskScoreBadge, ReviewTriggerBadge } from "../components/Badges";
import { SectionNav, type SectionNavItem } from "../components/SectionNav";
import { ApiError } from "../api/client";
import type { Question } from "../api/types";

// Mirrors server/src/services/riskQuestionnaire.ts suggestCapabilityTier —
// suggests a tier from Decision Autonomy (and the Dimension 1 full-autonomy
// gate, which forces T4). Purely additive/advisory; the user can override.
function suggestCapabilityTier(answers: Record<string, string>, dimension2: Question[]): string | null {
  if (answers["d1_full_autonomy"] === "Yes") return "T4";
  const q = dimension2.find((d) => d.id === "d2_decision_autonomy");
  if (!q) return null;
  const chosen = q.options.findIndex((o) => o.label === answers["d2_decision_autonomy"]);
  if (chosen === 0) return "T1";
  if (chosen === 1) return "T3";
  if (chosen === 2) return "T4";
  return null;
}

// Mirrors server/src/services/riskQuestionnaire.ts suggestRiskFactors.
function suggestRiskFactors(answers: Record<string, string>, dimension2: Question[]): number[] {
  const suggested = new Set<number>();
  if (answers["d1_customer_facing"] === "Yes") suggested.add(2);
  if (answers["d1_regulated_decisions"] === "Yes") suggested.add(10);
  if (answers["d1_vendor_training_data"] === "Yes") suggested.add(4);
  if (answers["d1_full_autonomy"] === "Yes") suggested.add(5);

  const highestOptionChosen = (questionId: string) => {
    const q = dimension2.find((d) => d.id === questionId);
    if (!q) return false;
    return q.options[q.options.length - 1]?.label === answers[questionId];
  };
  if (highestOptionChosen("d2_data_sensitivity")) suggested.add(1);
  if (highestOptionChosen("d2_external_interaction")) suggested.add(2);
  if (highestOptionChosen("d2_business_impact")) suggested.add(10);

  return Array.from(suggested).sort((a, b) => a - b);
}

export function RiskAssessmentPage() {
  const { systemId, assessmentId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { has } = usePermissions();
  const { data: questions } = useQuestionnaire();
  const { data: classificationOptions } = useClassificationOptions();
  const { data: assessments } = useAssessments(systemId);
  const { data: system } = useSystem(systemId);
  const { data: orgSettings } = useOrgSettings();
  const threshold = orgSettings?.approvalThreshold ?? 30;
  const assessment = assessments?.find((a) => a.id === assessmentId);

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [deliveryModel, setDeliveryModel] = useState<string | null>(null);
  const [capabilityTier, setCapabilityTier] = useState<string | null>(null);
  const [riskFactors, setRiskFactors] = useState<number[]>([]);
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const saveAnswers = useSaveAssessmentAnswers(assessmentId ?? "", systemId ?? "");
  const finalize = useFinalizeAssessment(assessmentId ?? "", systemId ?? "");
  const deleteAssessment = useDeleteAssessment(systemId ?? "");

  useEffect(() => {
    if (assessment && !initialized) {
      try {
        setAnswers(JSON.parse(assessment.answers || "{}"));
      } catch {
        setAnswers({});
      }
      setDeliveryModel(assessment.deliveryModel);
      setCapabilityTier(assessment.capabilityTier);
      try {
        setRiskFactors(assessment.riskFactors ? JSON.parse(assessment.riskFactors) : []);
      } catch {
        setRiskFactors([]);
      }
      setInitialized(true);
    }
  }, [assessment, initialized]);

  const dimension1 = useMemo(() => (questions ?? []).filter((q) => q.dimension === 1).sort((a, b) => a.order - b.order), [questions]);
  const dimension2 = useMemo(() => (questions ?? []).filter((q) => q.dimension === 2).sort((a, b) => a.order - b.order), [questions]);

  const suggestedTier = useMemo(() => suggestCapabilityTier(answers, dimension2), [answers, dimension2]);
  const effectiveTier = capabilityTier ?? suggestedTier;
  const autoRiskFactors = useMemo(() => suggestRiskFactors(answers, dimension2), [answers, dimension2]);

  // Auto-suggested risk factors are additive: newly-triggered ones get
  // checked automatically, but the user can uncheck any of them afterward.
  useEffect(() => {
    setRiskFactors((prev) => {
      const missing = autoRiskFactors.filter((rf) => !prev.includes(rf));
      return missing.length ? [...prev, ...missing].sort((a, b) => a - b) : prev;
    });
  }, [autoRiskFactors]);

  const maxScore = dimension2.length * 5;
  const currentScore = useMemo(() => {
    let total = 0;
    for (const q of dimension2) {
      const chosen = q.options.find((o) => o.label === answers[q.id]);
      if (chosen) total += chosen.points;
    }
    return total;
  }, [dimension2, answers]);

  const currentReviewTriggered = useMemo(
    () =>
      dimension1.some((q) => {
        const option = q.options.find((o) => o.label === answers[q.id]);
        return !!option && option.points > 0;
      }),
    [dimension1, answers]
  );

  const answeredCount = questions ? questions.filter((q) => answers[q.id]).length : 0;
  const allAnswered = questions ? answeredCount === questions.length : false;
  const isFinalized = assessment?.status === "FINALIZED";

  if (!assessment || !questions) {
    return <p className="text-slate-500 dark:text-slate-400">Loading assessment...</p>;
  }

  const canDelete =
    !!user &&
    has("DELETE_ASSESSMENT") &&
    (user.role !== "SYSTEM_OWNER" || (system?.ownerId === user.id && assessment.status === "DRAFT"));

  async function handleSave() {
    setError(null);
    try {
      await saveAnswers.mutateAsync({ answers, deliveryModel, capabilityTier: effectiveTier, riskFactors });
    } catch {
      setError("Could not save answers. Please try again.");
    }
  }

  async function handleFinalize() {
    setError(null);
    try {
      await handleSave();
      await finalize.mutateAsync();
      navigate(`/systems/${systemId}/assessments/${assessmentId}/report`);
    } catch {
      setError("Could not finalize the assessment. Please try again.");
    }
  }

  async function handleDelete() {
    setError(null);
    try {
      await deleteAssessment.mutateAsync(assessment!.id);
      navigate(`/systems/${systemId}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete the assessment. Please try again.");
      setConfirmingDelete(false);
    }
  }

  const displayedTriggered = isFinalized ? assessment.reviewTriggered : currentReviewTriggered;

  const sectionNavItems: SectionNavItem[] = [
    { id: "section-dimension1", label: "Dimension 1" },
    { id: "section-dimension2", label: "Dimension 2" },
    { id: "section-classification", label: "Classification" },
    { id: "section-score", label: "Risk Score" },
  ];

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Risk Assessment v{assessment.version}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Dimension 1 (trigger questions) and Dimension 2 (risk scoring).
          </p>
        </div>
        <div className="text-right">
          <div className="mb-1 flex items-center justify-end gap-2">
            <RiskScoreBadge score={isFinalized ? assessment.score : currentScore} />
            <ReviewTriggerBadge triggered={displayedTriggered ?? false} />
          </div>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            {isFinalized ? "Final" : "Live preview"} Dimension 2 score: {isFinalized ? assessment.score : currentScore} /{" "}
            {maxScore}
          </p>
        </div>
      </div>

      <SectionNav
        items={sectionNavItems}
        title={
          <>
            <span className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
              Risk Assessment v{assessment.version}
            </span>
            <RiskScoreBadge score={isFinalized ? assessment.score : currentScore} />
          </>
        }
      />

      {isFinalized && (
        <div className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 text-sm text-slate-600 dark:text-slate-400">
          <span>This assessment was finalized and can no longer be edited. Start a new version from the system page to reassess.</span>
          <Link
            to={`/systems/${systemId}/assessments/${assessmentId}/report`}
            className="ml-3 shrink-0 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            View Report
          </Link>
        </div>
      )}

      <div id="section-dimension1" className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm scroll-mt-16">
        <h2 className="mb-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
          Dimension 1 — Trigger Questions
        </h2>
        <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
          Informational only for now — a "Yes" answer flags the system for additional review but doesn't change the
          Dimension 2 score or block anything.
        </p>
        <div className="space-y-4">
          {dimension1.map((q, i) => (
            <div key={q.id}>
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                {i + 1}. {q.text}
              </p>
              {q.helpText && <p className="mb-2 text-xs text-slate-400 dark:text-slate-500">{q.helpText}</p>}
              <div className="flex gap-2">
                {q.options.map((opt) => (
                  <label
                    key={opt.label}
                    className={`flex cursor-pointer items-center gap-2 rounded-md border px-4 py-1.5 text-sm ${
                      answers[q.id] === opt.label
                        ? "border-slate-900 dark:border-slate-100 bg-slate-50 dark:bg-slate-800"
                        : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-950"
                    } ${isFinalized ? "cursor-not-allowed opacity-70" : ""}`}
                  >
                    <input
                      type="radio"
                      name={q.id}
                      disabled={isFinalized}
                      checked={answers[q.id] === opt.label}
                      onChange={() => setAnswers((a) => ({ ...a, [q.id]: opt.label }))}
                    />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div id="section-dimension2" className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm scroll-mt-16">
        <h2 className="mb-1 text-sm font-semibold text-slate-900 dark:text-slate-100">Dimension 2 — Risk Scoring</h2>
        <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
          Scores at or below {threshold} follow standard approval. Above {threshold}, additional approval is required.
        </p>
        <div className="space-y-5">
          {dimension2.map((q) => (
            <div key={q.id}>
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                {q.order}. {q.text}
              </p>
              <p className="mb-2 text-xs text-slate-400 dark:text-slate-500">{q.helpText}</p>
              <div className="space-y-1.5">
                {q.options.map((opt) => {
                  const selected = answers[q.id] === opt.label;
                  return (
                    <label
                      key={opt.label}
                      className={`flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2 text-sm ${
                        selected
                          ? "border-slate-900 dark:border-slate-100 bg-slate-50 dark:bg-slate-800"
                          : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-950"
                      } ${isFinalized ? "cursor-not-allowed opacity-70" : ""}`}
                    >
                      <input
                        type="radio"
                        name={q.id}
                        disabled={isFinalized}
                        checked={selected}
                        onChange={() => setAnswers((a) => ({ ...a, [q.id]: opt.label }))}
                        className="mt-0.5"
                      />
                      <span>
                        {opt.label} <span className="text-xs text-slate-400 dark:text-slate-500">({opt.points} pts)</span>
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div id="section-classification" className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm scroll-mt-16">
        <h2 className="mb-1 text-sm font-semibold text-slate-900 dark:text-slate-100">Classification</h2>
        <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
          Delivery Model, Capability Tier, and Risk Factors used to scope any downstream functional review. Capability
          Tier and Risk Factors are suggested from the answers above but can be overridden.
        </p>
        <div className="mb-5 grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Delivery Model</label>
            <select
              disabled={isFinalized}
              value={(isFinalized ? assessment.deliveryModel : deliveryModel) ?? ""}
              onChange={(e) => setDeliveryModel(e.target.value || null)}
              className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 disabled:opacity-70"
            >
              <option value="">— Select —</option>
              {(classificationOptions?.deliveryModels ?? []).map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
              Capability Tier
              {!isFinalized && capabilityTier === null && suggestedTier && (
                <span className="ml-1 font-normal text-amber-600 dark:text-amber-400">(suggested)</span>
              )}
            </label>
            <select
              disabled={isFinalized}
              value={(isFinalized ? assessment.capabilityTier : effectiveTier) ?? ""}
              onChange={(e) => setCapabilityTier(e.target.value || null)}
              className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-800 dark:text-slate-200 disabled:opacity-70"
            >
              <option value="">— Select —</option>
              {(classificationOptions?.capabilityTiers ?? []).map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="mb-2 block text-xs font-medium text-slate-500 dark:text-slate-400">Risk Factors</label>
          <div className="grid gap-2 sm:grid-cols-2">
            {(classificationOptions?.riskFactors ?? []).map((rf) => {
              const activeList = isFinalized ? JSON.parse(assessment.riskFactors || "[]") : riskFactors;
              const checked = activeList.includes(rf.id);
              const isAuto = autoRiskFactors.includes(rf.id);
              return (
                <label
                  key={rf.id}
                  title={rf.description}
                  className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm ${
                    checked
                      ? isAuto
                        ? "border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950"
                        : "border-slate-900 dark:border-slate-100 bg-slate-50 dark:bg-slate-800"
                      : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-950"
                  } ${isFinalized ? "cursor-not-allowed opacity-70" : ""}`}
                >
                  <input
                    type="checkbox"
                    disabled={isFinalized}
                    checked={checked}
                    onChange={(e) =>
                      setRiskFactors((prev) => (e.target.checked ? [...prev, rf.id].sort((a, b) => a - b) : prev.filter((x) => x !== rf.id)))
                    }
                  />
                  <span className="flex-1">
                    <span className="font-medium text-slate-700 dark:text-slate-300">RF{rf.id}</span> {rf.label}
                  </span>
                  {isAuto && (
                    <span className="rounded-full bg-amber-200 dark:bg-amber-800 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:text-amber-200">
                      AUTO
                    </span>
                  )}
                </label>
              );
            })}
          </div>
        </div>
      </div>

      <div id="section-score" className="rounded-xl border-2 border-slate-900 dark:border-slate-100 bg-white dark:bg-slate-900 p-5 shadow-sm scroll-mt-16">
        <h2 className="mb-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
          {isFinalized ? "Final Risk Score" : "Risk Score (Live Calculation)"}
        </h2>
        <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
          {isFinalized
            ? "This is the score this assessment was finalized with."
            : "Updates automatically as Dimension 2 answers change below — this is what will be recorded when finalized."}
        </p>
        <div className="flex flex-wrap items-center gap-8">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
              Total score
            </div>
            <div className="text-3xl font-bold text-slate-900 dark:text-slate-100">
              {isFinalized ? assessment.score : currentScore}
              <span className="text-base font-normal text-slate-400 dark:text-slate-500"> / {maxScore}</span>
            </div>
          </div>
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
              Risk Rating
            </div>
            <div className="mt-1.5">
              <RiskScoreBadge score={isFinalized ? assessment.score : currentScore} />
            </div>
          </div>
          {displayedTriggered && (
            <div>
              <div className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
                Dimension 1
              </div>
              <div className="mt-1.5">
                <ReviewTriggerBadge triggered={displayedTriggered} />
              </div>
            </div>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {(canDelete || !isFinalized) && (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
        <div>
          {canDelete &&
            (confirmingDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-red-700 dark:text-red-400">Delete this assessment?</span>
                <button
                  onClick={handleDelete}
                  disabled={deleteAssessment.isPending}
                  className="rounded-md bg-red-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-50"
                >
                  {deleteAssessment.isPending ? "Deleting..." : "Yes, delete"}
                </button>
                <button
                  onClick={() => setConfirmingDelete(false)}
                  className="text-sm font-medium text-slate-500 dark:text-slate-400 hover:underline"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmingDelete(true)}
                className="rounded-md border border-red-200 dark:border-red-900 px-3 py-1.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950"
              >
                Delete Assessment
              </button>
            ))}
        </div>

        {!isFinalized && (
          <div className="flex items-center gap-3">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {answeredCount} / {questions.length} questions answered
            </p>
            <button
              onClick={handleSave}
              disabled={saveAnswers.isPending}
              className="rounded-md border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-950 disabled:opacity-50"
            >
              {saveAnswers.isPending ? "Saving..." : "Save Draft"}
            </button>
            {user && has("FINALIZE_ASSESSMENT") && (
              <button
                onClick={handleFinalize}
                disabled={!allAnswered || finalize.isPending}
                title={!allAnswered ? "Answer all questions before finalizing" : undefined}
                className="rounded-md bg-slate-900 dark:bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 dark:hover:bg-slate-600 disabled:opacity-50"
              >
                {finalize.isPending ? "Finalizing..." : "Finalize Assessment"}
              </button>
            )}
          </div>
        )}
      </div>
      )}
    </div>
  );
}
