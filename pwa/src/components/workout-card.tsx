import type { ReactNode } from "react";
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

interface Metric {
  key: string;
  label: string;
  value: ReactNode;
  /** Sub-stats revealed when this metric is tapped. */
  detail: { label: string; value: ReactNode }[];
}

/**
 * The reusable view for a strength workout. By default only three headline
 * metrics show — Total time, Total cal, Avg HR — kept scannable for summary
 * contexts (Home). The activity-detail route passes `detailed` to reveal each
 * metric's breakdown (e.g. Total time → work, rest, total); that breakdown
 * lives only on the detail page, not behind a tap in the summary.
 */
export function WorkoutCard({
  data,
  showHeader = true,
  detailed = false,
  compact = false,
}: {
  data: ActivityDetailResponse;
  showHeader?: boolean;
  detailed?: boolean;
  /** Tightens padding/text so the three headline stats fit one row on a narrow
   * screen — used in the Activities inline expansion. */
  compact?: boolean;
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

  const metrics: Metric[] = [
    {
      key: "time",
      label: "Total time",
      value: formatDuration(total),
      detail: [
        { label: "Work", value: formatDuration(workSeconds) },
        { label: "Rest", value: formatDuration(restSeconds) },
        { label: "Total", value: formatDuration(total) },
      ],
    },
    {
      key: "cal",
      label: "Total cal",
      value: formatCalories(a.calories),
      detail: [
        { label: "Resting", value: formatCalories(a.bmr_calories) },
        { label: "Active", value: formatCalories(active) },
        { label: "Total", value: formatCalories(a.calories) },
      ],
    },
    {
      key: "hr",
      label: "Avg HR",
      value: formatHr(a.average_hr),
      detail: [
        { label: "Avg", value: formatHr(a.average_hr) },
        { label: "Max", value: formatHr(a.max_hr) },
        { label: "Intensity", value: intensity },
      ],
    },
  ];

  return (
    <Card className={"flex flex-col " + (compact ? "gap-3 p-3!" : "gap-4")}>
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

      {detailed ? (
        <div className="flex flex-col gap-4">
          {metrics.map((m) => (
            <div key={m.key}>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
                {m.label}
              </h3>
              <StatGrid>
                {m.detail.map((s) => (
                  <Stat key={s.label} label={s.label} value={s.value} />
                ))}
              </StatGrid>
            </div>
          ))}
        </div>
      ) : (
        <div className={"grid grid-cols-3 " + (compact ? "gap-1.5" : "gap-2")}>
          {metrics.map((m) => (
            <div
              key={m.key}
              className={
                "min-h-16 rounded-xl bg-surface-2/60 text-center " +
                (compact ? "px-1.5 py-2" : "px-2 py-2.5")
              }
            >
              <div
                className={
                  "font-medium uppercase text-muted " +
                  (compact ? "text-[11px] tracking-tight" : "text-xs tracking-wide")
                }
              >
                {m.label}
              </div>
              <div
                className={
                  "mt-0.5 font-semibold tabular-nums text-ink whitespace-nowrap " +
                  (compact ? "text-sm" : "text-base sm:text-lg")
                }
              >
                {m.value}
              </div>
            </div>
          ))}
        </div>
      )}

      <div>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
          Exercises
        </h3>
        <ExerciseSets groups={groups} />
      </div>
    </Card>
  );
}
