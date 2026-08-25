import { useState } from "react";
import { useAuth, isAdmin } from "../auth/AuthContext";
import { AdminUsersPanel } from "../components/admin/AdminUsersPanel";
import { AdminActivityPanel } from "../components/admin/AdminActivityPanel";
import { AdminOrgSettingsPanel } from "../components/admin/AdminOrgSettingsPanel";
import { AdminAiTypeOptionsPanel } from "../components/admin/AdminAiTypeOptionsPanel";
import { AdminRiskQuestionsPanel } from "../components/admin/AdminRiskQuestionsPanel";
import { AdminReviewFunctionsPanel } from "../components/admin/AdminReviewFunctionsPanel";
import { AdminCustomFieldsPanel } from "../components/admin/AdminCustomFieldsPanel";
import { AdminEmailSettingsPanel } from "../components/admin/AdminEmailSettingsPanel";
import { AdminEmailTemplatesPanel } from "../components/admin/AdminEmailTemplatesPanel";
import { AdminRolesPanel } from "../components/admin/AdminRolesPanel";

type Tab = "users" | "activity" | "organization" | "email" | "email-templates" | "roles" | "ai-types" | "risk-questions" | "work-papers" | "custom-fields";

const TABS: { key: Tab; label: string }[] = [
  { key: "users", label: "Users" },
  { key: "activity", label: "Activity" },
  { key: "organization", label: "Organization" },
  { key: "email", label: "Email" },
  { key: "email-templates", label: "Email Templates" },
  { key: "roles", label: "Roles" },
  { key: "ai-types", label: "AI Types" },
  { key: "risk-questions", label: "Risk Questionnaire" },
  { key: "work-papers", label: "Function Work Papers" },
  { key: "custom-fields", label: "Custom Fields" },
];

export function AdminPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("users");

  if (!user || !isAdmin(user.role)) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 text-sm text-slate-600 dark:text-slate-400 shadow-sm">
        You don't have access to the admin panel. This area is restricted to Admins.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Admin</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Manage users and system-level activity.</p>
      </div>

      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-800">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`border-b-2 px-4 py-2 text-sm font-medium ${
              tab === t.key ? "border-slate-900 text-slate-900 dark:text-slate-100" : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "users" && <AdminUsersPanel />}
      {tab === "activity" && <AdminActivityPanel />}
      {tab === "organization" && <AdminOrgSettingsPanel />}
      {tab === "email" && <AdminEmailSettingsPanel />}
      {tab === "email-templates" && <AdminEmailTemplatesPanel />}
      {tab === "roles" && <AdminRolesPanel />}
      {tab === "ai-types" && <AdminAiTypeOptionsPanel />}
      {tab === "risk-questions" && <AdminRiskQuestionsPanel />}
      {tab === "work-papers" && <AdminReviewFunctionsPanel />}
      {tab === "custom-fields" && <AdminCustomFieldsPanel />}
    </div>
  );
}
