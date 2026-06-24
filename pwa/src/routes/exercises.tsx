import { useMemo, useState } from "react";
import { useExerciseSets } from "../api/hooks";
import { aggregateExercises, type ExerciseSummary } from "../lib/garmin";
import { Stat, StatGrid } from "../components/ui";
import { Empty, ErrorState, Loading } from "../components/state";
import {
  GRAMS_PER_POUND,
  formatDateLong,
  formatExerciseName,
  formatStrengthWeight,
} from "../lib/format";

const formatVolume = (grams: number | null): string => {
  if (grams == null || grams <= 0) return "—";
  return `${Math.round(grams / GRAMS_PER_POUND).toLocaleString()} lb`;
};

function ExerciseItem({ ex }: { ex: ExerciseSummary }) {
  const [open, setOpen] = useState(false);
  const r = ex.record;
  return (
    <li className="overflow-hidden rounded-2xl border border-line/60 bg-surface">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left active:bg-surface-2/50"
      >
        <div className="min-w-0">
          <div className="truncate font-semibold text-ink">
            {formatExerciseName(ex.name)}
          </div>
          <div className="mt-0.5 text-sm text-muted">
            Last: {formatDateLong(ex.lastDate)} · {ex.totalSessions}{" "}
            {ex.totalSessions === 1 ? "session" : "sessions"}
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
        <div className="flex flex-col gap-4 border-t border-line/60 p-4">
          <div>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
              Record
            </h3>
            <StatGrid>
              <Stat label="Heaviest" value={formatStrengthWeight(r.maxWeightGrams)} />
              <Stat label="Max reps" value={r.maxReps ?? "—"} />
              <Stat label="Est. 1RM" value={formatStrengthWeight(r.bestEst1RmGrams)} />
              <Stat label="Best volume" value={formatVolume(r.bestSessionVolumeGrams)} />
            </StatGrid>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
              Last session · {formatDateLong(ex.lastDate)}
            </h3>
            <ul className="divide-y divide-line/40 rounded-xl bg-surface-2/50 px-3">
              {ex.recentSets.map((set, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between py-1.5 text-sm"
                >
                  <span className="text-muted">Set {i + 1}</span>
                  <span className="font-medium tabular-nums text-ink">
                    {set.reps != null ? `${set.reps} reps` : "—"}
                  </span>
                  <span className="tabular-nums text-muted">
                    {formatStrengthWeight(set.weightGrams)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </li>
  );
}

export default function Exercises() {
  const q = useExerciseSets();
  const exercises = useMemo(() => aggregateExercises(q.data ?? []), [q.data]);

  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (exercises.length === 0) return <Empty>No exercises logged yet.</Empty>;

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-2xl font-bold text-ink">Exercises</h1>
        <p className="text-sm text-muted">Tap an exercise to see your records</p>
      </header>
      <ul className="flex flex-col gap-2">
        {exercises.map((ex) => (
          <ExerciseItem key={ex.name} ex={ex} />
        ))}
      </ul>
    </div>
  );
}
