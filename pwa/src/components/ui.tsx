import type { ReactNode } from "react";

/** Rounded surface card — the base container for every section. */
export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={
        "rounded-2xl border border-line/60 bg-surface p-4 shadow-lg shadow-black/20 " +
        className
      }
    >
      {children}
    </div>
  );
}

/** A labelled metric tile used inside StatGrid. */
export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl bg-surface-2/60 px-3 py-2.5">
      <div className="text-xs font-medium uppercase tracking-wide text-muted">
        {label}
      </div>
      <div className="mt-0.5 text-lg font-semibold tabular-nums text-ink">{value}</div>
    </div>
  );
}

/** Responsive grid of Stat tiles. */
export function StatGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-3 gap-2">{children}</div>;
}

/** Small inline pill/badge. */
export function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-medium text-accent">
      {children}
    </span>
  );
}
