import { useEffect, useState } from "react";
import { useEmailTemplates, useUpdateEmailTemplate, useSendTemplateTest } from "../../api/emailTemplates";
import { useOrgSettings } from "../../api/orgSettings";
import { useEmailSettings } from "../../api/emailSettings";
import {
  EMAIL_TEMPLATE_KINDS,
  EMAIL_TEMPLATE_LABELS,
  EMAIL_TEMPLATE_DESCRIPTIONS,
  SAMPLE_VARIABLES,
  renderTemplatePreview,
  formatEmailBodyPreview,
  type EmailTemplateKind,
} from "../../lib/emailTemplateSamples";
import { ApiError } from "../../api/client";

const inputClass =
  "w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2 text-sm focus:border-slate-500 dark:focus:border-slate-400 focus:outline-none";

export function AdminEmailTemplatesPanel() {
  const { data: templates, isLoading } = useEmailTemplates();
  const { data: org } = useOrgSettings();
  const { data: emailSettings } = useEmailSettings();
  const updateTemplate = useUpdateEmailTemplate();
  const sendTest = useSendTemplateTest();

  const [selected, setSelected] = useState<EmailTemplateKind>("COMMENT_POSTED");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [ctaLabel, setCtaLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null);

  const current = templates?.find((t) => t.kind === selected);

  useEffect(() => {
    if (current) {
      setSubject(current.subject);
      setBody(current.body);
      setCtaLabel(current.ctaLabel);
      setSaved(false);
      setTestResult(null);
      setError(null);
    }
  }, [current?.id, current?.kind, selected]);

  const samples = SAMPLE_VARIABLES[selected];
  const usedVariables = Array.from(new Set(Object.keys(samples)));
  const orgName = org?.orgName ?? "GovernTrace AI";
  const primaryColor = org?.primaryColor || "#0f172a";
  // The real "From" name every outgoing email actually uses, configured on
  // the Email tab — not guessed from the org name, so this preview matches
  // what a recipient's inbox shows.
  const fromName = emailSettings?.fromName || "GovernTrace AI";

  async function handleSave() {
    setError(null);
    setSaved(false);
    try {
      await updateTemplate.mutateAsync({ kind: selected, subject, body, ctaLabel });
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save this template.");
    }
  }

  async function handleSendTest() {
    setTestResult(null);
    const result = await sendTest.mutateAsync(selected);
    setTestResult(result);
  }

  if (isLoading) {
    return <p className="text-sm text-slate-400 dark:text-slate-500">Loading...</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr_1fr]">
      <div className="space-y-1">
        {EMAIL_TEMPLATE_KINDS.map((kind) => (
          <button
            key={kind}
            onClick={() => setSelected(kind)}
            className={`block w-full rounded-md px-3 py-2 text-left text-sm font-medium ${
              selected === kind
                ? "bg-slate-900 text-white dark:bg-slate-700"
                : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            {EMAIL_TEMPLATE_LABELS[kind]}
          </button>
        ))}
      </div>

      <div className="space-y-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-sm">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{EMAIL_TEMPLATE_LABELS[selected]}</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{EMAIL_TEMPLATE_DESCRIPTIONS[selected]}</p>
          <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
            Available placeholders: {usedVariables.map((v) => `{{${v}}}`).join(", ")}
            <br />
            Use <code>**text**</code> for bold and a blank line for a new paragraph.
          </p>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Subject</label>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Body</label>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={6} className={inputClass} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Button Label</label>
          <input
            value={ctaLabel}
            onChange={(e) => setCtaLabel(e.target.value)}
            className={inputClass}
            placeholder="View in GovernTrace AI"
          />
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
            Text on the button linking back to the relevant record. Leave blank to omit the button.
          </p>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={updateTemplate.isPending}
            className="rounded-md bg-slate-900 dark:bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 dark:hover:bg-slate-600 disabled:opacity-50"
          >
            {updateTemplate.isPending ? "Saving..." : "Save Template"}
          </button>
          {saved && !updateTemplate.isPending && <span className="text-sm text-emerald-600 dark:text-emerald-400">Saved.</span>}
        </div>

        <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSendTest}
              disabled={sendTest.isPending}
              className="rounded-md border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-950 disabled:opacity-50"
            >
              {sendTest.isPending ? "Sending..." : "Send Test Email"}
            </button>
            <span className="text-xs text-slate-400 dark:text-slate-500">
              Sends the currently saved template (with sample data) to your own account email.
            </span>
          </div>
          {testResult && (
            <p className={`mt-2 text-sm ${testResult.ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-600"}`}>
              {testResult.ok ? "Test email sent successfully." : `Failed: ${testResult.error}`}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Preview</h3>
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
          <div className="border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-3 text-xs">
            <p className="text-slate-400 dark:text-slate-500">
              From: <span className="text-slate-600 dark:text-slate-300">{fromName}</span>
            </p>
            <p className="mt-1 text-slate-400 dark:text-slate-500">
              Subject:{" "}
              <span className="font-medium text-slate-700 dark:text-slate-200">{renderTemplatePreview(subject, samples)}</span>
            </p>
          </div>

          {/* Mirrors the branded shell rendered server-side in emailLayout.ts */}
          <div className="p-4">
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <div className="px-5 py-4" style={{ background: primaryColor }}>
                <span className="text-sm font-semibold text-white">{orgName} | GovernTrace AI</span>
              </div>
              <div className="px-5 py-5 text-slate-800">
                <div
                  className="text-sm leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: formatEmailBodyPreview(renderTemplatePreview(body, samples)) }}
                />
                {ctaLabel && (
                  <div className="mt-4">
                    <span
                      className="inline-block rounded-md px-4 py-2 text-sm font-semibold text-white"
                      style={{ background: primaryColor }}
                    >
                      {ctaLabel} &rarr;
                    </span>
                  </div>
                )}
              </div>
              <div className="border-t border-slate-200 bg-slate-50 px-5 py-3">
                <p className="text-xs text-slate-400">This is an automated notification from GovernTrace AI, {orgName}'s AI Governance platform.</p>
              </div>
            </div>
          </div>
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500">
          Rendered with sample data and your Organization branding — updates as you type.
        </p>
      </div>
    </div>
  );
}
