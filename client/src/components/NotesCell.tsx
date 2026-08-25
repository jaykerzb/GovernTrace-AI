import { useEffect, useRef, useState } from "react";
import { useUpdateSystem } from "../api/systems";

const AUTOSAVE_DELAY_MS = 700;

function autoGrow(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

export function NotesCell({ id, notes, editable }: { id: string; notes: string | null; editable: boolean }) {
  const [value, setValue] = useState(notes ?? "");
  const updateSystem = useUpdateSystem(id);
  const hydratedFor = useRef(id);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Keep in sync if the underlying data changes from elsewhere (e.g. another
  // tab, or a background refetch) without clobbering an in-progress edit.
  useEffect(() => {
    if (hydratedFor.current !== id) {
      hydratedFor.current = id;
      setValue(notes ?? "");
    }
  }, [id, notes]);

  useEffect(() => {
    autoGrow(textareaRef.current);
  }, [value]);

  useEffect(() => {
    if (value === (notes ?? "")) return;
    const timeout = setTimeout(() => {
      updateSystem.mutate({ notes: value });
    }, AUTOSAVE_DELAY_MS);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  if (!editable) {
    return (
      <span className="block min-w-[14rem] max-w-[20rem] whitespace-pre-wrap break-words text-slate-500 dark:text-slate-400">
        {notes || "—"}
      </span>
    );
  }

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      placeholder="Add a note..."
      rows={1}
      className="block min-w-[14rem] max-w-[20rem] resize-none overflow-hidden rounded-md border border-transparent bg-transparent px-2 py-1 text-sm leading-normal text-slate-700 placeholder:text-slate-400 hover:border-slate-200 focus:border-slate-400 focus:bg-white focus:outline-none dark:text-slate-300 dark:placeholder:text-slate-600 dark:hover:border-slate-700 dark:focus:border-slate-500 dark:focus:bg-slate-800"
    />
  );
}
