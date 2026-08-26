import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useSystem, useUpdateSystem, type SystemInput } from "../api/systems";
import { useUsers } from "../api/users";
import { useActiveAiTypeOptions } from "../api/aiTypeOptions";
import { ApiError } from "../api/client";
import type { AiType } from "../api/types";
import { primaryButtonBase, inputClass } from "../lib/ui";

const EMPTY: SystemInput = {
  useCaseId: "",
  dateSubmitted: "",
  name: "",
  description: "",
  capabilityCategory: "",
  businessUnit: "",
  aitoCoordinator: "",
  sponsorName: "",
  ownerId: "",
  applicationName: "",
  aiType: "IN_HOUSE",
  vendorName: "",
  projectedCost: null,
  targetDeploymentDate: "",
  purpose: "",
  businessJustification: "",
  dataTypesUsed: "",
  deploymentContext: "",
  notes: "",
};

/** Edit form for an already-registered AI system. New systems are registered
 * through the guided intake wizard (see IntakeWizardPage) instead. */
export function SystemFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: users } = useUsers();
  const { data: aiTypeOptions } = useActiveAiTypeOptions();
  const { data: existing } = useSystem(id);
  const updateSystem = useUpdateSystem(id ?? "");

  const [form, setForm] = useState<SystemInput>(EMPTY);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (existing) {
      setForm({
        useCaseId: existing.useCaseId ?? "",
        dateSubmitted: existing.dateSubmitted ? existing.dateSubmitted.slice(0, 10) : "",
        name: existing.name,
        description: existing.description,
        capabilityCategory: existing.capabilityCategory ?? "",
        businessUnit: existing.businessUnit,
        aitoCoordinator: existing.aitoCoordinator ?? "",
        sponsorName: existing.sponsorName ?? "",
        ownerId: existing.ownerId,
        applicationName: existing.applicationName ?? "",
        aiType: existing.aiType,
        vendorName: existing.vendorName ?? "",
        projectedCost: existing.projectedCost,
        targetDeploymentDate: existing.targetDeploymentDate ? existing.targetDeploymentDate.slice(0, 10) : "",
        purpose: existing.purpose ?? "",
        businessJustification: existing.businessJustification ?? "",
        dataTypesUsed: existing.dataTypesUsed ?? "",
        deploymentContext: existing.deploymentContext ?? "",
        notes: existing.notes ?? "",
      });
    }
  }, [existing]);

  function set<K extends keyof SystemInput>(key: K, value: SystemInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await updateSystem.mutateAsync(form);
      navigate(`/systems/${id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-xl font-semibold text-slate-900 dark:text-slate-100">Edit AI System</h1>

      <form onSubmit={handleSubmit} className="space-y-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Use Case ID" hint="Optional — assign your own tracking ID">
            <input value={form.useCaseId ?? ""} onChange={(e) => set("useCaseId", e.target.value)} className={inputClass} placeholder="e.g. AI-2026-014" />
          </Field>
          <Field label="Date Submitted">
            <input type="date" value={form.dateSubmitted ?? ""} onChange={(e) => set("dateSubmitted", e.target.value || null)} className={inputClass} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Use Case Name">
            <input required value={form.name} onChange={(e) => set("name", e.target.value)} className={inputClass} />
          </Field>
          <Field label="Application / Platform" hint="The application or product this use case runs in">
            <input
              required
              value={form.applicationName ?? ""}
              onChange={(e) => set("applicationName", e.target.value)}
              className={inputClass}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Vendor Name" hint="If applicable">
            <input value={form.vendorName ?? ""} onChange={(e) => set("vendorName", e.target.value)} className={inputClass} />
          </Field>
          <Field label="AITO Coordinator" hint="Person coordinating intake">
            <input value={form.aitoCoordinator ?? ""} onChange={(e) => set("aitoCoordinator", e.target.value)} className={inputClass} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="AI Type" hint="How this capability is built or delivered">
            <select value={form.aiType} onChange={(e) => set("aiType", e.target.value as AiType)} className={inputClass}>
              {aiTypeOptions?.map((t) => (
                <option key={t.key} value={t.key} title={t.definition ?? undefined}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Projected Cost" hint="Estimated cost in USD (optional)">
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-slate-400 dark:text-slate-500">$</span>
              <input
                type="number"
                min="0"
                step="1000"
                placeholder="0"
                value={form.projectedCost ?? ""}
                onChange={(e) => set("projectedCost", e.target.value === "" ? null : Number(e.target.value))}
                className={`${inputClass} pl-6`}
              />
            </div>
          </Field>
        </div>
        {(() => {
          // Rendered as its own grid row (not inside the AI Type Field) so this
          // variable-length text can't inflate that row's height and throw off
          // the vertical alignment between the AI Type and Projected Cost inputs.
          const definition = aiTypeOptions?.find((t) => t.key === form.aiType)?.definition;
          return definition ? (
            <div className="grid grid-cols-2 gap-4">
              <p className="-mt-2 text-xs text-slate-400 dark:text-slate-500">{definition}</p>
            </div>
          ) : null;
        })()}

        <div className="grid grid-cols-2 gap-4">
          <Field label="Requesting Business Unit">
            <input
              required
              value={form.businessUnit}
              onChange={(e) => set("businessUnit", e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Sponsor / Product Owner" hint="Typically the business unit lead">
            <input value={form.sponsorName ?? ""} onChange={(e) => set("sponsorName", e.target.value)} className={inputClass} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Managed By (Account)" hint="Controls who can edit, delete, or complete intake for this system">
            <select required value={form.ownerId} onChange={(e) => set("ownerId", e.target.value)} className={inputClass}>
              <option value="">Select an Owner...</option>
              {users?.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role.replace("_", " ")})
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Use Case Description" hint="What does this use case do?">
          <textarea
            required
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            className={inputClass}
            rows={3}
          />
        </Field>

        <Field label="Business Justification" hint="Why is this use case being pursued?">
          <textarea
            value={form.businessJustification ?? ""}
            onChange={(e) => set("businessJustification", e.target.value)}
            className={inputClass}
            rows={3}
          />
        </Field>

        <Field label="Capability Category" hint="A short description of the AI capability">
          <input
            required
            value={form.capabilityCategory ?? ""}
            onChange={(e) => set("capabilityCategory", e.target.value)}
            className={inputClass}
          />
        </Field>

        <Field label="Purpose / Intended Use">
          <textarea required value={form.purpose ?? ""} onChange={(e) => set("purpose", e.target.value)} className={inputClass} rows={2} />
        </Field>

        <Field label="Data Types Used" hint="e.g. customer PII, transaction records, employee data">
          <input
            required
            value={form.dataTypesUsed ?? ""}
            onChange={(e) => set("dataTypesUsed", e.target.value)}
            className={inputClass}
          />
        </Field>

        <Field label="Deployment Context" hint="Where/how is it deployed and who uses it?">
          <textarea
            required
            value={form.deploymentContext ?? ""}
            onChange={(e) => set("deploymentContext", e.target.value)}
            className={inputClass}
            rows={2}
          />
        </Field>

        <Field label="Target Deployment Date" hint="Optional">
          <input
            type="date"
            value={form.targetDeploymentDate ?? ""}
            onChange={(e) => set("targetDeploymentDate", e.target.value || null)}
            className={inputClass}
          />
        </Field>

        <Field label="Misc. Notes" hint="Anything else worth recording that doesn't fit above — optional">
          <textarea value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} className={inputClass} rows={3} />
        </Field>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-md border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-950"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={updateSystem.isPending}
            className={`${primaryButtonBase} px-4 py-2 text-sm`}
          >
            {updateSystem.isPending ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}


function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex h-full flex-col">
      <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>
      <p className="mb-1 min-h-[1rem] text-xs text-slate-400 dark:text-slate-500">{hint || " "}</p>
      <div className="mt-auto">{children}</div>
    </div>
  );
}
