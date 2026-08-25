import { useState, type FormEvent } from "react";
import {
  useCustomFieldDefs,
  useCreateCustomField,
  useUpdateCustomField,
  useDeleteCustomField,
  type CustomFieldType,
} from "../../api/customFields";
import { ApiError } from "../../api/client";

const inputClass =
  "rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-1.5 text-sm focus:border-slate-500 dark:focus:border-slate-400 focus:outline-none";

const FIELD_TYPE_LABELS: Record<CustomFieldType, string> = {
  TEXT: "Text",
  TEXTAREA: "Long Text",
  NUMBER: "Number",
  DATE: "Date",
  SELECT: "Dropdown",
};

export function AdminCustomFieldsPanel() {
  const { data: fields, isLoading } = useCustomFieldDefs();
  const createField = useCreateCustomField();
  const updateField = useUpdateCustomField();
  const deleteField = useDeleteCustomField();

  const [newLabel, setNewLabel] = useState("");
  const [newType, setNewType] = useState<CustomFieldType>("TEXT");
  const [newOptions, setNewOptions] = useState("");
  const [newRequired, setNewRequired] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [rowError, setRowError] = useState<Record<string, string>>({});

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setCreateError(null);
    const options = newType === "SELECT" ? newOptions.split(",").map((o) => o.trim()).filter(Boolean) : undefined;
    if (newType === "SELECT" && (!options || options.length < 2)) {
      setCreateError("A dropdown field needs at least 2 comma-separated options.");
      return;
    }
    try {
      await createField.mutateAsync({ label: newLabel, fieldType: newType, options, required: newRequired });
      setNewLabel("");
      setNewOptions("");
      setNewRequired(false);
      setNewType("TEXT");
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : "Could not add this field.");
    }
  }

  async function handleToggleActive(id: string, isActive: boolean) {
    setRowError((e) => ({ ...e, [id]: "" }));
    try {
      await updateField.mutateAsync({ id, isActive: !isActive });
    } catch (err) {
      setRowError((e) => ({ ...e, [id]: err instanceof ApiError ? err.message : "Could not update." }));
    }
  }

  async function handleDelete(id: string) {
    setRowError((e) => ({ ...e, [id]: "" }));
    try {
      await deleteField.mutateAsync(id);
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
        Extra questions shown at the end of the intake wizard, beyond the platform's built-in fields. Deleting one
        removes it from new intakes; if any use case already has a value for it, that field is deactivated instead of
        removed so its historical value keeps showing on those records — only a field nothing has ever used is deleted
        outright.
      </p>

      <form onSubmit={handleCreate} className="flex flex-wrap items-start gap-3">
        <input
          required
          placeholder='New field label, e.g. "Regulatory Jurisdiction"'
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          className={`${inputClass} w-64`}
        />
        <select value={newType} onChange={(e) => setNewType(e.target.value as CustomFieldType)} className={inputClass}>
          {Object.entries(FIELD_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        {newType === "SELECT" && (
          <input
            placeholder="Option A, Option B, Option C"
            value={newOptions}
            onChange={(e) => setNewOptions(e.target.value)}
            className={`${inputClass} w-64`}
          />
        )}
        <label className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400">
          <input type="checkbox" checked={newRequired} onChange={(e) => setNewRequired(e.target.checked)} />
          Required
        </label>
        <button
          type="submit"
          disabled={createField.isPending}
          className="rounded-md bg-slate-900 dark:bg-slate-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800 dark:hover:bg-slate-600 disabled:opacity-50"
        >
          {createField.isPending ? "Adding..." : "+ Add Field"}
        </button>
      </form>
      {createError && <p className="text-sm text-red-600">{createError}</p>}

      <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <tr>
              <th className="px-4 py-2.5">Label</th>
              <th className="px-4 py-2.5">Type</th>
              <th className="px-4 py-2.5">Required</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {fields?.map((f) => (
              <tr key={f.id}>
                <td className="px-4 py-2.5">
                  <span className={f.isActive ? "text-slate-800 dark:text-slate-200" : "text-slate-400 dark:text-slate-500"}>
                    {f.label}
                  </span>
                  {f.fieldType === "SELECT" && f.options && (
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      {(JSON.parse(f.options) as string[]).join(", ")}
                    </p>
                  )}
                </td>
                <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">{FIELD_TYPE_LABELS[f.fieldType]}</td>
                <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">{f.required ? "Yes" : "No"}</td>
                <td className="px-4 py-2.5">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      f.isActive
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                    }`}
                  >
                    {f.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleActive(f.id, f.isActive)}
                      disabled={updateField.isPending}
                      className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:underline disabled:opacity-50"
                    >
                      {f.isActive ? "Deactivate" : "Reactivate"}
                    </button>
                    <button
                      onClick={() => handleDelete(f.id)}
                      disabled={deleteField.isPending}
                      className="text-xs font-medium text-red-600 dark:text-red-400 hover:underline disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                  {rowError[f.id] && <p className="mt-1 text-xs text-red-600">{rowError[f.id]}</p>}
                </td>
              </tr>
            ))}
            {fields?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-slate-400 dark:text-slate-500">
                  No custom fields yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
