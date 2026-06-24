import type {
  ActivityExerciseSet,
  ActivityHrZonesRow,
  ExerciseSetAgg,
} from "../api/types";
import { METERS_PER_MILE } from "./format";

/** Pace in seconds per mile from speed in m/s. Null if speed isn't positive. */
export const paceSecPerMile = (speedMps: number | null | undefined): number | null => {
  const s = Number(speedMps);
  return Number.isFinite(s) && s > 0 ? METERS_PER_MILE / s : null;
};

export interface HrZone {
  zone: 1 | 2 | 3 | 4 | 5;
  seconds: number;
}

/** Reshape the wide hr-zones row (zone1_seconds…zone5_seconds) into chart-ready rows. */
export const hrZonesAsArray = (row: ActivityHrZonesRow | null): HrZone[] => {
  if (!row) return [];
  const cols: { zone: HrZone["zone"]; key: keyof ActivityHrZonesRow }[] = [
    { zone: 1, key: "zone1_seconds" },
    { zone: 2, key: "zone2_seconds" },
    { zone: 3, key: "zone3_seconds" },
    { zone: 4, key: "zone4_seconds" },
    { zone: 5, key: "zone5_seconds" },
  ];
  return cols
    .map(({ zone, key }) => ({ zone, seconds: Number(row[key]) }))
    .filter((z) => Number.isFinite(z.seconds) && z.seconds > 0);
};

/**
 * Exercise-set parsing — STOPGAP. The typed columns `exercise_name` and
 * `exercise_category` on `activity_exercise_sets` are NULL on every row; the
 * real data lives in `raw_json` (`{ exercises: [{category}], setType, ... }`).
 * Promote these fields to typed columns in garmin-givemydata upstream and
 * delete this section. See README "Follow-ups".
 */

export type SetType = "ACTIVE" | "REST" | "OTHER";

export interface ParsedExerciseSet {
  setNumber: number;
  setType: SetType;
  /** Garmin's specific exercise name (e.g. BARBELL_BENCH_PRESS), not category. */
  name: string | null;
  reps: number | null;
  /** Garmin stores strength weight in grams. */
  weightGrams: number | null;
  durationSeconds: number | null;
  startTime: string | null;
}

interface RawExerciseSet {
  duration?: number | null;
  exercises?: { category?: string | null; name?: string | null }[];
  repetitionCount?: number | null;
  setType?: string | null;
  startTime?: string | null;
  weight?: number | null;
}

const tryParse = <T>(raw: string | null): Partial<T> => {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Partial<T>;
  } catch {
    return {};
  }
};

const asSetType = (s: string | null | undefined): SetType =>
  s === "ACTIVE" || s === "REST" ? s : "OTHER";

export const parseExerciseSet = (row: ActivityExerciseSet): ParsedExerciseSet => {
  const raw = tryParse<RawExerciseSet>(row.raw_json);
  const firstExercise = raw.exercises?.[0] ?? null;
  return {
    setNumber: row.set_number,
    setType: asSetType(raw.setType),
    // Prefer the specific exercise name; fall back to category, which Garmin
    // always populates (name is often null). Keeps exercises from vanishing.
    name:
      row.exercise_name ??
      firstExercise?.name ??
      row.exercise_category ??
      firstExercise?.category ??
      null,
    reps: row.reps ?? raw.repetitionCount ?? null,
    weightGrams: row.weight ?? raw.weight ?? null,
    durationSeconds: row.duration_seconds ?? raw.duration ?? null,
    startTime: raw.startTime ?? null,
  };
};

export interface ExerciseGroup {
  name: string;
  sets: ParsedExerciseSet[];
}

/**
 * Split a workout's total time into work vs rest by summing set durations by
 * type. More accurate for strength than the activity-level moving/elapsed
 * columns, since rest between sets is logged explicitly.
 */
export const setDurationsByType = (
  rows: ActivityExerciseSet[],
): { workSeconds: number; restSeconds: number } => {
  let workSeconds = 0;
  let restSeconds = 0;
  for (const set of rows.map(parseExerciseSet)) {
    const d = set.durationSeconds;
    if (d == null || !Number.isFinite(d) || d <= 0) continue;
    if (set.setType === "ACTIVE") workSeconds += d;
    else if (set.setType === "REST") restSeconds += d;
  }
  return { workSeconds, restSeconds };
};

/**
 * Group ACTIVE sets by exercise name in workout order. REST sets are dropped
 * from the grouped view but available via `parseExerciseSet` if a future view
 * wants to show rest time.
 */
export const groupExerciseSets = (rows: ActivityExerciseSet[]): ExerciseGroup[] => {
  const parsed = rows.map(parseExerciseSet);
  const groups: ExerciseGroup[] = [];
  for (const set of parsed) {
    if (set.setType !== "ACTIVE" || !set.name) continue;
    const last = groups[groups.length - 1];
    if (last && last.name === set.name) {
      last.sets.push(set);
    } else {
      groups.push({ name: set.name, sets: [set] });
    }
  }
  return groups;
};

/** All-time bests for one exercise, derived from logged sets. */
export interface ExerciseRecord {
  /** Heaviest single set. */
  maxWeightGrams: number | null;
  /** Most reps in a single set. */
  maxReps: number | null;
  /** Best estimated 1-rep max (Epley: weight × (1 + reps/30)). */
  bestEst1RmGrams: number | null;
  /** Best single-session volume = Σ(reps × weight) within one workout. */
  bestSessionVolumeGrams: number | null;
}

/** A single set, reduced to what the Exercises views render. */
export interface RecentSet {
  reps: number | null;
  weightGrams: number | null;
}

export interface ExerciseSummary {
  name: string;
  lastDate: string | null;
  lastActivityId: number | null;
  /** Sets from the most recent session this exercise appeared in. */
  recentSets: RecentSet[];
  /** How many separate workouts included this exercise. */
  totalSessions: number;
  record: ExerciseRecord;
}

const max = (a: number | null, b: number | null): number | null => {
  if (a == null) return b;
  if (b == null) return a;
  return Math.max(a, b);
};

/**
 * Aggregate every logged ACTIVE set into a per-exercise summary: last-performed
 * date, the most recent session's sets, and all-time derived records. Rows come
 * pre-extracted/filtered from `/api/exercise-sets` (exercise name + grams
 * weight); see [[schema-translation-boundary]] for why this read happens
 * server-side.
 */
export const aggregateExercises = (rows: ExerciseSetAgg[]): ExerciseSummary[] => {
  const byName = new Map<string, ExerciseSetAgg[]>();
  for (const row of rows) {
    if (!row.name) continue;
    const list = byName.get(row.name) ?? [];
    list.push(row);
    byName.set(row.name, list);
  }

  const summaries: ExerciseSummary[] = [];
  for (const [name, sets] of byName) {
    // Group sets into sessions (by activity) to find the latest and best volume.
    const sessions = new Map<number, ExerciseSetAgg[]>();
    for (const row of sets) {
      const list = sessions.get(row.activity_id) ?? [];
      list.push(row);
      sessions.set(row.activity_id, list);
    }

    let latest: { activityId: number; date: string } | null = null;
    let bestSessionVolumeGrams: number | null = null;
    for (const [activityId, sessionSets] of sessions) {
      const date = sessionSets[0]!.start_time_local;
      if (!latest || date > latest.date) latest = { activityId, date };
      let volume = 0;
      let hasVolume = false;
      for (const row of sessionSets) {
        if (row.reps != null && row.weight != null && row.weight > 0) {
          volume += row.reps * row.weight;
          hasVolume = true;
        }
      }
      if (hasVolume) bestSessionVolumeGrams = max(bestSessionVolumeGrams, volume);
    }

    let maxWeightGrams: number | null = null;
    let maxReps: number | null = null;
    let bestEst1RmGrams: number | null = null;
    for (const row of sets) {
      if (row.weight != null && row.weight > 0) {
        maxWeightGrams = max(maxWeightGrams, row.weight);
        if (row.reps != null && row.reps > 0) {
          bestEst1RmGrams = max(bestEst1RmGrams, row.weight * (1 + row.reps / 30));
        }
      }
      if (row.reps != null) maxReps = max(maxReps, row.reps);
    }

    summaries.push({
      name,
      lastDate: latest?.date ?? null,
      lastActivityId: latest?.activityId ?? null,
      recentSets: latest
        ? sessions
            .get(latest.activityId)!
            .map((row) => ({ reps: row.reps, weightGrams: row.weight }))
        : [],
      totalSessions: sessions.size,
      record: { maxWeightGrams, maxReps, bestEst1RmGrams, bestSessionVolumeGrams },
    });
  }

  summaries.sort((a, b) => (b.lastDate ?? "").localeCompare(a.lastDate ?? ""));
  return summaries;
};
