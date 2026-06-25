import type { ReactNode } from "react";

/**
 * Quiet surface frame. In the editorial-dark language a Card is barely raised —
 * a hairline border on a near-black ground, no heavy drop shadow — so the
 * content (oversized numbers, hairline-separated rows) carries the eye.
 */
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
        "rounded-[var(--radius-card)] border border-line/70 bg-surface p-4 " +
        className
      }
    >
      {children}
    </div>
  );
}

/**
 * A single labelled metric: big tabular number with a tiny uppercase eyebrow.
 * Borderless by design — structure comes from the parent's hairline dividers or
 * whitespace, not from a box around each value.
 */
export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="metric text-xl font-semibold sm:text-2xl">{value}</div>
      <div className="eyebrow">{label}</div>
    </div>
  );
}

/** Grid of Stat cells. Defaults to 3 columns (metric breakdowns); pass `cols={2}`
 * for an even 2×2 (e.g. a 4-item records grid). */
export function StatGrid({
  children,
  cols = 3,
}: {
  children: ReactNode;
  cols?: 2 | 3;
}) {
  return (
    <div
      className={
        "grid gap-x-3 gap-y-5 " + (cols === 2 ? "grid-cols-2" : "grid-cols-3")
      }
    >
      {children}
    </div>
  );
}

/**
 * The signature editorial layout: three (or more) headline numbers in a row,
 * divided by vertical hairlines, framed top and bottom by a rule. Each item is
 * `{ label, value }`.
 */
export function MetricRow({
  items,
  size = "lg",
}: {
  items: { label: string; value: ReactNode }[];
  /** `lg` = hero (Home/detail); `sm` = tightened for inline list expansions. */
  size?: "lg" | "sm";
}) {
  return (
    <div className="grid grid-cols-3 divide-x divide-line/70 border-y border-line/70">
      {items.map((m, i) => (
        <div
          key={i}
          className={
            "flex flex-col items-center gap-1.5 text-center " +
            (size === "lg" ? "py-4" : "py-3")
          }
        >
          <div
            className={
              "metric font-semibold whitespace-nowrap " +
              (size === "lg" ? "text-2xl sm:text-3xl" : "text-xl")
            }
          >
            {m.value}
          </div>
          <div className="eyebrow">{m.label}</div>
        </div>
      ))}
    </div>
  );
}

/** Small inline pill/badge. */
export function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-accent/30 bg-accent/10 px-2.5 py-0.5 text-xs font-medium text-accent">
      {children}
    </span>
  );
}
