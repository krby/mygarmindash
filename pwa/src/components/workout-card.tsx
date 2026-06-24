import type { ActivityDetailResponse } from "../api/types";
import {
  formatCalories,
  formatDateLong,
  formatDuration,
  formatHr,
  formatTime,
} from "../lib/format";
import { groupExerciseSets, setDurationsByType } from "../lib/garmin";
import { Card, Stat, StatGrid } from "./ui";
import { ExerciseSets } from "./exercise-sets";

/**
 * The reusable "full detail" view for a strength workout: date, duration split,
 * calories, intensity minutes, HR, and per-set exercises. Used by Home, the
 * Activities inline expansion, and the activity-detail route.
 */
export function WorkoutCard({
  data,
  showHeader = true,
}: {
  data: ActivityDetailResponse;
  showHeader?: boolean;
}) {
  const { activity: a, exercise_sets } = data;
  const groups = groupExerciseSets(exercise_sets);
  const { workSeconds, restSeconds } = setDurationsByType(exercise_sets);

  const total = a.elapsed_duration_seconds ?? a.duration_seconds;
  const active =
    a.calories != null && a.bmr_calories != null ? a.calories - a.bmr_calories : null;
  const intensity =
    a.moderate_intensity_minutes == null && a.vigorous_intensity_minutes == null
      ? "—"
      : `${Math.round(a.moderate_intensity_minutes ?? 0)} / ${Math.round(
          a.vigorous_intensity_minutes ?? 0,
        )} min`;

  return (
    <Card className="flex flex-col gap-4">
      {showHeader && (
        <div>
          <h2 className="text-xl font-bold text-ink">
            {a.activity_name?.trim() || "Strength workout"}
          </h2>
          <p className="mt-0.5 text-sm text-muted">
            {formatDateLong(a.start_time_local)} · {formatTime(a.start_time_local)}
          </p>
        </div>
      )}

      <StatGrid>
        <Stat label="Total" value={formatDuration(total)} />
        <Stat label="Work" value={formatDuration(workSeconds)} />
        <Stat label="Rest" value={formatDuration(restSeconds)} />
        <Stat label="Resting" value={formatCalories(a.bmr_calories)} />
        <Stat label="Active" value={formatCalories(active)} />
        <Stat label="Total cal" value={formatCalories(a.calories)} />
        <Stat label="Intensity" value={intensity} />
        <Stat label="Avg HR" value={formatHr(a.average_hr)} />
        <Stat label="Max HR" value={formatHr(a.max_hr)} />
      </StatGrid>

      <div>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
          Exercises
        </h3>
        <ExerciseSets groups={groups} />
      </div>
    </Card>
  );
}
