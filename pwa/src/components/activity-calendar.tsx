import { useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import type { ActivityRow } from "../api/types";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

/** Local calendar-day key (yyyy-MM-dd) for an activity's local start time. */
export const dayKey = (v: string): string => {
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "" : format(d, "yyyy-MM-dd");
};

/**
 * Month grid of the fetched activities. Days with one or more activities are
 * tappable and dotted; selecting one bubbles its day key up so the route can
 * list that day's workouts. The visible month defaults to the most recent
 * activity's month and can be paged, independent of selection.
 */
export function ActivityCalendar({
  activities,
  selected,
  onSelect,
}: {
  activities: ActivityRow[];
  selected: string | null;
  onSelect: (key: string | null) => void;
}) {
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of activities) {
      const k = dayKey(a.start_time_local);
      if (k) m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  }, [activities]);

  // Follows the latest activity until the user pages to another month.
  const defaultMonth = useMemo(() => {
    const latest = activities[0]?.start_time_local;
    const d = latest ? new Date(latest) : new Date();
    return startOfMonth(Number.isNaN(d.getTime()) ? new Date() : d);
  }, [activities]);
  const [override, setOverride] = useState<Date | null>(null);
  const month = override ?? defaultMonth;

  const days = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfWeek(startOfMonth(month)),
        end: endOfWeek(endOfMonth(month)),
      }),
    [month],
  );

  const navClass =
    "flex h-10 w-10 items-center justify-center rounded-lg text-xl text-muted active:bg-surface-2";

  return (
    <div className="rounded-[var(--radius-card)] border border-line/70 bg-surface p-3">
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          aria-label="Previous month"
          className={navClass}
          onClick={() => setOverride(addMonths(month, -1))}
        >
          ‹
        </button>
        <div className="font-semibold text-ink">{format(month, "MMMM yyyy")}</div>
        <button
          type="button"
          aria-label="Next month"
          className={navClass}
          onClick={() => setOverride(addMonths(month, 1))}
        >
          ›
        </button>
      </div>

      <div className="mb-1 grid grid-cols-7 gap-1 text-center text-xs text-muted">
        {WEEKDAYS.map((d, i) => (
          <div key={i}>{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => {
          const key = format(d, "yyyy-MM-dd");
          const count = counts.get(key) ?? 0;
          const has = count > 0;
          const inMonth = isSameMonth(d, month);
          const isSel = selected === key;

          let cls = "text-muted";
          if (isSel) cls = "bg-accent font-semibold text-bg";
          else if (has) cls = "bg-surface-2/60 font-medium text-ink active:bg-surface-2";
          else if (!inMonth) cls = "text-muted/40";
          if (!isSel && isToday(d)) cls += " ring-1 ring-accent";

          return (
            <button
              key={key}
              type="button"
              disabled={!has}
              onClick={() => onSelect(isSel ? null : key)}
              className={
                "relative flex aspect-square flex-col items-center justify-center rounded-lg text-sm " +
                cls
              }
            >
              <span>{format(d, "d")}</span>
              {has && (
                <span
                  className={
                    "absolute bottom-1 h-1.5 w-1.5 rounded-full " +
                    (isSel ? "bg-bg" : "bg-accent")
                  }
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
