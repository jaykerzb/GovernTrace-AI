import { useState, type FormEvent } from "react";
import {
  useBusinessUnitOptions,
  useCreateBusinessUnitOption,
  useUpdateBusinessUnitOption,
  useDeleteBusinessUnitOption,
} from "../../api/businessUnitOptions";
import { ApiError } from "../../api/client";
import { primaryButtonBase, compactInputClass as inputClass } from "../../lib/ui";

export function AdminBusinessUnitsPanel() {
  const { data: options, isLoading } = useBusinessUnitOptions();
  const createOption = useCreateBusinessUnitOption();
  const updateOption = useUpdateBusinessUnitOption();
  const deleteOption = useDeleteBusinessUnitOption();

  const [newLabel, setNewLabel] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [rowError, setRowError] = useState<Record<string, string>>({});

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setCreateError(null);
    try {
      await createOption.mutateAsync(newLabel);
      setNewLabel("");
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : "Could not add this business unit.");
    }
  }

  async function handleToggleActive(id: string, isActive: boolean) {
    setRowError((e) => ({ ...e, [id]: "" }));
    try {
      await updateOption.mutateAsync({ id, isActive: !isActive });
    } catch (err) {
      setRowError((e) => ({ ...e, [id]: err instanceof ApiError ? err.message : "Could not update." }));
    }
  }

  async function handleDelete(id: string) {
    setRowError((e) => ({ ...e, [id]: "" }));
    try {
      await deleteOption.mutateAsync(id);
    } catch (err) {
      setRowError((e) => ({ ...e, [id]: err instanceof ApiError ? err.message : "Could not delete." }));
    }
  }

  if (isLoading) {
    return <p className="text-sm text-slate-400 dark:text-slate-500">Loading...</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        These are the options offered for "Business Unit" when registering or editing a use case, and in the registry's
        filter. Deactivating hides an option from new picks but keeps it on any use case that already has it. There's no
        rename here — renaming wouldn't update use cases that already have the old name, since it's stored as plain
        text on each one; use the registry's bulk "Reassign business unit" action for that instead.
      </p>

      <form onSubmit={handleCreate} className="flex items-start gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
        <input
          required
          placeholder='New business unit, e.g. "Digital Banking"'
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          className={`${inputClass} flex-1`}
        />
        <button type="submit" disabled={createOption.isPending} className={`${primaryButtonBase} px-4 py-1.5 text-sm`}>
          {createOption.isPending ? "Adding..." : "+ Add Business Unit"}
        </button>
      </form>
      {createError && <p className="text-sm text-red-600">{createError}</p>}

      <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <tr>
              <th className="px-4 py-2.5">Label</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {options?.map((o) => (
              <tr key={o.id}>
                <td className="px-4 py-2.5 align-top">
                  <span className={o.isActive ? "text-slate-800 dark:text-slate-200" : "text-slate-400 dark:text-slate-500"}>
                    {o.label}
                  </span>
                </td>
                <td className="px-4 py-2.5 align-top">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      o.isActive
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                    }`}
                  >
                    {o.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-2.5 align-top">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleActive(o.id, o.isActive)}
                      disabled={updateOption.isPending}
                      className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:underline disabled:opacity-50"
                    >
                      {o.isActive ? "Deactivate" : "Reactivate"}
                    </button>
                    <button
                      onClick={() => handleDelete(o.id)}
                      disabled={deleteOption.isPending}
                      className="text-xs font-medium text-red-600 dark:text-red-400 hover:underline disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                  {rowError[o.id] && <p className="mt-1 text-xs text-red-600">{rowError[o.id]}</p>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
