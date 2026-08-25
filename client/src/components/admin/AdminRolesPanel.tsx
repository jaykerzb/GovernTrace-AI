import { Fragment, useState } from "react";
import { useRolePermissions, useSetRolePermission } from "../../api/permissions";
import type { Role } from "../../api/types";
import { ApiError } from "../../api/client";

const ROLES: Role[] = ["ADMIN", "COMPLIANCE_OFFICER", "SYSTEM_OWNER", "APPROVER", "VIEWER"];

const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Admin",
  COMPLIANCE_OFFICER: "Compliance Officer",
  SYSTEM_OWNER: "System Owner",
  APPROVER: "Approver",
  VIEWER: "Viewer",
};

export function AdminRolesPanel() {
  const { data, isLoading } = useRolePermissions();
  const setPermission = useSetRolePermission();
  const [error, setError] = useState<string | null>(null);

  if (isLoading || !data) {
    return <p className="text-sm text-slate-400 dark:text-slate-500">Loading...</p>;
  }

  const groups = Array.from(new Set(data.permissions.map((p) => p.group)));

  async function handleToggle(role: Role, permission: string, granted: boolean) {
    setError(null);
    try {
      await setPermission.mutateAsync({ role, permission, granted });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not update this privilege.");
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Controls which of the 5 roles can perform each governance action. Admins always have full access and can't be
        changed here — this only governs the other four roles. Actions that manage the admin panel itself (users, org
        settings, email, the risk questionnaire, review functions, AI types, custom fields) stay Admin-only and aren't
        listed below.
      </p>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <tr>
              <th className="px-4 py-2.5">Privilege</th>
              {ROLES.map((r) => (
                <th key={r} className="px-3 py-2.5 text-center">
                  {ROLE_LABELS[r]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {groups.map((group) => (
              <Fragment key={group}>
                <tr className="bg-slate-50/60 dark:bg-slate-950/40">
                  <td colSpan={ROLES.length + 1} className="px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    {group}
                  </td>
                </tr>
                {data.permissions
                  .filter((p) => p.group === group)
                  .map((p) => (
                    <tr key={p.key}>
                      <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300">{p.label}</td>
                      {ROLES.map((role) => {
                        const granted = data.grants[role]?.includes(p.key) ?? false;
                        const isAdminRole = role === "ADMIN";
                        return (
                          <td key={role} className="px-3 py-2.5 text-center">
                            <input
                              type="checkbox"
                              checked={granted}
                              disabled={isAdminRole || setPermission.isPending}
                              title={isAdminRole ? "Admins always have full access" : undefined}
                              onChange={(e) => handleToggle(role, p.key, e.target.checked)}
                              className="h-4 w-4 accent-slate-900 dark:accent-slate-500 disabled:opacity-50"
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
