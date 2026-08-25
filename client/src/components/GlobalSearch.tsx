import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSystems } from "../api/systems";
import { useDocumentSearch } from "../api/documentSearch";
import { usePolicySearch } from "../api/policySearch";
import { SearchIcon } from "./Icons";

// Splits `text` on the (case-insensitive) matched substring so it can be
// rendered bold — client-side only, no server-generated HTML.
function Highlighted({ text, query }: { text: string; query: string }) {
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <strong className="font-semibold text-slate-900 dark:text-slate-100">{text.slice(idx, idx + query.length)}</strong>
      {text.slice(idx + query.length)}
    </>
  );
}

export function GlobalSearch() {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);

  const { data: results } = useSystems(debounced.length >= 2 ? { q: debounced } : {});
  const { data: documentResults } = useDocumentSearch(debounced);
  const { data: policyResults } = usePolicySearch(debounced);
  const showResults = open && debounced.length >= 2;

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onEscape);
    };
  }, []);

  function goToSystem(id: string) {
    setOpen(false);
    setQuery("");
    navigate(`/systems/${id}`);
  }

  const hasSystemResults = !!results && results.length > 0;
  const hasDocumentResults = !!documentResults && documentResults.length > 0;
  const hasPolicyResults = !!policyResults && policyResults.length > 0;

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Search use cases and documents..."
          className="w-full rounded-md border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-2 text-xs text-slate-700 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:placeholder:text-slate-500"
        />
      </div>

      {showResults && (
        <div className="absolute left-0 top-full z-50 mt-1 max-h-96 w-80 overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800">
          {!hasSystemResults && !hasDocumentResults && !hasPolicyResults ? (
            <div className="px-3 py-4 text-center text-xs text-slate-400 dark:text-slate-500">No matches.</div>
          ) : (
            <>
              {hasSystemResults && (
                <div>
                  <div className="px-3 pt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    Use Cases
                  </div>
                  <ul className="divide-y divide-slate-100 dark:divide-slate-700">
                    {results!.slice(0, 8).map((s) => (
                      <li key={s.id}>
                        <button
                          onClick={() => goToSystem(s.id)}
                          className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50"
                        >
                          <span className="truncate text-xs font-medium text-slate-900 dark:text-slate-100">{s.name}</span>
                          <span className="text-[11px] text-slate-400 dark:text-slate-500">{s.businessUnit}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {hasDocumentResults && (
                <div>
                  <div className="px-3 pt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    Documents
                  </div>
                  <ul className="divide-y divide-slate-100 dark:divide-slate-700">
                    {documentResults!.map((d) => (
                      <li key={d.id} className="flex items-start justify-between gap-2 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                        <button onClick={() => goToSystem(d.aiSystemId)} className="min-w-0 flex-1 text-left">
                          <span className="block truncate text-xs font-medium text-slate-900 dark:text-slate-100">
                            <Highlighted text={d.originalName} query={debounced} />
                          </span>
                          <span className="block text-[11px] text-slate-400 dark:text-slate-500">{d.aiSystemName}</span>
                          {d.snippet && (
                            <span className="mt-0.5 block text-[11px] text-slate-500 dark:text-slate-400">
                              <Highlighted text={d.snippet} query={debounced} />
                            </span>
                          )}
                        </button>
                        <a
                          href={`/api/documents/${d.id}/view`}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="shrink-0 pt-0.5 text-[11px] font-medium text-slate-500 hover:underline dark:text-slate-400"
                        >
                          Open
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {hasPolicyResults && (
                <div>
                  <div className="px-3 pt-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                    Policies
                  </div>
                  <ul className="divide-y divide-slate-100 dark:divide-slate-700">
                    {policyResults!.map((p) => (
                      <li key={p.id} className="flex items-start justify-between gap-2 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                        <Link
                          to="/policies"
                          onClick={() => {
                            setOpen(false);
                            setQuery("");
                          }}
                          className="min-w-0 flex-1 text-left"
                        >
                          <span className="block truncate text-xs font-medium text-slate-900 dark:text-slate-100">
                            <Highlighted text={p.title} query={debounced} />
                          </span>
                          {p.snippet && (
                            <span className="mt-0.5 block text-[11px] text-slate-500 dark:text-slate-400">
                              <Highlighted text={p.snippet} query={debounced} />
                            </span>
                          )}
                        </Link>
                        <a
                          href={`/api/policies/${p.id}/view`}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="shrink-0 pt-0.5 text-[11px] font-medium text-slate-500 hover:underline dark:text-slate-400"
                        >
                          Open
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
