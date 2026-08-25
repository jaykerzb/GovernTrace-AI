import { Link, useSearchParams } from "react-router-dom";
import { SystemExportCard } from "../components/SystemExportCard";

export function BulkExportPage() {
  const [searchParams] = useSearchParams();
  const ids = (searchParams.get("ids") ?? "").split(",").filter(Boolean);

  return (
    <div className="max-w-3xl space-y-6 print:max-w-none print:space-y-4">
      <div className="flex items-start justify-between print:hidden">
        <Link to="/systems" className="text-xs text-slate-400 hover:underline dark:text-slate-500">
          &larr; Back to Registry
        </Link>
        <button
          onClick={() => window.print()}
          disabled={ids.length === 0}
          className="rounded-md bg-slate-900 dark:bg-slate-700 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 dark:hover:bg-slate-600 disabled:opacity-50"
        >
          Print / Save as PDF
        </button>
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
                <SystemExportCard systemId={id} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
