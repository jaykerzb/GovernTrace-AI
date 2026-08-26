import { useEffect, useState, type FormEvent } from "react";
import { useEmailSettings, useUpdateEmailSettings, useSendTestEmail, type EmailProvider } from "../../api/emailSettings";
import { ApiError } from "../../api/client";
import { primaryButtonBase, inputClass } from "../../lib/ui";


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

export function AdminEmailSettingsPanel() {
  const { data: settings, isLoading } = useEmailSettings();
  const updateSettings = useUpdateEmailSettings();
  const sendTest = useSendTestEmail();

  const [form, setForm] = useState({
    provider: "DISABLED" as EmailProvider,
    fromName: "GovernTrace AI",
    fromAddress: "",
    smtpHost: "",
    smtpPort: 587,
    smtpSecure: true,
    smtpUser: "",
    smtpPassword: "",
    apiKey: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null);

  useEffect(() => {
    if (settings) {
      setForm((f) => ({
        ...f,
        provider: settings.provider,
        fromName: settings.fromName,
        fromAddress: settings.fromAddress ?? "",
        smtpHost: settings.smtpHost ?? "",
        smtpPort: settings.smtpPort ?? 587,
        smtpSecure: settings.smtpSecure,
        smtpUser: settings.smtpUser ?? "",
        smtpPassword: "",
        apiKey: "",
      }));
    }
  }, [settings]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setTestResult(null);
    try {
      await updateSettings.mutateAsync({
        provider: form.provider,
        fromName: form.fromName,
        fromAddress: form.fromAddress || null,
        smtpHost: form.smtpHost || null,
        smtpPort: form.smtpPort || null,
        smtpSecure: form.smtpSecure,
        smtpUser: form.smtpUser || null,
        smtpPassword: form.smtpPassword,
        apiKey: form.apiKey,
      });
      setForm((f) => ({ ...f, smtpPassword: "", apiKey: "" }));
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not save these settings.");
    }
  }

  async function handleSendTest() {
    setTestResult(null);
    const result = await sendTest.mutateAsync();
    setTestResult(result);
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
        <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Email Delivery</h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          When enabled, every in-app notification (approvals, comments, meetings, etc.) also sends an email to the
          recipient, unless they've turned email off in their own Account settings.
        </p>
        <div className="mt-4">
          <Field label="Provider">
            <select
              value={form.provider}
              onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value as EmailProvider }))}
              className={inputClass}
            >
              <option value="DISABLED">Disabled</option>
              <option value="SMTP">SMTP (your own mail server)</option>
              <option value="API">API (Resend)</option>
            </select>
          </Field>
        </div>

        {form.provider !== "DISABLED" && (
          <div className="mt-4 grid grid-cols-2 gap-4">
            <Field label="From Name">
              <input
                value={form.fromName}
                onChange={(e) => setForm((f) => ({ ...f, fromName: e.target.value }))}
                className={inputClass}
                required
              />
            </Field>
            <Field label="From Address">
              <input
                type="email"
                value={form.fromAddress}
                onChange={(e) => setForm((f) => ({ ...f, fromAddress: e.target.value }))}
                className={inputClass}
                placeholder="notifications@yourorg.com"
                required
              />
            </Field>
          </div>
        )}

        {form.provider === "SMTP" && (
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Field label="SMTP Host">
                <input
                  value={form.smtpHost}
                  onChange={(e) => setForm((f) => ({ ...f, smtpHost: e.target.value }))}
                  className={inputClass}
                  placeholder="mail.yourorg.com"
                  required
                />
              </Field>
              <Field label="Port">
                <input
                  type="number"
                  value={form.smtpPort}
                  onChange={(e) => setForm((f) => ({ ...f, smtpPort: Number(e.target.value) }))}
                  className={inputClass}
                  required
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Username">
                <input
                  value={form.smtpUser}
                  onChange={(e) => setForm((f) => ({ ...f, smtpUser: e.target.value }))}
                  className={inputClass}
                  required
                />
              </Field>
              <Field
                label="Password"
                hint={settings?.hasSmtpPassword ? "Leave blank to keep the current password." : undefined}
              >
                <input
                  type="password"
                  value={form.smtpPassword}
                  onChange={(e) => setForm((f) => ({ ...f, smtpPassword: e.target.value }))}
                  className={inputClass}
                  placeholder={settings?.hasSmtpPassword ? "•••••••• (unchanged)" : ""}
                  required={!settings?.hasSmtpPassword}
                />
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={form.smtpSecure}
                onChange={(e) => setForm((f) => ({ ...f, smtpSecure: e.target.checked }))}
              />
              Use TLS
            </label>
          </div>
        )}

        {form.provider === "API" && (
          <div className="mt-4">
            <Field
              label="Resend API Key"
              hint={settings?.hasApiKey ? "Leave blank to keep the current key." : "Get one from resend.com — free tier available."}
            >
              <input
                type="password"
                value={form.apiKey}
                onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
                className={inputClass}
                placeholder={settings?.hasApiKey ? "•••••••• (unchanged)" : "re_..."}
                required={!settings?.hasApiKey}
              />
            </Field>
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

      <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSendTest}
            disabled={sendTest.isPending || form.provider === "DISABLED"}
            title={form.provider === "DISABLED" ? "Enable and save a provider first" : undefined}
            className="rounded-md border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-950 disabled:opacity-50"
          >
            {sendTest.isPending ? "Sending..." : "Send Test Email"}
          </button>
          <span className="text-xs text-slate-400 dark:text-slate-500">Sends to your own account email.</span>
        </div>
        {testResult && (
          <p className={`mt-2 text-sm ${testResult.ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-600"}`}>
            {testResult.ok ? "Test email sent successfully." : `Failed: ${testResult.error}`}
          </p>
        )}
      </div>
    </form>
  );
}
