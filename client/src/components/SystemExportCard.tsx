import { Link } from "react-router-dom";
import { useSystem } from "../api/systems";
import { useWorkPapers, useWorkPaper } from "../api/workPapers";
import { useCommitteeReview } from "../api/committeeReview";
import { useDocuments } from "../api/documents";
import { useAiTypeLabel } from "../api/aiTypeOptions";
import { useCustomFieldDefs } from "../api/customFields";
import { useOrgSettings } from "../api/orgSettings";
import { useApprovalSteps } from "../api/approvalSteps";
import { ReviewTriggerBadge, StatusBadge, WorkPaperStatusBadge } from "./Badges";
import { riskBand } from "../lib/riskBand";
import { RISK_LABELS } from "../constants/riskColors";
import type { FunctionWorkPaper } from "../api/types";

const STEP_TYPE_LABELS: Record<string, string> = {
  AIGA_APPROVAL: "Approval",
  AISC_REVIEW: "Review",
  AISC_FINAL_APPROVAL: "Final Approval",
};

const DISPOSITION_LABELS: Record<string, string> = {
  APPROVED: "Approved",
  APPROVED_WITH_CONDITIONS: "Approved with Conditions",
  NOT_APPROVED: "Not Approved",
  DEFERRED: "Deferred",
  REMANDED: "Remanded",
};

// The single-system "governance record" card — the printable content shown
// on SystemExportPage, and reused once per system on BulkExportPage.
// `includeFullWorkPapers` swaps the summary-only work paper table for every
// question, answer, evidence note, and section synthesis — the full record
// an auditor would expect, at the cost of a much longer document.
export function SystemExportCard({ systemId, includeFullWorkPapers = false }: { systemId: string; includeFullWorkPapers?: boolean }) {
  const { data: system } = useSystem(systemId);
  const aiTypeLabel = useAiTypeLabel();
  const { data: orgSettings } = useOrgSettings();
  const riskThresholds = {
    riskBandLowMax: orgSettings?.riskBandLowMax ?? 15,
    riskBandModerateMax: orgSettings?.riskBandModerateMax ?? 30,
    riskBandHighMax: orgSettings?.riskBandHighMax ?? 38,
  };
  const { data: customFieldDefs } = useCustomFieldDefs();
  const { data: workPapers } = useWorkPapers(systemId);
  const { data: committeeReview } = useCommitteeReview(systemId);
  const { data: documents } = useDocuments(systemId);
  const { data: approvalSteps } = useApprovalSteps(systemId);

  if (!system) {
    return <p className="text-slate-500 dark:text-slate-400">Loading export...</p>;
  }

  const latestFinalized = system.riskAssessments.find((a) => a.status === "FINALIZED");
  const generatedAt = new Date();
  const customFieldValues = (() => {
    try {
      return JSON.parse(system.customFieldValues || "{}") as Record<string, string>;
    } catch {
      return {};
    }
  })();
  const populatedCustomFields = (customFieldDefs ?? []).filter((f) => customFieldValues[f.key]);

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm print:border-0 print:p-0 print:shadow-none">
      <div className="mb-1 flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Governance Record Export</p>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{system.name}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Generated {generatedAt.toLocaleString()} &middot; {system.businessUnit}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <StatusBadge status={system.status} />
          <ReviewTriggerBadge triggered={system.currentReviewTriggered} />
        </div>
      </div>

      <Section title="Use Case Overview">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <Field label="Use Case ID" value={system.useCaseId || "—"} />
          <Field label="AI Type" value={aiTypeLabel(system.aiType)} />
          <Field label="Vendor" value={system.vendorName || "—"} />
          <Field label="Business Unit" value={system.businessUnit} />
          <Field label="Managed By" value={`${system.owner.name} (${system.owner.email})`} />
          <Field label="Sponsor / Product Owner" value={system.sponsorName || "—"} />
          <Field label="Registered" value={new Date(system.createdAt).toLocaleDateString()} />
          <Field
            label="Next Review Due"
            value={system.nextReviewDue ? new Date(system.nextReviewDue).toLocaleDateString() : "Not scheduled"}
          />
        </dl>
        <div className="mt-3">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">Description</span>
          <p className="text-sm text-slate-700 dark:text-slate-300">{system.description || "—"}</p>
        </div>
        {populatedCustomFields.length > 0 && (
          <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            {populatedCustomFields.map((f) => (
              <Field key={f.id} label={f.label} value={customFieldValues[f.key]} />
            ))}
          </dl>
        )}
      </Section>

      <Section title="Risk Assessment Summary">
        {latestFinalized ? (
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-4 rounded-lg bg-slate-900 dark:bg-slate-950 p-4 text-center text-white print:bg-slate-100 print:text-slate-900 print:border print:border-slate-300">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-300 print:text-slate-500">Score</p>
                <p className="text-2xl font-semibold">{latestFinalized.score ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-300 print:text-slate-500">Risk Rating</p>
                <p className="text-2xl font-semibold">
                  {latestFinalized.score !== null ? RISK_LABELS[riskBand(latestFinalized.score, riskThresholds)] : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-300 print:text-slate-500">Status</p>
                <p className="text-2xl font-semibold">
                  {committeeReview?.status === "FINALIZED"
                    ? DISPOSITION_LABELS[committeeReview.finalDisposition ?? ""] ?? committeeReview.finalDisposition
                    : "Pending"}
                </p>
              </div>
            </div>
            <p className="text-sm text-slate-700 dark:text-slate-300">
              Finalized {latestFinalized.finalizedAt ? new Date(latestFinalized.finalizedAt).toLocaleDateString() : "—"} by{" "}
              {latestFinalized.assessedBy?.name ?? "—"}.{" "}
              <Link
                to={`/systems/${systemId}/assessments/${latestFinalized.id}/report`}
                className="text-slate-500 hover:underline dark:text-slate-400 print:hidden"
              >
                View full report &rarr;
              </Link>
            </p>
          </div>
        ) : (
          <p className="text-sm text-slate-400 dark:text-slate-500">No risk assessment has been finalized yet.</p>
        )}
      </Section>

      <Section title="Function Work Papers">
        {!workPapers || workPapers.length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-slate-500">No functions are in scope for this system's classification.</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700 text-left text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">
                <th className="py-1.5 pr-2">Function</th>
                <th className="py-1.5 pr-2">Status</th>
                <th className="py-1.5 pr-2">Composite Risk</th>
                <th className="py-1.5 text-right">Recommendation</th>
              </tr>
            </thead>
            <tbody>
              {workPapers.map((wp) => (
                <tr key={wp.id} className="border-b border-slate-100 dark:border-slate-800">
                  <td className="py-2 pr-2 align-top font-medium text-slate-700 dark:text-slate-300">{wp.label}</td>
                  <td className="py-2 pr-2 align-top">
                    <WorkPaperStatusBadge status={wp.status} />
                  </td>
                  <td className="py-2 pr-2 align-top text-slate-600 dark:text-slate-400">{wp.compositeRiskRating ?? "—"}</td>
                  <td className="py-2 text-right align-top text-slate-600 dark:text-slate-400">
                    {wp.overallRecommendation?.replaceAll("_", " ") ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {includeFullWorkPapers && (workPapers ?? []).map((wp) => <WorkPaperFullDetail key={wp.id} workPaper={wp} />)}

      <Section title="Committee Decision">
        {committeeReview?.status === "FINALIZED" ? (
          <div className="space-y-2 text-sm">
            <p className="font-semibold text-slate-900 dark:text-slate-100">
              {DISPOSITION_LABELS[committeeReview.finalDisposition ?? ""] ?? committeeReview.finalDisposition}
            </p>
            <p className="text-slate-700 dark:text-slate-300">{committeeReview.decisionJustification || "—"}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              Finalized {committeeReview.finalizedAt ? new Date(committeeReview.finalizedAt).toLocaleDateString() : "—"} by{" "}
              {committeeReview.finalizedBy?.name ?? "—"}.
            </p>
          </div>
        ) : (
          <p className="text-sm text-slate-400 dark:text-slate-500">The committee summary has not been finalized yet.</p>
        )}
      </Section>

      <Section title="Approval Chain">
        {!approvalSteps || approvalSteps.length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-slate-500">No approval chain has been created for this system.</p>
        ) : (
          <ol className="space-y-1.5 text-sm">
            {approvalSteps.map((step) => (
              <li key={step.id} className="flex items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-1.5 last:border-0">
                <span className="text-slate-700 dark:text-slate-300">
                  {STEP_TYPE_LABELS[step.stepType] ?? step.stepType.replace(/_/g, " ")}{" "}
                  <span className="text-xs text-slate-400 dark:text-slate-500">({step.requiredRole.replace("_", " ")})</span>
                </span>
                <span className="text-right text-xs text-slate-500 dark:text-slate-400">
                  {step.status.charAt(0) + step.status.slice(1).toLowerCase()}
                  {step.status !== "PENDING" && (
                    <>
                      {" — "}
                      {step.approver?.name ?? "—"}
                      {step.actedAt ? ` · ${new Date(step.actedAt).toLocaleDateString()}` : ""}
                    </>
                  )}
                </span>
              </li>
            ))}
          </ol>
        )}
      </Section>

      <Section title="Supporting Documents">
        {!documents || documents.length === 0 ? (
          <p className="text-sm text-slate-400 dark:text-slate-500">No supporting documents uploaded.</p>
        ) : (
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700 dark:text-slate-300">
            {documents.map((d) => (
              <li key={d.id}>
                {d.originalName} <span className="text-xs text-slate-400 dark:text-slate-500">({d.category.replace("_", " ")})</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

// Every question, answer, and evidence note for one work paper, plus each
// section's findings/risks/controls/actions and rating — the level of
// detail an auditor reviewing the packet would expect, not just the
// composite-rating summary shown in the table above.
function WorkPaperFullDetail({ workPaper }: { workPaper: FunctionWorkPaper }) {
  const { data: detail } = useWorkPaper(workPaper.id);

  if (!detail) return null;

  const answers = (() => {
    try {
      return JSON.parse(detail.answers || "{}") as Record<string, string>;
    } catch {
      return {};
    }
  })();
  const questionNotes = (() => {
    try {
      return JSON.parse(detail.questionNotes || "{}") as Record<string, string>;
    } catch {
      return {};
    }
  })();
  const sectionData = (() => {
    try {
      return JSON.parse(detail.sectionData || "{}") as Record<string, { findings?: string; identifiedRisks?: string; mitigatingControls?: string; requiredActions?: string; riskRating?: string }>;
    } catch {
      return {};
    }
  })();

  return (
    <Section title={`${detail.label} Work Paper — Detail`}>
      {detail.sections.length === 0 ? (
        <p className="text-sm text-slate-400 dark:text-slate-500">No sections were in scope for this work paper.</p>
      ) : (
        <div className="space-y-4">
          {detail.sections.map((section) => {
            const sd = sectionData[section.id] ?? {};
            return (
              <div key={section.id} className="print:break-inside-avoid">
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">{section.title}</h3>
                <div className="mt-1.5 space-y-2">
                  {section.questions.map((q, i) => (
                    <div key={q.id} className="text-sm">
                      <p className="text-slate-700 dark:text-slate-300">
                        {i + 1}. {q.text} — <span className="font-medium">{answers[q.id] ?? "Unanswered"}</span>
                      </p>
                      {questionNotes[q.id] && <p className="text-xs text-slate-500 dark:text-slate-400">{questionNotes[q.id]}</p>}
                    </div>
                  ))}
                </div>
                <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
                  <Field label="Findings" value={sd.findings || "—"} />
                  <Field label="Identified Risks" value={sd.identifiedRisks || "—"} />
                  <Field label="Mitigating Controls" value={sd.mitigatingControls || "—"} />
                  <Field label="Required Actions" value={sd.requiredActions || "—"} />
                  <Field label="Section Risk Rating" value={sd.riskRating || "Not Rated"} />
                </dl>
              </div>
            );
          })}
        </div>
      )}

      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 border-t border-slate-100 dark:border-slate-800 pt-3 text-sm">
        <Field label="Key Findings Synthesis" value={detail.keyFindings || "—"} />
        <Field label="Rationale for Recommendation" value={detail.rationale || "—"} />
        <Field
          label="Reviewer"
          value={detail.reviewerName ? `${detail.reviewerName}${detail.reviewerTitle ? `, ${detail.reviewerTitle}` : ""}` : "—"}
        />
        <Field label="Reviewer Date" value={detail.reviewerDate ? new Date(detail.reviewerDate).toLocaleDateString() : "—"} />
      </dl>
    </Section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6 border-t border-slate-100 dark:border-slate-800 pt-4 first:mt-4 first:border-t-0 first:pt-0 print:break-inside-avoid">
      <h2 className="mb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
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
