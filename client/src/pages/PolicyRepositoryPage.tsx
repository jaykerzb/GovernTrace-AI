import { useRef, useState } from "react";
import { usePolicies, useCreatePolicy, useUpdatePolicy, useDeletePolicy } from "../api/policies";
import { useAuth } from "../auth/AuthContext";
import { usePermissions } from "../api/permissions";
import { ApiError } from "../api/client";
import { DocumentIcon, DownloadIcon, EyeIcon, TrashIcon, UploadIcon } from "../components/Icons";
import { DocumentPreviewModal } from "../components/DocumentPreviewModal";
import type { Policy, PolicyCategory } from "../api/types";
import { primaryButtonBase, compactInputClass as inputClass } from "../lib/ui";

const CATEGORY_LABELS: Record<PolicyCategory, string> = {
  POLICY: "Policy",
  STANDARD: "Standard",
  PROCEDURE: "Procedure",
  GUIDELINE: "Guideline",
  OTHER: "Other",
};


function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function PolicyRepositoryPage() {
  const { user } = useAuth();
  const { has } = usePermissions();
  const canManage = !!user && has("MANAGE_POLICIES");
  // Deleting a policy stays hardcoded ADMIN-only (server-side unchanged too)
  // — it's not part of the configurable privilege set.
  const isAdmin = user?.role === "ADMIN";

  const [category, setCategory] = useState("");
  const { data: policies, isLoading } = usePolicies({ category: category || undefined });
  const createPolicy = useCreatePolicy();
  const updatePolicy = useUpdatePolicy();
  const deletePolicy = useDeletePolicy();

  const [title, setTitle] = useState("");
  const [uploadCategory, setUploadCategory] = useState<PolicyCategory>("POLICY");
  const [description, setDescription] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [previewPolicy, setPreviewPolicy] = useState<Policy | null>(null);

  async function handleUpload() {
    const file = fileInputRef.current?.files?.[0];
    if (!file || !title.trim()) {
      setError("A title and file are required.");
      return;
    }
    setError(null);
    try {
      await createPolicy.mutateAsync({ file, title: title.trim(), category: uploadCategory, description: description || undefined });
      setTitle("");
      setDescription("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Upload failed.");
    }
  }

  async function handleDelete(id: string) {
    setError(null);
    try {
      await deletePolicy.mutateAsync(id);
      setConfirmDeleteId(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not delete this policy.");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Policy Repository</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Org-wide governance policies, standards, and procedures — not tied to a specific AI use case.
        </p>
      </div>

      {canManage && (
        <div className="space-y-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-2">
            <input
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={`${inputClass} min-w-[12rem] flex-1`}
            />
            <select value={uploadCategory} onChange={(e) => setUploadCategory(e.target.value as PolicyCategory)} className={inputClass}>
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <input
              placeholder="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={`${inputClass} min-w-[10rem] flex-1`}
            />
            <input
              ref={fileInputRef}
              type="file"
              className="text-sm text-slate-600 dark:text-slate-400 file:mr-2 file:rounded-md file:border-0 file:bg-slate-200 file:px-2 file:py-1.5 file:text-xs file:font-medium"
            />
            <button
              onClick={handleUpload}
              disabled={createPolicy.isPending}
              className={`flex items-center gap-1.5 ${primaryButtonBase} px-4 py-1.5 text-sm`}
            >
              <UploadIcon className="h-3.5 w-3.5" />
              {createPolicy.isPending ? "Uploading..." : "Upload"}
            </button>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <p className="text-xs text-slate-400 dark:text-slate-500">PDF, Word, Excel, PowerPoint, text, CSV, or images up to 20MB.</p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setCategory("")}
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            category === "" ? "bg-slate-900 text-white dark:bg-slate-700" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
          }`}
        >
          All
        </button>
        {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setCategory(value)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              category === value ? "bg-slate-900 text-white dark:bg-slate-700" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        {isLoading && <p className="p-4 text-sm text-slate-400 dark:text-slate-500">Loading...</p>}
        {!isLoading && (!policies || policies.length === 0) && (
          <p className="p-4 text-sm text-slate-400 dark:text-slate-500">No policies match this filter.</p>
        )}
        {policies && policies.length > 0 && (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {policies.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="flex min-w-0 items-center gap-3">
                  <DocumentIcon className="h-5 w-5 shrink-0 text-slate-400 dark:text-slate-500" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setPreviewPolicy(p)}
                        className={`truncate text-left text-sm font-medium hover:underline ${p.isActive ? "text-slate-800 dark:text-slate-200" : "text-slate-400 dark:text-slate-500"}`}
                      >
                        {p.title}
                      </button>
                      {!p.isActive && (
                        <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                          Inactive
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {CATEGORY_LABELS[p.category]} &middot; v{p.version} &middot; {formatSize(p.sizeBytes)} &middot;{" "}
                      {p.uploadedBy?.name} &middot; {new Date(p.createdAt).toLocaleDateString()}
                    </div>
                    {p.description && <div className="text-xs text-slate-500 dark:text-slate-400">{p.description}</div>}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={() => setPreviewPolicy(p)}
                    title="Preview"
                    className="rounded-md p-1.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <EyeIcon className="h-4 w-4" />
                  </button>
                  <a
                    href={`/api/policies/${p.id}/download`}
                    target="_blank"
                    rel="noreferrer"
                    title="Download"
                    className="rounded-md p-1.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <DownloadIcon className="h-4 w-4" />
                  </a>
                  {canManage && (
                    <button
                      onClick={() => updatePolicy.mutate({ id: p.id, isActive: !p.isActive })}
                      className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:underline"
                    >
                      {p.isActive ? "Deactivate" : "Reactivate"}
                    </button>
                  )}
                  {isAdmin &&
                    (confirmDeleteId === p.id ? (
                      <span className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleDelete(p.id)}
                          disabled={deletePolicy.isPending}
                          className="rounded-md bg-red-700 px-2 py-1 text-xs font-medium text-white hover:bg-red-800 disabled:opacity-50"
                        >
                          Confirm
                        </button>
                        <button onClick={() => setConfirmDeleteId(null)} className="text-xs text-slate-500 dark:text-slate-400 hover:underline">
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(p.id)}
                        title="Delete"
                        className="rounded-md p-1.5 text-slate-500 dark:text-slate-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {previewPolicy && (
        <DocumentPreviewModal
          file={{
            originalName: previewPolicy.originalName,
            mimeType: previewPolicy.mimeType,
            viewUrl: `/api/policies/${previewPolicy.id}/view`,
            downloadUrl: `/api/policies/${previewPolicy.id}/download`,
            previewHtmlUrl: `/api/policies/${previewPolicy.id}/preview-html`,
          }}
          onClose={() => setPreviewPolicy(null)}
        />
      )}
    </div>
  );
}
