import { useEffect, useRef, useState, type ReactNode } from "react";

export interface SectionNavItem {
  id: string;
  label: string;
}

// A jump-to-section nav for long pages (an AI use case's detail page, a work
// paper, the dashboard). Renders two ways depending on viewport width:
//  - xl and up (>=1280px, this app's typical desktop/laptop target): a
//    floating "On This Page" card fixed to the top-right corner of the
//    viewport, listing every section vertically — no horizontal scrolling,
//    and it doesn't compete with the page's own column width since it
//    floats over the right margin rather than living in the content flow.
//  - below xl (a split-screened or narrower window, where there's no room
//    for a floating card without overlapping content): the original sticky
//    horizontal bar.
// Both are rendered at all times and toggled with Tailwind's `xl:` classes
// (not JS/matchMedia) so there's no remount or duplicate-id churn crossing
// the breakpoint — only one is ever visible.
// Both highlight whichever section is currently in view via
// IntersectionObserver, not just on click. `title`, if given, stays pinned
// alongside the pills/list — e.g. the record's name — so context isn't lost
// once the page's own header scrolls away.
export function SectionNav({ items, title }: { items: SectionNavItem[]; title?: ReactNode }) {
  const [activeId, setActiveId] = useState(items[0]?.id);
  const clickScrollingRef = useRef(false);
  const listRef = useRef<HTMLUListElement>(null);
  const pillRefs = useRef(new Map<string, HTMLButtonElement>());

  // Keeps the active pill scrolled into view within the horizontal bar
  // variant's own row — otherwise, on a page with many sections, the
  // highlighted pill can end up scrolled off to the side and invisible even
  // though it's technically "active." Deliberately moves only the list's
  // own scrollLeft rather than calling scrollIntoView on the pill —
  // scrollIntoView walks every scrollable ancestor, and since the pill's
  // nearest vertical scroll ancestor is the same `main` element the page
  // itself scrolls in, it would fight (and cancel) the page-level
  // smooth-scroll a section click just kicked off.
  useEffect(() => {
    const list = listRef.current;
    const pill = activeId ? pillRefs.current.get(activeId) : undefined;
    if (!list || !pill) return;
    const listRect = list.getBoundingClientRect();
    const pillRect = pill.getBoundingClientRect();
    if (pillRect.left < listRect.left) {
      list.scrollBy({ left: pillRect.left - listRect.left - 16, behavior: "smooth" });
    } else if (pillRect.right > listRect.right) {
      list.scrollBy({ left: pillRect.right - listRect.right + 16, behavior: "smooth" });
    }
  }, [activeId]);

  useEffect(() => {
    const elements = items.map((item) => document.getElementById(item.id)).filter((el): el is HTMLElement => !!el);
    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Ignore intersection updates triggered by our own smooth-scroll —
        // otherwise the highlight flickers through every section it passes.
        if (clickScrollingRef.current) return;
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length === 0) return;
        const topMost = visible.reduce((a, b) => (a.boundingClientRect.top < b.boundingClientRect.top ? a : b));
        setActiveId(topMost.target.id);
      },
      { rootMargin: "-96px 0px -70% 0px", threshold: 0 }
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [items]);

  function handleClick(id: string) {
    const el = document.getElementById(id);
    if (!el) return;
    clickScrollingRef.current = true;
    setActiveId(id);
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    // scrollIntoView has no completion callback — a fixed delay is the
    // simplest way to resume observer-driven highlighting once it settles.
    window.setTimeout(() => {
      clickScrollingRef.current = false;
    }, 700);
  }

  if (items.length === 0) return null;

  return (
    <>
      {/* Floating "On This Page" card — wide desktop viewports only. */}
      <nav className="fixed right-6 top-6 z-40 hidden w-max min-w-56 max-w-sm rounded-xl border border-slate-200 bg-white/95 p-3 shadow-lg backdrop-blur xl:block dark:border-slate-800 dark:bg-slate-900/95">
        {title && (
          <div className="mb-2 flex min-w-0 flex-col items-start gap-1 border-b border-slate-100 dark:border-slate-800 pb-2">
            {title}
          </div>
        )}
        <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
          On This Page
        </p>
        <ul className="space-y-0.5">
          {items.map((item) => (
            <li key={item.id}>
              <button
                onClick={() => handleClick(item.id)}
                className={`block w-full rounded-md px-2 py-1.5 text-left text-xs font-medium leading-snug transition-colors ${
                  activeId === item.id
                    ? "bg-slate-900 text-white dark:bg-slate-700"
                    : "text-slate-500 hover:bg-slate-200 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                }`}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Sticky horizontal bar — fallback for narrower / split-screen windows. */}
      <nav className="sticky top-0 z-10 rounded-xl border border-slate-200 bg-white/95 px-4 py-2.5 shadow-sm backdrop-blur xl:hidden dark:border-slate-800 dark:bg-slate-900/95">
        {title && <div className="mb-1.5 flex min-w-0 items-center gap-2">{title}</div>}
        {/* A single scrolling row, not a wrapped grid — a page with many
            sections (e.g. a work paper's per-section pills) would otherwise
            push the sticky bar's height up and eat a chunk of the viewport. */}
        <ul
          ref={listRef}
          className="flex gap-1 overflow-x-auto pb-0.5 [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 dark:[&::-webkit-scrollbar-thumb]:bg-slate-700 [&::-webkit-scrollbar-track]:bg-transparent"
        >
          {items.map((item) => (
            <li key={item.id} className="shrink-0">
              <button
                ref={(el) => {
                  if (el) pillRefs.current.set(item.id, el);
                  else pillRefs.current.delete(item.id);
                }}
                onClick={() => handleClick(item.id)}
                className={`whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  activeId === item.id
                    ? "bg-slate-900 text-white dark:bg-slate-700"
                    : "text-slate-500 hover:bg-slate-200 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                }`}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
