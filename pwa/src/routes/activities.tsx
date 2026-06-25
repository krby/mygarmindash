import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useActivities, useActivity, usePrefetchActivities } from "../api/hooks";
import type { ActivityRow } from "../api/types";
import { WorkoutCard } from "../components/workout-card";
import { CollapsibleCard } from "../components/collapsible-card";
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
  return (
    <div className="flex flex-col gap-3">
      <WorkoutCard data={q.data} showHeader={false} compact />
      <Link
        to={`/activities/${id}`}
        className="flex min-h-12 items-center justify-center rounded-xl bg-accent px-4 text-sm font-semibold text-white active:opacity-80"
      >
        See more details
      </Link>
    </div>
  );
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
  // Hide distance for strength/indoor activities, where it's null or rounds to 0.00 mi.
  const dist = a.distance_meters != null ? formatDistance(a.distance_meters) : null;
  const distance = dist && dist !== "0.00 mi" && dist !== "—" ? dist : null;
  return (
    <CollapsibleCard
      open={open}
      onToggle={onToggle}
      title={a.activity_name?.trim() || a.activity_type || "Activity"}
      subtitle={
        <>
          <span>{formatDateLong(a.start_time_local)}</span>
          {distance && <span>{distance}</span>}
          <span>{formatDuration(a.duration_seconds)}</span>
        </>
      }
    >
      <div className="border-t border-line/60 px-2 py-3">
        <ExpandedActivity id={String(a.activity_id)} />
      </div>
    </CollapsibleCard>
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
