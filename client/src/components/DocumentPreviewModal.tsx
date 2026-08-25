import { useEffect } from "react";
import { DownloadIcon } from "./Icons";

// Office formats converted to HTML server-side for inline preview (see
// server/src/services/textExtraction.ts's HTML_PREVIEWABLE_MIME_TYPES).
const OFFICE_HTML_PREVIEWABLE_MIME_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "application/vnd.openxmlformats-officedocument.presentationml.presentation", // .pptx
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
]);

function isPreviewable(mimeType: string): boolean {
  return mimeType.startsWith("image/") || mimeType === "application/pdf" || mimeType.startsWith("text/");
}

export interface PreviewableFile {
  originalName: string;
  mimeType: string;
  viewUrl: string;
  downloadUrl: string;
  // Converts the file to an HTML page for inline preview (.docx/.pptx/.xlsx)
  // — omit for file types without a converter.
  previewHtmlUrl?: string;
}

export function DocumentPreviewModal({ file, onClose }: { file: PreviewableFile; onClose: () => void }) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const { originalName, mimeType, viewUrl, downloadUrl, previewHtmlUrl } = file;
  const previewable = isPreviewable(mimeType);
  const isOfficeHtmlPreviewable = OFFICE_HTML_PREVIEWABLE_MIME_TYPES.has(mimeType);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="flex h-full max-h-[85vh] w-full max-w-4xl flex-col rounded-xl bg-white dark:bg-slate-900 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 dark:border-slate-800 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-200">{originalName}</p>
            <p className="text-xs text-slate-400 dark:text-slate-500">{mimeType}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <a
              href={downloadUrl}
              className="flex items-center gap-1.5 rounded-md border border-slate-300 dark:border-slate-600 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <DownloadIcon className="h-3.5 w-3.5" />
              Download
            </a>
            <button
              onClick={onClose}
              className="rounded-md px-2.5 py-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Close
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto bg-slate-50 dark:bg-slate-950">
          {mimeType.startsWith("image/") ? (
            <div className="flex h-full items-center justify-center p-4">
              <img src={viewUrl} alt={originalName} className="max-h-full max-w-full object-contain" />
            </div>
          ) : mimeType === "application/pdf" ? (
            <embed src={viewUrl} type="application/pdf" title={originalName} className="h-full w-full" />
          ) : isOfficeHtmlPreviewable && previewHtmlUrl ? (
            <iframe src={previewHtmlUrl} title={originalName} className="h-full w-full border-0 bg-white" />
          ) : previewable ? (
            <iframe src={viewUrl} title={originalName} className="h-full w-full border-0 bg-white" />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No inline preview is available for this file type.
              </p>
              <a
                href={downloadUrl}
                className="flex items-center gap-1.5 rounded-md bg-slate-900 dark:bg-slate-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 dark:hover:bg-slate-600"
              >
                <DownloadIcon className="h-4 w-4" />
                Download to View
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
