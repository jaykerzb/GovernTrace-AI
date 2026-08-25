import { useState, type FormEvent } from "react";
import { useAdminUsers, useCreateUser, useUpdateUser, useResetPassword } from "../../api/admin";
import { useAuth } from "../../auth/AuthContext";
import { ApiError } from "../../api/client";
import type { Role } from "../../api/types";

const ROLES: Role[] = ["ADMIN", "COMPLIANCE_OFFICER", "SYSTEM_OWNER", "APPROVER", "VIEWER"];

const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Admin",
  COMPLIANCE_OFFICER: "Compliance Officer",
  SYSTEM_OWNER: "System Owner",
  APPROVER: "Approver",
  VIEWER: "Viewer",
};

const inputClass = "rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-1.5 text-sm focus:border-slate-500 dark:focus:border-slate-400 focus:outline-none";

export function AdminUsersPanel() {
  const { user: currentUser } = useAuth();
  const { data: users, isLoading } = useAdminUsers();
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const resetPassword = useResetPassword();

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", role: "VIEWER" as Role, password: "" });
  const [createError, setCreateError] = useState<string | null>(null);

  const [resettingId, setResettingId] = useState<string | null>(null);
  const [resetValue, setResetValue] = useState("");
  const [rowError, setRowError] = useState<Record<string, string>>({});

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setCreateError(null);
    try {
      await createUser.mutateAsync(form);
      setForm({ name: "", email: "", role: "VIEWER", password: "" });
      setShowCreate(false);
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : "Could not create user.");
    }
  }

  async function handleRoleChange(id: string, role: Role) {
    setRowError((e) => ({ ...e, [id]: "" }));
    try {
      await updateUser.mutateAsync({ id, input: { role } });
    } catch (err) {
      setRowError((e) => ({ ...e, [id]: err instanceof ApiError ? err.message : "Could not update role." }));
    }
  }

  async function handleToggleActive(id: string, isActive: boolean) {
    setRowError((e) => ({ ...e, [id]: "" }));
    try {
      await updateUser.mutateAsync({ id, input: { isActive: !isActive } });
    } catch (err) {
      setRowError((e) => ({ ...e, [id]: err instanceof ApiError ? err.message : "Could not update status." }));
    }
  }

  async function handleResetPassword(id: string) {
    if (resetValue.length < 8) {
      setRowError((e) => ({ ...e, [id]: "New password must be at least 8 characters." }));
      return;
    }
    try {
      await resetPassword.mutateAsync({ id, newPassword: resetValue });
      setResettingId(null);
      setResetValue("");
    } catch (err) {
      setRowError((e) => ({ ...e, [id]: err instanceof ApiError ? err.message : "Could not reset password." }));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500 dark:text-slate-400">{users?.length ?? 0} Users</p>
        <button
          onClick={() => setShowCreate((s) => !s)}
          className="rounded-md bg-slate-900 dark:bg-slate-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 dark:hover:bg-slate-600"
        >
          {showCreate ? "Cancel" : "+ New User"}
        </button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} className="grid grid-cols-2 gap-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-4">
          <input
            required
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className={inputClass}
          />
          <input
            required
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            className={inputClass}
          />
          <select
            value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as Role }))}
            className={inputClass}
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
          <input
            required
            type="password"
            minLength={8}
            placeholder="Initial Password (min 8 chars)"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            className={inputClass}
          />
          {createError && <p className="col-span-2 text-sm text-red-600">{createError}</p>}
          <div className="col-span-2 flex justify-end">
            <button
              type="submit"
              disabled={createUser.isPending}
              className="rounded-md bg-slate-900 dark:bg-slate-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800 dark:hover:bg-slate-600 disabled:opacity-50"
            >
              {createUser.isPending ? "Creating..." : "Create User"}
            </button>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {isLoading && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-slate-400 dark:text-slate-500">
                  Loading...
                </td>
              </tr>
            )}
            {users?.map((u) => (
              <tr key={u.id} className={u.isActive ? "" : "bg-slate-50 dark:bg-slate-950"}>
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-800 dark:text-slate-200">
                    {u.name} {u.id === currentUser?.id && <span className="text-xs text-slate-400 dark:text-slate-500">(you)</span>}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">{u.email}</div>
                  {rowError[u.id] && <div className="mt-1 text-xs text-red-600">{rowError[u.id]}</div>}
                </td>
                <td className="px-4 py-3">
                  <select
                    value={u.role}
                    onChange={(e) => handleRoleChange(u.id, e.target.value as Role)}
                    className="rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-2 py-1 text-xs focus:border-slate-500 dark:focus:border-slate-400 focus:outline-none"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABELS[r]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      u.isActive ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400"
                    }`}
                  >
                    {u.isActive ? "Active" : "Deactivated"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => handleToggleActive(u.id, u.isActive ?? true)}
                      className="rounded-md border border-slate-300 dark:border-slate-600 px-2 py-1 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-950"
                    >
                      {u.isActive ? "Deactivate" : "Reactivate"}
                    </button>
                    {resettingId === u.id ? (
                      <>
                        <input
                          type="password"
                          minLength={8}
                          placeholder="New Password"
                          value={resetValue}
                          onChange={(e) => setResetValue(e.target.value)}
                          className="w-32 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-2 py-1 text-xs focus:border-slate-500 dark:focus:border-slate-400 focus:outline-none"
                        />
                        <button
                          onClick={() => handleResetPassword(u.id)}
                          className="rounded-md bg-slate-900 dark:bg-slate-700 px-2 py-1 text-xs font-medium text-white hover:bg-slate-800 dark:hover:bg-slate-600"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => {
                            setResettingId(null);
                            setResetValue("");
                          }}
                          className="text-xs text-slate-500 dark:text-slate-400 hover:underline"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setResettingId(u.id)}
                        className="rounded-md border border-slate-300 dark:border-slate-600 px-2 py-1 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-950"
                      >
                        Reset Password
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
