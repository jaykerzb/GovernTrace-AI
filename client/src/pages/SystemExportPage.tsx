import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useSystem } from "../api/systems";
import { SystemExportCard } from "../components/SystemExportCard";
import { primaryButtonBase } from "../lib/ui";

export function SystemExportPage() {
  const { id } = useParams();
  const { data: system } = useSystem(id);
  const [searchParams, setSearchParams] = useSearchParams();
  const [fullDetail, setFullDetail] = useState(searchParams.get("full") === "1");

  if (!id || !system) {
    return <p className="text-slate-500 dark:text-slate-400">Loading export...</p>;
  }

  function toggleFullDetail(checked: boolean) {
    setFullDetail(checked);
    setSearchParams(checked ? { full: "1" } : {});
  }

  return (
    <div className="max-w-3xl space-y-6 print:max-w-none print:space-y-4">
      <div className="flex items-start justify-between print:hidden">
        <Link to={`/systems/${id}`} className="text-xs text-slate-400 hover:underline dark:text-slate-500">
          &larr; Back to {system.name}
        </Link>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <input type="checkbox" checked={fullDetail} onChange={(e) => toggleFullDetail(e.target.checked)} />
            Include full work paper detail
          </label>
          <button onClick={() => window.print()} className={`${primaryButtonBase} px-4 py-2 text-sm`}>
            Print / Save as PDF
          </button>
        </div>
      </div>

      <SystemExportCard systemId={id} includeFullWorkPapers={fullDetail} />
    </div>
  );
}
