import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useExerciseSets } from "../api/hooks";
import {
  aggregateExercises,
  BODY_PARTS,
  type BodyPart,
  type ExerciseSummary,
} from "../lib/garmin";
import { CollapsibleCard } from "../components/collapsible-card";
import { SetRow } from "../components/exercise-sets";
import { Empty, ErrorState, Loading } from "../components/state";
import { formatDateLongMaybeYear, formatExerciseName } from "../lib/format";

const inputClass =
  "min-h-12 w-full rounded-xl border border-line bg-surface px-4 text-ink placeholder:text-muted";

function ExerciseItem({ ex }: { ex: ExerciseSummary }) {
  const [open, setOpen] = useState(false);
  return (
    <CollapsibleCard
      open={open}
      onToggle={() => setOpen((o) => !o)}
      title={formatExerciseName(ex.name)}
      subtitle={
        <span>
          Last: {formatDateLongMaybeYear(ex.lastDate)} · {ex.totalSessions}{" "}
          {ex.totalSessions === 1 ? "session" : "sessions"}
        </span>
      }
    >
      <div className="flex flex-col gap-5 border-t border-line/50 py-4">
        <div>
          <h3 className="eyebrow mb-3">Recent sessions</h3>
          <div className="flex flex-col gap-4">
            {ex.recentSessions.map((session) => (
              <Link
                key={session.activityId}
                to={`/activities/${session.activityId}`}
                className="block active:opacity-70"
              >
                <div className="mb-1 flex items-center justify-between text-sm font-medium text-accent">
                  <span>{formatDateLongMaybeYear(session.date)}</span>
                  <span aria-hidden="true">→</span>
                </div>
                <ul className="divide-y divide-line/40 border-t border-line/40">
                  {session.sets.map((set, i) => (
                    <SetRow key={i} index={i + 1} set={set} />
                  ))}
                </ul>
              </Link>
            ))}
          </div>
        </div>

        <Link
          to={`/exercises/${encodeURIComponent(ex.name)}`}
          className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-xl border border-line bg-surface px-4 text-sm font-semibold text-ink active:opacity-70"
        >
          View all sessions &amp; records{" "}
          <span className="text-accent" aria-hidden="true">→</span>
        </Link>
      </div>
    </CollapsibleCard>
  );
}

export default function Exercises() {
  const q = useExerciseSets();
  const exercises = useMemo(() => aggregateExercises(q.data ?? []), [q.data]);

  const [search, setSearch] = useState("");
  const [bodyPart, setBodyPart] = useState<BodyPart | "All">("All");

  // Only offer chips for body parts that actually appear, in canonical order.
  const parts = useMemo(() => {
    const present = new Set(exercises.map((e) => e.bodyPart));
    return BODY_PARTS.filter((p) => present.has(p));
  }, [exercises]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return exercises.filter((ex) => {
      if (bodyPart !== "All" && ex.bodyPart !== bodyPart) return false;
      if (!query) return true;
      return (
        formatExerciseName(ex.name).toLowerCase().includes(query) ||
        ex.name.toLowerCase().includes(query)
      );
    });
  }, [exercises, search, bodyPart]);

  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (exercises.length === 0) return <Empty>No exercises logged yet.</Empty>;

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-2xl font-bold text-ink">Exercises</h1>
        <p className="text-sm text-muted">Tap an exercise to see your records</p>
      </header>

      <div className="flex flex-col gap-3">
        <input
          type="search"
          inputMode="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search exercises…"
          className={inputClass}
          aria-label="Search exercises"
        />
        <div className="flex flex-wrap gap-2">
          {(["All", ...parts] as const).map((p) => {
            const active = bodyPart === p;
            return (
              <button
                key={p}
                type="button"
                onClick={() => setBodyPart(p)}
                className={
                  "inline-flex min-h-12 items-center rounded-full border px-4 text-sm font-medium transition-colors " +
                  (active
                    ? "border-accent/40 bg-accent/10 text-accent"
                    : "border-line text-muted active:bg-surface-2/70")
                }
              >
                {p}
              </button>
            );
          })}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="py-12 text-center text-muted">No exercises match your filters.</p>
      ) : (
        <ul className="flex flex-col border-t border-line/70">
          {filtered.map((ex) => (
            <ExerciseItem key={ex.name} ex={ex} />
          ))}
        </ul>
      )}
    </div>
  );
}
