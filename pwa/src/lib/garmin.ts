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

/** One workout's worth of an exercise's sets, for the expanded history view. */
export interface ExerciseSession {
  activityId: number;
  date: string;
  sets: RecentSet[];
}

/** How many recent sessions the expanded Exercises view shows. */
export const RECENT_SESSIONS = 3;

/**
 * Coarse muscle-group buckets for the Exercises body-part filter.
 *
 * STOPGAP — like the raw_json parsing above, this is keyword heuristics over
 * Garmin's exercise label (the specific name, or the category when name is
 * null), not a real taxonomy. Garmin has no body-part field; the long-term fix
 * is a promoted `exercise_category` column upstream (see README "Follow-ups").
 * Rules are tried in order, first match wins, so more-specific groups precede
 * the catch-alls (e.g. LEG_RAISE → Core before the generic LEG → Legs rule).
 */
export const BODY_PARTS = [
  "Chest",
  "Back",
  "Shoulders",
  "Core",
  "Legs",
  "Arms",
  "Cardio",
  "Other",
] as const;

export type BodyPart = (typeof BODY_PARTS)[number];

const BODY_PART_RULES: { part: Exclude<BodyPart, "Other">; keywords: string[] }[] = [
  { part: "Chest", keywords: ["BENCH", "CHEST", "FLYE", "PEC", "PUSH_UP", "PUSHUP", "DIP"] },
  { part: "Back", keywords: ["PULL_UP", "PULLUP", "CHIN_UP", "PULLDOWN", "PULL_DOWN", "LAT_PULL", "ROW", "DEADLIFT", "SHRUG", "HYPEREXTENSION", "BACK_EXTENSION", "FACE_PULL", "PULL"] },
  { part: "Shoulders", keywords: ["SHOULDER", "OVERHEAD_PRESS", "MILITARY", "LATERAL_RAISE", "FRONT_RAISE", "DELT", "ARNOLD"] },
  { part: "Core", keywords: ["CORE", "CRUNCH", "PLANK", "SIT_UP", "SITUP", "OBLIQUE", "RUSSIAN_TWIST", "ABDOMINAL", "LEG_RAISE", "KNEE_RAISE", "HANGING", "FLUTTER", "MOUNTAIN_CLIMBER", "BICYCLE"] },
  { part: "Legs", keywords: ["SQUAT", "LUNGE", "LEG", "CALF", "GLUTE", "HIP", "HAMSTRING", "QUAD", "STEP_UP", "ABDUCTION", "ADDUCTION", "THRUST"] },
  { part: "Arms", keywords: ["CURL", "TRICEP", "BICEP", "FOREARM", "EXTENSION", "SKULL_CRUSHER", "PUSHDOWN", "PRESSDOWN"] },
  { part: "Cardio", keywords: ["CARDIO", "RUN", "BIKE", "ELLIPTICAL", "PLYO", "BURPEE", "JUMP", "SKI_ERG", "BATTLE_ROPE"] },
];

/** Classify a Garmin exercise label (name or category) into a body part. */
export const bodyPartFor = (label: string | null | undefined): BodyPart => {
  if (!label) return "Other";
  // Normalize any separator (space, hyphen) to "_" so keywords like
  // BACK_EXTENSION match regardless of how the label is punctuated.
  const key = label.toUpperCase().replace(/[^A-Z0-9]+/g, "_");
  for (const { part, keywords } of BODY_PART_RULES) {
    if (keywords.some((k) => key.includes(k))) return part;
  }
  return "Other";
};

export interface ExerciseSummary {
  name: string;
  /** Coarse muscle group for the body-part filter; "Other" when unclassified. */
  bodyPart: BodyPart;
  lastDate: string | null;
  lastActivityId: number | null;
  /** The most recent sessions (newest first), capped at RECENT_SESSIONS. */
  recentSessions: ExerciseSession[];
  /** How many separate workouts included this exercise. */
  totalSessions: number;
  record: ExerciseRecord;
}

const max = (a: number | null, b: number | null): number | null => {
  if (a == null) return b;
  if (b == null) return a;
  return Math.max(a, b);
};

/** Group ACTIVE-set rows by exercise name, dropping rows without a name. */
const byExerciseName = (rows: ExerciseSetAgg[]): Map<string, ExerciseSetAgg[]> => {
  const byName = new Map<string, ExerciseSetAgg[]>();
  for (const row of rows) {
    if (!row.name) continue;
    const list = byName.get(row.name) ?? [];
    list.push(row);
    byName.set(row.name, list);
  }
  return byName;
};

interface ExerciseAggregate {
  /** Every session this exercise appeared in, newest first. */
  sessions: ExerciseSession[];
  totalSessions: number;
  record: ExerciseRecord;
}

/**
 * Reduce one exercise's sets to its full session history (newest first) plus
 * all-time derived records. The list summary caps the sessions to the most
 * recent few; the detail page paginates them. Shared so both views agree.
 */
const aggregateOne = (sets: ExerciseSetAgg[]): ExerciseAggregate => {
  // Group sets into sessions (by activity) for per-session sets and volume.
  const sessions = new Map<number, ExerciseSetAgg[]>();
  for (const row of sets) {
    const list = sessions.get(row.activity_id) ?? [];
    list.push(row);
    sessions.set(row.activity_id, list);
  }

  let bestSessionVolumeGrams: number | null = null;
  const sessionList: ExerciseSession[] = [];
  for (const [activityId, sessionSets] of sessions) {
    sessionList.push({
      activityId,
      date: sessionSets[0]!.start_time_local,
      sets: sessionSets.map((row) => ({ reps: row.reps, weightGrams: row.weight })),
    });
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
  sessionList.sort((a, b) => b.date.localeCompare(a.date));

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

  return {
    sessions: sessionList,
    totalSessions: sessions.size,
    record: { maxWeightGrams, maxReps, bestEst1RmGrams, bestSessionVolumeGrams },
  };
};

/**
 * Aggregate every logged ACTIVE set into a per-exercise summary: last-performed
 * date, the most recent sessions' sets, and all-time derived records. Rows come
 * pre-extracted/filtered from `/api/exercise-sets` (exercise name + grams
 * weight); see [[schema-translation-boundary]] for why this read happens
 * server-side.
 */
export const aggregateExercises = (rows: ExerciseSetAgg[]): ExerciseSummary[] => {
  const summaries: ExerciseSummary[] = [];
  for (const [name, sets] of byExerciseName(rows)) {
    const { sessions, totalSessions, record } = aggregateOne(sets);
    summaries.push({
      name,
      bodyPart: bodyPartFor(name),
      lastDate: sessions[0]?.date ?? null,
      lastActivityId: sessions[0]?.activityId ?? null,
      recentSessions: sessions.slice(0, RECENT_SESSIONS),
      totalSessions,
      record,
    });
  }

  summaries.sort((a, b) => (b.lastDate ?? "").localeCompare(a.lastDate ?? ""));
  return summaries;
};

/** Records plus the *full* session history for one exercise's detail page. */
export interface ExerciseDetail {
  name: string;
  bodyPart: BodyPart;
  lastDate: string | null;
  totalSessions: number;
  record: ExerciseRecord;
  /** Every session, newest first. Paginate on render. */
  sessions: ExerciseSession[];
}

/**
 * Build the detail view for a single exercise from the already-cached
 * `/api/exercise-sets` payload — no extra fetch. Returns null when the exercise
 * has no logged sets (e.g. an unknown name in the URL).
 */
export const exerciseDetail = (
  rows: ExerciseSetAgg[],
  name: string,
): ExerciseDetail | null => {
  const sets = rows.filter((r) => r.name === name);
  if (sets.length === 0) return null;
  const { sessions, totalSessions, record } = aggregateOne(sets);
  return {
    name,
    bodyPart: bodyPartFor(name),
    lastDate: sessions[0]?.date ?? null,
    totalSessions,
    record,
    sessions,
  };
};
