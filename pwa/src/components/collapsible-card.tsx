import type { ReactNode } from "react";

/**
 * A list-item card with a tappable header that expands to reveal `children`.
 * Used by the Activities and Exercises lists. `open`/`onToggle` are controlled
 * by the caller, so a list can keep at most one row open if it wants.
 */
export function CollapsibleCard({
  title,
  subtitle,
  open,
  onToggle,
  children,
}: {
  title: ReactNode;
  subtitle: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <li className="overflow-hidden rounded-2xl border border-line/60 bg-surface">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left active:bg-surface-2/50"
      >
        <div className="min-w-0">
          <div className="truncate font-semibold text-ink">{title}</div>
          <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-sm text-muted">
            {subtitle}
          </div>
        </div>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={"h-5 w-5 shrink-0 text-muted transition-transform " + (open ? "rotate-180" : "")}
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && children}
    </li>
  );
}
