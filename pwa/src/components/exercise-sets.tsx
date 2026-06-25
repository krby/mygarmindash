import type { ExerciseGroup } from "../lib/garmin";
import { formatExerciseName, formatStrengthWeight } from "../lib/format";

/** One `Set N · reps · weight` row. Only needs reps + weight, so both
 * `ParsedExerciseSet` and the lighter `RecentSet` satisfy it. */
export function SetRow({
  index,
  set,
}: {
  index: number;
  set: { reps: number | null; weightGrams: number | null };
}) {
  const reps = set.reps != null ? `${set.reps} reps` : "—";
  const weight = formatStrengthWeight(set.weightGrams);
  return (
    <li className="grid grid-cols-3 items-center py-2 text-sm">
      <span className="text-muted tabular-nums">Set {index}</span>
      <span className="text-center font-medium tabular-nums text-ink">{reps}</span>
      <span className="text-right tabular-nums text-muted">{weight}</span>
    </li>
  );
}

/** Renders grouped exercises, each with its individual sets (reps + weight). */
export function ExerciseSets({ groups }: { groups: ExerciseGroup[] }) {
  if (groups.length === 0) {
    return <p className="text-sm text-muted">No exercises logged for this workout.</p>;
  }
  return (
    <div className="flex flex-col divide-y divide-line/70">
      {groups.map((group, gi) => (
        <div key={`${group.name}-${gi}`} className="py-3 first:pt-0 last:pb-0">
          <div className="flex items-baseline justify-between">
            <h4 className="font-semibold text-ink">
              {formatExerciseName(group.name)}
            </h4>
            <span className="eyebrow">{group.sets.length} sets</span>
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
