import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { SystemExportCard } from "../components/SystemExportCard";
import { primaryButtonBase } from "../lib/ui";

export function BulkExportPage() {
  const [searchParams] = useSearchParams();
  const ids = (searchParams.get("ids") ?? "").split(",").filter(Boolean);
  const [fullDetail, setFullDetail] = useState(false);

  return (
    <div className="max-w-3xl space-y-6 print:max-w-none print:space-y-4">
      <div className="flex items-start justify-between print:hidden">
        <Link to="/systems" className="text-xs text-slate-400 hover:underline dark:text-slate-500">
          &larr; Back to Registry
        </Link>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <input type="checkbox" checked={fullDetail} onChange={(e) => setFullDetail(e.target.checked)} />
            Include full work paper detail
          </label>
          <button
            onClick={() => window.print()}
            disabled={ids.length === 0}
            className={`${primaryButtonBase} px-4 py-2 text-sm`}
          >
            Print / Save as PDF
          </button>
        </div>
      </div>

      {ids.length === 0 ? (
        <p className="text-sm text-slate-400 dark:text-slate-500">No use cases selected.</p>
      ) : (
        <>
          <p className="text-sm text-slate-500 dark:text-slate-400 print:hidden">
            {ids.length} governance record{ids.length === 1 ? "" : "s"} — each starts on its own printed page.
          </p>
          <div className="space-y-6">
            {ids.map((id, i) => (
              <div key={id} style={i < ids.length - 1 ? { breakAfter: "page" } : undefined}>
                <SystemExportCard systemId={id} includeFullWorkPapers={fullDetail} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
