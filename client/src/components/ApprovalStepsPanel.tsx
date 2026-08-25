import { useState } from "react";
import { useApprovalSteps, useDecideApprovalStep } from "../api/approvalSteps";
import { useAuth } from "../auth/AuthContext";
import { usePermissions } from "../api/permissions";
import { ApiError } from "../api/client";

const STEP_TYPE_LABELS: Record<string, string> = {
  AIGA_APPROVAL: "Approval",
  AISC_REVIEW: "Review",
  AISC_FINAL_APPROVAL: "Final Approval",
};

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  APPROVED: "bg-emerald-100 text-emerald-800",
  REJECTED: "bg-red-100 text-red-800",
};

export function ApprovalStepsPanel({ systemId }: { systemId: string }) {
  const { user } = useAuth();
  const { has } = usePermissions();
  const { data: steps } = useApprovalSteps(systemId);
  const decide = useDecideApprovalStep(systemId);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!steps || steps.length === 0) return null;

  const firstPendingIndex = steps.findIndex((s) => s.status === "PENDING");

  async function handleDecide(id: string, status: "APPROVED" | "REJECTED") {
    setError(null);
    try {
      await decide.mutateAsync({ id, status, comment: comment.trim() || undefined });
      setComment("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not record this decision.");
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-sm">
      <h2 className="mb-1 text-sm font-semibold text-slate-900 dark:text-slate-100">Approval Chain</h2>
      <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
        Sequential sign-off — each step becomes actionable once the one before it is approved.
      </p>

      <ol className="space-y-3">
        {steps.map((step, index) => {
          const isActive = index === firstPendingIndex;
          const canAct = isActive && !!user && has("DECIDE_APPROVAL") && (user.role === "ADMIN" || user.role === step.requiredRole);
          return (
            <li
              key={step.id}
              className={`rounded-lg border p-3 ${
                isActive
                  ? "border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-950"
                  : "border-slate-100 dark:border-slate-800"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
                    {STEP_TYPE_LABELS[step.stepType] ?? step.stepType.replace(/_/g, " ")}
                  </span>
                  <span className="ml-2 text-xs text-slate-400 dark:text-slate-500">
                    {step.requiredRole.replace("_", " ")}
                  </span>
                </div>
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[step.status]}`}>
                  {step.status.charAt(0) + step.status.slice(1).toLowerCase()}
                </span>
              </div>
              {step.status !== "PENDING" && (
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {step.approver?.name ?? "—"}
                  {step.actedAt ? ` · ${new Date(step.actedAt).toLocaleDateString()}` : ""}
                  {step.comment ? ` — "${step.comment}"` : ""}
                </p>
              )}
              {canAct && (
                <div className="mt-3 space-y-2 border-t border-slate-200 dark:border-slate-700 pt-3">
                  <input
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Optional comment"
                    className="w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-1.5 text-sm focus:border-slate-500 dark:focus:border-slate-400 focus:outline-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDecide(step.id, "APPROVED")}
                      disabled={decide.isPending}
                      className="rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleDecide(step.id, "REJECTED")}
                      disabled={decide.isPending}
                      className="rounded-md bg-red-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-800 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ol>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}
