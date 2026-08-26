import { useState, type FormEvent } from "react";
import {
  useAiTypeOptions,
  useCreateAiTypeOption,
  useUpdateAiTypeOption,
  useDeleteAiTypeOption,
} from "../../api/aiTypeOptions";
import { ApiError } from "../../api/client";
import { primaryButtonBase, compactInputClass as inputClass } from "../../lib/ui";


export function AdminAiTypeOptionsPanel() {
  const { data: options, isLoading } = useAiTypeOptions();
  const createOption = useCreateAiTypeOption();
  const updateOption = useUpdateAiTypeOption();
  const deleteOption = useDeleteAiTypeOption();

  const [newLabel, setNewLabel] = useState("");
  const [newDefinition, setNewDefinition] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editDefinition, setEditDefinition] = useState("");
  const [rowError, setRowError] = useState<Record<string, string>>({});

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setCreateError(null);
    try {
      await createOption.mutateAsync({ label: newLabel, definition: newDefinition || undefined });
      setNewLabel("");
      setNewDefinition("");
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : "Could not add this AI type.");
    }
  }

  async function handleSaveEdit(id: string) {
    setRowError((e) => ({ ...e, [id]: "" }));
    try {
      await updateOption.mutateAsync({ id, label: editLabel, definition: editDefinition || null });
      setEditingId(null);
    } catch (err) {
      setRowError((e) => ({ ...e, [id]: err instanceof ApiError ? err.message : "Could not save." }));
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
      <div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          These are the options offered for "AI Type" when registering or editing a use case. The definition is shown
          to the user while they're choosing, so they can pick the right one with confidence. Deactivating an option
          hides it from new picks but keeps it on any use case that already has it.
        </p>
      </div>

      <form onSubmit={handleCreate} className="space-y-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex-1">
            <input
              required
              placeholder='New AI type, e.g. "Third-Party Model"'
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              className={`${inputClass} w-full`}
            />
          </div>
          <button
            type="submit"
            disabled={createOption.isPending}
            className={`${primaryButtonBase} px-4 py-1.5 text-sm`}
          >
            {createOption.isPending ? "Adding..." : "+ Add AI Type"}
          </button>
        </div>
        <textarea
          placeholder="Definition shown to the user while choosing this type (optional)"
          value={newDefinition}
          onChange={(e) => setNewDefinition(e.target.value)}
          rows={2}
          className={`${inputClass} w-full`}
        />
        {createError && <p className="text-sm text-red-600">{createError}</p>}
      </form>

      <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <tr>
              <th className="px-4 py-2.5">Label</th>
              <th className="px-4 py-2.5">Definition</th>
              <th className="px-4 py-2.5">Key</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {options?.map((o) => (
              <tr key={o.id}>
                <td className="px-4 py-2.5 align-top">
                  {editingId === o.id ? (
                    <input
                      autoFocus
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
                      className={`${inputClass} w-full`}
                    />
                  ) : (
                    <span className={o.isActive ? "text-slate-800 dark:text-slate-200" : "text-slate-400 dark:text-slate-500"}>
                      {o.label}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 align-top max-w-xs">
                  {editingId === o.id ? (
                    <textarea
                      value={editDefinition}
                      onChange={(e) => setEditDefinition(e.target.value)}
                      rows={2}
                      className={`${inputClass} w-full`}
                    />
                  ) : (
                    <span className="text-slate-500 dark:text-slate-400">{o.definition || "—"}</span>
                  )}
                </td>
                <td className="px-4 py-2.5 align-top font-mono text-xs text-slate-400 dark:text-slate-500">{o.key}</td>
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
                    {editingId === o.id ? (
                      <>
                        <button
                          onClick={() => handleSaveEdit(o.id)}
                          disabled={updateOption.isPending}
                          className="text-xs font-medium text-slate-700 dark:text-slate-300 hover:underline disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="text-xs font-medium text-slate-400 dark:text-slate-500 hover:underline"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => {
                          setEditingId(o.id);
                          setEditLabel(o.label);
                          setEditDefinition(o.definition ?? "");
                        }}
                        className="text-xs font-medium text-slate-700 dark:text-slate-300 hover:underline"
                      >
                        Edit
                      </button>
                    )}
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
