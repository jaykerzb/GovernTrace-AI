// Shared Tailwind class fragments for form inputs and buttons, pulled out of
// ~15 page/panel files that had each redeclared their own copy (with drift —
// some missing `disabled:opacity-70` on inputs, `disabled:opacity-50` on
// buttons). Editing the shared brand/interaction styling in one place instead
// of two dozen now keeps every input and primary button in sync.

// Full-width form input (label-above layouts: forms, wizards, panels).
export const inputClass =
  "w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2 text-sm focus:border-slate-500 dark:focus:border-slate-400 focus:outline-none disabled:opacity-70";

// Inline/compact input (table filters, admin list rows) — same styling, no
// forced width and slightly tighter vertical padding to match its context.
export const compactInputClass =
  "rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-1.5 text-sm focus:border-slate-500 dark:focus:border-slate-400 focus:outline-none disabled:opacity-70";

// Shared brand color/hover/disabled styling for primary (dark, filled)
// buttons. Callers append their own size utilities (px-*, py-*, text-*) and
// any layout classes (flex, gap, w-full, shrink-0) since those legitimately
// vary by context.
export const primaryButtonBase =
  "rounded-md bg-slate-900 dark:bg-slate-700 font-medium text-white hover:bg-slate-800 dark:hover:bg-slate-600 disabled:opacity-50";
