import { useRef, useState } from "react";
import { useDocuments, useUploadDocument, useDeleteDocument } from "../api/documents";
import { ApiError } from "../api/client";
import { DocumentIcon, DownloadIcon, EyeIcon, TrashIcon, UploadIcon } from "./Icons";
import { DocumentPreviewModal } from "./DocumentPreviewModal";
import type { DocumentCategory, Document } from "../api/types";
import { primaryButtonBase } from "../lib/ui";

const CATEGORY_LABELS: Record<DocumentCategory, string> = {
  SOC_REPORT: "SOC Report",
  WHITEPAPER: "Whitepaper",
  POLICY: "Policy",
  CONTRACT: "Contract",
  OTHER: "Other",
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Triggers a browser download for each id, staggered slightly so browsers
// don't silently drop simultaneous downloads (Chrome/Firefox both throttle
// or block a burst of same-tick downloads).
function downloadMany(ids: string[]) {
  ids.forEach((id, i) => {
    setTimeout(() => {
      const a = document.createElement("a");
      a.href = `/api/documents/${id}/download`;
      a.rel = "noreferrer";
      document.body.appendChild(a);
      a.click();
      a.remove();
    }, i * 300);
  });
}

export function DocumentsPanel({ systemId, canManage }: { systemId: string; canManage: boolean }) {
  const { data: documents, isLoading } = useDocuments(systemId);
  const upload = useUploadDocument(systemId);
  const del = useDeleteDocument(systemId);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [category, setCategory] = useState<DocumentCategory>("SOC_REPORT");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmingBulkDelete, setConfirmingBulkDelete] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  async function handleUpload() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError("Choose a file to upload.");
      return;
    }
    setError(null);
    try {
      await upload.mutateAsync({ file, category, description: description || undefined });
      setDescription("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Upload failed.");
    }
  }

  function toggleSelected(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function toggleSelectAll(checked: boolean) {
    setSelectedIds(checked ? new Set(documents?.map((d) => d.id) ?? []) : new Set());
  }

  async function handleBulkDelete() {
    setBulkDeleting(true);
    try {
      for (const id of selectedIds) {
        await del.mutateAsync(id);
      }
      setSelectedIds(new Set());
      setConfirmingBulkDelete(false);
    } finally {
      setBulkDeleting(false);
    }
  }

  const allSelected = !!documents && documents.length > 0 && selectedIds.size === documents.length;

  return (
    <div>
      {canManage && (
        <div className="mb-4 space-y-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as DocumentCategory)}
              className="rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-2 py-1.5 text-xs focus:border-slate-500 dark:focus:border-slate-400 focus:outline-none"
            >
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-w-[10rem] flex-1 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-2 py-1.5 text-xs focus:border-slate-500 dark:focus:border-slate-400 focus:outline-none"
            />
            <input
              ref={fileInputRef}
              type="file"
              className="text-xs text-slate-600 dark:text-slate-400 file:mr-2 file:rounded-md file:border-0 file:bg-slate-200 file:px-2 file:py-1 file:text-xs file:font-medium"
            />
            <button
              onClick={handleUpload}
              disabled={upload.isPending}
              className={`flex items-center gap-1.5 ${primaryButtonBase} px-3 py-1.5 text-xs`}
            >
              <UploadIcon className="h-3.5 w-3.5" />
              {upload.isPending ? "Uploading..." : "Upload"}
            </button>
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <p className="text-xs text-slate-400 dark:text-slate-500">PDF, Word, Excel, PowerPoint, text, CSV, or images up to 20MB.</p>
        </div>
      )}

      {isLoading && <p className="text-sm text-slate-400 dark:text-slate-500">Loading documents...</p>}
      {!isLoading && (!documents || documents.length === 0) && (
        <p className="text-sm text-slate-400 dark:text-slate-500">No supporting documents yet.</p>
      )}
      {documents && documents.length > 0 && (
        <>
          <div className="mb-2 flex items-center justify-between">
            <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <input type="checkbox" checked={allSelected} onChange={(e) => toggleSelectAll(e.target.checked)} />
              Select All
            </label>

            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 dark:text-slate-400">{selectedIds.size} Selected</span>
                <button
                  onClick={() => downloadMany(Array.from(selectedIds))}
                  className="flex items-center gap-1.5 rounded-md border border-slate-300 dark:border-slate-600 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <DownloadIcon className="h-3.5 w-3.5" />
                  Download Selected
                </button>
                {canManage &&
                  (confirmingBulkDelete ? (
                    <span className="flex items-center gap-1.5">
                      <span className="text-xs text-red-700 dark:text-red-400">Delete {selectedIds.size}?</span>
                      <button
                        onClick={handleBulkDelete}
                        disabled={bulkDeleting}
                        className="rounded-md bg-red-700 px-2 py-1 text-xs font-medium text-white hover:bg-red-800 disabled:opacity-50"
                      >
                        {bulkDeleting ? "Deleting..." : "Confirm"}
                      </button>
                      <button
                        onClick={() => setConfirmingBulkDelete(false)}
                        className="text-xs text-slate-500 dark:text-slate-400 hover:underline"
                      >
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <button
                      onClick={() => setConfirmingBulkDelete(true)}
                      className="flex items-center gap-1.5 rounded-md border border-red-200 dark:border-red-900 px-2.5 py-1 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950"
                    >
                      <TrashIcon className="h-3.5 w-3.5" />
                      Delete Selected
                    </button>
                  ))}
              </div>
            )}
          </div>

          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {documents.map((doc) => (
              <li key={doc.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="flex min-w-0 items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(doc.id)}
                    onChange={(e) => toggleSelected(doc.id, e.target.checked)}
                    className="shrink-0"
                  />
                  <DocumentIcon className="h-5 w-5 shrink-0 text-slate-400 dark:text-slate-500" />
                  <div className="min-w-0">
                    <button
                      onClick={() => setPreviewDoc(doc)}
                      className="truncate text-left text-sm font-medium text-slate-800 dark:text-slate-200 hover:underline"
                    >
                      {doc.originalName}
                    </button>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {CATEGORY_LABELS[doc.category]} &middot; {formatSize(doc.sizeBytes)} &middot; {doc.uploadedBy?.name}{" "}
                      &middot; {new Date(doc.createdAt).toLocaleDateString()}
                    </div>
                    {doc.description && <div className="text-xs text-slate-500 dark:text-slate-400">{doc.description}</div>}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    onClick={() => setPreviewDoc(doc)}
                    title="Preview"
                    className="rounded-md p-1.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <EyeIcon className="h-4 w-4" />
                  </button>
                  <a
                    href={`/api/documents/${doc.id}/download`}
                    target="_blank"
                    rel="noreferrer"
                    title="Download"
                    className="rounded-md p-1.5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <DownloadIcon className="h-4 w-4" />
                  </a>
                  {canManage && (
                    <button
                      onClick={() => del.mutate(doc.id)}
                      title="Delete"
                      className="rounded-md p-1.5 text-slate-500 dark:text-slate-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {previewDoc && (
        <DocumentPreviewModal
          file={{
            originalName: previewDoc.originalName,
            mimeType: previewDoc.mimeType,
            viewUrl: `/api/documents/${previewDoc.id}/view`,
            downloadUrl: `/api/documents/${previewDoc.id}/download`,
            previewHtmlUrl: `/api/documents/${previewDoc.id}/preview-html`,
          }}
          onClose={() => setPreviewDoc(null)}
        />
      )}
    </div>
  );
}
