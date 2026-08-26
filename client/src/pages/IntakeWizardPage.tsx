import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useCreateSystem, useSystem, useUpdateSystem, useCompleteIntake, abandonSystem, type SystemInput } from "../api/systems";
import { useActiveAiTypeOptions } from "../api/aiTypeOptions";
import { useActiveCustomFieldDefs } from "../api/customFields";
import { useAuth } from "../auth/AuthContext";
import { ApiError } from "../api/client";
import { DocumentsPanel } from "../components/DocumentsPanel";
import type { AiType } from "../api/types";
import { primaryButtonBase, inputClass } from "../lib/ui";

interface FormState {
  useCaseId: string;
  dateSubmitted: string;
  name: string;
  description: string;
  capabilityCategory: string;
  businessUnit: string;
  aitoCoordinator: string;
  sponsorName: string;
  applicationName: string;
  aiType: AiType;
  vendorName: string;
  projectedCost: string;
  targetDeploymentDate: string;
  purpose: string;
  businessJustification: string;
  dataTypesUsed: string;
  deploymentContext: string;
  notes: string;
  customFieldValues: Record<string, string>;
}

const EMPTY_FORM: FormState = {
  useCaseId: "",
  dateSubmitted: new Date().toISOString().slice(0, 10),
  name: "",
  description: "",
  capabilityCategory: "",
  businessUnit: "",
  aitoCoordinator: "",
  sponsorName: "",
  applicationName: "",
  aiType: "IN_HOUSE",
  vendorName: "",
  projectedCost: "",
  targetDeploymentDate: "",
  purpose: "",
  businessJustification: "",
  dataTypesUsed: "",
  deploymentContext: "",
  notes: "",
  customFieldValues: {},
};

const AUTOSAVE_DELAY_MS = 900;


function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex h-full flex-col">
      <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>
      <p className="mb-1 min-h-[1rem] text-xs text-slate-400 dark:text-slate-500">{hint || " "}</p>
      <div className="mt-auto">{children}</div>
    </div>
  );
}

function SectionHeader({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-5 border-b border-slate-100 dark:border-slate-800 pb-3">
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
      {hint && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
    </div>
  );
}

function toPayload(form: FormState): Partial<SystemInput> {
  return {
    ...form,
    projectedCost: form.projectedCost === "" ? null : Number(form.projectedCost),
    targetDeploymentDate: form.targetDeploymentDate || null,
    dateSubmitted: form.dateSubmitted || null,
  };
}

export function IntakeWizardPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: existing } = useSystem(id);

  const [systemId, setSystemId] = useState<string | undefined>(id);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const hydrated = useRef(false);
  const creating = useRef(false);

  const { data: aiTypeOptions } = useActiveAiTypeOptions();
  const { data: customFields } = useActiveCustomFieldDefs();
  const createSystem = useCreateSystem();
  const updateSystem = useUpdateSystem(systemId ?? "");
  const completeIntake = useCompleteIntake(systemId ?? "");
  const queryClient = useQueryClient();

  // No draft to resume — create an empty one immediately so uploads and
  // "Complete Intake" are available right away instead of being gated behind
  // filling in specific fields first. Everything below is freely editable
  // and can be filled in (or left blank) in any order.
  useEffect(() => {
    if (id || systemId || creating.current || !user) return;
    creating.current = true;
    createSystem
      .mutateAsync({
        name: "Untitled Use Case",
        description: "",
        businessUnit: "",
        ownerId: user.id,
        aiType: "IN_HOUSE",
        dateSubmitted: EMPTY_FORM.dateSubmitted,
      })
      .then((created) => {
        setSystemId(created.id);
        // Keep local form state in sync with what was actually created
        // (owner in particular) so the next autosave doesn't PATCH it away.
        setForm((f) => ({ ...f, name: created.name, aiType: created.aiType }));
        hydrated.current = true;
        navigate(`/systems/${created.id}/intake`, { replace: true });
      })
      .catch(() => {
        creating.current = false;
        setError("Could not start this use case. Please try again.");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, user]);

  // Populate the form from an existing (resumed) draft exactly once, so a
  // background refetch triggered by our own autosave doesn't stomp on
  // whatever the user is currently typing.
  useEffect(() => {
    if (existing && !hydrated.current) {
      hydrated.current = true;
      setForm({
        useCaseId: existing.useCaseId ?? "",
        dateSubmitted: existing.dateSubmitted ? existing.dateSubmitted.slice(0, 10) : "",
        name: existing.name,
        description: existing.description,
        capabilityCategory: existing.capabilityCategory ?? "",
        businessUnit: existing.businessUnit,
        aitoCoordinator: existing.aitoCoordinator ?? "",
        sponsorName: existing.sponsorName ?? "",
        applicationName: existing.applicationName ?? "",
        aiType: existing.aiType,
        vendorName: existing.vendorName ?? "",
        projectedCost: existing.projectedCost != null ? String(existing.projectedCost) : "",
        targetDeploymentDate: existing.targetDeploymentDate ? existing.targetDeploymentDate.slice(0, 10) : "",
        purpose: existing.purpose ?? "",
        businessJustification: existing.businessJustification ?? "",
        dataTypesUsed: existing.dataTypesUsed ?? "",
        deploymentContext: existing.deploymentContext ?? "",
        notes: existing.notes ?? "",
        customFieldValues: (() => {
          try {
            return JSON.parse(existing.customFieldValues || "{}") as Record<string, string>;
          } catch {
            return {};
          }
        })(),
      });
    }
  }, [existing]);

  // Autosave: debounce edits into PATCH calls once the draft exists. Every
  // field is optional here — nothing blocks saving a partially-filled form.
  useEffect(() => {
    if (!systemId || !hydrated.current) return;

    const timeout = setTimeout(async () => {
      setSaveStatus("saving");
      setError(null);
      try {
        await updateSystem.mutateAsync(toPayload(form));
        setSaveStatus("saved");
      } catch (err) {
        setSaveStatus("error");
        setError(err instanceof ApiError ? err.message : "Could not save. Please try again.");
      }
    }, AUTOSAVE_DELAY_MS);

    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, systemId]);

  // If the user leaves this page without ever typing anything, clean up the
  // draft instead of leaving an empty "Untitled Use Case" behind. Only
  // attached once `id` is a real route param (i.e. not the very first
  // render at "/systems/intake", whose unmount is just the internal
  // redirect to "/systems/:id/intake" right after creation) so it fires
  // exactly once, on an actual navigate-away.
  useEffect(() => {
    if (!id) return;
    return () => {
      abandonSystem(id).then(() => {
        queryClient.invalidateQueries({ queryKey: ["systems"] });
        queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function setCustomField(key: string, value: string) {
    setForm((f) => ({ ...f, customFieldValues: { ...f.customFieldValues, [key]: value } }));
  }

  async function handleComplete() {
    setError(null);
    const missingRequired = (customFields ?? []).filter((f) => f.required && !form.customFieldValues[f.key]?.trim());
    if (missingRequired.length > 0) {
      setError(`Please fill in: ${missingRequired.map((f) => f.label).join(", ")}.`);
      return;
    }
    try {
      await completeIntake.mutateAsync();
      navigate(`/systems/${systemId}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not complete intake. Please try again.");
    }
  }

  const saveStatusLabel = {
    idle: "",
    saving: "Saving...",
    saved: "All Changes Saved",
    error: "Couldn't Save",
  }[saveStatus];

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Register a New AI Use Case</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Fill in the sections below — your progress saves automatically.</p>
        </div>
        <div className="flex items-center gap-3">
          {saveStatusLabel && (
            <span className={`text-xs font-medium ${saveStatus === "error" ? "text-red-600" : "text-slate-400 dark:text-slate-500"}`}>
              {saveStatusLabel}
            </span>
          )}
          {systemId && (
            <button
              onClick={() => navigate(`/systems/${systemId}`)}
              className="text-sm font-medium text-slate-500 dark:text-slate-400 underline decoration-dotted hover:text-slate-700 dark:hover:text-slate-300"
            >
              Finish Later
            </button>
          )}
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleComplete();
        }}
        className="space-y-6"
      >
        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <SectionHeader title="Basics" hint="Use Case Identification" />
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Use Case ID" hint="Optional — assign your own tracking ID">
                <input value={form.useCaseId} onChange={(e) => set("useCaseId", e.target.value)} className={inputClass} placeholder="e.g. AI-2026-014" />
              </Field>
              <Field label="Date Submitted" hint="Defaults to today">
                <input type="date" value={form.dateSubmitted} onChange={(e) => set("dateSubmitted", e.target.value)} className={inputClass} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Use Case Name" hint="A short, descriptive name">
                <input value={form.name} onChange={(e) => set("name", e.target.value)} className={inputClass} />
              </Field>
              <Field label="Application / Platform" hint="The application or product this use case runs in">
                <input
                  value={form.applicationName}
                  onChange={(e) => set("applicationName", e.target.value)}
                  className={inputClass}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Vendor Name" hint="If applicable">
                <input value={form.vendorName} onChange={(e) => set("vendorName", e.target.value)} className={inputClass} />
              </Field>
              <Field label="AITO Coordinator" hint="Person coordinating intake">
                <input value={form.aitoCoordinator} onChange={(e) => set("aitoCoordinator", e.target.value)} className={inputClass} />
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
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-slate-400 dark:text-slate-500">
                    $
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    placeholder="0"
                    value={form.projectedCost}
                    onChange={(e) => set("projectedCost", e.target.value)}
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
              <Field label="Requesting Business Unit" hint="Team or department requesting this">
                <input
                  value={form.businessUnit}
                  onChange={(e) => set("businessUnit", e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Sponsor / Product Owner" hint="Typically the business unit lead">
                <input value={form.sponsorName} onChange={(e) => set("sponsorName", e.target.value)} className={inputClass} />
              </Field>
            </div>
            <Field label="Use Case Description" hint="What does this use case do?">
              <textarea
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                className={inputClass}
                rows={3}
              />
            </Field>
            <Field label="Business Justification" hint="Why is this use case being pursued?">
              <textarea
                value={form.businessJustification}
                onChange={(e) => set("businessJustification", e.target.value)}
                className={inputClass}
                rows={3}
              />
            </Field>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <SectionHeader title="Data & Deployment" />
          <div className="space-y-5">
            <Field
              label="Capability Category"
              hint='A short description of the AI capability, e.g. "document summarization" or "fraud scoring"'
            >
              <input
                value={form.capabilityCategory}
                onChange={(e) => set("capabilityCategory", e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Purpose / Intended Use" hint="The business problem this use case solves">
              <textarea
                value={form.purpose}
                onChange={(e) => set("purpose", e.target.value)}
                className={inputClass}
                rows={2}
              />
            </Field>
            <Field label="Data Types Used" hint="e.g. customer PII, transaction records, employee data">
              <input
                value={form.dataTypesUsed}
                onChange={(e) => set("dataTypesUsed", e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Deployment Context" hint="Where/how is it deployed and who uses it?">
              <textarea
                value={form.deploymentContext}
                onChange={(e) => set("deploymentContext", e.target.value)}
                className={inputClass}
                rows={2}
              />
            </Field>
            <Field label="Target Deployment Date" hint="Optional">
              <input
                type="date"
                value={form.targetDeploymentDate}
                onChange={(e) => set("targetDeploymentDate", e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Misc. Notes" hint="Anything else worth recording that doesn't fit above — optional">
              <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} className={inputClass} rows={3} />
            </Field>
          </div>
        </section>

        {customFields && customFields.length > 0 && (
          <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
            <SectionHeader title="Additional Information" hint="Fields specific to this organization" />
            <div className="space-y-5">
              {customFields.map((f) => (
                <Field key={f.id} label={f.required ? `${f.label} *` : f.label}>
                  {f.fieldType === "TEXTAREA" ? (
                    <textarea
                      value={form.customFieldValues[f.key] ?? ""}
                      onChange={(e) => setCustomField(f.key, e.target.value)}
                      className={inputClass}
                      rows={3}
                    />
                  ) : f.fieldType === "SELECT" ? (
                    <select
                      value={form.customFieldValues[f.key] ?? ""}
                      onChange={(e) => setCustomField(f.key, e.target.value)}
                      className={inputClass}
                    >
                      <option value="">Select...</option>
                      {(f.options ? (JSON.parse(f.options) as string[]) : []).map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={f.fieldType === "NUMBER" ? "number" : f.fieldType === "DATE" ? "date" : "text"}
                      value={form.customFieldValues[f.key] ?? ""}
                      onChange={(e) => setCustomField(f.key, e.target.value)}
                      className={inputClass}
                    />
                  )}
                </Field>
              ))}
            </div>
          </section>
        )}

        <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
          <SectionHeader
            title="Supporting Documents"
            hint="Attach any supporting documents you have on hand — SOC reports, whitepapers, contracts. Optional."
          />
          {systemId ? (
            <DocumentsPanel systemId={systemId} canManage />
          ) : (
            <p className="text-sm text-slate-400 dark:text-slate-500">Setting up this use case...</p>
          )}
        </section>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={completeIntake.isPending || !systemId}
            className={`${primaryButtonBase} px-5 py-2.5 text-sm`}
          >
            {completeIntake.isPending ? "Completing..." : "Complete Intake"}
          </button>
        </div>
      </form>
    </div>
  );
}
