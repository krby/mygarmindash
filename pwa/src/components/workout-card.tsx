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
import { MetricRow, Stat, StatGrid } from "./ui";
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
    <section className={"flex flex-col " + (compact ? "gap-4" : "gap-6")}>
      {showHeader && (
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-ink">
            {a.activity_name?.trim() || "Strength workout"}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {formatDateLong(a.start_time_local)} · {formatTime(a.start_time_local)}
          </p>
        </div>
      )}

      {detailed ? (
        <div className="flex flex-col gap-6">
          {metrics.map((m) => (
            <div key={m.key}>
              <h3 className="eyebrow mb-3">{m.label}</h3>
              <StatGrid>
                {m.detail.map((s) => (
                  <Stat key={s.label} label={s.label} value={s.value} />
                ))}
              </StatGrid>
            </div>
          ))}
        </div>
      ) : (
        <MetricRow
          size={compact ? "sm" : "lg"}
          items={metrics.map((m) => ({ label: m.label, value: m.value }))}
        />
      )}

      <div>
        <h3 className="eyebrow mb-3">Exercises</h3>
        <ExerciseSets groups={groups} />
      </div>
    </section>
  );
}
