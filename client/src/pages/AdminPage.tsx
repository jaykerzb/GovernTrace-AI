import { useState } from "react";
import { useAuth, isAdmin } from "../auth/AuthContext";
import { AdminUsersPanel } from "../components/admin/AdminUsersPanel";
import { AdminActivityPanel } from "../components/admin/AdminActivityPanel";
import { AdminOrgSettingsPanel } from "../components/admin/AdminOrgSettingsPanel";
import { AdminBusinessUnitsPanel } from "../components/admin/AdminBusinessUnitsPanel";
import { AdminAiTypeOptionsPanel } from "../components/admin/AdminAiTypeOptionsPanel";
import { AdminRiskQuestionsPanel } from "../components/admin/AdminRiskQuestionsPanel";
import { AdminReviewFunctionsPanel } from "../components/admin/AdminReviewFunctionsPanel";
import { AdminCustomFieldsPanel } from "../components/admin/AdminCustomFieldsPanel";
import { AdminEmailSettingsPanel } from "../components/admin/AdminEmailSettingsPanel";
import { AdminEmailTemplatesPanel } from "../components/admin/AdminEmailTemplatesPanel";
import { AdminRolesPanel } from "../components/admin/AdminRolesPanel";
import { AdminSystemPanel } from "../components/admin/AdminSystemPanel";

// Two-level nav: a handful of top-level groups, most with a secondary row
// of sub-tabs for what used to be 11 flat top-level tabs — grouped by what
// an admin is actually trying to do (manage people, configure the org's
// taxonomy, configure the assessment methodology, communications, or
// operate the instance itself) rather than one tab per settings screen.
interface SubTab {
  key: string;
  label: string;
  Panel: React.ComponentType;
}

interface Group {
  key: string;
  label: string;
  tabs: SubTab[];
}

const GROUPS: Group[] = [
  {
    key: "people",
    label: "Users & Roles",
    tabs: [
      { key: "users", label: "Users", Panel: AdminUsersPanel },
      { key: "roles", label: "Roles", Panel: AdminRolesPanel },
    ],
  },
  {
    key: "organization",
    label: "Organization",
    tabs: [
      { key: "settings", label: "Settings", Panel: AdminOrgSettingsPanel },
      { key: "business-units", label: "Business Units", Panel: AdminBusinessUnitsPanel },
      { key: "ai-types", label: "AI Types", Panel: AdminAiTypeOptionsPanel },
      { key: "custom-fields", label: "Custom Fields", Panel: AdminCustomFieldsPanel },
    ],
  },
  {
    key: "assessment",
    label: "Assessment Config",
    tabs: [
      { key: "risk-questions", label: "Risk Questionnaire", Panel: AdminRiskQuestionsPanel },
      { key: "work-papers", label: "Function Work Papers", Panel: AdminReviewFunctionsPanel },
    ],
  },
  {
    key: "communications",
    label: "Communications",
    tabs: [
      { key: "email", label: "Email", Panel: AdminEmailSettingsPanel },
      { key: "email-templates", label: "Email Templates", Panel: AdminEmailTemplatesPanel },
    ],
  },
  { key: "activity", label: "Activity", tabs: [{ key: "activity", label: "Activity", Panel: AdminActivityPanel }] },
  { key: "system", label: "System", tabs: [{ key: "system", label: "System", Panel: AdminSystemPanel }] },
];

export function AdminPage() {
  const { user } = useAuth();
  const [groupKey, setGroupKey] = useState(GROUPS[0].key);
  const [subTabByGroup, setSubTabByGroup] = useState<Record<string, string>>({});

  if (!user || !isAdmin(user.role)) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 text-sm text-slate-600 dark:text-slate-400 shadow-sm">
        You don't have access to the admin panel. This area is restricted to Admins.
      </div>
    );
  }

  const group = GROUPS.find((g) => g.key === groupKey) ?? GROUPS[0];
  const activeSubTabKey = subTabByGroup[group.key] ?? group.tabs[0].key;
  const activeTab = group.tabs.find((t) => t.key === activeSubTabKey) ?? group.tabs[0];
  const ActivePanel = activeTab.Panel;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Admin</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Manage users and system-level activity.</p>
      </div>

      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-800">
        {GROUPS.map((g) => (
          <button
            key={g.key}
            onClick={() => setGroupKey(g.key)}
            className={`border-b-2 px-4 py-2 text-sm font-medium ${
              group.key === g.key
                ? "border-slate-900 text-slate-900 dark:text-slate-100"
                : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
            }`}
          >
            {g.label}
          </button>
        ))}
      </div>

      {group.tabs.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {group.tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setSubTabByGroup((s) => ({ ...s, [group.key]: t.key }))}
              className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                activeTab.key === t.key
                  ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                  : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      <ActivePanel />
    </div>
  );
}
