import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useAssessments, useClassificationOptions, useQuestionnaire } from "../api/assessments";
import { useSystem } from "../api/systems";
import { useOrgSettings } from "../api/orgSettings";
import { useAiTypeLabel } from "../api/aiTypeOptions";
import { RiskScoreBadge, ReviewTriggerBadge } from "../components/Badges";
import { riskBand } from "../lib/riskBand";

export function AssessmentReportPage() {
  const { systemId, assessmentId } = useParams();
  const { data: system } = useSystem(systemId);
  const aiTypeLabel = useAiTypeLabel();
  const { data: assessments } = useAssessments(systemId);
  const { data: questions } = useQuestionnaire();
  const { data: classificationOptions } = useClassificationOptions();
  const { data: orgSettings } = useOrgSettings();
  const threshold = orgSettings?.approvalThreshold ?? 30;
  const riskThresholds = {
    riskBandLowMax: orgSettings?.riskBandLowMax ?? 15,
    riskBandModerateMax: orgSettings?.riskBandModerateMax ?? 30,
    riskBandHighMax: orgSettings?.riskBandHighMax ?? 38,
  };
  const assessment = assessments?.find((a) => a.id === assessmentId);

  const answers = useMemo<Record<string, string>>(() => {
    if (!assessment) return {};
    try {
      return JSON.parse(assessment.answers || "{}");
    } catch {
      return {};
    }
  }, [assessment]);

  const riskFactorIds = useMemo<number[]>(() => {
    if (!assessment?.riskFactors) return [];
    try {
      return JSON.parse(assessment.riskFactors);
    } catch {
      return [];
    }
  }, [assessment]);

  // Prefer the snapshot captured at finalize time, so the report always
  // shows exactly what this assessment was scored against — even if
  // questions have since been edited, reordered, or deactivated. Falls back
  // to the live questionnaire for assessments finalized before snapshotting
  // existed.
  const snapshotQuestions = useMemo(() => {
    if (!assessment?.questionsSnapshot) return null;
    try {
      return JSON.parse(assessment.questionsSnapshot) as typeof questions;
    } catch {
      return null;
    }
  }, [assessment]);
  const effectiveQuestions = snapshotQuestions ?? questions;

  const dimension1 = useMemo(
    () => (effectiveQuestions ?? []).filter((q) => q.dimension === 1).sort((a, b) => a.order - b.order),
    [effectiveQuestions]
  );
  const dimension2 = useMemo(
    () => (effectiveQuestions ?? []).filter((q) => q.dimension === 2).sort((a, b) => a.order - b.order),
    [effectiveQuestions]
  );

  if (!system || !assessment || !effectiveQuestions) {
    return <p className="text-slate-500 dark:text-slate-400">Loading report...</p>;
  }

  if (assessment.status !== "FINALIZED") {
    return (
      <div className="max-w-3xl space-y-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          This report is only available once the assessment has been finalized.
        </p>
        <Link to={`/systems/${systemId}/assessments/${assessmentId}`} className="text-sm font-medium text-slate-800 dark:text-slate-200 hover:underline">
          &larr; Back to the Assessment
        </Link>
      </div>
    );
  }

  const score = assessment.score ?? 0;
  const deliveryModelLabel = classificationOptions?.deliveryModels.find((o) => o.id === assessment.deliveryModel)?.label ?? assessment.deliveryModel;
  const capabilityTierLabel = classificationOptions?.capabilityTiers.find((o) => o.id === assessment.capabilityTier)?.label ?? assessment.capabilityTier;
  const riskFactorLabels = riskFactorIds
    .map((rfId) => classificationOptions?.riskFactors.find((rf) => rf.id === rfId))
    .filter((rf): rf is NonNullable<typeof rf> => !!rf);

  const scoreText =
    assessment.approvalAuthority === "AISC"
      ? `The Dimension 2 risk score of ${score} exceeds ${threshold}, so additional approval is required.`
      : `The Dimension 2 risk score of ${score} is at or below ${threshold}, so standard approval applies.`;
  const routingText = assessment.reviewTriggered
    ? `${scoreText} One or more Dimension 1 trigger questions were also answered "Yes" — this is informational and flags the system for additional review, but does not by itself change the approval authority.`
    : scoreText;

  return (
    <div className="max-w-3xl space-y-6 print:max-w-none print:space-y-4">
      <div className="flex items-start justify-between print:hidden">
        <Link to={`/systems/${systemId}/assessments/${assessmentId}`} className="text-xs text-slate-400 hover:underline dark:text-slate-500">
          &larr; Back to the Assessment
        </Link>
        <button
          onClick={() => window.print()}
          className="rounded-md bg-slate-900 dark:bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 dark:hover:bg-slate-600"
        >
          Print / Save as PDF
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm print:border-0 print:p-0 print:shadow-none">
        <div className="mb-1 flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">AI Use Case</p>
            <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Intake &amp; Risk Scoring Report</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {system.name} &middot; Version {assessment.version} &middot; Finalized {assessment.finalizedAt ? new Date(assessment.finalizedAt).toLocaleDateString() : ""}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <RiskScoreBadge score={assessment.score} />
            <ReviewTriggerBadge triggered={assessment.reviewTriggered} />
          </div>
        </div>

        <Section title="Use Case Identification">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <Field label="Use Case ID" value={system.useCaseId || "—"} />
            <Field
              label="Date Submitted"
              value={system.dateSubmitted ? new Date(system.dateSubmitted).toLocaleDateString(undefined, { timeZone: "UTC" }) : "—"}
            />
            <Field label="Use Case Name" value={system.name} />
            <Field label="Application / Platform" value={system.applicationName || "—"} />
            <Field label="Vendor Name" value={system.vendorName || "—"} />
            <Field label="AITO Coordinator" value={system.aitoCoordinator || "—"} />
            <Field label="AI Type" value={aiTypeLabel(system.aiType)} />
            <Field
              label="Projected Cost"
              value={system.projectedCost != null ? `$${system.projectedCost.toLocaleString()}` : "—"}
            />
            <Field label="Requesting Business Unit" value={system.businessUnit} />
            <Field label="Sponsor / Product Owner" value={system.sponsorName || "—"} />
          </dl>
        </Section>

        <Section title="Use Case Description">
          <p className="text-sm text-slate-700 dark:text-slate-300">{system.description || "—"}</p>
        </Section>

        {system.businessJustification && (
          <Section title="Business Justification">
            <p className="text-sm text-slate-700 dark:text-slate-300">{system.businessJustification}</p>
          </Section>
        )}

        {system.purpose && (
          <Section title="Purpose">
            <p className="text-sm text-slate-700 dark:text-slate-300">{system.purpose}</p>
          </Section>
        )}

        <Section
          title="Step 1: Dimension 1 — Trigger Gates"
          note="If the response to one or more of the questions below is Yes, additional review and approval is required."
        >
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 text-left text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">
                <th className="w-8 py-1.5 pr-2">#</th>
                <th className="py-1.5 pr-2">Question</th>
                <th className="w-20 py-1.5 text-right">Response</th>
              </tr>
            </thead>
            <tbody>
              {dimension1.map((q, i) => {
                const response = answers[q.id] ?? "—";
                return (
                  <tr key={q.id} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-2 pr-2 align-top text-slate-500 dark:text-slate-400">{i + 1}</td>
                    <td className="py-2 pr-2 align-top text-slate-700 dark:text-slate-300">{q.text}</td>
                    <td className={`py-2 text-right align-top font-medium ${response === "Yes" ? "text-red-600 dark:text-red-400" : "text-slate-600 dark:text-slate-400"}`}>
                      {response}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Section>

        <Section
          title="Step 2: Dimension 2 — Risk Scoring"
          note={`Scores at or below ${threshold} follow standard approval. Above ${threshold}, additional approval is required.`}
        >
          <div className="space-y-4">
            {dimension2.map((q, qi) => {
              const chosenLabel = answers[q.id];
              const chosenOption = q.options.find((o) => o.label === chosenLabel);
              return (
                <div key={q.id}>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                    {qi + 1}. {q.text}{" "}
                    <span className="font-normal text-slate-400 dark:text-slate-500">— Score: {chosenOption?.points ?? "—"}</span>
                  </p>
                  <p className="mb-1 text-xs text-slate-400 dark:text-slate-500">{q.helpText}</p>
                  <ul className="text-xs">
                    {q.options.map((opt) => {
                      const selected = opt.label === chosenLabel;
                      return (
                        <li
                          key={opt.label}
                          className={`flex items-center gap-2 rounded-md px-2 py-1 ${
                            selected
                              ? "border border-indigo-500 dark:border-indigo-400 bg-indigo-50 dark:bg-indigo-950"
                              : "border border-transparent text-slate-500 dark:text-slate-400"
                          }`}
                        >
                          <span className="inline-block w-3 shrink-0 text-indigo-600 dark:text-indigo-400">{selected ? "✓" : ""}</span>
                          <span className={`flex-1 ${selected ? "font-semibold text-indigo-950 dark:text-indigo-100" : ""}`}>{opt.label}</span>
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 font-semibold ${
                              selected ? "bg-indigo-600 text-white dark:bg-indigo-500" : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                            }`}
                          >
                            {opt.points} pts
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        </Section>

        {(assessment.deliveryModel || assessment.capabilityTier || riskFactorLabels.length > 0) && (
          <Section title="Classification">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <Field label="Delivery Model" value={deliveryModelLabel || "—"} />
              <Field label="Capability Tier" value={capabilityTierLabel || "—"} />
            </dl>
            {riskFactorLabels.length > 0 && (
              <div className="mt-2">
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">Risk Factors</p>
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  {riskFactorLabels.map((rf) => `RF${rf.id} ${rf.label}`).join(", ")}
                </p>
              </div>
            )}
          </Section>
        )}

        <Section title="Step 3: AI Use Case Risk Scoring Result">
          <div className="grid grid-cols-2 gap-4 rounded-lg bg-slate-900 dark:bg-slate-950 p-4 text-center text-white print:bg-slate-100 print:text-slate-900 print:border print:border-slate-300">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-300 print:text-slate-500">Total Score</p>
              <p className="text-2xl font-semibold">{score}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-300 print:text-slate-500">Risk Rating</p>
              <p className="text-2xl font-semibold">{riskBand(score, riskThresholds)}</p>
            </div>
          </div>
          <p className="mt-3 text-sm text-slate-700 dark:text-slate-300">{routingText}</p>
        </Section>

        <Section title="Sign-Off">
          <p className="text-sm text-slate-700 dark:text-slate-300">
            Assessed by {assessment.assessedBy?.name ?? "—"}. Finalized on{" "}
            {assessment.finalizedAt ? new Date(assessment.finalizedAt).toLocaleString() : "—"}.
          </p>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <div className="mt-6 border-t border-slate-100 dark:border-slate-800 pt-4 first:mt-4 first:border-t-0 first:pt-0 print:break-inside-avoid">
      <h2 className="mb-1 text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
      {note && <p className="mb-3 text-xs italic text-slate-400 dark:text-slate-500">{note}</p>}
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">{label}</dt>
      <dd className="text-slate-700 dark:text-slate-300">{value}</dd>
    </div>
  );
}
