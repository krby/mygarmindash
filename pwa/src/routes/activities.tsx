import { useMemo, useState } from "react";
import { useActivities, useActivity, usePrefetchActivities } from "../api/hooks";
import type { ActivityRow } from "../api/types";
import { WorkoutCard } from "../components/workout-card";
import { ErrorState, Loading } from "../components/state";
import { formatDateLong, formatDistance, formatDuration } from "../lib/format";

const RANGE_OPTIONS = [30, 90, 180, 365];

const selectClass =
  "min-h-12 w-full rounded-xl border border-line bg-surface-2 px-3 text-ink";

function ExpandedActivity({ id }: { id: string }) {
  const q = useActivity(id);
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (!q.data) return null;
  return <WorkoutCard data={q.data} showHeader={false} />;
}

function ActivityItem({
  activity: a,
  open,
  onToggle,
}: {
  activity: ActivityRow;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <li className="overflow-hidden rounded-2xl border border-line/60 bg-surface">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left active:bg-surface-2/50"
      >
        <div className="min-w-0">
          <div className="truncate font-semibold text-ink">
            {a.activity_name?.trim() || a.activity_type || "Activity"}
          </div>
          <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-sm text-muted">
            <span>{formatDateLong(a.start_time_local)}</span>
            {a.distance_meters != null && <span>{formatDistance(a.distance_meters)}</span>}
            <span>{formatDuration(a.duration_seconds)}</span>
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
      {open && (
        <div className="border-t border-line/60 p-3">
          <ExpandedActivity id={String(a.activity_id)} />
        </div>
      )}
    </li>
  );
}

export default function Activities() {
  const [days, setDays] = useState(30);
  const [type, setType] = useState<string>("");
  const [openId, setOpenId] = useState<number | null>(null);
  const q = useActivities(days, type || undefined);
  usePrefetchActivities(q.data, 5);

  const types = useMemo(() => {
    const set = new Set<string>();
    for (const a of q.data ?? []) {
      if (a.activity_type) set.add(a.activity_type);
    }
    return Array.from(set).sort();
  }, [q.data]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold text-ink">Activities</h1>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-xs text-muted">
          Range
          <select
            className={selectClass}
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            {RANGE_OPTIONS.map((d) => (
              <option key={d} value={d}>
                {d}d
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Type
          <select
            className={selectClass}
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="">All</option>
            {types.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
      </div>

      {q.isLoading ? (
        <Loading />
      ) : q.error ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : (q.data ?? []).length === 0 ? (
        <p className="py-12 text-center text-muted">No activities in this range.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {q.data!.map((a) => (
            <ActivityItem
              key={a.activity_id}
              activity={a}
              open={openId === a.activity_id}
              onToggle={() =>
                setOpenId((cur) => (cur === a.activity_id ? null : a.activity_id))
              }
            />
          ))}
        </ul>
      )}
    </div>
  );
}
