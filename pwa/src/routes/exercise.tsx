import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useExerciseSets } from "../api/hooks";
import { exerciseDetail } from "../lib/garmin";
import { Card, Pill, Stat, StatGrid } from "../components/ui";
import { SetRow } from "../components/exercise-sets";
import { ErrorState, Loading } from "../components/state";
import {
  GRAMS_PER_POUND,
  formatDateLongMaybeYear,
  formatExerciseName,
  formatStrengthWeight,
} from "../lib/format";

/** How many sessions to reveal per "Show more" tap. */
const PAGE = 10;

const formatVolume = (grams: number | null): string => {
  if (grams == null || grams <= 0) return "—";
  return `${Math.round(grams / GRAMS_PER_POUND).toLocaleString()} lb`;
};

export default function Exercise() {
  const { name: rawName } = useParams<{ name: string }>();
  const name = rawName ?? "";
  const navigate = useNavigate();
  const q = useExerciseSets();

  // Reuses the cached /api/exercise-sets payload — no per-exercise fetch.
  const detail = useMemo(
    () => (name ? exerciseDetail(q.data ?? [], name) : null),
    [q.data, name],
  );

  // Render only a window of sessions; "Show more" widens it (no refetch).
  const [visible, setVisible] = useState(PAGE);

  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (!detail) {
    return (
      <div className="flex flex-col gap-4">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="self-start text-sm font-medium text-accent"
        >
          ← Back
        </button>
        <p className="py-12 text-center text-muted">Exercise not found.</p>
      </div>
    );
  }

  const r = detail.record;
  const shown = detail.sessions.slice(0, visible);
  const remaining = detail.sessions.length - shown.length;

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="self-start text-sm font-medium text-accent"
      >
        ← Back
      </button>

      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-ink">{formatExerciseName(detail.name)}</h1>
        <div className="flex items-center gap-2 text-sm text-muted">
          <Pill>{detail.bodyPart}</Pill>
          <span>
            {detail.totalSessions}{" "}
            {detail.totalSessions === 1 ? "session" : "sessions"} · last{" "}
            {formatDateLongMaybeYear(detail.lastDate)}
          </span>
        </div>
      </header>

      <Card>
        <h2 className="eyebrow mb-4">Records</h2>
        <StatGrid cols={2}>
          <Stat label="Heaviest" value={formatStrengthWeight(r.maxWeightGrams)} />
          <Stat label="Max reps" value={r.maxReps ?? "—"} />
          <Stat label="Est. 1RM" value={formatStrengthWeight(r.bestEst1RmGrams)} />
          <Stat label="Best volume" value={formatVolume(r.bestSessionVolumeGrams)} />
        </StatGrid>
      </Card>

      <section className="flex flex-col gap-4">
        <h2 className="eyebrow">All sessions</h2>
        {shown.map((session) => (
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

        {remaining > 0 && (
          <button
            type="button"
            onClick={() => setVisible((v) => v + PAGE)}
            className="min-h-12 rounded-xl border border-line bg-surface px-4 text-sm font-semibold text-ink active:opacity-70"
          >
            Show more ({remaining} left)
          </button>
        )}
      </section>
    </div>
  );
}
