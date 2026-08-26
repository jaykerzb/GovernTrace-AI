import { useEffect, useState, type FormEvent } from "react";
import { useOrgSettings, useUpdateOrgSettings } from "../../api/orgSettings";
import { ApiError } from "../../api/client";
import { RISK_COLORS, RISK_LABELS } from "../../constants/riskColors";
import { primaryButtonBase, inputClass } from "../../lib/ui";

const MIN_SCORE = 9;
const MAX_SCORE = 45;


// `flex h-full flex-col` + `mt-auto` on the input wrapper keeps inputs bottom-aligned
// within a grid row even when a sibling Field's hint text wraps to a different number
// of lines (or has none) — otherwise the row's inputs would start at different heights.
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col">
      <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>
      <p className="mb-1 min-h-[1rem] text-xs text-slate-400 dark:text-slate-500">{hint || " "}</p>
      <div className="mt-auto">{children}</div>
    </div>
  );
}

export function AdminOrgSettingsPanel() {
  const { data: settings, isLoading } = useOrgSettings();
  const updateSettings = useUpdateOrgSettings();

  const [form, setForm] = useState({
    orgName: "",
    logoUrl: "",
    primaryColor: "#0f172a",
    approvalThreshold: 30,
    reassessmentCadenceDays: 365,
    riskBandLowMax: 15,
    riskBandModerateMax: 30,
    riskBandHighMax: 38,
  });
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (settings) {
      setForm({
        orgName: settings.orgName,
        logoUrl: settings.logoUrl ?? "",
        primaryColor: settings.primaryColor,
        approvalThreshold: settings.approvalThreshold,
        reassessmentCadenceDays: settings.reassessmentCadenceDays,
        riskBandLowMax: settings.riskBandLowMax,
        riskBandModerateMax: settings.riskBandModerateMax,
        riskBandHighMax: settings.riskBandHighMax,
      });
    }
  }, [settings]);

  const riskBandsInOrder = form.riskBandLowMax < form.riskBandModerateMax && form.riskBandModerateMax < form.riskBandHighMax;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    if (!riskBandsInOrder) {
      setError("Risk band cutoffs must increase: Low < Moderate < High.");
      return;
    }
    try {
      await updateSettings.mutateAsync({
        orgName: form.orgName,
        logoUrl: form.logoUrl || null,
        primaryColor: form.primaryColor,
        approvalThreshold: form.approvalThreshold,
        reassessmentCadenceDays: form.reassessmentCadenceDays,
        riskBandLowMax: form.riskBandLowMax,
        riskBandModerateMax: form.riskBandModerateMax,
        riskBandHighMax: form.riskBandHighMax,
      });
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save these settings.");
    }
  }

  if (isLoading) {
    return <p className="text-sm text-slate-400 dark:text-slate-500">Loading...</p>;
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="max-w-2xl space-y-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm"
    >
      <div>
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Branding</h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Shown in the sidebar, login page, and generated reports.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <Field label="Organization Name">
            <input
              value={form.orgName}
              onChange={(e) => setForm((f) => ({ ...f, orgName: e.target.value }))}
              className={inputClass}
              required
            />
          </Field>
          <Field label="Logo URL" hint="Optional — a hosted image URL. Falls back to initials if left blank.">
            <input
              value={form.logoUrl}
              onChange={(e) => setForm((f) => ({ ...f, logoUrl: e.target.value }))}
              className={inputClass}
              placeholder="https://..."
            />
          </Field>
        </div>
        <div className="mt-4">
          <Field label="Primary Color" hint="Used for the brand mark and active navigation.">
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={form.primaryColor}
                onChange={(e) => setForm((f) => ({ ...f, primaryColor: e.target.value }))}
                className="h-9 w-14 cursor-pointer rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 p-1"
              />
              <input
                value={form.primaryColor}
                onChange={(e) => setForm((f) => ({ ...f, primaryColor: e.target.value }))}
                className={`${inputClass} w-32 font-mono`}
                pattern="^#[0-9a-fA-F]{6}$"
                placeholder="#0f172a"
              />
            </div>
          </Field>
        </div>
      </div>

      <div className="border-t border-slate-100 dark:border-slate-800 pt-5">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Approval Threshold</h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          The risk score that separates standard approval from additional approval.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-4">
          <Field label="Approval Score Threshold" hint="Dimension 2 score (9–45) at/below which standard approval applies.">
            <input
              type="number"
              min={9}
              max={45}
              value={form.approvalThreshold}
              onChange={(e) => setForm((f) => ({ ...f, approvalThreshold: Number(e.target.value) }))}
              className={inputClass}
              required
            />
          </Field>
          <Field label="Re-Assessment Cadence (Days)" hint="How often approved systems come up for re-review.">
            <input
              type="number"
              min={1}
              value={form.reassessmentCadenceDays}
              onChange={(e) => setForm((f) => ({ ...f, reassessmentCadenceDays: Number(e.target.value) }))}
              className={inputClass}
              required
            />
          </Field>
        </div>
      </div>

      <div className="border-t border-slate-100 dark:border-slate-800 pt-5">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Risk Score Bands</h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Cutoffs (Dimension 2 score, {MIN_SCORE}–{MAX_SCORE}) for the Low / Moderate / High / Critical risk score shown
          across the registry, system pages, and reports. Each band is "up to and including" its cutoff; Critical is
          anything above the High cutoff.
        </p>
        <div className="mt-4 grid grid-cols-3 gap-4">
          <Field label="Low up to">
            <input
              type="number"
              min={MIN_SCORE}
              max={MAX_SCORE}
              value={form.riskBandLowMax}
              onChange={(e) => setForm((f) => ({ ...f, riskBandLowMax: Number(e.target.value) }))}
              className={inputClass}
              required
            />
          </Field>
          <Field label="Moderate up to">
            <input
              type="number"
              min={MIN_SCORE}
              max={MAX_SCORE}
              value={form.riskBandModerateMax}
              onChange={(e) => setForm((f) => ({ ...f, riskBandModerateMax: Number(e.target.value) }))}
              className={inputClass}
              required
            />
          </Field>
          <Field label="High up to">
            <input
              type="number"
              min={MIN_SCORE}
              max={MAX_SCORE}
              value={form.riskBandHighMax}
              onChange={(e) => setForm((f) => ({ ...f, riskBandHighMax: Number(e.target.value) }))}
              className={inputClass}
              required
            />
          </Field>
        </div>

        {!riskBandsInOrder && (
          <p className="mt-2 text-xs text-red-600">Cutoffs must increase: Low &lt; Moderate &lt; High.</p>
        )}

        {riskBandsInOrder && (
          <div className="mt-4 flex overflow-hidden rounded-md text-xs font-medium text-white">
            {[
              { label: "Low", range: `${MIN_SCORE}–${form.riskBandLowMax}`, width: form.riskBandLowMax - MIN_SCORE + 1 },
              {
                label: "Moderate",
                range: `${form.riskBandLowMax + 1}–${form.riskBandModerateMax}`,
                width: form.riskBandModerateMax - form.riskBandLowMax,
              },
              {
                label: "High",
                range: `${form.riskBandModerateMax + 1}–${form.riskBandHighMax}`,
                width: form.riskBandHighMax - form.riskBandModerateMax,
              },
              {
                label: "Critical",
                range: `${form.riskBandHighMax + 1}–${MAX_SCORE}`,
                width: MAX_SCORE - form.riskBandHighMax,
              },
            ].map((band) => (
              <div
                key={band.label}
                title={`${band.label}: ${band.range}`}
                className="flex flex-col items-center justify-center gap-0.5 px-2 py-2"
                style={{ backgroundColor: RISK_COLORS[band.label], flexGrow: Math.max(band.width, 0.001) }}
              >
                <span>{RISK_LABELS[band.label]}</span>
                <span className="opacity-80">{band.range}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={updateSettings.isPending}
          className={`${primaryButtonBase} px-4 py-2 text-sm`}
        >
          {updateSettings.isPending ? "Saving..." : "Save Settings"}
        </button>
        {saved && !updateSettings.isPending && <span className="text-sm text-emerald-600 dark:text-emerald-400">Saved.</span>}
      </div>
    </form>
  );
}
