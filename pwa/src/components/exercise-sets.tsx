import type { ExerciseGroup, ParsedExerciseSet } from "../lib/garmin";
import { formatExerciseName, formatStrengthWeight } from "../lib/format";

/** One `Set N · reps · weight` row. */
function SetRow({ index, set }: { index: number; set: ParsedExerciseSet }) {
  const reps = set.reps != null ? `${set.reps} reps` : "—";
  const weight = formatStrengthWeight(set.weightGrams);
  return (
    <li className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-muted">Set {index}</span>
      <span className="font-medium tabular-nums text-ink">{reps}</span>
      <span className="tabular-nums text-muted">{weight}</span>
    </li>
  );
}

/** Renders grouped exercises, each with its individual sets (reps + weight). */
export function ExerciseSets({ groups }: { groups: ExerciseGroup[] }) {
  if (groups.length === 0) {
    return <p className="text-sm text-muted">No exercises logged for this workout.</p>;
  }
  return (
    <div className="flex flex-col gap-3">
      {groups.map((group, gi) => (
        <div
          key={`${group.name}-${gi}`}
          className="rounded-xl bg-surface-2/50 px-3 py-2.5"
        >
          <div className="flex items-baseline justify-between">
            <h3 className="font-semibold text-ink">
              {formatExerciseName(group.name)}
            </h3>
            <span className="text-xs text-muted">{group.sets.length} sets</span>
          </div>
          <ul className="mt-1 divide-y divide-line/40">
            {group.sets.map((set, si) => (
              <SetRow key={si} index={si + 1} set={set} />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
