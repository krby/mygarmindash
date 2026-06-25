import { describe, it, expect } from "vitest";
import {
  paceSecPerMile,
  hrZonesAsArray,
  parseExerciseSet,
  groupExerciseSets,
  setDurationsByType,
  aggregateExercises,
  exerciseDetail,
  bodyPartFor,
} from "../src/lib/garmin";
import { METERS_PER_MILE } from "../src/lib/format";
import type {
  ActivityExerciseSet,
  ActivityHrZonesRow,
  ExerciseSetAgg,
} from "../src/api/types";

describe("paceSecPerMile", () => {
  it("converts m/s to seconds per mile", () => {
    // 1609.344 m/mile ÷ 4 m/s ≈ 402.3 s/mile
    expect(paceSecPerMile(4)).toBeCloseTo(METERS_PER_MILE / 4);
  });

  it("returns null for non-positive or missing speed", () => {
    expect(paceSecPerMile(0)).toBeNull();
    expect(paceSecPerMile(-1)).toBeNull();
    expect(paceSecPerMile(null)).toBeNull();
    expect(paceSecPerMile(undefined)).toBeNull();
  });
});

describe("hrZonesAsArray", () => {
  const row = (over: Partial<ActivityHrZonesRow>): ActivityHrZonesRow => ({
    activity_id: 1,
    zone1_seconds: null,
    zone2_seconds: null,
    zone3_seconds: null,
    zone4_seconds: null,
    zone5_seconds: null,
    raw_json: null,
    ...over,
  });

  it("reshapes the wide row into ordered zone entries, dropping empties", () => {
    const out = hrZonesAsArray(row({ zone1_seconds: 100, zone3_seconds: 300, zone5_seconds: 50 }));
    expect(out).toEqual([
      { zone: 1, seconds: 100 },
      { zone: 3, seconds: 300 },
      { zone: 5, seconds: 50 },
    ]);
  });

  it("drops zero and null zones", () => {
    expect(hrZonesAsArray(row({ zone2_seconds: 0 }))).toEqual([]);
  });

  it("returns [] for a null row", () => {
    expect(hrZonesAsArray(null)).toEqual([]);
  });
});

describe("parseExerciseSet (raw_json stopgap)", () => {
  const base = (over: Partial<ActivityExerciseSet>): ActivityExerciseSet => ({
    activity_id: 1,
    set_number: 1,
    exercise_name: null,
    exercise_category: null,
    reps: null,
    weight: null,
    duration_seconds: null,
    raw_json: null,
    ...over,
  });

  it("falls back to raw_json when typed columns are null", () => {
    const set = parseExerciseSet(
      base({
        set_number: 2,
        raw_json: JSON.stringify({
          setType: "ACTIVE",
          repetitionCount: 10,
          weight: 20000,
          duration: 45,
          startTime: "2024-01-01T10:00:00",
          exercises: [{ name: "SHOULDER_PRESS" }],
        }),
      }),
    );
    expect(set).toEqual({
      setNumber: 2,
      setType: "ACTIVE",
      name: "SHOULDER_PRESS",
      reps: 10,
      weightGrams: 20000,
      durationSeconds: 45,
      startTime: "2024-01-01T10:00:00",
    });
  });

  it("prefers typed columns over raw_json when present", () => {
    const set = parseExerciseSet(
      base({
        exercise_name: "CURL",
        reps: 8,
        weight: 15000,
        duration_seconds: 30,
        raw_json: JSON.stringify({ exercises: [{ name: "ROW" }], repetitionCount: 99 }),
      }),
    );
    expect(set.name).toBe("CURL");
    expect(set.reps).toBe(8);
    expect(set.weightGrams).toBe(15000);
    expect(set.durationSeconds).toBe(30);
  });

  it("survives malformed JSON with safe defaults", () => {
    const set = parseExerciseSet(base({ raw_json: "{not valid json" }));
    expect(set.setType).toBe("OTHER");
    expect(set.name).toBeNull();
    expect(set.reps).toBeNull();
  });

  it("maps unknown setType to OTHER", () => {
    const set = parseExerciseSet(base({ raw_json: JSON.stringify({ setType: "WARMUP" }) }));
    expect(set.setType).toBe("OTHER");
  });
});

describe("groupExerciseSets", () => {
  const set = (n: number, raw: object): ActivityExerciseSet => ({
    activity_id: 1,
    set_number: n,
    exercise_name: null,
    exercise_category: null,
    reps: null,
    weight: null,
    duration_seconds: null,
    raw_json: JSON.stringify(raw),
  });

  it("groups consecutive ACTIVE sets by name and drops REST", () => {
    const groups = groupExerciseSets([
      set(1, { setType: "ACTIVE", exercises: [{ name: "CURL" }] }),
      set(2, { setType: "ACTIVE", exercises: [{ name: "CURL" }] }),
      set(3, { setType: "REST" }),
      set(4, { setType: "ACTIVE", exercises: [{ name: "ROW" }] }),
    ]);
    expect(groups.map((g) => g.name)).toEqual(["CURL", "ROW"]);
    expect(groups[0]!.sets).toHaveLength(2);
    expect(groups[1]!.sets).toHaveLength(1);
  });

  it("starts a new group when the same name recurs non-consecutively", () => {
    const groups = groupExerciseSets([
      set(1, { setType: "ACTIVE", exercises: [{ name: "CURL" }] }),
      set(2, { setType: "ACTIVE", exercises: [{ name: "ROW" }] }),
      set(3, { setType: "ACTIVE", exercises: [{ name: "CURL" }] }),
    ]);
    expect(groups.map((g) => g.name)).toEqual(["CURL", "ROW", "CURL"]);
  });

  it("returns [] when there are no ACTIVE sets with a name", () => {
    expect(groupExerciseSets([set(1, { setType: "REST" })])).toEqual([]);
  });
});

describe("setDurationsByType", () => {
  const set = (n: number, raw: object): ActivityExerciseSet => ({
    activity_id: 1,
    set_number: n,
    exercise_name: null,
    exercise_category: null,
    reps: null,
    weight: null,
    duration_seconds: null,
    raw_json: JSON.stringify(raw),
  });

  it("sums ACTIVE durations into work and REST durations into rest", () => {
    const out = setDurationsByType([
      set(1, { setType: "ACTIVE", duration: 40 }),
      set(2, { setType: "REST", duration: 90 }),
      set(3, { setType: "ACTIVE", duration: 35 }),
      set(4, { setType: "WARMUP", duration: 999 }),
    ]);
    expect(out).toEqual({ workSeconds: 75, restSeconds: 90 });
  });

  it("ignores missing/non-positive durations", () => {
    expect(setDurationsByType([set(1, { setType: "ACTIVE" })])).toEqual({
      workSeconds: 0,
      restSeconds: 0,
    });
  });
});

describe("aggregateExercises", () => {
  const s = (over: Partial<ExerciseSetAgg>): ExerciseSetAgg => ({
    activity_id: 1,
    set_number: 1,
    start_time_local: "2024-01-01T10:00:00",
    name: null,
    reps: null,
    weight: null,
    ...over,
  });

  it("groups across activities and derives last date, sessions, and records", () => {
    const out = aggregateExercises([
      // newest session (activity 2) — two sets
      s({ activity_id: 2, set_number: 1, start_time_local: "2024-02-01T10:00:00", name: "BENCH", reps: 5, weight: 50000 }),
      s({ activity_id: 2, set_number: 2, start_time_local: "2024-02-01T10:05:00", name: "BENCH", reps: 8, weight: 40000 }),
      // older session (activity 1)
      s({ activity_id: 1, set_number: 1, start_time_local: "2024-01-01T10:00:00", name: "BENCH", reps: 10, weight: 30000 }),
    ]);

    expect(out).toHaveLength(1);
    const bench = out[0]!;
    expect(bench.name).toBe("BENCH");
    expect(bench.bodyPart).toBe("Chest");
    expect(bench.lastDate).toBe("2024-02-01T10:00:00");
    expect(bench.lastActivityId).toBe(2);
    expect(bench.totalSessions).toBe(2);
    // recentSessions are newest-first, each carrying that workout's sets.
    expect(bench.recentSessions).toEqual([
      {
        activityId: 2,
        date: "2024-02-01T10:00:00",
        sets: [
          { reps: 5, weightGrams: 50000 },
          { reps: 8, weightGrams: 40000 },
        ],
      },
      {
        activityId: 1,
        date: "2024-01-01T10:00:00",
        sets: [{ reps: 10, weightGrams: 30000 }],
      },
    ]);
    expect(bench.record.maxWeightGrams).toBe(50000);
    expect(bench.record.maxReps).toBe(10);
    // Epley: 50000*(1+5/30) ≈ 58333 beats 40000*(1+8/30) ≈ 50667 and 30000*(1+10/30)=40000
    expect(Math.round(bench.record.bestEst1RmGrams!)).toBe(58333);
    // best session volume: activity 2 = 5*50000 + 8*40000 = 570000; activity 1 = 10*30000 = 300000
    expect(bench.record.bestSessionVolumeGrams).toBe(570000);
  });

  it("sorts exercises by most-recent first and skips rows without a name", () => {
    const out = aggregateExercises([
      s({ activity_id: 1, start_time_local: "2024-01-01T10:00:00", name: "OLD" }),
      s({ activity_id: 2, start_time_local: "2024-03-01T10:00:00", name: "NEW" }),
      s({ activity_id: 2, start_time_local: "2024-03-01T10:00:00", name: null }),
    ]);
    expect(out.map((e) => e.name)).toEqual(["NEW", "OLD"]);
  });

  it("caps recentSessions at the 3 newest workouts but counts all sessions", () => {
    const rows = [1, 2, 3, 4, 5].map((id) =>
      s({
        activity_id: id,
        start_time_local: `2024-0${id}-01T10:00:00`,
        name: "SQUAT",
        reps: 5,
        weight: 60000,
      }),
    );
    const squat = aggregateExercises(rows)[0]!;
    expect(squat.totalSessions).toBe(5);
    expect(squat.recentSessions).toHaveLength(3);
    expect(squat.recentSessions.map((sess) => sess.activityId)).toEqual([5, 4, 3]);
  });
});

describe("exerciseDetail", () => {
  const s = (over: Partial<ExerciseSetAgg>): ExerciseSetAgg => ({
    activity_id: 1,
    set_number: 1,
    start_time_local: "2024-01-01T10:00:00",
    name: null,
    reps: null,
    weight: null,
    ...over,
  });

  it("returns every session (uncapped) newest-first with records for one name", () => {
    const rows = [1, 2, 3, 4, 5].map((id) =>
      s({
        activity_id: id,
        start_time_local: `2024-0${id}-01T10:00:00`,
        name: "SQUAT",
        reps: 5,
        weight: 60000,
      }),
    );
    // Another exercise that must be excluded from the SQUAT detail.
    rows.push(s({ activity_id: 9, name: "BENCH", reps: 3, weight: 80000 }));

    const detail = exerciseDetail(rows, "SQUAT")!;
    expect(detail.name).toBe("SQUAT");
    expect(detail.bodyPart).toBe("Legs");
    expect(detail.totalSessions).toBe(5);
    expect(detail.sessions).toHaveLength(5);
    expect(detail.sessions.map((sess) => sess.activityId)).toEqual([5, 4, 3, 2, 1]);
    expect(detail.lastDate).toBe("2024-05-01T10:00:00");
    expect(detail.record.maxWeightGrams).toBe(60000);
  });

  it("returns null for an unknown exercise name", () => {
    expect(exerciseDetail([s({ name: "SQUAT" })], "DEADLIFT")).toBeNull();
  });
});

describe("bodyPartFor", () => {
  it("classifies exercises by keyword, first match wins", () => {
    expect(bodyPartFor("BARBELL_BENCH_PRESS")).toBe("Chest");
    expect(bodyPartFor("LAT_PULLDOWN")).toBe("Back");
    expect(bodyPartFor("ROMANIAN_DEADLIFT")).toBe("Back");
    expect(bodyPartFor("DUMBBELL_SHOULDER_PRESS")).toBe("Shoulders");
    expect(bodyPartFor("BARBELL_BACK_SQUAT")).toBe("Legs");
    expect(bodyPartFor("LEG_CURL")).toBe("Legs");
    expect(bodyPartFor("HANGING_LEG_RAISE")).toBe("Core");
    expect(bodyPartFor("BICEPS_CURL")).toBe("Arms");
    expect(bodyPartFor("TRICEPS_EXTENSION")).toBe("Arms");
    expect(bodyPartFor("RUNNING")).toBe("Cardio");
    expect(bodyPartFor("SOME_RANDOM_MOVE")).toBe("Other");
    expect(bodyPartFor(null)).toBe("Other");
  });

  it("normalizes separators so spaced/hyphenated labels match too", () => {
    // BACK_EXTENSION (Back) must win over the generic EXTENSION (Arms) rule
    // even when the label uses spaces instead of underscores.
    expect(bodyPartFor("weighted ghd back extensions")).toBe("Back");
    expect(bodyPartFor("Lat-Pulldown")).toBe("Back");
  });
});
